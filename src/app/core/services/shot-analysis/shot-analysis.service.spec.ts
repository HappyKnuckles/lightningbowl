import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { TOAST_MESSAGES } from 'src/app/core/constants/toast-messages.constants';
import { ShotCalibration } from 'src/app/core/models/shot-analysis.model';

import { ShotAnalysisService } from './shot-analysis.service';

const CALIBRATION: ShotCalibration = {
  foulLeft: [0.43, 0.54],
  foulRight: [0.69, 0.54],
  farLeft: [0.64, 0.46],
  farRight: [0.7, 0.46],
  farDistanceFt: 60,
  frameTimeS: 0.2,
};

describe('ShotAnalysisService', () => {
  let service: ShotAnalysisService;

  beforeEach(() => {
    service = TestBed.inject(ShotAnalysisService);
  });

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
