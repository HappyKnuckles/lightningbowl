import { Component, computed, ElementRef, input, signal, viewChild } from '@angular/core';
import { IonCol, IonGrid, IonIcon, IonListHeader, IonRow } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { arrowDownOutline, arrowUpOutline } from 'ionicons/icons';

import { FitScreenDirective } from 'src/app/core/directives/fit-screen/fit-screen.directive';
import { Pattern } from 'src/app/core/models/pattern.model';
import { boardName, boardStripe, CHART_H, CHART_W, chartPointToLane, footBand } from 'src/app/core/utils/pattern-utils/pattern-chart-geometry.utils';
import { blockRatios, oilByBoard, oilByFoot, patternFacts, patternRatioColor } from 'src/app/core/utils/pattern-utils/pattern-oil.utils';
import { environment } from 'src/environments/environment';

import { PatternOilChartComponent } from '../pattern-oil-chart/pattern-oil-chart.component';

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
  /** Board (1-39 from the left) and foot (0-based) picked on the chart or a graph; highlighted in both. */
  readonly selectedBoard = signal<number | null>(null);
  readonly selectedBoardIndex = computed(() => (this.selectedBoard() === null ? null : this.selectedBoard()! - 1));

  /** The selected board from the foul line to the end of the oil. */
  readonly boardStripe = computed(() => {
    const board = this.selectedBoard();
    return board === null ? null : boardStripe(board, this.byFoot().length);
  });
  readonly selectedFoot = signal<number | null>(null);
  readonly footBand = computed(() => {
    const foot = this.selectedFoot();
    return foot === null ? null : footBand(foot);
  });

  readonly boardReadout = computed(() => {
    const board = this.selectedBoard();
    if (board === null) {
      return 'Tap a board on the graph or the lane';
    }
    const bar = this.byBoard()[board - 1];
    return `Board ${boardName(board)} · ${formatOil(bar.forward, bar.reverse)}`;
  });
  readonly footReadout = computed(() => {
    const foot = this.selectedFoot();
    const bar = foot === null ? undefined : this.byFoot()[foot];
    if (foot === null || !bar) {
      return 'Tap a distance on the graph or the lane';
    }
    return `${foot}–${foot + 1} ft · ${formatOil(bar.forward, bar.reverse)}`;
  });
  readonly imagesUrl = environment.imagesUrl;

  readonly boardTicks = BOARD_TICKS;
  readonly overlayViewBox = `0 0 ${CHART_W} ${CHART_H}`;

  constructor() {
    addIcons({ arrowUpOutline, arrowDownOutline });
  }

  /** Tapping the selected board again clears it; dragging across the graph moves it. */
  selectBoard(board: number): void {
    this.selectedBoard.update((current) => (current === board ? null : board));
  }

  selectFoot(foot: number): void {
    this.selectedFoot.update((current) => (current === foot ? null : foot));
  }

  /** A tap on the lane picks the board and the distance under it. */
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
    this.selectedBoard.set(board);
    this.selectedFoot.set(foot !== null && foot < this.byFoot().length ? foot : null);
  }
}

/** Oil on a board or foot: the total and how it splits into forward (↑) and reverse (↓) passes. */
function formatOil(forward: number, reverse: number): string {
  const total = Math.round(forward + reverse);
  return total === 0 ? 'no oil' : `${total} µL · ${Math.round(forward)} ↑ ${Math.round(reverse)} ↓`;
}
