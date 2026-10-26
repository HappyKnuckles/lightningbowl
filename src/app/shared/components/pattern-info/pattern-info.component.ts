import { Component, computed, ElementRef, input, signal, viewChild } from '@angular/core';
import { IonCol, IonGrid, IonIcon, IonListHeader, IonRow } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { arrowDownOutline, arrowUpOutline } from 'ionicons/icons';

import { FitScreenDirective } from 'src/app/core/directives/fit-screen/fit-screen.directive';
import { Pattern } from 'src/app/core/models/pattern.model';
import { boardName, boardStripe, CHART_H, CHART_W, chartPointToLane, footBand } from 'src/app/core/utils/pattern-utils/pattern-chart-geometry.utils';
import {
  BarRange,
  blockRatios,
  oilByBoard,
  oilByFoot,
  patternFacts,
  patternRatioColor,
  sumBars,
} from 'src/app/core/utils/pattern-utils/pattern-oil.utils';
import { environment } from 'src/environments/environment';

import { BarPick, PatternOilChartComponent } from '../pattern-oil-chart/pattern-oil-chart.component';

/** Board labels under the left-to-right chart: 1, 5, 10 … 20 … 10, 5, 1 counted from each edge. */
const BOARD_TICKS = [1, 5, 10, 15, 20, 25, 30, 35, 39].map((b) => ({ at: b - 1, label: `${b <= 20 ? b : 40 - b}` }));

@Component({
  selector: 'app-pattern-info',
  imports: [IonListHeader, IonGrid, IonRow, IonCol, IonIcon, FitScreenDirective, PatternOilChartComponent],
  templateUrl: './pattern-info.component.html',
  styleUrl: './pattern-info.component.scss',
})
export class PatternInfoComponent {
  pattern = input.required<Pattern>();
  readonly overlay = viewChild<ElementRef<SVGSVGElement>>('overlay');
  readonly facts = computed(() => patternFacts(this.pattern()));
  readonly color = computed(() => patternRatioColor(this.pattern().ratio));

  readonly byBoard = computed(() => oilByBoard(this.pattern()));
  readonly ratios = computed(() => blockRatios(this.byBoard()).map((r) => ({ from: r.from - 1, to: r.to - 1, label: r.label })));
  /** Front to back up to the end of the oil (at least the pattern distance), in whole feet. */
  readonly byFoot = computed(() => {
    const pattern = this.pattern();
    const rows = [...(pattern.forwards_data ?? []), ...(pattern.reverse_data ?? [])];
    const end = Math.max(
      parseFloat(pattern.distance) || 0,
      ...rows.map((r) => Math.max(parseFloat(r.distance_start) || 0, parseFloat(r.distance_end) || 0)),
    );
    return oilByFoot(pattern, end);
  });
  readonly footTicks = computed(() =>
    this.byFoot()
      .map((_, i) => i + 1)
      .filter((ft) => ft % 5 === 0)
      .map((ft) => ({ at: ft - 1, label: `${ft}` })),
  );
  /**
   * Boards (as 0-based bar indexes, board 1 from the left is 0) and feet picked on the chart or a
   * graph: one by a tap, a run by dragging. Highlighted on both, with their oil added up.
   */
  readonly boardRange = signal<BarRange | null>(null);
  /** The picked boards from the foul line to the end of the oil. */
  readonly boardStripe = computed(() => {
    const range = this.boardRange();
    return range === null ? null : boardStripe(range.from + 1, range.to + 1, this.byFoot().length);
  });
  readonly footRange = signal<BarRange | null>(null);

  readonly footBand = computed(() => {
    const range = this.footRange();
    return range === null ? null : footBand(range.from, range.to);
  });
  readonly boardReadout = computed(() => {
    const range = this.boardRange();
    if (range === null) {
      return 'Tap or drag across boards on the graph or the lane';
    }
    const { forward, reverse } = sumBars(this.byBoard(), range);
    const boards = range.from === range.to ? `Board ${boardName(range.from + 1)}` : `Boards ${boardName(range.from + 1)}–${boardName(range.to + 1)}`;
    return `${boards} · ${formatOil(forward, reverse)}`;
  });

  readonly footReadout = computed(() => {
    const range = this.footRange();
    if (range === null) {
      return 'Tap or drag across distances on the graph or the lane';
    }
    const { forward, reverse } = sumBars(this.byFoot(), range);
    return `${range.from}–${range.to + 1} ft · ${formatOil(forward, reverse)}`;
  });
  readonly imagesUrl = environment.imagesUrl;
  readonly boardTicks = BOARD_TICKS;

  readonly overlayViewBox = `0 0 ${CHART_W} ${CHART_H}`;
  #laneAnchor: { board: number | null; foot: number | null } = { board: null, foot: null };

  constructor() {
    addIcons({ arrowUpOutline, arrowDownOutline });
  }

  /** The new pick on a graph: tapping the only picked bar again clears it, anything else replaces the pick. */
  pickRange(current: BarRange | null, pick: BarPick): BarRange | null {
    const { from, to } = pick.range;
    const tappedSame = pick.start && current !== null && current.from === from && current.to === to;
    return tappedSame ? null : pick.range;
  }

  /** A tap on the lane picks the board and the distance under it; dragging picks everything from there to the finger. */
  onLanePointer(event: PointerEvent): void {
    if (event.type === 'pointermove' && event.buttons === 0) {
      return;
    }
    const matrix = this.overlay()?.nativeElement.getScreenCTM();
    if (!matrix) {
      return;
    }
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    const { board, foot } = chartPointToLane(point.x, point.y);
    const boardIndex = board === null ? null : board - 1;
    const footIndex = foot !== null && foot < this.byFoot().length ? foot : null;

    if (event.type === 'pointerdown') {
      this.#laneAnchor = { board: boardIndex, foot: footIndex };
      this.boardRange.set(boardIndex === null ? null : { from: boardIndex, to: boardIndex });
      this.footRange.set(footIndex === null ? null : { from: footIndex, to: footIndex });
      return;
    }
    // while dragging, a finger over the gutter or the pin deck keeps that side of the pick as it was
    const anchor = this.#laneAnchor;
    if (anchor.board !== null && boardIndex !== null) {
      this.boardRange.set({ from: Math.min(anchor.board, boardIndex), to: Math.max(anchor.board, boardIndex) });
    }
    if (anchor.foot !== null && footIndex !== null) {
      this.footRange.set({ from: Math.min(anchor.foot, footIndex), to: Math.max(anchor.foot, footIndex) });
    }
  }
}

/** Oil on boards or feet: the total and how it splits into forward (↑) and reverse (↓) passes. */
function formatOil(forward: number, reverse: number): string {
  const total = Math.round(forward + reverse);
  return total === 0 ? 'no oil' : `${total} µL · ${Math.round(forward)} ↑ ${Math.round(reverse)} ↓`;
}
