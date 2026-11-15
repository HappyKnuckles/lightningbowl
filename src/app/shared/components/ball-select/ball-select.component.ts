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
import { Ball } from 'src/app/core/models/ball.model';
import { twinLabel } from 'src/app/core/utils/ball-utils/arsenal-ball.utils';
import { getThrowBallKey, sameGameBall, toThrowBall } from 'src/app/core/utils/game-utils/game-ball.utils';
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

  #tempSelectedBalls = signal<ThrowBall[]>([]);

  /**
   * The arsenal, most thrown ball first, each with whether it is selected and its second line: the
   * brand, plus what tells two of the same ball apart (on its own line, as a long name is cut off).
   */
  rows = computed(() => {
    const arsenal = this.ballsStore.arsenal();
    const usage = countBallUsage(this.#gamesStore.games());
    const selected = new Set(this.#tempSelectedBalls().map(getThrowBallKey));
    return rankByUsage(arsenal, usage, (ball) => getThrowBallKey(toThrowBall(ball))).map((ball) => ({
      ball,
      detail: [ball.brand_name, twinLabel(ball, arsenal)].filter(Boolean).join(' · '),
      selected: selected.has(getThrowBallKey(toThrowBall(ball))),
    }));
  });

  get tempSelectedBalls() {
    return this.#tempSelectedBalls();
  }

  ngOnInit(): void {
    this.#tempSelectedBalls.set([...this.selectedBalls()!]);
  }

  toggleBallSelection(arsenalBall: Ball): void {
    const ball = toThrowBall(arsenalBall);
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

  confirmBallSelection(): void {
    this.ballSelect.emit(this.#tempSelectedBalls());
  }

  cancelBallSelection(): void {
    this.#tempSelectedBalls.set([...this.selectedBalls()!]);
    this.ballSelect.emit(this.selectedBalls()!);
  }
}
