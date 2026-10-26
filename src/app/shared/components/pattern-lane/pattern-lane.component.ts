import { afterNextRender, ChangeDetectionStrategy, Component, computed, DestroyRef, ElementRef, inject, input, signal } from '@angular/core';

import { Pattern } from 'src/app/core/models/pattern.model';
import { BOARDS, patternDistanceFt, patternOilRects, patternRatioColor } from 'src/app/core/utils/pattern-utils/pattern-oil.utils';

/**
 * Drawing size in SVG units; the SVG scales to its container. The width is fixed, the lane's length
 * follows the space the component gets, so it fills its box without stretching pins or arrows.
 * LANE_H is the length until it is measured.
 */
const LANE_W = 156;
const LANE_H = 640;
const MIN_LANE_H = 320;
/** Shortest the lane may get relative to its width, so it never looks stubby in a wide box. */
const MIN_LANE_RATIO = 5;
const GUTTER = 10;
const PAD_X = 30;
const PAD_TOP = 8;
const PAD_BOTTOM = 24;
const LANE_LENGTH_FT = 60;
/** The pin deck above the 60 ft line, not to scale: the triangle spans most of the lane. */
const PIN_SPACING = LANE_W / 4.2;
const PIN_RADIUS = PIN_SPACING * 0.3;
const PIN_ROW = PIN_SPACING * 0.8;
const HEAD_PIN_GAP = 8;
const DECK_H = HEAD_PIN_GAP + 2 * PIN_RADIUS + 3 * PIN_ROW + 6;
/** Approximate arrow positions: board and feet from the foul line. */
const ARROWS: readonly [number, number][] = [
  [5, 13],
  [10, 14],
  [15, 15],
  [20, 16],
  [25, 15],
  [30, 14],
  [35, 13],
];
/** Range finders on synthetic lanes: board 15 from each side at 34-37 ft, board 10 from each side at 40-43 ft. */
const RANGE_FINDERS: readonly [number, number][] = [
  [15, 34],
  [25, 34],
  [10, 40],
  [30, 40],
];
const RANGE_FINDER_FT = 3;

/**
 * Top-down lane with a pattern's oil, the foul line at the bottom and the pins at the top, drawn
 * like the pattern charts: a light wash over the oiled length, the forward passes and the reverse
 * passes on top, in the colour of the pattern's ratio, and a line where the oil ends.
 */
@Component({
  selector: 'app-pattern-lane',
  templateUrl: './pattern-lane.component.html',
  styleUrl: './pattern-lane.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PatternLaneComponent {
  readonly pattern = input.required<Pattern>();

  readonly boardLines = computed(() =>
    Array.from({ length: BOARDS - 1 }, (_, i) => {
      const x = PAD_X + ((i + 1) / BOARDS) * LANE_W;
      return { x, major: (i + 1) % 5 === 0 };
    }),
  );

  /** Board numbers as a right-hander counts them, from the right gutter; arrows and range finders are symmetric. */
  readonly #x = (board: number) => PAD_X + (1 - (board - 0.5) / BOARDS) * LANE_W;

  readonly boardLabels = computed(() => [5, 10, 15, 20, 25, 30, 35].map((board) => ({ board, x: this.#x(board) })));

  /** 0 ft at the bottom of the drawing, 60 ft below the pin deck. */
  readonly #y = (ft: number) => PAD_TOP + DECK_H + (1 - ft / LANE_LENGTH_FT) * (this.#laneH() - DECK_H);

  readonly arrows = computed(() =>
    ARROWS.map(([board, ft]) => {
      const x = this.#x(board);
      const y = this.#y(ft);
      return { key: `${board}`, points: `${x},${y - 6} ${x + 2.5},${y + 3} ${x - 2.5},${y + 3}` };
    }),
  );

  readonly rangeFinders = computed(() =>
    RANGE_FINDERS.map(([board, fromFt]) => {
      const top = this.#y(fromFt + RANGE_FINDER_FT);
      return { key: `${board}-${fromFt}`, x: this.#x(board) - 0.9, y: top, height: this.#y(fromFt) - top };
    }),
  );

  /** Oil boards are counted from the lane's left edge. */
  readonly oil = computed(() => {
    const pattern = this.pattern();
    const xFromLeft = (boards: number) => PAD_X + (boards / BOARDS) * LANE_W;
    const rects = patternOilRects(pattern).map((r) => {
      const top = this.#y(r.toFt);
      return {
        key: r.key,
        x: xFromLeft(r.left),
        y: top,
        width: xFromLeft(r.right) - xFromLeft(r.left),
        height: this.#y(r.fromFt) - top,
        opacity: r.opacity,
      };
    });
    return { color: patternRatioColor(pattern.ratio), rects };
  });

  readonly patternEnd = computed(() => {
    const ft = patternDistanceFt(this.pattern());
    return ft === null ? null : { y: this.#y(ft), label: `end of pattern ${ft}'` };
  });

  readonly pins = computed(() => {
    const pins: { key: string; x: number; y: number }[] = [];
    const headPinY = this.#y(LANE_LENGTH_FT) - HEAD_PIN_GAP - PIN_RADIUS;
    for (let row = 0; row < 4; row++) {
      for (let i = 0; i <= row; i++) {
        pins.push({ key: `${row}-${i}`, x: PAD_X + LANE_W / 2 + (i - row / 2) * PIN_SPACING, y: headPinY - row * PIN_ROW });
      }
    }
    return pins;
  });

  /** Lane length in SVG units for the component's current height / width (read lazily through #y above). */
  readonly #laneH = signal(LANE_H);

  readonly viewBox = computed(() => `0 0 ${LANE_W + 2 * PAD_X} ${PAD_TOP + this.#laneH() + PAD_BOTTOM}`);

  readonly lane = computed(() => ({ x: PAD_X, y: PAD_TOP, width: LANE_W, height: this.#laneH(), gutter: GUTTER }));

  readonly distanceLabels = computed(() => [0, 15, 30, 45, 60].map((ft) => ({ ft, y: this.#y(ft) })));

  readonly foulLineY = computed(() => this.#y(0));

  readonly pinRadius = PIN_RADIUS;

  constructor() {
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const observer = new ResizeObserver(([entry]) => {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          const total = (height / width) * (LANE_W + 2 * PAD_X);
          this.#laneH.set(Math.max(MIN_LANE_H, LANE_W * MIN_LANE_RATIO, total - PAD_TOP - PAD_BOTTOM));
        }
      });
      observer.observe(host);
      destroyRef.onDestroy(() => observer.disconnect());
    });
  }
}
