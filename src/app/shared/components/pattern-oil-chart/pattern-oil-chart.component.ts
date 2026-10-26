import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { OilBar } from 'src/app/core/utils/pattern-utils/pattern-oil.utils';

/** A label under the chart at a bar (0-based), or a band label over a range of bars above it. */
export interface ChartTick {
  at: number;
  label: string;
}
export interface ChartBand {
  from: number;
  label: string;
  to: number;
}

const BAR_W = 10;
const PLOT_H = 100;
const GRID_LINES = 3;

/**
 * Oil as stacked bars, forward passes below and reverse passes on top, like a pattern sheet's
 * "left to right" and "front to back" graphs. Stretches to the size it's given.
 */
@Component({
  selector: 'app-pattern-oil-chart',
  templateUrl: './pattern-oil-chart.component.html',
  styleUrl: './pattern-oil-chart.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PatternOilChartComponent {
  readonly bars = input.required<OilBar[]>();
  readonly color = input('red');
  readonly ticks = input<ChartTick[]>([]);
  readonly bands = input<ChartBand[]>([]);
  readonly label = input('');

  readonly #max = computed(() => Math.max(1, ...this.bars().map((b) => b.forward + b.reverse)));
  readonly width = computed(() => this.bars().length * BAR_W);

  readonly viewBox = computed(() => `0 0 ${this.width()} ${PLOT_H}`);
  readonly #y = (value: number) => PLOT_H - (value / this.#max()) * PLOT_H;

  readonly rects = computed(() =>
    this.bars().map((bar, i) => {
      const forwardTop = this.#y(bar.forward);
      const top = this.#y(bar.forward + bar.reverse);
      return {
        key: i,
        x: i * BAR_W + 0.5,
        forward: { y: forwardTop, height: PLOT_H - forwardTop },
        reverse: { y: top, height: forwardTop - top },
      };
    }),
  );

  readonly grid = computed(() => Array.from({ length: GRID_LINES }, (_, i) => (PLOT_H * i) / GRID_LINES));
  readonly tickMarks = computed(() => this.ticks().map((t) => ({ ...t, left: (((t.at + 0.5) * BAR_W) / this.width()) * 100 })));
  readonly bandMarks = computed(() =>
    this.bands().map((b) => ({ ...b, left: ((b.from * BAR_W) / this.width()) * 100, width: (((b.to - b.from + 1) * BAR_W) / this.width()) * 100 })),
  );

  readonly baseline = PLOT_H;
  readonly barWidth = BAR_W - 1;
}
