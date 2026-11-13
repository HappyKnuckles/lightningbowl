import { HttpErrorResponse, HttpEventType } from '@angular/common/http';
import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { TOAST_MESSAGES } from 'src/app/core/constants/toast-messages.constants';
import { ShotAnalysisEvent, ShotAnalysisResult, ShotCalibration } from 'src/app/core/models/shot-analysis.model';
import { environment } from 'src/environments/environment';

import { shotAnalysisErrorMessage, ShotAnalysisService } from './shot-analysis.service';

const URL = `${environment.trackerEndpoint}v1/track`;

const CALIBRATION: ShotCalibration = {
  foulLeft: [0.43, 0.54],
  foulRight: [0.69, 0.54],
  farLeft: [0.64, 0.46],
  farRight: [0.7, 0.46],
  farDistanceFt: 60,
  frameTimeS: 0.2,
};

const RESULT: ShotAnalysisResult = {
  handedness: 'right',
  fps: 60,
  framesProcessed: 300,
  trackedFromFt: 2,
  trackedToFt: 60,
  points: [],
  curve: [{ distanceFt: 2, board: 20 }],
  metrics: { speedMph: 16.7, entryBoardExtrapolated: false },
};

describe('ShotAnalysisService', () => {
  let service: ShotAnalysisService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ShotAnalysisService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('posts the video, calibration and options as multipart form data', () => {
    const video = new Blob(['video'], { type: 'video/mp4' });
    service.analyze(video, 'shot.mp4', CALIBRATION, { handedness: 'left' }).subscribe();

    const req = httpMock.expectOne(URL);
    expect(req.request.method).toBe('POST');
    const body = req.request.body as FormData;
    expect((body.get('video') as File).name).toBe('shot.mp4');
    expect(JSON.parse(body.get('calibration') as string)).toEqual(CALIBRATION);
    expect(JSON.parse(body.get('options') as string)).toEqual({ handedness: 'left' });
    req.flush(RESULT);
  });

  it("sends the tracker's API key", () => {
    const original = environment.trackerApiKey;
    environment.trackerApiKey = 'secret';
    try {
      service.analyze(new Blob(['video']), 'shot.mp4', CALIBRATION, { handedness: 'right' }).subscribe();

      const req = httpMock.expectOne(URL);
      expect(req.request.headers.get('X-API-Key')).toBe('secret');
      req.flush(RESULT);
    } finally {
      environment.trackerApiKey = original;
    }
  });

  it('reports upload progress, then processing, then the result', () => {
    const events: ShotAnalysisEvent[] = [];
    service.analyze(new Blob(), 'shot.mov', CALIBRATION, { handedness: 'right' }).subscribe((event) => events.push(event));

    const req = httpMock.expectOne(URL);
    req.event({ type: HttpEventType.UploadProgress, loaded: 25, total: 100 });
    req.event({ type: HttpEventType.UploadProgress, loaded: 100, total: 100 });
    req.flush(RESULT);

    expect(events).toEqual([
      { type: 'uploading', progress: 0 },
      { type: 'uploading', progress: 0.25 },
      { type: 'processing' },
      { type: 'done', result: RESULT },
    ]);
  });

  it('fails with the toast message for "no ball path found"', () => {
    let message = '';
    service.analyze(new Blob(), 'shot.mov', CALIBRATION, { handedness: 'right' }).subscribe({ error: (e: Error) => (message = e.message) });

    httpMock.expectOne(URL).flush({ detail: 'no ball path found' }, { status: 422, statusText: 'Unprocessable Entity' });

    expect(message).toBe(TOAST_MESSAGES.shotAnalysisNoPath);
  });

  describe('analyzeOnDevice', () => {
    it('stops with the reason when cancelled', async () => {
      const abort = new AbortController();
      abort.abort();

      await expect(service.analyzeOnDevice(new Blob(['x']), CALIBRATION, { handedness: 'right', signal: abort.signal })).rejects.toBe(
        abort.signal.reason,
      );
    });

    it('fails with a toast message when the video cannot be read', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined);

      await expect(service.analyzeOnDevice(new Blob(['not a video']), CALIBRATION, { handedness: 'right' })).rejects.toThrow(
        TOAST_MESSAGES.shotAnalysisError,
      );
    }, 60_000);
  });

  describe('shotAnalysisErrorMessage', () => {
    const http = (status: number, error: unknown = null) => new HttpErrorResponse({ status, error });

    it('maps each failure to its message', () => {
      expect(shotAnalysisErrorMessage(http(0))).toBe(TOAST_MESSAGES.shotAnalysisOffline);
      expect(shotAnalysisErrorMessage(http(400))).toBe(TOAST_MESSAGES.shotAnalysisUnreadableVideo);
      expect(shotAnalysisErrorMessage(http(413))).toBe(TOAST_MESSAGES.shotAnalysisVideoTooLarge);
      expect(shotAnalysisErrorMessage(http(422, { detail: [{ loc: ['calibration'] }] }))).toBe(TOAST_MESSAGES.shotAnalysisError);
      expect(shotAnalysisErrorMessage(http(500))).toBe(TOAST_MESSAGES.shotAnalysisError);
      expect(shotAnalysisErrorMessage(new Error('boom'))).toBe(TOAST_MESSAGES.shotAnalysisError);
    });
  });
});
