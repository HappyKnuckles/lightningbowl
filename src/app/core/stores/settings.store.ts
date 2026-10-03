import { Injectable, signal } from '@angular/core';
import { BallTracking } from 'src/app/core/models/game.model';

export type Handedness = 'right' | 'left';

@Injectable({ providedIn: 'root' })
export class SettingsStore {
  readonly pinInputMode = signal<boolean>(true);

  /** Default ball tracking for new games. Per-throw tracking needs pin input mode. */
  readonly ballTracking = signal<BallTracking>('throw');

  /** Used to name leaves relative to the bowler ("light" vs "high"), not to change any math. */
  readonly handedness = signal<Handedness>('right');

  loadPinInputMode(): void {
    const mode = localStorage.getItem('pin-input-mode');
    const pinInputMode = mode === null ? false : mode === 'hit';
    this.pinInputMode.set(pinInputMode);
  }

  savePinInputMode(pinMode: string): void {
    this.pinInputMode.set(pinMode === 'hit');
    const mode = pinMode === 'hit' ? 'hit' : 'missing';
    localStorage.setItem('pin-input-mode', mode);
  }

  loadBallTracking(): void {
    this.ballTracking.set(localStorage.getItem('ball-tracking') === 'game' ? 'game' : 'throw');
  }

  saveBallTracking(tracking: string): void {
    const mode: BallTracking = tracking === 'throw' ? 'throw' : 'game';
    this.ballTracking.set(mode);
    localStorage.setItem('ball-tracking', mode);
  }

  loadHandedness(): void {
    this.handedness.set(localStorage.getItem('handedness') === 'left' ? 'left' : 'right');
  }

  saveHandedness(handedness: string): void {
    const hand: Handedness = handedness === 'left' ? 'left' : 'right';
    this.handedness.set(hand);
    localStorage.setItem('handedness', hand);
  }
}
