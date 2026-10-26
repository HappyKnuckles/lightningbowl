import { Component, computed, input } from '@angular/core';
import { IonCol, IonGrid, IonIcon, IonListHeader, IonRow } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { arrowDownOutline, arrowUpOutline } from 'ionicons/icons';

import { FitScreenDirective } from 'src/app/core/directives/fit-screen/fit-screen.directive';
import { Pattern } from 'src/app/core/models/pattern.model';
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
  readonly imagesUrl = environment.imagesUrl;
  readonly boardTicks = BOARD_TICKS;

  constructor() {
    addIcons({ arrowUpOutline, arrowDownOutline });
  }
}
