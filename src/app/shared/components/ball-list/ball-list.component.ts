import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { IonAvatar, IonContent, IonHeader, IonImg, IonItem, IonLabel, IonList, IonTitle, IonToolbar } from '@ionic/angular/standalone';
import { Ball } from '@models/ball.model';
import { BallsStore } from '@stores/balls.store';

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

  constructor(public ballsStore: BallsStore) {}

  onBallClick(ball: Ball): void {
    this.ballSelected.emit(ball);
  }
}
