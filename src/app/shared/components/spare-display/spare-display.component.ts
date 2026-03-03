import { CommonModule, NgIf, NgStyle } from '@angular/common';
import { ChangeDetectionStrategy, Component, CUSTOM_ELEMENTS_SCHEMA, Input } from '@angular/core';
import { IonText, IonCol, IonRow, IonIcon, IonGrid } from '@ionic/angular/standalone';
import { PrevStats, SessionStats, Stats } from 'src/app/core/models/stats.model';
import { addIcons } from 'ionicons';
import { arrowDown, arrowUp, informationCircleOutline } from 'ionicons/icons';
import { UtilsService } from 'src/app/core/services/utils/utils.service';

@Component({
  selector: 'app-spare-display',
  templateUrl: './spare-display.component.html',
  styleUrls: ['./spare-display.component.scss'],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [IonText, IonCol, IonRow, IonIcon, IonGrid, NgIf, NgStyle, CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SpareDisplayComponent {
  @Input({ required: true }) stats!: Stats | SessionStats;
  @Input() title = '';
  @Input() prevStats?: PrevStats | Stats;
  @Input() id?: string;
  constructor(private utilsService: UtilsService) {
    addIcons({ informationCircleOutline, arrowUp, arrowDown });
  }

  calculateStatDifference(currentValue: number, previousValue: number): string {
    return this.utilsService.calculateStatDifference(currentValue, previousValue);
  }

  getArrowIcon(currentValue: number, previousValue: number): string {
    return this.utilsService.getArrowIcon(currentValue, previousValue);
  }

  getDiffColor(currentValue: number, previousValue: number): string {
    return this.utilsService.getDiffColor(currentValue, previousValue);
  }

  getLabel(i: number): string {
    if (i === 0) return 'Overall';
    if (i === 1) return `${i} Pin`;
    return `${i} Pins`;
  }

  getRateColor(conversionRate: number): string {
    if (conversionRate > 95) {
      return '#4faeff';
    } else if (conversionRate > 75) {
      return '#008000';
    } else if (conversionRate > 50) {
      return '#809300';
    } else if (conversionRate > 33) {
      return '#FFA500';
    } else {
      return '#FF0000';
    }
  }
}
