import { ChangeDetectionStrategy, Component, computed, CUSTOM_ELEMENTS_SCHEMA, input } from '@angular/core';
import { IonIcon, IonText } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { arrowDown, arrowUp, informationCircleOutline } from 'ionicons/icons';

import { PINS } from 'src/app/core/constants/app.constants';
import { PrevStats, Stats } from 'src/app/core/models/stats.model';
import { UtilsService } from 'src/app/core/utils/utils.service';

interface SpareRow {
  arrow: string; // '' = no arrow
  barWidth: number;
  diff: string; // '' = "0", hide popover
  diffColor: string;
  empty: boolean;
  hit: number;
  label: string;
  miss: number;
  pin: number;
  rate: number;
  rateColor: string;
  rateText: string;
  triggerId: string;
}

interface SpareSummary {
  arrow: string;
  attempts: number;
  diff: string;
  diffColor: string;
  fillValue: number;
  hasAttempts: boolean;
  hit: number;
  miss: number;
  rate: number;
  rateColor: string;
  rateText: string;
  triggerId: string;
}

@Component({
  selector: 'app-stat-spare',
  templateUrl: './stat-spare.component.html',
  styleUrls: ['./stat-spare.component.scss'],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [IonText, IonIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatSpareComponent {
  readonly stats = input.required<Stats>();
  readonly title = input('');
  readonly prevStats = input<PrevStats | Stats>();
  readonly id = input('');

  readonly overallVm = computed<SpareSummary>(() => {
    const stats = this.stats();
    const prev = this.prevStats();
    const attempts = stats.totalSparesConverted + stats.totalSparesMissed;
    return {
      hasAttempts: attempts > 0,
      rate: stats.overallSpareRate,
      rateText: stats.overallSpareRate.toFixed(2),
      rateColor: this.rateColor(stats.overallSpareRate),
      hit: stats.totalSparesConverted,
      miss: stats.totalSparesMissed,
      attempts,
      arrow: prev ? this.utilsService.getArrowIcon(stats.overallSpareRate, prev.overallSpareRate) : '',
      diffColor: prev ? this.utilsService.getDiffColor(stats.overallSpareRate, prev.overallSpareRate) : '',
      diff: prev ? this.hideZeroDiff(this.utilsService.formatStatDifference(stats.overallSpareRate, prev.overallSpareRate)) : '',
      fillValue: stats.overallSpareRate || 1,
      triggerId: 'overall' + this.id(),
    };
  });

  readonly rowVms = computed<SpareRow[]>(() => {
    const stats = this.stats();
    const prev = this.prevStats();
    const id = this.id();
    const max = this.maxAttempts(stats);

    return PINS.map((i) => {
      const hit = stats.pinCounts[i] ?? 0;
      const miss = stats.missedCounts[i] ?? 0;
      const empty = hit === 0 && miss === 0;
      const rate = stats.spareRates[i] ?? 0;
      const prevRate = prev?.spareRates[i] ?? 0;

      return {
        pin: i,
        label: i === 1 ? `${i} Pin` : `${i} Pins`,
        hit,
        miss,
        empty,
        barWidth: max === 0 ? 0 : ((hit + miss) / max) * 100,
        rate,
        rateText: rate.toFixed(2),
        rateColor: this.rateColor(rate),
        arrow: prev ? this.utilsService.getArrowIcon(rate, prevRate) : '',
        diffColor: prev ? this.utilsService.getDiffColor(rate, prevRate) : '',
        diff: prev ? this.hideZeroDiff(this.utilsService.formatStatDifference(rate, prevRate)) : '',
        triggerId: id + i,
      };
    });
  });

  constructor(private utilsService: UtilsService) {
    addIcons({ informationCircleOutline, arrowUp, arrowDown });
  }

  private maxAttempts(s: Stats): number {
    let max = 0;
    for (const i of PINS) {
      const total = (s.pinCounts[i] ?? 0) + (s.missedCounts[i] ?? 0);
      if (total > max) max = total;
    }
    return max;
  }

  private hideZeroDiff(diff: string): string {
    return diff === '0' ? '' : diff;
  }

  private rateColor(rate: number): string {
    if (rate > 95) return '#4faeff';
    if (rate > 75) return '#008000';
    if (rate > 50) return '#809300';
    if (rate > 33) return '#FFA500';
    return '#FF0000';
  }
}
