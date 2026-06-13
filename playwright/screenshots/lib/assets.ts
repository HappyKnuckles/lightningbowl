/**
 * Inline SVG placeholders served in place of remote images. Returning them with
 * a `image/svg+xml` content-type means an <img>/<ion-img>/Leaflet tile renders
 * them directly — no committed binary files, fully offline & deterministic.
 *
 * They are intentionally tasteful (not "PLACEHOLDER" boxes) so marketing/store
 * screenshots still look like a finished product. Swap any of these for real
 * captured assets via `npm run capture:fixtures` if you prefer live imagery.
 */

export interface FulfillImage {
  contentType: string;
  body: string;
}

const svg = (body: string): FulfillImage => ({ contentType: 'image/svg+xml', body });

/** A 256×256 OSM-style map tile: light base with a faint grid + roads. */
export const MAP_TILE = svg(`
<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
  <rect width="256" height="256" fill="#e8efe6"/>
  <g stroke="#d4ddd0" stroke-width="1">
    ${Array.from({ length: 8 }, (_, i) => `<line x1="${i * 32}" y1="0" x2="${i * 32}" y2="256"/><line x1="0" y1="${i * 32}" x2="256" y2="${i * 32}"/>`).join('')}
  </g>
  <path d="M0 170 H256 M150 0 V256" stroke="#ffffff" stroke-width="8"/>
  <path d="M0 170 H256 M150 0 V256" stroke="#f2c14e" stroke-width="2"/>
  <rect x="30" y="40" width="60" height="40" fill="#dfe7da"/>
  <rect x="180" y="190" width="48" height="44" fill="#dfe7da"/>
</svg>`);

/** Leaflet teardrop marker (blue), 25×41 to match the app's icon size. */
export const MAP_MARKER = svg(`
<svg xmlns="http://www.w3.org/2000/svg" width="25" height="41" viewBox="0 0 25 41">
  <path d="M12.5 0C5.6 0 0 5.6 0 12.5 0 22 12.5 41 12.5 41S25 22 25 12.5C25 5.6 19.4 0 12.5 0z" fill="#2a6fdb"/>
  <circle cx="12.5" cy="12.5" r="5" fill="#ffffff"/>
</svg>`);

/** Soft marker shadow. */
export const MAP_MARKER_SHADOW = svg(`
<svg xmlns="http://www.w3.org/2000/svg" width="41" height="41" viewBox="0 0 41 41">
  <ellipse cx="14" cy="38" rx="12" ry="3" fill="rgba(0,0,0,0.25)"/>
</svg>`);

/** A glossy bowling ball with finger holes — used for every ball thumbnail. */
export function ballThumb(seed = 0): FulfillImage {
  const palette = ['#1f6feb', '#d62246', '#10b981', '#7c3aed', '#f59e0b', '#0ea5e9', '#ec4899', '#14b8a6'];
  const color = palette[seed % palette.length];
  return svg(`
<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240">
  <defs>
    <radialGradient id="g" cx="38%" cy="32%" r="75%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.85"/>
      <stop offset="28%" stop-color="${color}"/>
      <stop offset="100%" stop-color="#0b1020"/>
    </radialGradient>
  </defs>
  <circle cx="120" cy="120" r="104" fill="url(#g)"/>
  <g fill="#0b1020" opacity="0.85">
    <circle cx="104" cy="92" r="9"/>
    <circle cx="138" cy="92" r="9"/>
    <circle cx="121" cy="126" r="9"/>
  </g>
  <ellipse cx="92" cy="80" rx="26" ry="14" fill="#ffffff" opacity="0.25"/>
</svg>`);
}

/** A lane oil-pattern chart placeholder (wide). */
export function patternChart(seed = 0): FulfillImage {
  const length = 30 + (seed % 5) * 4;
  return svg(`
<svg xmlns="http://www.w3.org/2000/svg" width="520" height="180" viewBox="0 0 520 180">
  <rect width="520" height="180" fill="#0d1b2a"/>
  <rect x="16" y="16" width="488" height="148" rx="6" fill="#13293d"/>
  ${Array.from({ length: 39 }, (_, i) => `<line x1="${16 + i * 12.5}" y1="16" x2="${16 + i * 12.5}" y2="164" stroke="#1b3a52" stroke-width="1"/>`).join('')}
  <rect x="${120 - seed * 6}" y="28" width="${260 + length * 2}" height="124" rx="40" fill="#2a9d8f" opacity="0.55"/>
  <rect x="${170 - seed * 4}" y="40" width="${180 + length}" height="100" rx="40" fill="#52b788" opacity="0.7"/>
  <text x="32" y="44" fill="#9fb3c8" font-family="Arial" font-size="14">${length} ft</text>
</svg>`);
}

/** The "bowwwl" attribution logo in the Ball Library / Arsenal toolbars. */
export const BOWWWL_LOGO = svg(`
<svg xmlns="http://www.w3.org/2000/svg" width="96" height="24" viewBox="0 0 96 24">
  <text x="0" y="18" fill="currentColor" font-family="Arial, sans-serif" font-weight="700" font-size="18">bowwwl</text>
</svg>`);
