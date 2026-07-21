import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { Pattern } from 'src/app/core/models/pattern.model';
import { AR_BACKEND } from 'src/app/core/services/ar-session/ar-backend';
import { ArSessionService } from 'src/app/core/services/ar-session/ar-session.service';
import { MockArBackend } from 'src/app/core/services/ar-session/backends/mock-ar.backend';
import { PatternService } from 'src/app/core/services/pattern/pattern.service';
import { PatternsStore } from 'src/app/core/stores/patterns.store';
import { ArPatternPage } from './ar-pattern.page';

const PATTERN: Pattern = {
  url: 'kegel-main-street',
  title: 'Kegel Main Street',
  category: 'Recreational',
  distance: '38',
  ratio: '7.5:1',
  volume: '22.55',
  forward: '12.0',
  reverse: '10.5',
  pump: '40',
  tanks: '3',
  pdf_url: '',
  kosi_url: '',
  forwards_data: [
    {
      number: '1',
      start: '10L',
      stop: '10R',
      load: '2',
      mics: '40',
      speed: '18',
      buf: '0',
      tank: '1',
      total_oil: '25',
      distance_start: '0',
      distance_end: '35',
    },
  ],
  reverse_data: [],
  chart_standard: '',
  chart_horizontal: '',
};

/** Renders the page and returns its visible text, for blank-screen checks. */
async function textOf(fixture: ComponentFixture<ArPatternPage>): Promise<string> {
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return (fixture.nativeElement.textContent ?? '').trim();
}

describe('ArPatternPage', () => {
  let fixture: ComponentFixture<ArPatternPage>;
  let component: ArPatternPage;
  let backend: MockArBackend;

  async function configure(options: {
    patterns?: Partial<typeof PATTERN>[];
    queryParam?: string | null;
    getPatternData?: () => Promise<typeof PATTERN>;
    loadAllPatterns?: () => Promise<void>;
  }): Promise<void> {
    backend = new MockArBackend();
    const patterns = signal(options.patterns ?? []);

    await TestBed.configureTestingModule({
      imports: [ArPatternPage],
      providers: [
        {
          provide: PatternService,
          useValue: { getPatternData: options.getPatternData ?? (() => Promise.resolve(PATTERN)) },
        },
        {
          provide: PatternsStore,
          useValue: {
            allPatterns: patterns,
            loadAllPatterns: options.loadAllPatterns ?? (() => Promise.resolve()),
          },
        },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: new Map(options.queryParam ? [['pattern', options.queryParam]] : []),
            },
          },
        },
      ],
    })
      .overrideComponent(ArPatternPage, {
        set: { providers: [ArSessionService, { provide: AR_BACKEND, useValue: backend }] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(ArPatternPage);
    component = fixture.componentInstance;
  }

  describe('reached with no pattern in the store and no query param', () => {
    it('loads the store rather than rendering nothing', async () => {
      const loadAllPatterns = jasmine.createSpy('loadAllPatterns').and.resolveTo();
      await configure({ patterns: [], queryParam: null, loadAllPatterns });

      await textOf(fixture);

      expect(loadAllPatterns).toHaveBeenCalled();
    });

    it('shows an explanation when the store stays empty', async () => {
      await configure({ patterns: [], queryParam: null });

      const text = await textOf(fixture);

      // The blank-page bug: every branch was false and nothing rendered.
      expect(text.length).toBeGreaterThan(0);
      expect(text).toContain('No patterns are available');
    });
  });

  describe('when the pattern fetch fails', () => {
    it('explains instead of rendering nothing', async () => {
      await configure({
        patterns: [{ url: PATTERN.url, title: PATTERN.title }],
        queryParam: PATTERN.url,
        // getPatternData resolves to an empty object rather than throwing.
        getPatternData: () => Promise.resolve({} as typeof PATTERN),
      });

      const text = await textOf(fixture);

      expect(text).toContain('Could not load that pattern');
    });
  });

  describe('with a pattern available', () => {
    beforeEach(async () => {
      await configure({ patterns: [{ url: PATTERN.url, title: PATTERN.title }], queryParam: PATTERN.url });
    });

    it('always renders something', async () => {
      expect((await textOf(fixture)).length).toBeGreaterThan(0);
    });

    it('keeps the background opaque until a session is live', async () => {
      await textOf(fixture);

      expect(component.isSessionLive()).toBeFalse();

      await component.enterAr();
      fixture.detectChanges();

      expect(component.isSessionLive()).toBeTrue();
    });
  });
});

describe('ArPatternPage session flow', () => {
  let fixture: ComponentFixture<ArPatternPage>;
  let component: ArPatternPage;
  let backend: MockArBackend;

  beforeEach(async () => {
    backend = new MockArBackend();

    await TestBed.configureTestingModule({
      imports: [ArPatternPage],
      providers: [
        { provide: PatternService, useValue: { getPatternData: () => Promise.resolve(PATTERN) } },
        {
          provide: PatternsStore,
          useValue: { allPatterns: signal([{ url: PATTERN.url, title: PATTERN.title }]), loadAllPatterns: () => Promise.resolve() },
        },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: new Map([['pattern', PATTERN.url]]) } } },
      ],
    })
      // `set` replaces the component's whole providers array, so the session
      // service has to be listed again alongside the swapped-in backend.
      .overrideComponent(ArPatternPage, {
        set: { providers: [ArSessionService, { provide: AR_BACKEND, useValue: backend }] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(ArPatternPage);
    component = fixture.componentInstance;
  });

  it('loads the requested pattern without opening a session', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component).toBeTruthy();
    expect(component.pattern()?.url).toBe(PATTERN.url);
    // WebXR needs user activation, so nothing starts until the tap.
    expect(component.isReady()).toBeTrue();
    expect(component.isScanning()).toBeFalse();
  });

  it('reaches the scanning phase once the user taps Start AR', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    await component.enterAr();

    expect(component.isScanning()).toBeTrue();
  });

  it('anchors after the three calibration taps', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    await component.enterAr();

    component.session.beginCalibration();
    expect(component.isCalibrating()).toBeTrue();

    await component.onCalibrationTap({ x: 0.3, y: 0.6, index: 0 });
    await component.onCalibrationTap({ x: 0.5, y: 0.55, index: 1 });
    await component.onCalibrationTap({ x: 0.7, y: 0.6, index: 2 });

    expect(component.isLive()).toBeTrue();
    expect(backend.texture).not.toBeNull();
  });

  it('stops the session when the page is destroyed', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    await component.enterAr();

    fixture.destroy();
    await fixture.whenStable();

    expect(component.phase()).toBe('idle');
  });
});
