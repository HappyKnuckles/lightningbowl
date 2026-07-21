import { Injectable } from '@angular/core';
import { ArBackendKind, ArSupport, LaneAnchor, Vec3 } from 'src/app/core/models/ar.model';
import { ArBackend } from '../ar-backend';
import { WebGlLaneRenderer } from './webgl-lane.renderer';

/**
 * WebXR immersive-ar, for the PWA.
 *
 * This is the browser path: Chrome on Android drives it through ARCore. Safari
 * on iPhone has no immersive-ar session mode, so isSupported() reports that
 * plainly rather than pretending — the page then shows the flat pattern view.
 *
 * The HUD is passed through as a DOM overlay, so the picker, coaching text and
 * calibration targets stay ordinary Angular markup composited over the camera
 * feed rather than being rebuilt in GL.
 */
@Injectable({ providedIn: 'root' })
export class WebXrArBackend implements ArBackend {
  readonly kind: ArBackendKind = 'webxr';

  private session: XRSession | null = null;
  private gl: WebGLRenderingContext | null = null;
  private renderer: WebGlLaneRenderer | null = null;
  private canvas: HTMLCanvasElement | null = null;

  private localSpace: XRReferenceSpace | null = null;
  private viewerSpace: XRReferenceSpace | null = null;
  private latestFrame: XRFrame | null = null;

  private anchorMatrix: Float32Array | null = null;
  private plane: Vec3 | null = null;

  async isSupported(): Promise<ArSupport> {
    // WebXR is only exposed in a secure context. http://localhost counts, but a
    // dev server reached over a LAN address does not — which looks exactly like
    // an unsupported device unless it is called out.
    if (!window.isSecureContext) {
      return {
        supported: false,
        backend: this.kind,
        reason: 'AR needs a secure connection (HTTPS). Open the app over HTTPS — a dev server reached by IP address will not work.',
      };
    }

    const xr = navigator.xr;
    if (!xr) {
      return {
        supported: false,
        backend: this.kind,
        reason: 'This browser has no WebXR support. On iPhone, AR needs the installed app; on Android, use Chrome with Google Play Services for AR.',
      };
    }

    try {
      const supported = await xr.isSessionSupported('immersive-ar');
      return supported
        ? { supported: true, backend: this.kind }
        : { supported: false, backend: this.kind, reason: 'This browser cannot start an AR session. On iPhone, install the app to use AR.' };
    } catch {
      return { supported: false, backend: this.kind, reason: 'Could not check for AR support.' };
    }
  }

  async start(options?: { domOverlayRoot?: HTMLElement | null }): Promise<void> {
    const xr = navigator.xr;
    if (!xr) {
      throw new Error('WebXR is not available.');
    }

    this.canvas = document.createElement('canvas');
    const gl = this.canvas.getContext('webgl', { xrCompatible: true, alpha: true, antialias: true } as WebGLContextAttributes);
    if (!gl) {
      throw new Error('Could not create a WebGL context for AR.');
    }
    this.gl = gl;

    const domOverlayRoot = options?.domOverlayRoot ?? null;
    const session = await xr.requestSession('immersive-ar', {
      requiredFeatures: ['hit-test', 'local-floor'],
      optionalFeatures: domOverlayRoot ? ['dom-overlay'] : [],
      ...(domOverlayRoot ? { domOverlay: { root: domOverlayRoot } } : {}),
    });

    this.session = session;
    this.renderer = new WebGlLaneRenderer(gl);

    await gl.makeXRCompatible();
    session.updateRenderState({ baseLayer: new XRWebGLLayer(session, gl) });

    this.localSpace = await session.requestReferenceSpace('local-floor');
    this.viewerSpace = await session.requestReferenceSpace('viewer');

    session.addEventListener('end', () => this.teardown());
    session.requestAnimationFrame(this.onFrame);
  }

  async stop(): Promise<void> {
    await this.session?.end().catch(() => undefined);
    this.teardown();
  }

  /**
   * Raycasts a screen point onto the detected surface.
   *
   * WebXR hit-test sources are created asynchronously and deliver results on a
   * later frame, so this builds a one-shot source along the ray through the tap
   * and resolves on the next frame that carries a result.
   */
  async hitTest(screenX: number, screenY: number): Promise<Vec3 | null> {
    const session = this.session;
    const viewerSpace = this.viewerSpace;
    const localSpace = this.localSpace;
    if (!session || !viewerSpace || !localSpace || !session.requestHitTestSource) {
      return null;
    }

    const direction = this.rayThrough(screenX, screenY);
    if (!direction) {
      return null;
    }

    const source = await session.requestHitTestSource({
      space: viewerSpace,
      offsetRay: new XRRay({ x: 0, y: 0, z: 0, w: 1 }, direction),
    });
    if (!source) {
      return null;
    }

    try {
      return await this.firstHit(source, localSpace);
    } finally {
      source.cancel();
    }
  }

  planeNormal(): Vec3 | null {
    return this.plane;
  }

  hasPlane(): boolean {
    return this.plane !== null;
  }

  async setAnchor(anchor: LaneAnchor): Promise<void> {
    this.anchorMatrix = anchor.matrix;
  }

  async setOverlayTexture(dataUri: string): Promise<void> {
    await this.renderer?.setTexture(dataUri);
  }

  async clearOverlay(): Promise<void> {
    this.renderer?.clearTexture();
  }

  /**
   * Unprojects a normalised screen point into a direction in view space.
   * Screen y runs down, clip y runs up, hence the flip.
   */
  private rayThrough(screenX: number, screenY: number): DOMPointInit | null {
    const view = this.currentView();
    if (!view) {
      return null;
    }

    const inverse = invertMatrix(view.projectionMatrix);
    if (!inverse) {
      return null;
    }

    const clipX = screenX * 2 - 1;
    const clipY = 1 - screenY * 2;
    const near = transformPoint(inverse, clipX, clipY, -1, 1);
    const far = transformPoint(inverse, clipX, clipY, 1, 1);
    if (!near || !far) {
      return null;
    }

    const dx = far.x - near.x;
    const dy = far.y - near.y;
    const dz = far.z - near.z;
    const magnitude = Math.hypot(dx, dy, dz);
    if (magnitude === 0) {
      return null;
    }

    return { x: dx / magnitude, y: dy / magnitude, z: dz / magnitude, w: 0 };
  }

  private currentView(): XRView | null {
    const pose = this.latestFrame && this.localSpace ? this.latestFrame.getViewerPose(this.localSpace) : null;
    return pose?.views[0] ?? null;
  }

  /** Waits for the first frame that produces a hit for this source. */
  private firstHit(source: XRHitTestSource, space: XRReferenceSpace): Promise<Vec3 | null> {
    return new Promise((resolve) => {
      const session = this.session;
      if (!session) {
        resolve(null);
        return;
      }

      let framesLeft = 10;
      const poll = (_time: number, frame: XRFrame) => {
        const results = frame.getHitTestResults(source);
        const pose = results.length > 0 ? results[0].getPose(space) : null;

        if (pose) {
          const { x, y, z } = pose.transform.position;
          resolve({ x, y, z });
          return;
        }

        if (--framesLeft <= 0) {
          resolve(null);
          return;
        }

        session.requestAnimationFrame(poll);
      };

      session.requestAnimationFrame(poll);
    });
  }

  private readonly onFrame = (_time: number, frame: XRFrame): void => {
    const session = this.session;
    const gl = this.gl;
    if (!session || !gl || !this.localSpace) {
      return;
    }

    this.latestFrame = frame;
    session.requestAnimationFrame(this.onFrame);

    const pose = frame.getViewerPose(this.localSpace);
    if (!pose) {
      return;
    }

    // local-floor is gravity aligned, so the floor normal is simply up.
    this.plane ??= { x: 0, y: 1, z: 0 };

    const layer = session.renderState.baseLayer;
    if (!layer) {
      return;
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, layer.framebuffer);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    if (!this.anchorMatrix || !this.renderer) {
      return;
    }

    for (const view of pose.views) {
      const viewport = layer.getViewport(view);
      if (!viewport) {
        continue;
      }

      gl.viewport(viewport.x, viewport.y, viewport.width, viewport.height);
      this.renderer.draw(view.projectionMatrix, view.transform.inverse.matrix, this.anchorMatrix);
    }
  };

  private teardown(): void {
    this.renderer?.dispose();
    this.renderer = null;
    this.session = null;
    this.gl = null;
    this.canvas = null;
    this.localSpace = null;
    this.viewerSpace = null;
    this.latestFrame = null;
    this.anchorMatrix = null;
    this.plane = null;
  }
}

/** Gauss-Jordan inverse of a column-major 4x4. Returns null if singular. */
export function invertMatrix(source: Float32Array): Float32Array | null {
  const m = Array.from(source);
  const inverse = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

  for (let column = 0; column < 4; column++) {
    let pivotRow = column;
    for (let row = column + 1; row < 4; row++) {
      if (Math.abs(m[column * 4 + row]) > Math.abs(m[column * 4 + pivotRow])) {
        pivotRow = row;
      }
    }

    const pivot = m[column * 4 + pivotRow];
    if (Math.abs(pivot) < 1e-12) {
      return null;
    }

    if (pivotRow !== column) {
      for (let k = 0; k < 4; k++) {
        [m[k * 4 + column], m[k * 4 + pivotRow]] = [m[k * 4 + pivotRow], m[k * 4 + column]];
        [inverse[k * 4 + column], inverse[k * 4 + pivotRow]] = [inverse[k * 4 + pivotRow], inverse[k * 4 + column]];
      }
    }

    const scale = 1 / m[column * 4 + column];
    for (let k = 0; k < 4; k++) {
      m[k * 4 + column] *= scale;
      inverse[k * 4 + column] *= scale;
    }

    for (let row = 0; row < 4; row++) {
      if (row === column) {
        continue;
      }

      const factor = m[column * 4 + row];
      if (factor === 0) {
        continue;
      }

      for (let k = 0; k < 4; k++) {
        m[k * 4 + row] -= factor * m[k * 4 + column];
        inverse[k * 4 + row] -= factor * inverse[k * 4 + column];
      }
    }
  }

  return new Float32Array(inverse);
}

/** Applies a column-major 4x4 to a point and divides through by w. */
export function transformPoint(matrix: Float32Array, x: number, y: number, z: number, w: number): Vec3 | null {
  const out = [0, 0, 0, 0];
  for (let row = 0; row < 4; row++) {
    out[row] = matrix[row] * x + matrix[4 + row] * y + matrix[8 + row] * z + matrix[12 + row] * w;
  }

  if (Math.abs(out[3]) < 1e-12) {
    return null;
  }

  return { x: out[0] / out[3], y: out[1] / out[3], z: out[2] / out[3] };
}
