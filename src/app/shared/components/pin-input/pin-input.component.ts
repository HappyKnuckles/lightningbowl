import { Component, input, output } from '@angular/core';
import { IonButton, IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { closeCircleOutline, arrowUndoOutline, checkmarkOutline } from 'ionicons/icons';

export interface ThrowConfirmedEvent {
  pinsKnockedDown: number[];
}
@Component({
  selector: 'app-pin-input',
  templateUrl: './pin-input.component.html',
  styleUrls: ['./pin-input.component.scss'],
  imports: [IonButton, IonIcon],
})
export class PinInputComponent {
  pinsLeftStanding = input<number[]>([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  canStrike = input<boolean>(false);
  canSpare = input<boolean>(false);
  canUndo = input<boolean>(false);
  isGameComplete = input<boolean>(false);
  selectHitPins = input<boolean>(true);
  throwConfirmed = output<ThrowConfirmedEvent>();
  undoRequested = output<void>();
  selectedPins: number[] = [];

  constructor() {
    addIcons({ checkmarkOutline, arrowUndoOutline, closeCircleOutline });
  }

  get allPins(): number[] {
    return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  }

  get pinsKnockedDownPreviously(): number[] {
    return this.allPins.filter((pin) => !this.pinsLeftStanding().includes(pin));
  }

  togglePin(pinNumber: number): void {
    if (this.isGameComplete()) return;
    if (!this.pinsLeftStanding().includes(pinNumber)) return;

    const index = this.selectedPins.indexOf(pinNumber);
    if (index > -1) {
      this.selectedPins = this.selectedPins.filter((p) => p !== pinNumber);
    } else {
      this.selectedPins = [...this.selectedPins, pinNumber];
    }
  }

  clearSelectedPins(): void {
    this.selectedPins = [];
  }

  undoLastThrow(): void {
    this.selectedPins = [];
    this.undoRequested.emit();
  }

  confirmThrow(): void {
    if (this.isGameComplete()) return;

    const availablePins = this.pinsLeftStanding();
    let pinsKnockedDown: number[];

    if (this.selectHitPins()) {
      pinsKnockedDown = [...this.selectedPins];
    } else {
      pinsKnockedDown = availablePins.filter((pin) => !this.selectedPins.includes(pin));
    }

    this.throwConfirmed.emit({ pinsKnockedDown });

    this.selectedPins = [];
  }

  recordStrike(): void {
    if (!this.canStrike() || this.isGameComplete()) return;

    const pinsKnockedDown = [...this.pinsLeftStanding()];
    this.throwConfirmed.emit({ pinsKnockedDown });
    this.selectedPins = [];
  }

  recordSpare(): void {
    if (!this.canSpare() || this.isGameComplete()) return;

    const pinsKnockedDown = [...this.pinsLeftStanding()];
    this.throwConfirmed.emit({ pinsKnockedDown });
    this.selectedPins = [];
  }

  recordGutter(): void {
    if (this.isGameComplete()) return;
    this.throwConfirmed.emit({ pinsKnockedDown: [] });
    this.selectedPins = [];
  }

  isPinSelected(pinNumber: number): boolean {
    return this.selectedPins.includes(pinNumber);
  }

  isPinAvailable(pinNumber: number): boolean {
    return this.pinsLeftStanding().includes(pinNumber);
  }

  isPinKnockedDown(pinNumber: number): boolean {
    return !this.pinsLeftStanding().includes(pinNumber);
  }
}
