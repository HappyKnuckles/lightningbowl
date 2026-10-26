import { afterNextRender, ChangeDetectionStrategy, Component, computed, DestroyRef, ElementRef, inject, input, signal } from '@angular/core';

import { Pattern } from 'src/app/core/models/pattern.model';
import { ShotAnalysisResult } from 'src/app/core/models/shot-analysis.model';
import { patternDistanceFt, patternOilRects, patternRatioColor } from 'src/app/core/utils/shot-analysis-utils/pattern-overlay.utils';
import { boardToX, distanceToY, LANE_ARROWS, LANE_BOARDS, LANE_LENGTH_FT } from 'src/app/core/utils/shot-analysis-utils/shot-analysis.utils';

/**
 * Drawing size in SVG units; the SVG scales to its container. The width is fixed, the lane's length
 * follows the space the component gets, so it fills its box exactly (e.g. as tall as the metric tiles
 * next to it) without stretching pins, arrows or labels. LANE_H is the length until it is measured.
 */
const LANE_W = 156;
const LANE_H = 640;
const MIN_LANE_H = 320;
/**
 * Shortest the lane may get relative to its width. In a wide, low box (tiles on a desktop) the lane
 * would otherwise come out stubby; this keeps it long and the drawing narrows to fit the height instead.
 */
const MIN_LANE_RATIO = 5;
const GUTTER = 10;
const PAD_X = 30;
const PAD_TOP = 8;
const PAD_BOTTOM = 24;
/**
 * The pin deck above the 60 ft line. Not to scale, like the pattern charts: real pins would be specks
 * at this size, so the triangle spans most of the lane. The head pin sits just above the 60 ft line,
 * clear of the entry marker there.
 */
const PIN_SPACING = LANE_W / 4.2;
const PIN_RADIUS = PIN_SPACING * 0.3;
const PIN_ROW = PIN_SPACING * 0.8;
const HEAD_PIN_GAP = 8;
const DECK_H = HEAD_PIN_GAP + 2 * PIN_RADIUS + 3 * PIN_ROW + 6;
/** Range finders on synthetic lanes: board 15 from each side at 34-37 ft, board 10 from each side at 40-43 ft. */
const RANGE_FINDERS: readonly [number, number][] = [
  [15, 34],
  [25, 34],
  [10, 40],
  [30, 40],
];
const RANGE_FINDER_FT = 3;

interface Marker {
  key: string;
  label: string;
  /** Label on the left of the marker (when the marker is on the right half of the lane). */
  labelLeft: boolean;
  x: number;
  y: number;
}

/**
 * Top-down lane with a shot's path, LaneTrax-style: the foul line at the bottom, the pins at the top,
 * as seen from the approach. Marks where the ball crossed the arrows, its breakpoint and its entry.
 */
@Component({
  selector: 'app-shot-lane',
  templateUrl: './shot-lane.component.html',
  styleUrl: './shot-lane.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShotLaneComponent {
  readonly result = input.required<ShotAnalysisResult>();
  /** Pattern the shot was bowled on; its oil is drawn under the ball path like on the pattern charts. */
  readonly pattern = input<Pattern | null>(null);

  readonly boardLines = computed(() =>
    Array.from({ length: LANE_BOARDS - 1 }, (_, i) => {
      const x = PAD_X + ((i + 1) / LANE_BOARDS) * LANE_W;
      return { x, major: (i + 1) % 5 === 0 };
    }),
  );
  readonly #x = (board: number) => PAD_X + boardToX(board, this.result().handedness, LANE_W);

  readonly boardLabels = computed(() => [5, 10, 15, 20, 25, 30, 35].map((board) => ({ board, x: this.#x(board) })));
  /** 0 ft at the bottom of the drawing, 60 ft below the pin deck. */
  readonly #y = (ft: number) => PAD_TOP + DECK_H + distanceToY(ft, this.#laneH() - DECK_H, LANE_LENGTH_FT);

  readonly arrows = computed(() =>
    LANE_ARROWS.map(([board, ft]) => {
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

  /** Oil boards are counted from the lane's left edge, whatever hand the shot was thrown with. */
  readonly oil = computed(() => {
    const pattern = this.pattern();
    if (!pattern) {
      return { color: '', rects: [] };
    }
    const xFromLeft = (boards: number) => PAD_X + (boards / LANE_BOARDS) * LANE_W;
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
    const pattern = this.pattern();
    const ft = pattern ? patternDistanceFt(pattern) : null;
    return ft === null ? null : { y: this.#y(ft), label: `end of pattern ${ft}'` };
  });

  readonly pins = computed(() => {
    const pins: { key: string; x: number; y: number }[] = [];
    for (let row = 0; row < 4; row++) {
      for (let i = 0; i <= row; i++) {
        const headPinY = this.#y(LANE_LENGTH_FT) - HEAD_PIN_GAP - PIN_RADIUS;
        pins.push({ key: `${row}-${i}`, x: PAD_X + LANE_W / 2 + (i - row / 2) * PIN_SPACING, y: headPinY - row * PIN_ROW });
      }
    }
    return pins;
  });

  readonly path = computed(() =>
    this.result()
      .curve.map((p, i) => `${i === 0 ? 'M' : 'L'}${this.#x(p.board).toFixed(2)} ${this.#y(p.distanceFt).toFixed(2)}`)
      .join(' '),
  );

  readonly markers = computed<Marker[]>(() => {
    const { metrics } = this.result();
    const markers: Marker[] = [];
    const add = (key: string, board: number, ft: number, label: string) => {
      const x = this.#x(board);
      markers.push({ key, x, y: this.#y(ft), label, labelLeft: x > PAD_X + LANE_W / 2 });
    };
    if (metrics.arrowsBoard !== undefined) {
      add('arrows', metrics.arrowsBoard, 15, `${metrics.arrowsBoard.toFixed(1)}`);
    }
    if (metrics.breakpoint) {
      add('breakpoint', metrics.breakpoint.board, metrics.breakpoint.distanceFt, `BP ${metrics.breakpoint.board.toFixed(1)}`);
    }
    if (metrics.entryBoard !== undefined) {
      add('entry', metrics.entryBoard, LANE_LENGTH_FT, `${metrics.entryBoard.toFixed(1)}`);
    }
    return markers;
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
