import { Component, input, output } from '@angular/core';
import { IonButton, IonIcon, IonModal } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { arrowUndoOutline, bowlingBallOutline, checkmarkOutline, closeCircleOutline } from 'ionicons/icons';
import { ThrowBall, formatThrowBall, getThrowBallKey } from 'src/app/core/models/game.model';
import { StorageService } from 'src/app/core/services/storage/storage.service';
import { alertEnterAnimation, alertLeaveAnimation } from '../../animations/alert.animation';
import { BallSelectComponent } from '../ball-select/ball-select.component';

export interface ThrowConfirmedEvent {
  pinsKnockedDown: number[];
}
@Component({
  selector: 'app-pin-input',
  templateUrl: './pin-input.component.html',
  styleUrls: ['./pin-input.component.scss'],
  imports: [IonButton, IonIcon, IonModal, BallSelectComponent],
})
export class PinInputComponent {
  pinsLeftStanding = input<number[]>([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  canStrike = input<boolean>(false);
  canSpare = input<boolean>(false);
  canUndo = input<boolean>(false);
  isGameComplete = input<boolean>(false);
  selectHitPins = input<boolean>(true);
  selectedBall = input<ThrowBall | undefined>(undefined);
  throwConfirmed = output<ThrowConfirmedEvent>();
  undoRequested = output<void>();
  ballSelected = output<ThrowBall | undefined>();
  selectedPins: number[] = [];
  isBallModalOpen = false;
  enterAnimation = alertEnterAnimation;
  leaveAnimation = alertLeaveAnimation;

  constructor(public storageService: StorageService) {
    addIcons({ checkmarkOutline, arrowUndoOutline, closeCircleOutline, bowlingBallOutline });
  }

  get allPins(): number[] {
    return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  }

  get pinsKnockedDownPreviously(): number[] {
    return this.allPins.filter((pin) => !this.pinsLeftStanding().includes(pin));
  }

  /** Convert the current ThrowBall to a key string used by BallSelectComponent */
  get selectedBallKeys(): string[] {
    const ball = this.selectedBall();
    return ball ? [getThrowBallKey(ball)] : [];
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

  openBallSelector(): void {
    if (this.storageService.arsenal().length === 0) {
      return;
    }
    this.isBallModalOpen = true;
  }

  closeBallSelector(): void {
    this.isBallModalOpen = false;
  }

  onBallSelection(selectedKeys: string[]): void {
    const key = selectedKeys.length > 0 ? selectedKeys[0] : undefined;
    if (!key) {
      this.ballSelected.emit(undefined);
    } else {
      // Look up the ball in the arsenal to get proper name + weight
      const arsenalBall = this.storageService.arsenal().find((b) => b.ball_name + b.core_weight === key);
      if (arsenalBall) {
        this.ballSelected.emit({ name: arsenalBall.ball_name, weight: arsenalBall.core_weight });
      } else {
        // Fallback: store the key as the name with no weight (edge case)
        this.ballSelected.emit({ name: key });
      }
    }
    this.isBallModalOpen = false;
  }

  getSelectedBallThumbnail(): string | undefined {
    const ball = this.selectedBall();
    if (!ball) return undefined;
    const arsenalBall = this.storageService
      .arsenal()
      .find((b) => b.ball_name === ball.name && (!ball.weight || b.core_weight === ball.weight));
    return arsenalBall?.thumbnail_image;
  }

  getSelectedBallDisplayName(): string {
    return formatThrowBall(this.selectedBall());
  }
}
