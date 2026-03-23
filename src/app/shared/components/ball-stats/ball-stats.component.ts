import { Component, input } from '@angular/core';
import { BestBallStats } from 'src/app/core/models/stats.model';
import { IonImg, IonListHeader, IonList } from '@ionic/angular/standalone';
import { BallsStore } from 'src/app/core/stores/balls.store';

@Component({
  selector: 'app-ball-stats',
  imports: [IonList, IonListHeader, IonImg],
  templateUrl: './ball-stats.component.html',
  styleUrl: './ball-stats.component.scss',
})
export class BallStatsComponent {
  bestBall = input.required<BestBallStats>();
  title = input.required<string>();

  totalGames = input.required<number>();

  constructor(public ballsStore: BallsStore) {}
}
