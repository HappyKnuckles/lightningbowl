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

  ballSelect = output<string[]>();

  #tempSelectedBalls = signal<string[]>([]);

  get tempSelectedBalls() {
    return this.#tempSelectedBalls();
  }

  ngOnInit(): void {
    this.#tempSelectedBalls.set([...this.selectedBalls()!]);
  }

  toggleBallSelection(ballName: string): void {
    const currentSelection = this.#tempSelectedBalls();
    const index = currentSelection.indexOf(ballName);

    if (index > -1) {
      const updated = currentSelection.filter((name) => name !== ballName);
      this.#tempSelectedBalls.set(updated);
    } else {
      this.#tempSelectedBalls.set([...currentSelection, ballName]);
    }
  }

  isBallSelected(ballName: string): boolean {
    return this.#tempSelectedBalls().includes(ballName);
  }

  confirmBallSelection(): void {
    this.ballSelect.emit(this.#tempSelectedBalls());
  }

  cancelBallSelection(): void {
    this.#tempSelectedBalls.set([...this.selectedBalls()!]);
    this.ballSelect.emit(this.selectedBalls()!);
  }
}
