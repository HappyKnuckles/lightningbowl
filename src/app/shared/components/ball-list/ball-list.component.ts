import { ChangeDetectionStrategy, Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { IonItem, IonContent, IonAvatar, IonImg, IonList, IonLabel, IonHeader, IonToolbar, IonTitle } from '@ionic/angular/standalone';
import { Ball } from 'src/app/core/models/ball.model';
import { StorageService } from 'src/app/core/services/storage/storage.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-ball-list',
  templateUrl: './ball-list.component.html',
  styleUrls: ['./ball-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonTitle, IonToolbar, IonHeader, IonLabel, IonList, IonImg, IonAvatar, IonItem, IonContent, TranslateModule],
})
export class BallListComponent {
  @Input() balls: Ball[] = [];
  @Input() isCoverstock = false;
  @Input() title?: string;
  @Output() ballSelected = new EventEmitter<Ball>();

  private translate = inject(TranslateService);

  constructor(public storageService: StorageService) {}

  getTitle(): string {
    if (this.title) return this.title;
    if (this.balls.length === 0) return '';
    if (this.isCoverstock) {
      return this.translate.instant('BALLS.COVERSTOCK_WITH_NAME', { name: this.balls[0].coverstock_name });
    }
    return this.translate.instant('BALLS.CORE_WITH_NAME', { name: this.balls[0].core_name });
  }

  onBallClick(ball: Ball): void {
    this.ballSelected.emit(ball);
  }
}
