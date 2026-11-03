import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import Chart from 'chart.js/auto';

import { ChartTick, generateOilChart } from 'src/app/core/services/chart/generation/oil-chart-generator';
import { ChartBand } from 'src/app/core/services/chart/plugins/oil-chart.plugin';
import { BarRange, OilBar } from 'src/app/core/utils/pattern-utils/pattern-oil.utils';

/** A picked run of bars; `start` is set on the tap that begins it, not while dragging it wider. */
export interface BarPick {
  range: BarRange;
  start: boolean;
}

/**
 * Oil per board or per foot as a stacked bar chart that stretches to the size it's given. A tap picks the
 * bar under the finger, dragging picks every bar from there to the finger; the picked bars are highlighted.
 */
@Component({
  selector: 'app-pattern-oil-chart',
  templateUrl: './pattern-oil-chart.component.html',
  styleUrl: './pattern-oil-chart.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(pointerdown)': 'onPointer($event)', '(pointermove)': 'onPointer($event)' },
})
export class PatternOilChartComponent {
  readonly bars = input.required<OilBar[]>();
  readonly color = input('red');
  readonly ticks = input<ChartTick[]>([]);
  readonly bands = input<ChartBand[]>([]);
  readonly label = input('');
  /** The highlighted bars. */
  readonly selected = input<BarRange | null>(null);

  /** The bars tapped or dragged across. */
  readonly barPick = output<BarPick>();
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');

  readonly #rendered = signal(false);
  /** The Chart.js instance, once the canvas is rendered. */
  chart: Chart<'bar'> | undefined;
  #anchor = 0;
  #last: number | null = null;

  constructor() {
    afterNextRender(() => this.#rendered.set(true));
    effect(() => {
      const data = { bars: this.bars(), color: this.color(), ticks: this.ticks(), bands: this.bands(), selected: this.selected() };
      if (this.#rendered()) {
        this.chart = generateOilChart(this.canvas(), data, this.chart);
      }
    });
    inject(DestroyRef).onDestroy(() => this.chart?.destroy());
  }

  onPointer(event: PointerEvent): void {
    // moves only count while pressed, so hovering with a mouse does nothing
    if (event.type === 'pointermove' && event.buttons === 0) {
      return;
    }
    const area = this.chart?.chartArea;
    const count = this.bars().length;
    if (!area || area.width <= 0 || count === 0) {
      return;
    }
    const x = event.clientX - this.canvas().nativeElement.getBoundingClientRect().left;
    const index = Math.min(count - 1, Math.max(0, Math.floor(((x - area.left) / area.width) * count)));
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
