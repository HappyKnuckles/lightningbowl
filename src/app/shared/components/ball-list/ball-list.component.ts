import { ChangeDetectionStrategy, Component, Input, Output, EventEmitter } from '@angular/core';
import { IonItem, IonContent, IonAvatar, IonImg, IonList, IonLabel, IonHeader, IonToolbar, IonTitle } from '@ionic/angular/standalone';
import { Ball } from 'src/app/core/models/ball.model';
import { StorageService } from 'src/app/core/services/storage/storage.service';

@Component({
  selector: 'app-ball-list',
  templateUrl: './ball-list.component.html',
  styleUrls: ['./ball-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonTitle, IonToolbar, IonHeader, IonLabel, IonList, IonImg, IonAvatar, IonItem, IonContent],
})
export class BallListComponent {
  @Input() balls: Ball[] = [];
  @Input() isCoverstock = false;
  @Input() title?: string;
  @Output() ballSelected = new EventEmitter<Ball>();

  constructor(public storageService: StorageService) {}

  onBallClick(ball: Ball): void {
    this.ballSelected.emit(ball);
  }
}
