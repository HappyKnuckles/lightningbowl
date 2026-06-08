import { ChangeDetectionStrategy, Component, CUSTOM_ELEMENTS_SCHEMA, computed, input } from '@angular/core';
import { IonText, IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { arrowDown, arrowUp, informationCircleOutline } from 'ionicons/icons';
import { UtilsService } from 'src/app/core/services/utils/utils.service';
import { ConditionalNumberPipe } from 'src/app/shared/pipes/number-pipe/conditional-number.pipe';

interface StatRowVm {
  showDiff: boolean;
  difference: string;
  arrowIcon: string;
  diffColor: string;
}

@Component({
  selector: 'app-stat-row',
  templateUrl: './stat-row.component.html',
  styleUrls: ['./stat-row.component.scss'],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [IonText, IonIcon, ConditionalNumberPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatRowComponent {
  label = input.required<string>();
  currentStat = input.required<number>();
  toolTip = input<string>();
  prevStat = input<number>();
  secondaryStat = input<number>();
  id = input<string>();
  isPercentage = input<boolean>();

  vm = computed<StatRowVm>(() => {
    const current = this.currentStat();
    const prev = this.prevStat();
    const difference = this.utilsService.calculateStatDifference(current, prev!);

    return {
      showDiff: difference !== '0',
      difference,
      arrowIcon: this.utilsService.getArrowIcon(current, prev),
      diffColor: this.utilsService.getDiffColor(current, prev),
    };
  });

  constructor(private utilsService: UtilsService) {
    addIcons({ informationCircleOutline, arrowUp, arrowDown });
  }
}
