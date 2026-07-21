import { Injectable, inject } from '@angular/core';
import { Pattern } from 'src/app/core/models/pattern.model';
import { buildLaneUsda, buildUsdz, dataUriToBytes } from 'src/app/core/utils/ar-utils/usdz.utils';
import { PatternTextureService } from '../pattern-texture/pattern-texture.service';

const TEXTURE_FILE = 'pattern.png';
const SCENE_FILE = 'lane.usda';
const USDZ_MIME = 'model/vnd.usdz+zip';

/**
 * AR Quick Look, the iOS path.
 *
 * iOS Safari has no immersive-ar session, but it will open a USDZ through
 * ARKit, which means the pattern can still be shown lying on a real lane at
 * true scale and tracked properly while the user walks around.
 *
 * What it cannot do is track the lane for us — Quick Look owns the UI, so the
 * user places the pattern by hand rather than the app solving a pose. That is
 * why this is a separate capability and not an ArBackend: there is no session,
 * no camera pose and no per-frame control to implement the interface against.
 */
@Injectable({ providedIn: 'root' })
export class ArQuickLookService {
  private readonly patternTextureService = inject(PatternTextureService);
  private objectUrl: string | null = null;

  /** Size of the last archive built, for on-screen diagnostics. */
  lastSize = 0;

  /** Whether this browser can open a USDZ in AR. */
  isSupported(): boolean {
    try {
      const anchor = document.createElement('a');
      return typeof anchor.relList?.supports === 'function' && anchor.relList.supports('ar');
    } catch {
      return false;
    }
  }

  /**
   * Builds a USDZ for the pattern and returns a URL to hand to an
   * `<a rel="ar">`.
   *
   * `allowsContentScaling=0` matters: without it Quick Look lets the user pinch
   * the model to any size, and a resized oil pattern is worse than no oil
   * pattern — the whole point is that 40 feet is really 40 feet.
   */
  async buildUrl(pattern: Pattern): Promise<string> {
    // Opaque, furniture included. Quick Look's handling of alpha is unreliable
    // — a texture that is transparent where there is no oil came out as a solid
    // black slab — and showing our arrows and foul line gives the user
    // something to line up against the real ones when placing it.
    const textureUri = await this.patternTextureService.bakeTexture(pattern, { showFurniture: true, showBoardNumbers: true });
    const archive = buildUsdz([
      { name: SCENE_FILE, data: new TextEncoder().encode(buildLaneUsda(TEXTURE_FILE, pattern.title)) },
      { name: TEXTURE_FILE, data: dataUriToBytes(textureUri) },
    ]);

    this.revoke();
    // Cast through ArrayBuffer: BlobPart rejects a plain Uint8Array view.
    this.objectUrl = URL.createObjectURL(new Blob([archive.buffer as ArrayBuffer], { type: USDZ_MIME }));
    this.lastSize = archive.length;

    return `${this.objectUrl}#allowsContentScaling=0`;
  }

  revoke(): void {
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
  }
}
