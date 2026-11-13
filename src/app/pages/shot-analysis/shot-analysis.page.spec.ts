import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { TOAST_MESSAGES } from 'src/app/core/constants/toast-messages.constants';
import { NormalizedPoint, ShotAnalysisResult } from 'src/app/core/models/shot-analysis.model';
import { PatternService } from 'src/app/core/services/pattern/pattern.service';
import { ShotAnalysisService } from 'src/app/core/services/shot-analysis/shot-analysis.service';
import { ToastService } from 'src/app/core/services/toast/toast.service';
import { makePattern } from 'src/testing/fixtures';
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
  /** Settles the running on-device analysis. */
  let finish: { resolve: (result: ShotAnalysisResult) => void; reject: (error: unknown) => void };
  const analysisService = { analyzeOnDevice: vi.fn() };
  const toastService = { showToast: vi.fn() };
  const patternService = { searchPattern: vi.fn(), getPatternData: vi.fn() };

  const el = () => fixture.nativeElement as HTMLElement;

  /** Selects a file as if picked in the file input. */
  const selectVideo = (file: File) => {
    const input = document.createElement('input');
    Object.defineProperty(input, 'files', { value: [file] });
    page.onVideoSelected({ target: input } as unknown as Event);
    fixture.detectChanges();
  };

  beforeEach(() => {
    analysisService.analyzeOnDevice.mockReset().mockImplementation(
      () =>
        new Promise<ShotAnalysisResult>((resolve, reject) => {
          finish = { resolve, reject };
        }),
    );
    toastService.showToast.mockReset();
    patternService.searchPattern.mockReset().mockResolvedValue({ patterns: [] });
    patternService.getPatternData.mockReset();
    localStorage.removeItem('shot-analysis-pattern');
    // no real video element loads in the test, so nothing tries to decode the fake file
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('');
    TestBed.configureTestingModule({
      providers: [
        { provide: ShotAnalysisService, useValue: analysisService },
        { provide: ToastService, useValue: toastService },
        { provide: PatternService, useValue: patternService },
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

  it('picks videos with the file input on the web', async () => {
    const input = document.createElement('input');
    const click = vi.spyOn(input, 'click');

    await page.chooseVideo(input);

    expect(click).toHaveBeenCalled();
  });

  it('analyzes only the selected part of the video', () => {
    const file = new File(['not a real video'], 'shot.mov');
    selectVideo(file);
    page.duration.set(30);
    page.trimWindow.set({ startS: 12, endS: 16 });
    page.frameTime.set(12.5);
    page.points.set(CORNERS);

    void page.analyze();

    const [video, calibration, options] = analysisService.analyzeOnDevice.mock.calls[0];
    expect(video).toBe(file);
    expect(calibration.frameTimeS).toBe(12.5);
    expect(options.window).toEqual({ startS: 12, endS: 16 });
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

  it('analyzes the shot on the device with the marked corners and handedness, then shows the result', async () => {
    const file = new File(['x'], 'shot.mov');
    selectVideo(file);
    page.points.set(CORNERS);
    page.setHandedness('left');

    const running = page.analyze();
    fixture.detectChanges();

    expect(page.step()).toBe('analyzing');
    const [video, calibration, options] = analysisService.analyzeOnDevice.mock.calls[0];
    expect(video).toBe(file);
    expect(calibration).toMatchObject({ foulLeft: CORNERS[0], farRight: CORNERS[3], farDistanceFt: 60 });
    expect(options.handedness).toBe('left');

    options.onProgress(0.4);
    fixture.detectChanges();
    expect(el().textContent).toContain('40%');

    finish.resolve(RESULT);
    await running;
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
    const running = page.analyze();

    finish.reject(new Error(TOAST_MESSAGES.shotAnalysisNoPath));
    await running;

    expect(toastService.showToast).toHaveBeenCalledWith(TOAST_MESSAGES.shotAnalysisNoPath, 'bug', true);
    expect(page.step()).toBe('calibrate');
    expect(page.points()).toEqual(CORNERS);
  });

  it('cancels a running analysis', async () => {
    selectVideo(new File(['x'], 'shot.mov'));
    page.points.set(CORNERS);
    const running = page.analyze();
    const { signal } = analysisService.analyzeOnDevice.mock.calls[0][2];

    page.cancelAnalysis();
    finish.reject(signal.reason);
    await running;

    expect(signal.aborted).toBe(true);
    expect(page.step()).toBe('calibrate');
    expect(toastService.showToast).not.toHaveBeenCalled();
  });

  it('starts over with a new video', () => {
    selectVideo(new File(['x'], 'shot.mov'));
    page.points.set(CORNERS);

    page.startOver();

    expect(page.step()).toBe('pick');
    expect(page.points()).toEqual([]);
  });

  describe('pattern', () => {
    const oil = {
      number: '1',
      start: '10L',
      stop: '10R',
      load: '',
      mics: '',
      speed: '',
      buf: '',
      tank: '',
      total_oil: '3',
      distance_start: '0',
      distance_end: '30',
    };

    it('loads the picked pattern with its oil through the search, not patterns/<url>', async () => {
      const addison = makePattern({ url: 'https://patternlibrary.kegel.net/pattern/a', title: 'Addison', forwards_data: [oil] });
      patternService.searchPattern.mockResolvedValue({ patterns: [makePattern({ title: 'Addison 2' }), addison] });

      await page.onPatternSelected(['Addison']);

      expect(patternService.searchPattern).toHaveBeenCalledWith('Addison', true);
      expect(patternService.getPatternData).not.toHaveBeenCalled();
      expect(page.pattern()).toBe(addison);
      expect(page.patternDetail()).toContain('mL');
      expect(localStorage.getItem('shot-analysis-pattern')).toBe('Addison');
    });

    it('keeps no pattern when the search has no oil data for it', async () => {
      patternService.searchPattern.mockResolvedValue({ patterns: [makePattern({ title: 'Addison' })] });

      await page.onPatternSelected(['Addison']);

      expect(page.pattern()).toBeNull();
    });

    it('clears the pattern when the selection is emptied', async () => {
      page.pattern.set(makePattern({ forwards_data: [oil] }));

      await page.onPatternSelected([]);

      expect(page.pattern()).toBeNull();
      expect(page.patternTitle()).toBe('No pattern');
    });
  });
});
