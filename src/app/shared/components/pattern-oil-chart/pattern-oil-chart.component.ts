import { ChangeDetectionStrategy, Component, computed, ElementRef, inject, input, output } from '@angular/core';

import { BarRange, OilBar } from 'src/app/core/utils/pattern-utils/pattern-oil.utils';

/** A picked run of bars; `start` is set on the tap that begins it, not while dragging it wider. */
export interface BarPick {
  range: BarRange;
  start: boolean;
}

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
 * "left to right" and "front to back" graphs. Stretches to the size it's given. A tap picks the bar
 * under the finger, dragging picks every bar from there to the finger; the picked bars are highlighted.
 */
@Component({
  selector: 'app-pattern-oil-chart',
  templateUrl: './pattern-oil-chart.component.html',
  styleUrl: './pattern-oil-chart.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(pointerdown)': 'onPointer($event)', '(pointermove)': 'onPointer($event)' },
})
export class PatternOilChartComponent {
  readonly #host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  readonly bars = input.required<OilBar[]>();
  readonly color = input('red');
  readonly ticks = input<ChartTick[]>([]);
  readonly bands = input<ChartBand[]>([]);
  readonly label = input('');
  /** The highlighted bars. */
  readonly selected = input<BarRange | null>(null);

  /** The bars tapped or dragged across. */
  readonly barPick = output<BarPick>();
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

  readonly selectedColumn = computed(() => {
    const range = this.selected();
    if (!range) {
      return null;
    }
    const from = Math.max(0, range.from);
    const to = Math.min(this.bars().length - 1, range.to);
    return to < from ? null : { x: from * BAR_W, width: (to - from + 1) * BAR_W };
  });
  readonly baseline = PLOT_H;
  readonly barWidth = BAR_W - 1;

  readonly plotHeight = PLOT_H;
  #anchor = 0;
  #last: number | null = null;

  onPointer(event: PointerEvent): void {
    // moves only count while pressed, so hovering with a mouse does nothing
    if (event.type === 'pointermove' && event.buttons === 0) {
      return;
    }
    const rect = this.#host.getBoundingClientRect();
    const count = this.bars().length;
    if (rect.width === 0 || count === 0) {
      return;
    }
    const index = Math.min(count - 1, Math.max(0, Math.floor(((event.clientX - rect.left) / rect.width) * count)));
    if (event.type === 'pointerdown') {
      this.#anchor = index;
      this.#last = index;
      this.barPick.emit({ range: { from: index, to: index }, start: true });
    } else if (index !== this.#last) {
      this.#last = index;
      this.barPick.emit({ range: { from: Math.min(this.#anchor, index), to: Math.max(this.#anchor, index) }, start: false });
    }
  }
}
