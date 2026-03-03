import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { StatDefinition } from 'src/app/core/models/stat-definitions.model';
import { StatRowComponent } from '../stat-row/stat-row.component';
import { GameStats } from 'src/app/core/models/stats.model';
import { IonList, IonListHeader } from '@ionic/angular/standalone';
import { NgIf } from '@angular/common';

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
