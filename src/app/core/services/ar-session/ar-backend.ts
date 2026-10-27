import { InjectionToken } from '@angular/core';
import { ArBackendKind, ArSupport, LaneAnchor, Vec3 } from 'src/app/core/models/ar.model';

/**
 * Everything the AR page needs from a runtime, and nothing more.
 *
 * The oil pattern is flat and lies on the lane, so a backend never needs a
 * scene graph — it tracks a plane and draws one textured quad. Keeping the
 * surface this small is what lets the native, WebXR and fallback paths share
 * the whole calibration and rendering pipeline above them.
 */
export interface ArBackend {
  readonly kind: ArBackendKind;

  isSupported(): Promise<ArSupport>;

  /**
   * `domOverlayRoot` is the element WebXR shows over the camera feed — the HUD
   * stays ordinary Angular markup rather than being rebuilt in GL. Backends
   * that composite natively ignore it.
   */
  start(options?: { domOverlayRoot?: HTMLElement | null }): Promise<void>;
  stop(): Promise<void>;

  /** Raycasts a normalised screen point (0..1) onto the tracked plane. */
  hitTest(screenX: number, screenY: number): Promise<Vec3 | null>;

  /** The tracked plane's normal, or null while still scanning. */
  planeNormal(): Vec3 | null;

  /** True once a plane has been found and taps can be raycast. */
  hasPlane(): boolean;

  setAnchor(anchor: LaneAnchor): Promise<void>;

  /** Hands over the baked pattern texture and the size of the quad in metres. */
  setOverlayTexture(dataUri: string, widthM: number, lengthM: number): Promise<void>;

  clearOverlay(): Promise<void>;
}

export const AR_BACKEND = new InjectionToken<ArBackend>('AR_BACKEND');
