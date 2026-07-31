import { TestBed } from '@angular/core/testing';
import { Pattern } from 'src/app/core/models/pattern.model';
import { AR_BACKEND } from './ar-backend';
import { ArSessionService } from './ar-session.service';
import { FallbackArBackend } from './backends/fallback-ar.backend';
import { MockArBackend } from './backends/mock-ar.backend';

const PATTERN: Pattern = {
  url: 'test-pattern',
  title: 'Test Pattern',
  category: 'Sport',
  distance: '40',
  ratio: '2.5:1',
  volume: '25.0',
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

/** Taps roughly where the three arrows would appear from the approach. */
async function tapAllThree(service: ArSessionService): Promise<void> {
  await service.recordTap(0.3, 0.6, 0);
  await service.recordTap(0.5, 0.55, 1);
  await service.recordTap(0.7, 0.6, 2);
}

describe('ArSessionService', () => {
  describe('with a working backend', () => {
    let service: ArSessionService;
    let backend: MockArBackend;

    beforeEach(() => {
      backend = new MockArBackend();
      TestBed.configureTestingModule({
        providers: [ArSessionService, { provide: AR_BACKEND, useValue: backend }],
      });
      service = TestBed.inject(ArSessionService);
    });

    it('starts out idle', () => {
      expect(service.phase()).toBe('idle');
      expect(service.isAnchored()).toBeFalse();
    });

    it('moves to scanning once the session starts', async () => {
      await service.start(PATTERN);

      expect(service.phase()).toBe('scanning');
      expect(service.pattern()).toBe(PATTERN);
    });

    it('counts down the calibration taps', async () => {
      await service.start(PATTERN);
      service.beginCalibration();

      expect(service.tapsRemaining()).toBe(3);

      await service.recordTap(0.3, 0.6, 0);
      expect(service.tapsRemaining()).toBe(2);
    });

    it('anchors once all three arrows are tapped', async () => {
      await service.start(PATTERN);
      service.beginCalibration();
      await tapAllThree(service);

      expect(service.isAnchored()).toBeTrue();
      expect(['tracking', 'limited']).toContain(service.phase());
      expect(backend.anchor).not.toBeNull();
    });

    it('hands the baked texture and lane dimensions to the backend', async () => {
      await service.start(PATTERN);
      service.beginCalibration();
      await tapAllThree(service);

      expect(backend.texture).not.toBeNull();
      expect(backend.texture!.dataUri.startsWith('data:image/png')).toBeTrue();
      expect(backend.texture!.widthM).toBeCloseTo(1.0541, 4);
      expect(backend.texture!.lengthM).toBeCloseTo(18.288, 3);
    });

    it('undoes a tap without keeping a stale anchor', async () => {
      await service.start(PATTERN);
      service.beginCalibration();
      await tapAllThree(service);

      service.undoTap();

      expect(service.taps().length).toBe(2);
      expect(service.isAnchored()).toBeFalse();
    });

    it('swaps pattern without dropping the anchor', async () => {
      await service.start(PATTERN);
      service.beginCalibration();
      await tapAllThree(service);
      const anchorBefore = service.anchor();

      await service.setPattern({ ...PATTERN, title: 'Another', url: 'another' });

      expect(service.anchor()).toBe(anchorBefore);
      expect(service.pattern()!.title).toBe('Another');
    });

    it('clears everything on stop', async () => {
      await service.start(PATTERN);
      service.beginCalibration();
      await tapAllThree(service);

      await service.stop();

      expect(service.phase()).toBe('idle');
      expect(service.isAnchored()).toBeFalse();
      expect(service.taps()).toEqual([]);
    });
  });

  describe('with no AR available', () => {
    let service: ArSessionService;

    beforeEach(() => {
      TestBed.configureTestingModule({
        providers: [ArSessionService, { provide: AR_BACKEND, useValue: new FallbackArBackend() }],
      });
      service = TestBed.inject(ArSessionService);
    });

    it('reports unsupported with a reason instead of failing silently', async () => {
      await service.start(PATTERN);

      expect(service.phase()).toBe('unsupported');
      expect(service.message()).toContain('cannot track a lane');
    });
  });
});
