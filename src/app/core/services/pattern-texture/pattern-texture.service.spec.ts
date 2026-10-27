import { TestBed } from '@angular/core/testing';
import { Pattern } from 'src/app/core/models/pattern.model';
import { PatternTextureService } from './pattern-texture.service';

function makePattern(overrides: Partial<Pattern> = {}): Pattern {
  return {
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
    // Every load claims to start 10 ft out. The forward load genuinely does;
    // the reverse load must still reach the foul line, because the reverse pass
    // runs back down the lane toward it.
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
        distance_start: '10',
        distance_end: '35',
      },
    ],
    reverse_data: [
      {
        number: '1',
        start: '5L',
        stop: '5R',
        load: '1',
        mics: '20',
        speed: '18',
        buf: '0',
        tank: '1',
        total_oil: '10',
        distance_start: '10',
        distance_end: '25',
      },
    ],
    chart_standard: '',
    chart_horizontal: '',
    ...overrides,
  };
}

describe('PatternTextureService', () => {
  let service: PatternTextureService;
  let canvas: HTMLCanvasElement;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PatternTextureService);

    canvas = document.createElement('canvas');
    canvas.width = 156;
    canvas.height = 600;
  });

  function alphaAtFoot(feet: number): number {
    const context = canvas.getContext('2d')!;
    const y = Math.min(canvas.height - 1, Math.round(canvas.height - (feet / 60) * canvas.height));
    return context.getImageData(Math.floor(canvas.width / 2), Math.max(0, y - 1), 1, 1).data[3];
  }

  describe('coverage mode', () => {
    beforeEach(() => {
      service.renderToCanvas(canvas, makePattern(), { model: 'coverage', showFurniture: false });
    });

    it('carries reverse oil to the foul line even when the row starts downlane', () => {
      expect(alphaAtFoot(0)).toBeGreaterThan(0);
    });

    it('keeps the lane oiled through the gap below the first load', () => {
      expect(alphaAtFoot(2)).toBeGreaterThan(0);
      expect(alphaAtFoot(8)).toBeGreaterThan(0);
    });

    it('builds up where loads stack on the base band', () => {
      expect(alphaAtFoot(20)).toBeGreaterThan(alphaAtFoot(2));
    });

    it('leaves the lane dry beyond the pattern distance', () => {
      expect(alphaAtFoot(50)).toBe(0);
    });
  });

  describe('coverage mode over the lane surface', () => {
    // The app renders with furniture on, so oil composites over the lane colour
    // rather than transparency. Bare lane is #e8dcc4.
    function isOiledAt(xFraction: number, feet: number): boolean {
      const context = canvas.getContext('2d')!;
      const y = Math.min(canvas.height - 1, Math.round(canvas.height - (feet / 60) * canvas.height));
      const [r, , b] = context.getImageData(Math.round(canvas.width * xFraction), Math.max(0, y - 1), 1, 1).data;

      // Any oil pulls the tan lane toward blue: blue channel rises, red falls.
      return b > 196 || r < 232;
    }

    beforeEach(() => {
      service.renderToCanvas(canvas, makePattern(), { model: 'coverage', showFurniture: true });
    });

    it('spans the full lane width at the foul line', () => {
      expect(isOiledAt(0.2, 0)).toBeTrue();
      expect(isOiledAt(0.5, 0)).toBeTrue();
      expect(isOiledAt(0.8, 0)).toBeTrue();
    });

    it('stays full width through the gap below the first load', () => {
      expect(isOiledAt(0.2, 5)).toBeTrue();
      expect(isOiledAt(0.8, 5)).toBeTrue();
    });
  });

  describe('thickness mode', () => {
    it('also reaches the foul line', () => {
      service.renderToCanvas(canvas, makePattern(), { model: 'thickness', showFurniture: false });

      expect(alphaAtFoot(0)).toBeGreaterThan(0);
    });
  });

  describe('bakeTexture', () => {
    it('produces a png data uri with no lane furniture behind it', async () => {
      const uri = await service.bakeTexture(makePattern());

      expect(uri.startsWith('data:image/png;base64,')).toBeTrue();
    });
  });
});
