import { Injectable } from '@angular/core';
import { ArBackendKind, ArSupport, LaneAnchor, Vec3 } from 'src/app/core/models/ar.model';
import { ArBackend } from '../ar-backend';
import { LightningAr } from '../lightning-ar.plugin';

/**
 * ARKit on iOS, ARCore on Android, through the LightningAr plugin.
 *
 * This is the only path that covers iPhone, and it gives the best tracking on
 * both platforms — years of sensor-fused VIO that matters a great deal in a
 * bowling centre, where the lane itself is glossy and nearly featureless and
 * the tracking has to come from the surrounding room.
 */
@Injectable({ providedIn: 'root' })
export class NativeArBackend implements ArBackend {
  readonly kind: ArBackendKind = 'native';

  private plane: Vec3 | null = null;

  async isSupported(): Promise<ArSupport> {
    try {
      const result = await LightningAr.isSupported();
      return { supported: result.supported, backend: this.kind, reason: result.reason };
    } catch {
      return { supported: false, backend: this.kind, reason: 'The AR plugin is not available in this build.' };
    }
  }

  async start(): Promise<void> {
    this.plane = null;
    await LightningAr.startSession({ planeDetection: true });
  }

  async stop(): Promise<void> {
    this.plane = null;
    await LightningAr.stopSession();
  }

  async hitTest(screenX: number, screenY: number): Promise<Vec3 | null> {
    const result = await LightningAr.hitTest({ x: screenX, y: screenY });
    return result.hit ? { x: result.x, y: result.y, z: result.z } : null;
  }

  /** Polled by the session service while scanning; cached for synchronous reads. */
  async refreshPlane(): Promise<Vec3 | null> {
    const result = await LightningAr.getPlane();
    this.plane = result.hasPlane ? { x: result.normalX, y: result.normalY, z: result.normalZ } : null;
    return this.plane;
  }

  planeNormal(): Vec3 | null {
    return this.plane;
  }

  hasPlane(): boolean {
    return this.plane !== null;
  }

  async setAnchor(anchor: LaneAnchor): Promise<void> {
    await LightningAr.setLaneAnchor({ matrix: Array.from(anchor.matrix) });
  }

  async setOverlayTexture(dataUri: string, widthM: number, lengthM: number): Promise<void> {
    await LightningAr.setOverlayTexture({ dataUri, widthM, lengthM });
  }

  async clearOverlay(): Promise<void> {
    await LightningAr.clearOverlay();
  }
}
