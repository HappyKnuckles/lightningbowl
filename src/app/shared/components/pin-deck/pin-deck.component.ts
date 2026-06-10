import { CommonModule } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { isSplit } from 'src/app/core/utils/game-utils/pin.utils';

interface Pin {
  id: number;
  active: boolean;
}

@Component({
  selector: 'app-pin-deck',
  imports: [CommonModule],
  templateUrl: './pin-deck.component.html',
  styleUrl: './pin-deck.component.scss',
})
export class PinDeckComponent {
  activePins = input.required<number[]>();
  isStatPage = input<boolean>(false);
  scale = input<number>(1);

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
