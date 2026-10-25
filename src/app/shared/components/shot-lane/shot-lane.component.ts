import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { ShotAnalysisResult } from 'src/app/core/models/shot-analysis.model';
import { boardToX, distanceToY, LANE_ARROWS, LANE_BOARDS, LANE_LENGTH_FT } from 'src/app/core/utils/shot-analysis-utils/shot-analysis.utils';

/** Drawing size in SVG units; the SVG scales to its container. */
const LANE_W = 156;
const LANE_H = 640;
const GUTTER = 10;
const PAD_X = 30;
const PAD_TOP = 8;
const PAD_BOTTOM = 24;
/** A little past the head pin so the pin deck shows. */
const SHOWN_FT = 64;
const PIN_SPACING_IN = 12;
const PIN_ROW_IN = 10.392;
const LANE_WIDTH_IN = 41.5;

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
  readonly #y = (ft: number) => PAD_TOP + distanceToY(ft, LANE_H, SHOWN_FT);

  readonly arrows = computed(() =>
    LANE_ARROWS.map(([board, ft]) => {
      const x = this.#x(board);
      const y = this.#y(ft);
      return { key: `${board}`, points: `${x},${y - 6} ${x + 2.5},${y + 3} ${x - 2.5},${y + 3}` };
    }),
  );

  readonly pins = computed(() => {
    const pins: { key: string; x: number; y: number }[] = [];
    for (let row = 0; row < 4; row++) {
      for (let i = 0; i <= row; i++) {
        const fromLeftIn = LANE_WIDTH_IN / 2 + (i - row / 2) * PIN_SPACING_IN;
        const ft = LANE_LENGTH_FT + (row * PIN_ROW_IN) / 12;
        pins.push({ key: `${row}-${i}`, x: PAD_X + (fromLeftIn / LANE_WIDTH_IN) * LANE_W, y: this.#y(ft) });
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

  readonly viewBox = `0 0 ${LANE_W + 2 * PAD_X} ${PAD_TOP + LANE_H + PAD_BOTTOM}`;

  readonly lane = { x: PAD_X, y: PAD_TOP, width: LANE_W, height: LANE_H, gutter: GUTTER };

  readonly distanceLabels = [0, 15, 30, 45, 60].map((ft) => ({ ft, y: PAD_TOP + distanceToY(ft, LANE_H, SHOWN_FT) }));

  readonly foulLineY = PAD_TOP + distanceToY(0, LANE_H, SHOWN_FT);
}
