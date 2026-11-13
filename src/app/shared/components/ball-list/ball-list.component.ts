import { BallImagePipe } from 'src/app/shared/pipes/ball-image-pipe/ball-image.pipe';
import { ChangeDetectionStrategy, Component, Input, Output, EventEmitter } from '@angular/core';
import { IonItem, IonContent, IonAvatar, IonImg, IonList, IonLabel, IonHeader, IonToolbar, IonTitle } from '@ionic/angular/standalone';
import { Ball } from 'src/app/core/models/ball.model';
import { BallsStore } from 'src/app/core/stores/balls.store';

@Component({
  selector: 'app-ball-list',
  templateUrl: './ball-list.component.html',
  styleUrls: ['./ball-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BallImagePipe, IonTitle, IonToolbar, IonHeader, IonLabel, IonList, IonImg, IonAvatar, IonItem, IonContent],
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
