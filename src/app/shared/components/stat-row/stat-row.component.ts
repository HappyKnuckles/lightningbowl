import { NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component, CUSTOM_ELEMENTS_SCHEMA, Input, OnChanges, SimpleChanges } from '@angular/core';
import { IonText, IonIcon } from '@ionic/angular/standalone';
import { ConditionalNumberPipe } from '../../pipes/number-pipe/conditional-number.pipe';
import { addIcons } from 'ionicons';
import { arrowDown, arrowUp, informationCircleOutline } from 'ionicons/icons';
import { UtilsService } from 'src/app/core/services/utils/utils.service';

@Component({
  selector: 'app-stat-row',
  templateUrl: './stat-row.component.html',
  styleUrls: ['./stat-row.component.scss'],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [NgIf, IonText, IonIcon, ConditionalNumberPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatRowComponent implements OnChanges {
  @Input({ required: true }) label!: string;
  @Input({ required: true }) currentStat!: number;
  @Input() toolTip?: string;
  @Input() prevStat?: number;
  @Input() secondaryStat?: number;
  @Input() id?: string;
  @Input() isPercentage?: boolean;

  statDifference = '0';

  constructor(private utilsService: UtilsService) {
    addIcons({ informationCircleOutline, arrowUp, arrowDown });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['currentStat'] || changes['prevStat']) {
      this.statDifference = this.calculateStatDifference(this.currentStat, this.prevStat!);
    }
  }

  getArrowIcon(currentValue: number, previousValue?: number): string {
    return this.utilsService.getArrowIcon(currentValue, previousValue);
  }

  getDiffColor(currentValue: number, previousValue?: number): string {
    return this.utilsService.getDiffColor(currentValue, previousValue);
  }

  private calculateStatDifference(currentValue: number, previousValue: number): string {
    return this.utilsService.calculateStatDifference(currentValue, previousValue);
  }
}
