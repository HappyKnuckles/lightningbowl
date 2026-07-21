import { registerPlugin } from '@capacitor/core';

/**
 * The native AR bridge.
 *
 * Deliberately tiny: because the oil pattern is a flat quad on a known plane,
 * the native side only has to run ARKit or ARCore, raycast taps onto the
 * detected plane, hold one anchor, and draw one textured quad. Everything else
 * — parsing loads, building the oil field, baking the texture, solving the lane
 * pose — stays in TypeScript and is shared by every backend.
 *
 * The native view renders behind a transparent webview, so the HUD stays
 * ordinary Angular and Ionic markup on top.
 *
 * The Swift (ARKit + RealityKit) and Kotlin (ARCore + SceneView) sides are not
 * in this repo yet; this is the contract they implement.
 */
export interface LightningArPlugin {
  isSupported(): Promise<{ supported: boolean; reason?: string }>;

  startSession(options: { planeDetection: boolean }): Promise<void>;
  stopSession(): Promise<void>;

  /** Raycasts a normalised screen point onto the tracked plane. */
  hitTest(options: { x: number; y: number }): Promise<{ hit: boolean; x: number; y: number; z: number }>;

  /** The tracked plane's normal, or hasPlane false while still scanning. */
  getPlane(): Promise<{ hasPlane: boolean; normalX: number; normalY: number; normalZ: number }>;

  /** Places or replaces the lane anchor from a column-major 4x4. */
  setLaneAnchor(options: { matrix: number[] }): Promise<{ anchorId: string }>;

  setOverlayTexture(options: { dataUri: string; widthM: number; lengthM: number }): Promise<void>;
  clearOverlay(): Promise<void>;
}

export const LightningAr = registerPlugin<LightningArPlugin>('LightningAr');
