import { NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { IonList, IonListHeader } from '@ionic/angular/standalone';
import { StatDefinition } from '@models/stat-definitions.model';
import { GameStats } from '@models/stats.model';
import { StatRowComponent } from '../stat-row/stat-row.component';

@Component({
  selector: 'app-stat-display',
  templateUrl: './stat-display.component.html',
  styleUrls: ['./stat-display.component.scss'],
  imports: [IonListHeader, IonList, NgIf, StatRowComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatDisplayComponent {
  @Input() statDefinitions: StatDefinition[] = [];
  @Input() title = '';
  @Input() currentStats!: GameStats;
  @Input() prevStats?: GameStats;

  getNumericStat(stats: GameStats | undefined, key: string): number | undefined {
    if (!stats) return undefined;
    const value = stats[key];
    return typeof value === 'number' ? value : undefined;
  }
}
