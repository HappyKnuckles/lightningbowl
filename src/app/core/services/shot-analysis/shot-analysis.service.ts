import { Injectable } from '@angular/core';

import { TOAST_MESSAGES } from 'src/app/core/constants/toast-messages.constants';
import { ShotAnalysisResult, ShotCalibration } from 'src/app/core/models/shot-analysis.model';
import { OnDeviceOptions, trackOnDevice, TrackingError } from 'src/app/core/utils/shot-tracker/pipeline.utils';

/** Analyzes a recorded shot on this device: the ball tracker runs in the browser, nothing is uploaded. */
@Injectable({ providedIn: 'root' })
export class ShotAnalysisService {
  /**
   * Tracks the ball on this device, the same way the ball tracker service does. Rejects with an `Error`
   * whose message is a toast message, or with the signal's reason when `options.signal` aborts.
   */
  async analyzeOnDevice(video: Blob, calibration: ShotCalibration, options: OnDeviceOptions): Promise<ShotAnalysisResult> {
    try {
      return (await trackOnDevice(video, calibration, options)).result;
    } catch (error) {
      if (options.signal?.aborted) {
        throw error;
      }
      console.error('On-device shot analysis failed:', error);
      throw new Error(error instanceof TrackingError ? TOAST_MESSAGES.shotAnalysisNoPath : TOAST_MESSAGES.shotAnalysisError);
    }
  }
}
