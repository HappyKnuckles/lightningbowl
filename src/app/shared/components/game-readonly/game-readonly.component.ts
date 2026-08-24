import { Component, ElementRef, ViewChild, computed, inject, input } from '@angular/core';
import { NgIf } from '@angular/common';
import { IonCol, IonGrid, IonRow } from '@ionic/angular/standalone';
import { PinDeckComponent } from '../pin-deck/pin-deck.component';
import { Game } from 'src/app/core/models/game.model';
import { getThrowValue } from 'src/app/core/utils/game-utils/frame.utils';
import { formatThrowDisplay } from 'src/app/core/utils/game-utils/score-input.utils';

interface ReadonlyThrowVm {
  display: string;
  isSplit: boolean;
  pinShow: boolean;
  pinPins: number[];
}

interface ReadonlyFrameVm {
  frameNumber: number;
  isTenth: boolean;
  throw0: ReadonlyThrowVm;
  throw1: ReadonlyThrowVm;
  throw2: ReadonlyThrowVm | null; // 10th frame only
  score: number;
}

@Component({
  selector: 'app-game-readonly',
  templateUrl: './game-readonly.component.html',
  styleUrls: ['./game-readonly.component.scss'],
  imports: [NgIf, IonGrid, IonRow, IonCol, PinDeckComponent],
})
export class GameReadonlyComponent {
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly game = input.required<Game>();

  readonly pinScale = input<number>(0.3);
  @ViewChild('captureRoot') private captureRoot?: ElementRef<HTMLElement>;

  readonly isPinMode = computed(() => this.game()?.isPinMode ?? false);

  readonly frameVms = computed<ReadonlyFrameVm[]>(() => {
    const game = this.game();
    const frames = game?.frames ?? [];
    const scores = game?.frameScores ?? [];

    return Array.from({ length: 10 }, (_, frameIndex) => {
      const frame = frames[frameIndex];
      const isTenth = frameIndex === 9;

      const v0 = getThrowValue(frame, 0);
      const v1 = getThrowValue(frame, 1);
      const v2 = getThrowValue(frame, 2);

      const cell = (throwIndex: 0 | 1 | 2, pinShow: boolean): ReadonlyThrowVm => ({
        display: formatThrowDisplay(frame, throwIndex, isTenth),
        isSplit: frame?.throws?.[throwIndex]?.isSplit ?? false,
        pinShow,
        pinPins: frame?.throws?.[throwIndex]?.pinsLeftStanding ?? [],
      });

      return {
        frameNumber: frameIndex + 1,
        isTenth,
        throw0: cell(0, v0 !== undefined),
        // frames 1–9: hide 2nd deck after a strike; 10th: show whenever thrown
        throw1: cell(1, v1 !== undefined && (isTenth || v0 !== 10)),
        throw2: isTenth ? cell(2, v2 !== undefined) : null,
        score: scores[frameIndex],
      };
    });
  });

  /** Element the share service should rasterize. */
  get captureElement(): HTMLElement {
    return this.captureRoot?.nativeElement ?? this.host.nativeElement;
  }
}
