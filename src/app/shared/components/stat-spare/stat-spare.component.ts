import { ChangeDetectionStrategy, Component, computed, CUSTOM_ELEMENTS_SCHEMA, input } from '@angular/core';
import { IonIcon, IonText } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { arrowDown, arrowUp, informationCircleOutline } from 'ionicons/icons';
import { PINS } from 'src/app/core/constants/app.constants';
import { PrevStats, Stats } from 'src/app/core/models/stats.model';
import { UtilsService } from 'src/app/core/utils/utils.service';

interface SpareRow {
  pin: number;
  label: string;
  hit: number;
  miss: number;
  empty: boolean;
  barWidth: number;
  rate: number;
  rateText: string;
  rateColor: string;
  arrow: string; // '' = no arrow
  diffColor: string;
  diff: string; // '' = "0", hide popover
  triggerId: string;
}

interface SpareSummary {
  hasAttempts: boolean;
  rate: number;
  rateText: string;
  rateColor: string;
  hit: number;
  miss: number;
  attempts: number;
  arrow: string;
  diffColor: string;
  diff: string;
  fillValue: number;
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

  constructor(private utils: UtilsService) {
    addIcons({ informationCircleOutline, arrowUp, arrowDown });
  }

  readonly overall = computed<SpareSummary>(() => {
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
      arrow: prev ? this.utils.getArrowIcon(stats.overallSpareRate, prev.overallSpareRate) : '',
      diffColor: prev ? this.utils.getDiffColor(stats.overallSpareRate, prev.overallSpareRate) : '',
      diff: prev ? this.hideZeroDiff(this.utils.calculateStatDifference(stats.overallSpareRate, prev.overallSpareRate)) : '',
      fillValue: stats.overallSpareRate || 1,
      triggerId: 'overall' + this.id(),
    };
  });

  readonly rows = computed<SpareRow[]>(() => {
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
        arrow: prev ? this.utils.getArrowIcon(rate, prevRate) : '',
        diffColor: prev ? this.utils.getDiffColor(rate, prevRate) : '',
        diff: prev ? this.hideZeroDiff(this.utils.calculateStatDifference(rate, prevRate)) : '',
        triggerId: id + i,
      };
    });
  });

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
