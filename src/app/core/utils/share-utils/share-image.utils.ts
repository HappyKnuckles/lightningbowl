export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Where an image of `naturalWidth` × `naturalHeight` is drawn inside `box` under CSS `object-fit`. */
export function objectFitBox(box: Box, naturalWidth: number, naturalHeight: number, objectFit: string): Box {
  if (!naturalWidth || !naturalHeight || objectFit === 'fill' || !['contain', 'cover', 'scale-down', 'none'].includes(objectFit)) {
    return box;
  }
  const containScale = Math.min(box.width / naturalWidth, box.height / naturalHeight);
  const scale =
    objectFit === 'cover'
      ? Math.max(box.width / naturalWidth, box.height / naturalHeight)
      : objectFit === 'none'
        ? 1
        : objectFit === 'scale-down'
          ? Math.min(1, containScale)
          : containScale;
  const width = naturalWidth * scale;
  const height = naturalHeight * scale;
  // object-position defaults to the center
  return { x: box.x + (box.width - width) / 2, y: box.y + (box.height - height) / 2, width, height };
}

/** A computed `border-radius` corner ("8px", "50%", "8px 4px") in pixels, for a box of the given size. */
export function cornerRadius(borderRadius: string, width: number, height: number): number {
  const first = borderRadius.trim().split(/\s+/)[0] ?? '';
  const value = parseFloat(first);
  if (!Number.isFinite(value) || value <= 0) return 0;
  const radius = first.endsWith('%') ? (Math.min(width, height) * value) / 100 : value;
  return Math.min(radius, width / 2, height / 2);
}

/** Every <img> under `root`, also inside shadow roots (e.g. the one in `ion-img`). */
export function collectImages(root: Element | ShadowRoot, found: HTMLImageElement[] = []): HTMLImageElement[] {
  if (root instanceof Element && root.shadowRoot) collectImages(root.shadowRoot, found);
  for (const element of Array.from(root.querySelectorAll('*'))) {
    if (element instanceof HTMLImageElement) found.push(element);
    if (element.shadowRoot) collectImages(element.shadowRoot, found);
  }
  return found;
}

/** Loads `src` with CORS (so it can be drawn into a canvas that is exported later); null if that fails. */
export function loadCorsImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    // a fresh URL: the cached copy from the page's <img> was loaded without CORS
    image.src = src.startsWith('data:') ? src : `${src}${src.includes('?') ? '&' : '?'}share=${Date.now()}`;
  });
}

/**
 * Draws the images inside `element` onto `canvas`, a snapshot of `element` at `pixelRatio`, where they are on
 * screen. Images inside a part marked with `excludeAttribute` are skipped, as are ones that can't be loaded.
 */
export async function drawImagesOnto(canvas: HTMLCanvasElement, element: HTMLElement, pixelRatio: number, excludeAttribute: string): Promise<void> {
  const context = canvas.getContext('2d');
  if (!context) return;
  const origin = element.getBoundingClientRect();

  for (const img of collectImages(element)) {
    // the <img> of an ion-img sits in its shadow root: check the host for the exclude marker
    const host = img.getRootNode() instanceof ShadowRoot ? (img.getRootNode() as ShadowRoot).host : img;
    if (host.closest(`[${excludeAttribute}]`) || img.closest(`[${excludeAttribute}]`)) continue;
    const rect = img.getBoundingClientRect();
    const src = img.currentSrc || img.src;
    if (!src || rect.width === 0 || rect.height === 0) continue;

    const image = await loadCorsImage(src);
    if (!image) continue;

    const style = getComputedStyle(img);
    const box = {
      x: (rect.left - origin.left) * pixelRatio,
      y: (rect.top - origin.top) * pixelRatio,
      width: rect.width * pixelRatio,
      height: rect.height * pixelRatio,
    };
    const drawn = objectFitBox(box, image.naturalWidth, image.naturalHeight, style.objectFit);
    const radius = cornerRadius(style.borderTopLeftRadius, rect.width, rect.height) * pixelRatio;

    context.save();
    context.beginPath();
    if (context.roundRect) context.roundRect(box.x, box.y, box.width, box.height, radius);
    else context.rect(box.x, box.y, box.width, box.height); // Safari before 16
    context.clip();
    context.drawImage(image, drawn.x, drawn.y, drawn.width, drawn.height);
    context.restore();
  }
}
