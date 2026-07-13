import { Component, inject, input, output, signal, OnInit } from '@angular/core';
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

@Component({
  selector: 'app-ball-select',
  imports: [IonItem, IonAvatar, IonList, IonLabel, IonTitle, IonHeader, IonContent, IonCheckbox, IonButton, IonToolbar, IonFooter, IonButtons],
  templateUrl: './ball-select.component.html',
  styleUrls: ['./ball-select.component.scss'],
})
export class BallSelectComponent implements OnInit {
  ballsStore = inject(BallsStore);

  selectedBalls = input.required<string[] | undefined>();
  singleSelect = input<boolean>(false);

  ballSelect = output<string[]>();

  #tempSelectedBalls = signal<string[]>([]);

  get tempSelectedBalls() {
    return this.#tempSelectedBalls();
  }

  ngOnInit(): void {
    this.#tempSelectedBalls.set([...this.selectedBalls()!]);
  }

  toggleBallSelection(ballName: string, ballWeight: string): void {
    const currentSelection = this.#tempSelectedBalls();
    const index = currentSelection.indexOf(ballName + ballWeight);

    if (this.singleSelect()) {
      if (index > -1) {
        this.#tempSelectedBalls.set([]);
      } else {
        this.#tempSelectedBalls.set([ballName + ballWeight]);
      }
      return;
    }

    if (index > -1) {
      const updated = currentSelection.filter((name) => name !== ballName + ballWeight);
      this.#tempSelectedBalls.set(updated);
    } else {
      this.#tempSelectedBalls.set([...currentSelection, ballName + ballWeight]);
    }
  }

  isBallSelected(ballName: string, ballWeight: string): boolean {
    return this.#tempSelectedBalls().includes(ballName + ballWeight);
  }

  confirmBallSelection(): void {
    this.ballSelect.emit(this.#tempSelectedBalls());
  }

  cancelBallSelection(): void {
    this.#tempSelectedBalls.set([...this.selectedBalls()!]);
    this.ballSelect.emit(this.selectedBalls()!);
  }
}
