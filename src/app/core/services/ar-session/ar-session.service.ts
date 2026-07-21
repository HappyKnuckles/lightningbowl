import { Injectable, computed, inject, signal } from '@angular/core';
import { ArPhase, LaneAnchor, LaneCorrespondence } from 'src/app/core/models/ar.model';
import { Pattern } from 'src/app/core/models/pattern.model';
import { LANE_LENGTH_FT, LANE_WIDTH_M, feetToMetres } from 'src/app/core/utils/pattern-utils/board.utils';
import { solveLaneTransform } from 'src/app/core/utils/ar-utils/pose.utils';
import { PatternTextureService } from '../pattern-texture/pattern-texture.service';
import { AR_BACKEND } from './ar-backend';

/**
 * Holds the live AR session.
 *
 * This is ephemeral UI state — it is never persisted and does not belong in a
 * store, so it lives here as private signals exposed read-only, matching the
 * store idiom without becoming one.
 *
 * Provided by the AR page rather than in root, so it resolves the same
 * component-scoped AR_BACKEND the page selects and is torn down with it.
 */
@Injectable()
export class ArSessionService {
  private readonly backend = inject(AR_BACKEND);
  private readonly patternTextureService = inject(PatternTextureService);

  readonly #phase = signal<ArPhase>('idle');
  readonly #anchor = signal<LaneAnchor | null>(null);
  readonly #pattern = signal<Pattern | null>(null);
  readonly #taps = signal<LaneCorrespondence[]>([]);
  readonly #message = signal<string | null>(null);

  readonly phase = this.#phase.asReadonly();
  readonly anchor = this.#anchor.asReadonly();
  readonly pattern = this.#pattern.asReadonly();
  readonly taps = this.#taps.asReadonly();
  readonly message = this.#message.asReadonly();

  readonly backendKind = this.backend.kind;
  readonly isAnchored = computed(() => this.#anchor() !== null);
  readonly confidence = computed(() => this.#anchor()?.confidence ?? 0);
  readonly tapsRemaining = computed(() => Math.max(0, 3 - this.#taps().length));

  /**
   * Loads the pattern and checks support, without opening a session.
   *
   * Starting an immersive WebXR session requires a user gesture, so the actual
   * start() has to come from a tap — never from page load.
   */
  async prepare(pattern: Pattern): Promise<void> {
    this.#pattern.set(pattern);
    this.#message.set(null);

    const support = await this.backend.isSupported();
    if (!support.supported) {
      this.#phase.set('unsupported');
      this.#message.set(support.reason ?? 'AR is not available on this device.');
      return;
    }

    this.#phase.set('idle');
  }

  /** Must be called from a user gesture — WebXR requires user activation. */
  async start(pattern: Pattern, domOverlayRoot?: HTMLElement | null): Promise<void> {
    this.#pattern.set(pattern);
    this.#message.set(null);
    this.#phase.set('starting');

    const support = await this.backend.isSupported();
    if (!support.supported) {
      this.#phase.set('unsupported');
      this.#message.set(support.reason ?? 'AR is not available on this device.');
      return;
    }

    try {
      await this.backend.start({ domOverlayRoot });
      this.#phase.set('scanning');
    } catch {
      this.#phase.set('failed');
      // Starting an immersive session needs a user gesture in most browsers.
      this.#message.set('Could not start the camera session. Tap "Try again" to allow camera access.');
    }
  }

  async stop(): Promise<void> {
    await this.backend.stop();
    this.#phase.set('idle');
    this.#anchor.set(null);
    this.#taps.set([]);
    this.#message.set(null);
  }

  /** Begins manual calibration: three taps on the arrows at boards 5, 20 and 35. */
  beginCalibration(): void {
    this.#taps.set([]);
    this.#anchor.set(null);
    this.#phase.set('calibrating');
    this.#message.set(null);
  }

  /**
   * Records one calibration tap.
   *
   * Taps land on the arrows rather than the lane corners: they are 12–16 ft out
   * so they resolve well from behind the foul line, and their staggered
   * distances make three of them non-collinear, which a homography needs.
   */
  async recordTap(screenX: number, screenY: number, laneIndex: number): Promise<void> {
    const targets = CALIBRATION_TARGETS;
    if (laneIndex < 0 || laneIndex >= targets.length) {
      return;
    }

    const world = await this.backend.hitTest(screenX, screenY);
    if (!world) {
      this.#message.set('Point at the lane surface and try again.');
      return;
    }

    this.#message.set(null);
    this.#taps.update((taps) => [...taps, { lane: targets[laneIndex], world }]);

    if (this.#taps().length === targets.length) {
      await this.solve();
    }
  }

  undoTap(): void {
    this.#taps.update((taps) => taps.slice(0, -1));
    this.#anchor.set(null);
    this.#message.set(null);
  }

  /** Fits the lane pose to the recorded taps and anchors the overlay. */
  async solve(): Promise<void> {
    const up = this.backend.planeNormal();
    if (!up) {
      this.#message.set('Still looking for the floor. Move the phone slowly.');
      return;
    }

    const result = solveLaneTransform(this.#taps(), up);
    if (!result.anchor) {
      this.#phase.set('calibrating');
      this.#message.set(result.reason ?? 'Could not work out where the lane is.');
      return;
    }

    this.#anchor.set(result.anchor);
    await this.backend.setAnchor(result.anchor);
    await this.applyPattern();
    this.#phase.set(result.anchor.confidence < 0.35 ? 'limited' : 'tracking');
  }

  /** Swaps the displayed pattern without dropping the anchor. */
  async setPattern(pattern: Pattern): Promise<void> {
    this.#pattern.set(pattern);
    if (this.isAnchored()) {
      await this.applyPattern();
    }
  }

  private async applyPattern(): Promise<void> {
    const pattern = this.#pattern();
    if (!pattern) {
      return;
    }

    const dataUri = await this.patternTextureService.bakeTexture(pattern);
    await this.backend.setOverlayTexture(dataUri, LANE_WIDTH_M, feetToMetres(LANE_LENGTH_FT));
  }
}

/**
 * The three arrows used for manual calibration — outer left, centre, outer
 * right. Their differing distances are what keeps them non-collinear.
 */
export const CALIBRATION_TARGETS = [
  { x: 4, distanceFt: 12.5 },
  { x: 19, distanceFt: 15.5 },
  { x: 34, distanceFt: 12.5 },
] as const;
