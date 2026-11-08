import { HttpClient, HttpErrorResponse, HttpEvent, HttpEventType, HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, filter, map, Observable, throwError } from 'rxjs';

import { TOAST_MESSAGES } from 'src/app/core/constants/toast-messages.constants';
import { ShotAnalysisEvent, ShotAnalysisOptions, ShotAnalysisResult, ShotCalibration } from 'src/app/core/models/shot-analysis.model';
import { environment } from 'src/environments/environment';

/** Matches the tracker's default `MAX_UPLOAD_MB`. */
export const MAX_SHOT_VIDEO_BYTES = 150 * 1024 * 1024;

/** Maps a failed request to the toast message for it. */
export function shotAnalysisErrorMessage(error: unknown): string {
  if (!(error instanceof HttpErrorResponse)) {
    return TOAST_MESSAGES.shotAnalysisError;
  }
  switch (error.status) {
    case 0:
      return TOAST_MESSAGES.shotAnalysisOffline;
    case 400:
      return TOAST_MESSAGES.shotAnalysisUnreadableVideo;
    case 413:
      return TOAST_MESSAGES.shotAnalysisVideoTooLarge;
    case 422:
      // 422 with a plain message means the video was read but no ball path was found; a list means bad input
      return typeof error.error?.detail === 'string' ? TOAST_MESSAGES.shotAnalysisNoPath : TOAST_MESSAGES.shotAnalysisError;
    default:
      return TOAST_MESSAGES.shotAnalysisError;
  }
}

/** Sends a recorded shot to the ball tracker (BallTracker repo) and reports upload progress. */
@Injectable({ providedIn: 'root' })
export class ShotAnalysisService {
  readonly #http = inject(HttpClient);

  /** Errors with an `Error` whose message is a toast message (see `shotAnalysisErrorMessage`). */
  analyze(video: Blob, fileName: string, calibration: ShotCalibration, options: ShotAnalysisOptions): Observable<ShotAnalysisEvent> {
    const body = new FormData();
    body.append('video', video, fileName);
    body.append('calibration', JSON.stringify(calibration));
    body.append('options', JSON.stringify(options));

    const headers = environment.trackerApiKey ? new HttpHeaders({ 'X-API-Key': environment.trackerApiKey }) : undefined;

    return this.#http
      .post<ShotAnalysisResult>(`${environment.trackerEndpoint}v1/track`, body, { headers, reportProgress: true, observe: 'events' })
      .pipe(
        map((event) => toAnalysisEvent(event)),
        filter((event): event is ShotAnalysisEvent => event !== null),
        catchError((error: unknown) => throwError(() => new Error(shotAnalysisErrorMessage(error)))),
      );
  }
}

function toAnalysisEvent(event: HttpEvent<ShotAnalysisResult>): ShotAnalysisEvent | null {
  switch (event.type) {
    case HttpEventType.Sent:
      return { type: 'uploading', progress: 0 };
    case HttpEventType.UploadProgress: {
      if (!event.total) {
        return { type: 'uploading', progress: 0 };
      }
      // once the last byte is sent the server is decoding and tracking; that is most of the wait
      return event.loaded >= event.total ? { type: 'processing' } : { type: 'uploading', progress: event.loaded / event.total };
    }
    case HttpEventType.Response:
      return event.body ? { type: 'done', result: event.body } : null;
    default:
      return null;
  }
}
