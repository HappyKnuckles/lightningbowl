import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Pattern } from 'src/app/core/models/pattern.model';
import { ArQuickLookService } from 'src/app/core/services/ar-quick-look/ar-quick-look.service';
import { AR_BACKEND, ArBackend } from 'src/app/core/services/ar-session/ar-backend';
import { ArSessionService } from 'src/app/core/services/ar-session/ar-session.service';
import { FallbackArBackend } from 'src/app/core/services/ar-session/backends/fallback-ar.backend';
import { MockArBackend } from 'src/app/core/services/ar-session/backends/mock-ar.backend';
import { PatternService } from 'src/app/core/services/pattern/pattern.service';
import { PatternsStore } from 'src/app/core/stores/patterns.store';
import { ArPatternViewComponent } from './ar-pattern-view.component';

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

describe('ArPatternViewComponent', () => {
  let fixture: ComponentFixture<ArPatternViewComponent>;
  let component: ArPatternViewComponent;
  let backend: MockArBackend;
  /** Subscribed before the first render, because AR starts on that render. */
  let closed: jasmine.Spy;

  /** Builds the component around a backend and renders it, which starts AR. */
  async function configure(
    options: {
      backend?: ArBackend;
      loadAllPatterns?: () => Promise<void>;
      patterns?: Partial<Pattern>[];
      quickLook?: Partial<ArQuickLookService>;
    } = {},
  ) {
    backend = new MockArBackend();

    await TestBed.configureTestingModule({
      imports: [ArPatternViewComponent],
      providers: [
        { provide: PatternService, useValue: { getPatternData: () => Promise.resolve(PATTERN) } },
        {
          provide: ArQuickLookService,
          useValue: { isSupported: () => false, open: () => Promise.resolve(null), lastSize: 0, ...options.quickLook },
        },
        {
          provide: PatternsStore,
          useValue: {
            allPatterns: signal(options.patterns ?? [{ url: PATTERN.url, title: PATTERN.title }]),
            loadAllPatterns: options.loadAllPatterns ?? (() => Promise.resolve()),
          },
        },
      ],
    })
      // `set` replaces the component's whole providers array, so the session
      // service has to be listed again alongside the swapped-in backend.
      .overrideComponent(ArPatternViewComponent, {
        set: { providers: [ArSessionService, { provide: AR_BACKEND, useValue: options.backend ?? backend }] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(ArPatternViewComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('pattern', PATTERN);

    closed = jasmine.createSpy('closed');
    component.closed.subscribe(closed);

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('opens the session as soon as it appears, without a second tap', async () => {
    await configure();

    // The button in the pattern detail is the gesture — nothing else to press.
    expect(component.isScanning()).toBeTrue();
    expect(component.isSessionLive()).toBeTrue();
  });

  it('projects the pattern it was opened with', async () => {
    await configure();

    expect(component.activePattern()?.url).toBe(PATTERN.url);
  });

  it('loads the library for the in-session picker when the store is empty', async () => {
    const loadAllPatterns = jasmine.createSpy('loadAllPatterns').and.resolveTo();
    await configure({ patterns: [], loadAllPatterns });

    expect(loadAllPatterns).toHaveBeenCalled();
  });

  it('anchors after the three calibration taps', async () => {
    await configure();

    component.session.beginCalibration();
    expect(component.isCalibrating()).toBeTrue();

    await component.onCalibrationTap({ x: 0.3, y: 0.6, index: 0 });
    await component.onCalibrationTap({ x: 0.5, y: 0.55, index: 1 });
    await component.onCalibrationTap({ x: 0.7, y: 0.6, index: 2 });

    expect(component.isLive()).toBeTrue();
    expect(backend.texture).not.toBeNull();
  });

  it('goes straight into Quick Look where no session can run, and gets out of the way', async () => {
    const open = jasmine.createSpy('open').and.resolveTo('blob:pattern.usdz');
    await configure({ backend: new FallbackArBackend(), quickLook: { isSupported: () => true, open } });

    // No card to read and nothing to press: Quick Look owns the screen.
    expect(open).toHaveBeenCalledWith(PATTERN);
    expect(closed).toHaveBeenCalled();
  });

  it('explains itself rather than showing a blank screen where AR is missing', async () => {
    await configure({ backend: new FallbackArBackend() });

    expect(component.isUnsupported()).toBeTrue();
    expect((fixture.nativeElement.textContent ?? '').trim().length).toBeGreaterThan(0);
  });

  it('stops the session when the view is destroyed', async () => {
    await configure();

    fixture.destroy();
    await fixture.whenStable();

    expect(component.phase()).toBe('idle');
  });
});
