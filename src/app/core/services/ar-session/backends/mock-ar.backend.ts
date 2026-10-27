import { Injectable } from '@angular/core';
import { ArBackendKind, ArSupport, LaneAnchor, Vec3 } from 'src/app/core/models/ar.model';
import { ArBackend } from '../ar-backend';

/**
 * An AR runtime that needs no camera and no device.
 *
 * It reports a level floor two metres below the viewer and raycasts taps onto
 * it deterministically, which is enough to drive the whole calibration and
 * overlay pipeline in unit tests and on a desktop dev loop.
 */
@Injectable({ providedIn: 'root' })
export class MockArBackend implements ArBackend {
  readonly kind: ArBackendKind = 'mock';

  private running = false;
  private planeFound = false;

  anchor: LaneAnchor | null = null;
  texture: { dataUri: string; widthM: number; lengthM: number } | null = null;

  async isSupported(): Promise<ArSupport> {
    return { supported: true, backend: this.kind };
  }

  async start(): Promise<void> {
    this.running = true;
    this.planeFound = true;
  }

  async stop(): Promise<void> {
    this.running = false;
    this.planeFound = false;
    this.anchor = null;
    this.texture = null;
  }

  async hitTest(screenX: number, screenY: number): Promise<Vec3 | null> {
    if (!this.running || !this.planeFound) {
      return null;
    }

    // A flat, deterministic projection: across the screen maps across the
    // floor, down the screen maps further away.
    return { x: (screenX - 0.5) * 4, y: -1.4, z: -2 - (1 - screenY) * 12 };
  }

  planeNormal(): Vec3 | null {
    return this.planeFound ? { x: 0, y: 1, z: 0 } : null;
  }

  hasPlane(): boolean {
    return this.planeFound;
  }

  async setAnchor(anchor: LaneAnchor): Promise<void> {
    this.anchor = anchor;
  }

  async setOverlayTexture(dataUri: string, widthM: number, lengthM: number): Promise<void> {
    this.texture = { dataUri, widthM, lengthM };
  }

  async clearOverlay(): Promise<void> {
    this.texture = null;
  }
}
