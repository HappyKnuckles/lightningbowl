import { Component, inject, input, OnInit, output, signal } from '@angular/core';
import {
  IonAvatar,
  IonButton,
  IonButtons,
  IonCheckbox,
  IonContent,
  IonFooter,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { StorageService } from 'src/app/core/services/storage/storage.service';

@Component({
  selector: 'app-ball-select',
  imports: [IonItem, IonAvatar, IonList, IonLabel, IonTitle, IonHeader, IonContent, IonCheckbox, IonButton, IonToolbar, IonFooter, IonButtons],
  templateUrl: './ball-select.component.html',
  styleUrls: ['./ball-select.component.scss'],
})
export class BallSelectComponent implements OnInit {
  storageService = inject(StorageService);

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
