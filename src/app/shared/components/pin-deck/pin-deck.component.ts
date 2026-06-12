import { CommonModule } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { isSplit } from 'src/app/core/utils/game-utils/pin.utils';

interface Pin {
  id: number;
  active: boolean;
}

const PIN_SIZE = 8;
const PIN_GAP = 4;
const DECK_SPAN = 4 * PIN_SIZE + 3 * PIN_GAP;

@Component({
  selector: 'app-pin-deck',
  imports: [CommonModule],
  templateUrl: './pin-deck.component.html',
  styleUrl: './pin-deck.component.scss',
  host: {
    '[style.width.px]': 'boxSize()',
    '[style.height.px]': 'boxSize()',
  },
})
export class PinDeckComponent {
  activePins = input.required<number[]>();
  isStatPage = input<boolean>(false);
  scale = input<number>(1);

  /** The scaled bounding box so the host reserves exactly what the deck renders. */
  readonly boxSize = computed(() => DECK_SPAN * this.scale());

  readonly pinDeck = computed<readonly (readonly Pin[])[]>(() => {
    const activeSet = new Set(this.activePins());

    const row = (ids: number[]): readonly Pin[] =>
      ids.map((id) => ({
        id,
        active: activeSet.has(id),
      }));

    return [row([7, 8, 9, 10]), row([4, 5, 6]), row([2, 3]), row([1])];
  });

  readonly isSplit = computed(() => isSplit(this.activePins()));

  trackByPinId(_: number, pin: Pin): number {
    return pin.id;
  }

  trackByRow(index: number): number {
    return index;
  }
}
