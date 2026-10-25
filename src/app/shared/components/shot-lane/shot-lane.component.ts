import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { ShotAnalysisResult } from 'src/app/core/models/shot-analysis.model';
import { boardToX, distanceToY, LANE_ARROWS, LANE_BOARDS, LANE_LENGTH_FT } from 'src/app/core/utils/shot-analysis-utils/shot-analysis.utils';

/** Drawing size in SVG units; the SVG scales to its container. Proportions follow the pattern charts. */
const LANE_W = 156;
const LANE_H = 600;
const PAD_X = 30;
const PAD_TOP = 8;
const PAD_BOTTOM = 24;
/**
 * The pin deck above the 60 ft line. Like the pattern charts it isn't to scale: real pins would be specks
 * at this size, so the triangle spans most of the lane width.
 */
const DECK_H = 112;
const PIN_SPACING = LANE_W / 4.2;
const PIN_ROW = PIN_SPACING * 0.78;
const PIN_RADIUS = PIN_SPACING * 0.24;
const LANE_TOP = PAD_TOP + DECK_H;
const DISTANCE_STEPS_FT = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60];

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

  readonly boardLines = computed(() =>
    Array.from({ length: LANE_BOARDS - 1 }, (_, i) => {
      const x = PAD_X + ((i + 1) / LANE_BOARDS) * LANE_W;
      return { x, major: (i + 1) % 5 === 0 };
    }),
  );
  readonly #x = (board: number) => PAD_X + boardToX(board, this.result().handedness, LANE_W);

  readonly boardLabels = computed(() => [5, 10, 15, 20, 25, 30, 35].map((board) => ({ board, x: this.#x(board) })));
  /** Distances past the head pin (the curve's last point can be a little beyond) stay on the lane. */
  readonly #y = (ft: number) => LANE_TOP + distanceToY(Math.min(ft, LANE_LENGTH_FT), LANE_H, LANE_LENGTH_FT);

  readonly arrows = computed(() =>
    LANE_ARROWS.map(([board, ft]) => {
      const x = this.#x(board);
      const y = this.#y(ft);
      return { key: `${board}`, points: `${x},${y - 9} ${x + 3.5},${y + 4} ${x - 3.5},${y + 4}` };
    }),
  );

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

  /** Head pin nearest the lane, back row at the top; pins of a row are the same for both hands. */
  readonly pins = (() => {
    const pins: { key: string; x: number; y: number }[] = [];
    const center = PAD_X + LANE_W / 2;
    const headY = LANE_TOP - PIN_RADIUS - 6;
    for (let row = 0; row < 4; row++) {
      for (let i = 0; i <= row; i++) {
        pins.push({ key: `${row}-${i}`, x: center + (i - row / 2) * PIN_SPACING, y: headY - row * PIN_ROW });
      }
    }
    return pins;
  })();
  readonly pinRadius = PIN_RADIUS;

  readonly viewBox = `0 0 ${LANE_W + 2 * PAD_X} ${LANE_TOP + LANE_H + PAD_BOTTOM}`;

  readonly lane = { x: PAD_X, y: LANE_TOP, width: LANE_W, height: LANE_H };

  readonly distanceLines = DISTANCE_STEPS_FT.map((ft) => ({ ft, y: LANE_TOP + distanceToY(ft, LANE_H, LANE_LENGTH_FT) }));
}
