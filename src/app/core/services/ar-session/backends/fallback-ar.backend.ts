import { Injectable } from '@angular/core';
import { ArBackendKind, ArSupport, LaneAnchor, Vec3 } from 'src/app/core/models/ar.model';
import { ArBackend } from '../ar-backend';

/**
 * The honest no-AR path, used where no runtime can track a lane — most
 * importantly Safari on iPhone, which has no immersive-ar session mode and no
 * other API for continuous camera pose.
 *
 * It reports itself unsupported with a reason the UI can show, and the page
 * falls back to the flat pattern view rather than pretending to anchor
 * anything. Nothing here fakes tracking.
 */
@Injectable({ providedIn: 'root' })
export class FallbackArBackend implements ArBackend {
  readonly kind: ArBackendKind = 'fallback';

  async isSupported(): Promise<ArSupport> {
    return {
      supported: false,
      backend: this.kind,
      reason: 'This browser cannot track a lane through the camera. Install the app for the AR view.',
    };
  }

  async start(): Promise<void> {
    // Nothing to start — there is no session.
  }

  async stop(): Promise<void> {
    // Nothing to stop.
  }

  async hitTest(): Promise<Vec3 | null> {
    return null;
  }

  planeNormal(): Vec3 | null {
    return null;
  }

  hasPlane(): boolean {
    return false;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async setAnchor(_anchor: LaneAnchor): Promise<void> {
    // No session to anchor into.
  }

  async setOverlayTexture(): Promise<void> {
    // The page renders the flat pattern view instead.
  }

  async clearOverlay(): Promise<void> {
    // Nothing to clear.
  }
}
