import { Component, ElementRef, ViewChild, computed, inject, input } from '@angular/core';
import { NgIf } from '@angular/common';
import { IonCol, IonGrid, IonIcon, IonRow } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { bowlingBallOutline } from 'ionicons/icons';
import { PinDeckComponent } from '../pin-deck/pin-deck.component';
import { Game, ThrowBall } from 'src/app/core/models/game.model';
import { BallsStore } from 'src/app/core/stores/balls.store';
import { findBallInArsenal, formatThrowBall, getThrowBallKey } from 'src/app/core/utils/game-utils/ball.utils';
import { getThrowValue } from 'src/app/core/utils/game-utils/frame.utils';
import { formatThrowDisplay } from 'src/app/core/utils/game-utils/score-input.utils';

interface ReadonlyThrowVm {
  display: string;
  isSplit: boolean;
  pinShow: boolean;
  pinPins: number[];
  hasBall: boolean;
  ballThumb: string | undefined;
  ballLabel: string;
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
  imports: [NgIf, IonGrid, IonRow, IonCol, IonIcon, PinDeckComponent],
})
export class GameReadonlyComponent {
  readonly game = input.required<Game>();
  readonly pinScale = input<number>(0.3);

  private ballsStore = inject(BallsStore);
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  @ViewChild('captureRoot') private captureRoot?: ElementRef<HTMLElement>;

  constructor() {
    addIcons({ bowlingBallOutline });
  }

  /** Element the share service should rasterize. */
  get captureElement(): HTMLElement {
    return this.captureRoot?.nativeElement ?? this.host.nativeElement;
  }

  readonly isPinMode = computed(() => this.game()?.isPinMode ?? false);

  readonly showBalls = computed(() => {
    const seen = new Set<string>();
    for (const frame of (this.game()?.frames ?? []).slice(0, 10)) {
      for (const t of frame?.throws ?? []) {
        if (t?.ball?.name) seen.add(getThrowBallKey(t.ball));
      }
    }
    return seen.size > 1;
  });

  readonly frameVms = computed<ReadonlyFrameVm[]>(() => {
    const game = this.game();
    const frames = game?.frames ?? [];
    const scores = game?.frameScores ?? [];
    const arsenal = this.ballsStore.arsenal();

    const showBalls = this.showBalls();

    // Arsenal matching is fuzzy (name formats vary), so resolve each distinct ball once.
    const thumbCache = new Map<string, string | undefined>();
    const resolveThumb = (ball: ThrowBall): string | undefined => {
      const key = getThrowBallKey(ball);
      if (!thumbCache.has(key)) {
        const arsenalBall = findBallInArsenal(ball, arsenal);
        thumbCache.set(key, arsenalBall?.thumbnail_image ? this.ballsStore.url + arsenalBall.thumbnail_image : undefined);
      }
      return thumbCache.get(key);
    };

    return Array.from({ length: 10 }, (_, frameIndex) => {
      const frame = frames[frameIndex];
      const isTenth = frameIndex === 9;

      const v0 = getThrowValue(frame, 0);
      const v1 = getThrowValue(frame, 1);
      const v2 = getThrowValue(frame, 2);

      const cell = (throwIndex: 0 | 1 | 2, pinShow: boolean): ReadonlyThrowVm => {
        const storedBall = frame?.throws?.[throwIndex]?.ball;
        const ball = showBalls && storedBall?.name ? storedBall : undefined;
        return {
          display: formatThrowDisplay(frame, throwIndex, isTenth),
          isSplit: frame?.throws?.[throwIndex]?.isSplit ?? false,
          pinShow,
          pinPins: frame?.throws?.[throwIndex]?.pinsLeftStanding ?? [],
          hasBall: !!ball,
          ballThumb: ball ? resolveThumb(ball) : undefined,
          ballLabel: formatThrowBall(ball),
        };
      };

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
}
