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
import { ballValueMatches } from 'src/app/core/utils/game-utils/ball.utils';
import { countBallUsage, rankByUsage } from 'src/app/core/utils/game-utils/usage.utils';

@Component({
  selector: 'app-ball-select',
  imports: [IonItem, IonAvatar, IonList, IonLabel, IonTitle, IonHeader, IonContent, IonCheckbox, IonButton, IonToolbar, IonFooter, IonButtons],
  templateUrl: './ball-select.component.html',
  styleUrls: ['./ball-select.component.scss'],
})
export class BallSelectComponent implements OnInit {
  ballsStore = inject(BallsStore);
  #gamesStore = inject(GamesStore);

  selectedBalls = input.required<string[] | undefined>();
  singleSelect = input<boolean>(false);

  ballSelect = output<string[]>();

  /** Arsenal sorted by how often each ball was thrown, most used first. */
  rankedArsenal = computed(() => {
    const usage = countBallUsage(this.#gamesStore.games());
    return rankByUsage(this.ballsStore.arsenal(), usage, (ball) => ball.ball_name + ball.core_weight);
  });

  #tempSelectedBalls = signal<string[]>([]);

  get tempSelectedBalls() {
    return this.#tempSelectedBalls();
  }

  ngOnInit(): void {
    this.#tempSelectedBalls.set([...this.selectedBalls()!]);
  }

  /**
   * Selections are stored as "Name{weight}" keys, but games saved before weights were tracked
   * hold plain names, so a stored value is matched against the ball rather than compared as a
   * string — otherwise reopening the picker on an older game shows nothing ticked.
   */
  toggleBallSelection(ballName: string, ballWeight: string): void {
    const ball = { ball_name: ballName, core_weight: ballWeight };
    const currentSelection = this.#tempSelectedBalls();
    const isSelected = currentSelection.some((value) => ballValueMatches(value, ball));

    if (this.singleSelect()) {
      this.#tempSelectedBalls.set(isSelected ? [] : [ballName + ballWeight]);
      return;
    }

    if (isSelected) {
      this.#tempSelectedBalls.set(currentSelection.filter((value) => !ballValueMatches(value, ball)));
    } else {
      this.#tempSelectedBalls.set([...currentSelection, ballName + ballWeight]);
    }
  }

  isBallSelected(ballName: string, ballWeight: string): boolean {
    return this.#tempSelectedBalls().some((value) => ballValueMatches(value, { ball_name: ballName, core_weight: ballWeight }));
  }

  confirmBallSelection(): void {
    this.ballSelect.emit(this.#tempSelectedBalls());
  }

  cancelBallSelection(): void {
    this.#tempSelectedBalls.set([...this.selectedBalls()!]);
    this.ballSelect.emit(this.selectedBalls()!);
  }
}
