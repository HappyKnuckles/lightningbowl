import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { IonButton, IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { arrowUndoOutline, barChartOutline, checkmarkOutline, closeCircleOutline } from 'ionicons/icons';
import { PINS } from 'src/app/core/constants/app.constants';

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
  imports: [IonButton, IonIcon],
})
export class PinInputComponent {
  pinsLeftStanding = input<number[]>(PINS);
  canStrike = input<boolean>(false);
  canSpare = input<boolean>(false);
  canUndo = input<boolean>(false);
  isGameComplete = input<boolean>(false);
  selectHitPins = input<boolean>(true);
  showStatsButton = input<boolean>(false);
  statsEnabled = input<boolean>();
  /**
   * Render flat and full-bleed for use as a docked keyboard surface, instead of
   * the rounded, inset card the component uses inside page flow.
   */
  docked = input<boolean>(false);

  throwConfirmed = output<ThrowConfirmedEvent>();
  undoRequested = output<void>();
  statsClick = output<void>();

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
    addIcons({ checkmarkOutline, arrowUndoOutline, closeCircleOutline, barChartOutline });
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
