import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { IonButton, IonIcon, IonModal } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { arrowUndoOutline, barChartOutline, bowlingBallOutline, checkmarkOutline, closeCircleOutline } from 'ionicons/icons';
import { PINS } from 'src/app/core/constants/app.constants';
import { ThrowBall } from 'src/app/core/models/game.model';
import { BallsStore } from 'src/app/core/stores/balls.store';
import { findBallInArsenal, formatThrowBall, getThrowBallKey } from 'src/app/core/utils/game-utils/ball.utils';
import { alertEnterAnimation, alertLeaveAnimation } from '../../animations/alert.animation';
import { BallSelectComponent } from '../ball-select/ball-select.component';

export interface ThrowConfirmedEvent {
  pinsKnockedDown: number[];
}

interface PinView {
  number: number;
  active: boolean;
  knockedDown: boolean;
  disabled: boolean;
}

const PIN_LAYOUT: readonly number[][] = [[7, 8, 9, 10], [4, 5, 6], [2, 3], [1]];

@Component({
  selector: 'app-pin-input',
  templateUrl: './pin-input.component.html',
  styleUrls: ['./pin-input.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonButton, IonIcon, IonModal, BallSelectComponent],
})
export class PinInputComponent {
  ballsStore = inject(BallsStore);

  pinsLeftStanding = input<number[]>(PINS);
  canStrike = input<boolean>(false);
  canSpare = input<boolean>(false);
  canUndo = input<boolean>(false);
  isGameComplete = input<boolean>(false);
  selectHitPins = input<boolean>(true);
  showStatsButton = input<boolean>(false);
  statsEnabled = input<boolean>();
  selectedBall = input<ThrowBall | undefined>(undefined);

  throwConfirmed = output<ThrowConfirmedEvent>();
  undoRequested = output<void>();
  statsClick = output<void>();
  ballSelected = output<ThrowBall | undefined>();

  readonly isBallModalOpen = signal(false);
  enterAnimation = alertEnterAnimation;
  leaveAnimation = alertLeaveAnimation;

  /** Current ThrowBall as a key string array used by BallSelectComponent */
  readonly selectedBallKeys = computed<string[]>(() => {
    const ball = this.selectedBall();
    return ball ? [getThrowBallKey(ball)] : [];
  });

  /** Arsenal thumbnail of the currently selected ball, if available */
  readonly selectedBallThumbnail = computed<string | undefined>(() => {
    const arsenalBall = findBallInArsenal(this.selectedBall(), this.ballsStore.arsenal());
    return arsenalBall?.thumbnail_image || undefined;
  });

  readonly selectedBallDisplayName = computed(() => formatThrowBall(this.selectedBall()));

  readonly hasSelection = computed(() => this.selectedPins().length > 0);
  readonly selectedPins = signal<number[]>([]);

  readonly pinRows = computed<PinView[][]>(() => {
    const standing = this.pinsLeftStanding();
    const selected = this.selectedPins();
    const complete = this.isGameComplete();
    const hitMode = this.selectHitPins();

    return PIN_LAYOUT.map((row) =>
      row.map((n) => {
        const available = standing.includes(n);
        const isSelected = selected.includes(n);
        return {
          number: n,
          knockedDown: !available,
          // "active" = lit/standing; only meaningful for available pins
          active: available && (hitMode ? !isSelected : isSelected),
          disabled: !available || complete,
        };
      }),
    );
  });

  constructor() {
    addIcons({ checkmarkOutline, arrowUndoOutline, closeCircleOutline, barChartOutline, bowlingBallOutline });
  }

  openBallSelector(): void {
    if (this.ballsStore.arsenal().length === 0) {
      return;
    }
    this.isBallModalOpen.set(true);
  }

  closeBallSelector(): void {
    this.isBallModalOpen.set(false);
  }

  onBallSelection(selectedKeys: string[]): void {
    const key = selectedKeys.length > 0 ? selectedKeys[0] : undefined;
    if (!key) {
      this.ballSelected.emit(undefined);
    } else {
      // Look up the ball in the arsenal to get proper name + weight
      const arsenalBall = this.ballsStore.arsenal().find((b) => b.ball_name + b.core_weight === key);
      if (arsenalBall) {
        this.ballSelected.emit({ name: arsenalBall.ball_name, weight: arsenalBall.core_weight });
      } else {
        // Fallback: store the key as the name with no weight (edge case)
        this.ballSelected.emit({ name: key });
      }
    }
    this.isBallModalOpen.set(false);
  }

  togglePin(pinNumber: number): void {
    if (this.isGameComplete()) return;
    if (!this.pinsLeftStanding().includes(pinNumber)) return;

    this.selectedPins.update((pins) => (pins.includes(pinNumber) ? pins.filter((p) => p !== pinNumber) : [...pins, pinNumber]));
  }

  clearSelectedPins(): void {
    this.selectedPins.set([]);
  }

  undoLastThrow(): void {
    this.selectedPins.set([]);
    this.undoRequested.emit();
  }

  confirmThrow(): void {
    if (this.isGameComplete()) return;

    const available = this.pinsLeftStanding();
    const selected = this.selectedPins();
    const pinsKnockedDown = this.selectHitPins() ? [...selected] : available.filter((pin) => !selected.includes(pin));

    this.throwConfirmed.emit({ pinsKnockedDown });
    this.selectedPins.set([]);
  }

  recordStrike(): void {
    if (!this.canStrike() || this.isGameComplete()) return;
    this.throwConfirmed.emit({ pinsKnockedDown: [...this.pinsLeftStanding()] });
    this.selectedPins.set([]);
  }

  recordSpare(): void {
    if (!this.canSpare() || this.isGameComplete()) return;
    this.throwConfirmed.emit({ pinsKnockedDown: [...this.pinsLeftStanding()] });
    this.selectedPins.set([]);
  }

  recordGutter(): void {
    if (this.isGameComplete()) return;
    this.throwConfirmed.emit({ pinsKnockedDown: [] });
    this.selectedPins.set([]);
  }
}
