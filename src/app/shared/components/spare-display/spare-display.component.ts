import { CommonModule, NgIf, NgStyle } from '@angular/common';
import { ChangeDetectionStrategy, Component, CUSTOM_ELEMENTS_SCHEMA, inject, Input } from '@angular/core';
import { IonText, IonCol, IonRow, IonIcon, IonGrid } from '@ionic/angular/standalone';
import { PrevStats, SessionStats, Stats } from 'src/app/core/models/stats.model';
import { addIcons } from 'ionicons';
import { arrowDown, arrowUp, informationCircleOutline } from 'ionicons/icons';
import { UtilsService } from 'src/app/core/services/utils/utils.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-spare-display',
  templateUrl: './spare-display.component.html',
  styleUrls: ['./spare-display.component.scss'],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [IonText, IonCol, IonRow, IonIcon, IonGrid, NgIf, NgStyle, CommonModule, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SpareDisplayComponent {
  @Input({ required: true }) stats!: Stats | SessionStats;
  @Input() title = '';
  @Input() prevStats?: PrevStats | Stats;
  @Input() id?: string;

  private utilsService = inject(UtilsService);
  private translate = inject(TranslateService);

  constructor() {
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
    if (i === 0) return this.translate.instant('SPARE_DISPLAY.OVERALL');
    if (i === 1) return this.translate.instant('SPARE_DISPLAY.ONE_PIN');
    return this.translate.instant('SPARE_DISPLAY.N_PINS', { count: i });
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
