import { Component, input, computed } from '@angular/core';
import { NgIf } from '@angular/common';
import { IonRow, IonCol } from '@ionic/angular/standalone';
import { PinDeckComponent } from '../pin-deck/pin-deck.component';
import { Game } from 'src/app/core/models/game.model';

@Component({
  selector: 'app-pin-deck-frame-row',
  templateUrl: './pin-deck-frame-row.component.html',
  styleUrls: ['./pin-deck-frame-row.component.scss'],
  imports: [IonRow, IonCol, PinDeckComponent, NgIf],
})
export class PinDeckFrameRowComponent {
  // Inputs
  game = input.required<Game>();
  frameIndex = input.required<number>();
  scale = input<number>(0.3);

  /** Computed signal for pins left per throw */
  pinsStanding = computed(() => {
    const f = this.game().frames[this.frameIndex()];
    if (!f) return undefined;

    return Array.from({ length: 3 }, (_, i) => f.throws?.[i]?.pinsLeftStanding);
  });

  /** Get pins for a specific throw, empty array if undefined */
  getPinsStanding(throwIndex: number): number[] {
    return this.pinsStanding()?.[throwIndex] ?? [];
  }

  /** Check if this is the 10th frame */
  isTenthFrame(): boolean {
    return this.frameIndex() === 9;
  }

  /** Return the throw value if it exists, otherwise undefined */
  getThrowValue(throwIndex: number): number | undefined {
    const f = this.game().frames[this.frameIndex()];
    if (!f) return undefined;

    return f.throws?.[throwIndex]?.value;
  }
}
