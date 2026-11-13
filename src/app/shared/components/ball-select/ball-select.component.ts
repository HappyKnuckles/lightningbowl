import { BallImagePipe } from 'src/app/shared/pipes/ball-image-pipe/ball-image.pipe';
import { Component, computed, inject, input, output, signal, OnInit } from '@angular/core';
import {
  IonButtons,
  IonFooter,
  IonToolbar,
  IonButton,
  IonCheckbox,
  IonContent,
  IonHeader,
  IonTitle,
  IonLabel,
  IonList,
  IonAvatar,
  IonItem,
} from '@ionic/angular/standalone';
import { BallsStore } from 'src/app/core/stores/balls.store';
import { GamesStore } from 'src/app/core/stores/games.store';
import { ThrowBall } from 'src/app/core/models/game.model';
import { sameGameBall } from 'src/app/core/utils/game-utils/ball.utils';
import { countBallUsage, rankByUsage } from 'src/app/core/utils/game-utils/usage.utils';

@Component({
  selector: 'app-ball-select',
  imports: [
    BallImagePipe,
    IonItem,
    IonAvatar,
    IonList,
    IonLabel,
    IonTitle,
    IonHeader,
    IonContent,
    IonCheckbox,
    IonButton,
    IonToolbar,
    IonFooter,
    IonButtons,
  ],
  templateUrl: './ball-select.component.html',
  styleUrls: ['./ball-select.component.scss'],
})
export class BallSelectComponent implements OnInit {
  ballsStore = inject(BallsStore);
  #gamesStore = inject(GamesStore);

  selectedBalls = input.required<ThrowBall[] | undefined>();
  singleSelect = input<boolean>(false);

  ballSelect = output<ThrowBall[]>();

  /** Arsenal sorted by how often each ball was thrown, most used first. */
  rankedArsenal = computed(() => {
    const usage = countBallUsage(this.#gamesStore.games());
    return rankByUsage(this.ballsStore.arsenal(), usage, (ball) => ball.ball_name + ball.core_weight);
  });

  #tempSelectedBalls = signal<ThrowBall[]>([]);

  get tempSelectedBalls() {
    return this.#tempSelectedBalls();
  }

  ngOnInit(): void {
    this.#tempSelectedBalls.set([...this.selectedBalls()!]);
  }

  toggleBallSelection(ballName: string, ballWeight: string): void {
    const ball: ThrowBall = { name: ballName, weight: ballWeight };
    const currentSelection = this.#tempSelectedBalls();
    const isSelected = currentSelection.some((selected) => sameGameBall(selected, ball));

    if (this.singleSelect()) {
      this.#tempSelectedBalls.set(isSelected ? [] : [ball]);
      return;
    }

    if (isSelected) {
      this.#tempSelectedBalls.set(currentSelection.filter((selected) => !sameGameBall(selected, ball)));
    } else {
      this.#tempSelectedBalls.set([...currentSelection, ball]);
    }
  }

  isBallSelected(ballName: string, ballWeight: string): boolean {
    return this.#tempSelectedBalls().some((selected) => sameGameBall(selected, { name: ballName, weight: ballWeight }));
  }

  confirmBallSelection(): void {
    this.ballSelect.emit(this.#tempSelectedBalls());
  }

  cancelBallSelection(): void {
    this.#tempSelectedBalls.set([...this.selectedBalls()!]);
    this.ballSelect.emit(this.selectedBalls()!);
  }
}
