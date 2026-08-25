import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { StatDefinition } from 'src/app/core/models/stat-definitions.model';
import { GameStats } from 'src/app/core/models/stats.model';

import { StatRowComponent } from './stat-row/stat-row.component';

interface StatRowVm {
  key: string;
  label: string;
  current: number;
  prev: number | undefined;
  secondary: number | undefined;
  toolTip: StatDefinition['toolTip'];
  id: StatDefinition['id'];
  isPercentage: StatDefinition['isPercentage'];
}

@Component({
  selector: 'app-stat-display',
  templateUrl: './stat-display.component.html',
  styleUrls: ['./stat-display.component.scss'],
  imports: [StatRowComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatDisplayComponent {
  statDefinitions = input.required<StatDefinition[]>();
  title = input<string>('');
  currentStats = input.required<GameStats>();
  prevStats = input<GameStats>();

  rows = computed<StatRowVm[]>(() => {
    const current = this.currentStats();
    const prev = this.prevStats();

    return this.statDefinitions()
      .map((stat) => {
        const value = this.readNumeric(current, stat.key);
        if (value === undefined) return undefined;

        return {
          key: stat.key,
          label: stat.label,
          current: value,
          prev: stat.prevKey ? this.readNumeric(prev, stat.prevKey) : undefined,
          secondary: stat.secondaryKey ? this.readNumeric(current, stat.secondaryKey) : undefined,
          toolTip: stat.toolTip,
          id: stat.id,
          isPercentage: stat.isPercentage,
        } satisfies StatRowVm;
      })
      .filter((row): row is StatRowVm => row !== undefined);
  });

  private readNumeric(stats: GameStats | undefined, key: string): number | undefined {
    if (!stats) return undefined;
    const value = stats[key];
    return typeof value === 'number' ? value : undefined;
  }
}
