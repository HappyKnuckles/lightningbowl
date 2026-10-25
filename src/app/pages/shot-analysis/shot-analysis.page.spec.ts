import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { vi } from 'vitest';
import { TOAST_MESSAGES } from 'src/app/core/constants/toast-messages.constants';
import { NormalizedPoint, ShotAnalysisEvent, ShotAnalysisResult } from 'src/app/core/models/shot-analysis.model';
import { MAX_SHOT_VIDEO_BYTES, ShotAnalysisService } from 'src/app/core/services/shot-analysis/shot-analysis.service';
import { ToastService } from 'src/app/core/services/toast/toast.service';
import { ShotAnalysisPage } from './shot-analysis.page';

const CORNERS: NormalizedPoint[] = [
  [0.43, 0.54],
  [0.69, 0.54],
  [0.64, 0.46],
  [0.7, 0.46],
];

const RESULT: ShotAnalysisResult = {
  handedness: 'right',
  fps: 60,
  framesProcessed: 300,
  trackedFromFt: 2.2,
  trackedToFt: 60.4,
  points: [],
  curve: [
    { distanceFt: 3, board: 20 },
    { distanceFt: 60, board: 17.5 },
  ],
  metrics: { speedMph: 16.7, revRateRpm: 333, entryBoard: 17.5, entryBoardExtrapolated: false },
};

describe('ShotAnalysisPage', () => {
  let fixture: ComponentFixture<ShotAnalysisPage>;
  let page: ShotAnalysisPage;
  let events: Subject<ShotAnalysisEvent>;
  const analysisService = { analyze: vi.fn() };
  const toastService = { showToast: vi.fn() };

  const el = () => fixture.nativeElement as HTMLElement;

  /** Selects a file as if picked in the file input. */
  const selectVideo = (file: File) => {
    const input = document.createElement('input');
    Object.defineProperty(input, 'files', { value: [file] });
    page.onVideoSelected({ target: input } as unknown as Event);
    fixture.detectChanges();
  };

  beforeEach(() => {
    events = new Subject<ShotAnalysisEvent>();
    analysisService.analyze.mockReset().mockReturnValue(events);
    toastService.showToast.mockReset();
    // no real video element loads in the test, so nothing tries to decode the fake file
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('');
    TestBed.configureTestingModule({
      providers: [
        { provide: ShotAnalysisService, useValue: analysisService },
        { provide: ToastService, useValue: toastService },
      ],
    });
    fixture = TestBed.createComponent(ShotAnalysisPage);
    page = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('starts by offering to record or choose a video', () => {
    expect(page.step()).toBe('pick');
    const buttons = [...el().querySelectorAll('ion-button')].map((b) => b.textContent?.trim());
    expect(buttons).toEqual(expect.arrayContaining(['Record Shot', 'Choose Video']));
  });

  it('accepts a long video but refuses to upload more than the limit', async () => {
    const big = new File(['x'], 'big.mov');
    Object.defineProperty(big, 'size', { value: MAX_SHOT_VIDEO_BYTES + 1 });

    selectVideo(big);
    expect(page.step()).toBe('calibrate');

    page.points.set(CORNERS);
    await page.analyze();

    expect(analysisService.analyze).not.toHaveBeenCalled();
    expect(page.step()).toBe('calibrate');
    expect(toastService.showToast).toHaveBeenCalledWith(TOAST_MESSAGES.shotAnalysisVideoTooLarge, 'bug', true);
  });

  it('sends the whole file with the selected window when it cannot be cut', async () => {
    const file = new File(['not a real video'], 'shot.mov');
    selectVideo(file);
    page.duration.set(30);
    page.trimWindow.set({ startS: 12, endS: 16 });
    page.frameTime.set(12.5);
    page.points.set(CORNERS);

    await page.analyze();

    const [video, name, calibration, options] = analysisService.analyze.mock.calls[0];
    expect(video).toBe(file);
    expect(name).toBe('shot.mov');
    expect(calibration.frameTimeS).toBe(12.5);
    expect(options).toEqual({ handedness: 'right', startS: 12, endS: 16 });
    expect(page.preparing()).toBe(false);
  });

  it('asks for the corners in order and only allows analyzing a plausible lane', () => {
    selectVideo(new File(['x'], 'shot.mov'));
    expect(page.step()).toBe('calibrate');
    expect(page.instruction()).toBe('Tap the left corner of the foul line');

    page.points.set([CORNERS[1], CORNERS[0], CORNERS[2], CORNERS[3]]);
    expect(page.canAnalyze()).toBe(false);
    expect(page.calibrationError()).toContain('swapped');

    page.points.set(CORNERS);
    expect(page.canAnalyze()).toBe(true);
  });

  describe('placing corners on the frame', () => {
    /** A pointer event at a frame position, via the overlay's own transform. */
    const pointerAt = (type: string, frameX: number, frameY: number) => {
      const svg = el().querySelector('svg.overlay') as SVGSVGElement;
      const screen = new DOMPoint(frameX, frameY).matrixTransform(svg.getScreenCTM()!);
      svg.dispatchEvent(new PointerEvent(type, { clientX: screen.x, clientY: screen.y, bubbles: true, pointerId: 1 }));
      fixture.detectChanges();
    };
    const tap = (x: number, y: number) => {
      pointerAt('pointerdown', x, y);
      pointerAt('pointerup', x, y);
    };

    beforeEach(() => {
      selectVideo(new File(['x'], 'shot.mov'));
      page.frameSize.set({ width: 1080, height: 1920 });
      fixture.detectChanges();
    });

    it('turns taps into corners as fractions of the frame', () => {
      tap(540, 960);
      expect(page.points()[0][0]).toBeCloseTo(0.5, 2);
      expect(page.points()[0][1]).toBeCloseTo(0.5, 2);
    });

    it('places the next corner even right next to the previous one (the pin end is only a few pixels wide)', () => {
      tap(427, 1090);
      tap(700, 1087);
      tap(645, 923);
      tap(652, 923);

      expect(page.points().length).toBe(4);
    });

    it('drags the nearest corner once all four are placed', () => {
      tap(427, 1090);
      tap(700, 1087);
      tap(645, 923);
      tap(714, 922);

      pointerAt('pointerdown', 700, 1087);
      pointerAt('pointermove', 690, 1080);
      pointerAt('pointerup', 690, 1080);

      expect(page.points().length).toBe(4);
      expect(page.points()[1][0]).toBeCloseTo(690 / 1080, 2);
      expect(page.points()[1][1]).toBeCloseTo(1080 / 1920, 2);
    });
  });

  it('undoes and resets corners', () => {
    page.points.set(CORNERS);
    page.undoPoint();
    expect(page.points()).toEqual(CORNERS.slice(0, 3));
    page.resetPoints();
    expect(page.points()).toEqual([]);
  });

  it('sends the shot with the marked corners and handedness, then shows the result', async () => {
    const file = new File(['x'], 'shot.mov');
    selectVideo(file);
    page.points.set(CORNERS);
    page.setHandedness('left');

    await page.analyze();
    fixture.detectChanges();

    expect(page.step()).toBe('analyzing');
    const [video, name, calibration, options] = analysisService.analyze.mock.calls[0];
    expect(video).toBe(file);
    expect(name).toBe('shot.mov');
    expect(calibration).toMatchObject({ foulLeft: CORNERS[0], farRight: CORNERS[3], farDistanceFt: 60 });
    expect(options).toEqual({ handedness: 'left' });

    events.next({ type: 'uploading', progress: 0.4 });
    fixture.detectChanges();
    expect(el().textContent).toContain('40%');

    events.next({ type: 'processing' });
    fixture.detectChanges();
    expect(el().textContent).toContain('Analyzing shot');

    events.next({ type: 'done', result: RESULT });
    fixture.detectChanges();
    expect(page.step()).toBe('result');
    expect(el().querySelector('app-shot-lane')).not.toBeNull();
    expect(el().textContent).toContain('16.7 mph');
    expect(el().textContent).toContain('333 rpm');
    expect(el().textContent).toContain('Tracked from 2 to 60 ft');
  });

  it('shows the error and returns to marking when the analysis fails', async () => {
    selectVideo(new File(['x'], 'shot.mov'));
    page.points.set(CORNERS);
    await page.analyze();

    events.error(new Error(TOAST_MESSAGES.shotAnalysisNoPath));

    expect(toastService.showToast).toHaveBeenCalledWith(TOAST_MESSAGES.shotAnalysisNoPath, 'bug', true);
    expect(page.step()).toBe('calibrate');
    expect(page.points()).toEqual(CORNERS);
  });

  it('cancels a running analysis', async () => {
    selectVideo(new File(['x'], 'shot.mov'));
    page.points.set(CORNERS);
    await page.analyze();

    page.cancelAnalysis();

    expect(events.observed).toBe(false);
    expect(page.step()).toBe('calibrate');
  });

  it('drops a cut that finishes after the analysis was cancelled', async () => {
    selectVideo(new File(['not a real video'], 'shot.mov'));
    page.duration.set(30);
    page.trimWindow.set({ startS: 12, endS: 16 });
    page.frameTime.set(12.5);
    page.points.set(CORNERS);

    const running = page.analyze();
    page.cancelAnalysis();
    await running;

    expect(analysisService.analyze).not.toHaveBeenCalled();
    expect(page.step()).toBe('calibrate');
  });

  it('starts over with a new video', () => {
    selectVideo(new File(['x'], 'shot.mov'));
    page.points.set(CORNERS);

    page.startOver();

    expect(page.step()).toBe('pick');
    expect(page.points()).toEqual([]);
  });
});
