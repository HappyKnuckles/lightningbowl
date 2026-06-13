import type { Page } from '@playwright/test';

/**
 * Determinism + anti-flake helpers.
 *
 * We deliberately do NOT freeze the global Date object: Chart.js animations use
 * the wall clock to advance, and a frozen clock makes them hang half-drawn.
 * Every *displayed* timestamp instead comes from seeded, fixed game data, so
 * the UI is already temporally stable. We only pin Math.random (safe) and kill
 * CSS animations/transitions; charts/maps are handled with explicit waits.
 */

const FREEZE_STYLE = `
  *, *::before, *::after {
    transition-duration: 0s !important;
    transition-delay: 0s !important;
    animation-duration: 0s !important;
    animation-delay: 0s !important;
    animation-iteration-count: 1 !important;
    caret-color: transparent !important;
    scroll-behavior: auto !important;
  }
  /* Hide the blinking lottie/refresher spinners that should never be captured. */
  lottie-player, ion-spinner { visibility: hidden !important; }
`;

/** Init scripts that must be present before any app code runs. */
export async function installStabilizers(page: Page): Promise<void> {
  // Force reduced motion at the engine level so Ionic's AnimationController
  // short-circuits page transitions / ripples (more reliable than CSS alone).
  await page.emulateMedia({ reducedMotion: 'reduce' });

  await page.addInitScript(() => {
    // Deterministic Math.random (mulberry32) so any random visual is stable.
    let a = 0x9e3779b9 >>> 0;
    Math.random = () => {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };

    // Force "reduced motion" for any library that honours it (Ionic, etc.).
    try {
      const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
      Object.defineProperty(mql, 'matches', { get: () => true });
    } catch {
      /* matchMedia not available yet — reducedMotion is also set at context level */
    }

    const addStyle = () => {
      if (document.getElementById('__screenshot_freeze__')) return;
      const style = document.createElement('style');
      style.id = '__screenshot_freeze__';
      style.textContent = `STYLE_PLACEHOLDER`;
      (document.head || document.documentElement).appendChild(style);
    };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', addStyle, { once: true });
    } else {
      addStyle();
    }
  });

  // Inject the real CSS text (kept out of the function body above to avoid
  // escaping headaches with template literals inside addInitScript).
  await page.addInitScript(`(${injectFreezeCss.toString()})(${JSON.stringify(FREEZE_STYLE)})`);
}

function injectFreezeCss(css: string) {
  const apply = () => {
    const el = document.getElementById('__screenshot_freeze__');
    if (el) {
      el.textContent = css;
    } else {
      const style = document.createElement('style');
      style.id = '__screenshot_freeze__';
      style.textContent = css;
      (document.head || document.documentElement).appendChild(style);
    }
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', apply, { once: true });
  } else {
    apply();
  }
}

/** Belt-and-braces: also add the freeze style to the live document post-nav. */
export async function injectFreezeStyles(page: Page): Promise<void> {
  await page.addStyleTag({ content: FREEZE_STYLE }).catch(() => {
    /* page may be mid-navigation; init script already covers it */
  });
}

/** Wait for the Ionic shell + fonts and for skeletons/spinners to disappear. */
export async function waitForAppReady(page: Page): Promise<void> {
  await page.waitForSelector('ion-app', { state: 'attached', timeout: 30_000 });
  // The active page's content is rendered and not the hidden outgoing page.
  await page.waitForSelector('.ion-page:not(.ion-page-hidden) ion-content, ion-content', {
    state: 'attached',
    timeout: 30_000,
  });
  await waitForFonts(page);
  await waitForNoSkeletons(page);
}

export async function waitForFonts(page: Page): Promise<void> {
  await page.evaluate(() => (document as Document).fonts?.ready).catch(() => undefined);
}

/** Skeleton placeholders must never appear in a screenshot. */
export async function waitForNoSkeletons(page: Page): Promise<void> {
  await page
    .waitForFunction(
      () => {
        const skeletons = Array.from(document.querySelectorAll('ion-skeleton-text'));
        return skeletons.every((s) => {
          const rect = (s as HTMLElement).getBoundingClientRect();
          return rect.width === 0 || rect.height === 0 || !(s as HTMLElement).offsetParent;
        });
      },
      { timeout: 20_000 },
    )
    .catch(() => {
      /* page may legitimately have no skeletons */
    });
}

/** Ensure every <img>/<ion-img> currently in the viewport has finished loading. */
export async function waitForImages(page: Page): Promise<void> {
  await page
    .waitForFunction(
      () => {
        const imgs = Array.from(document.images);
        const ready = imgs.every((img) => img.complete && (img.naturalWidth > 0 || img.getAttribute('src') === null));
        // ion-img renders an inner <img> only after intersection; treat unresolved
        // ones as fine because they are off-screen for viewport captures.
        return ready;
      },
      { timeout: 15_000 },
    )
    .catch(() => undefined);
}

/**
 * Wait until every visible <canvas> (Chart.js charts, arsenal/comparison charts,
 * the minigame) stops changing — i.e. animations have finished drawing.
 */
export async function waitForCharts(page: Page): Promise<void> {
  const hasCanvas = (await page.locator('canvas').count()) > 0;
  if (!hasCanvas) return;

  await page
    .waitForFunction(
      () => {
        const w = window as unknown as { __chartSamples?: Record<number, string> };
        w.__chartSamples = w.__chartSamples || {};
        const canvases = Array.from(document.querySelectorAll('canvas')) as HTMLCanvasElement[];
        let allStable = true;
        canvases.forEach((c, i) => {
          if (c.width === 0 || c.height === 0) return;
          let sig = '';
          try {
            // Cheap signature: sample a downscaled strip rather than the whole canvas.
            const ctx = c.getContext('2d');
            if (ctx) {
              const data = ctx.getImageData(0, 0, Math.min(c.width, 64), Math.min(c.height, 64)).data;
              let hash = 0;
              for (let p = 0; p < data.length; p += 97) hash = (hash * 31 + data[p]) | 0;
              sig = String(hash);
            }
          } catch {
            sig = String(c.width) + 'x' + c.height;
          }
          if (w.__chartSamples![i] !== sig) {
            allStable = false;
            w.__chartSamples![i] = sig;
          }
        });
        return allStable;
      },
      { timeout: 12_000, polling: 350 },
    )
    .catch(() => undefined);
}

/** A small fixed settle for layout/reflow after interactions. */
export async function settle(page: Page, ms = 350): Promise<void> {
  await page.waitForTimeout(ms);
}

/** Best-effort network-idle that never blocks forever on dev-server sockets. */
export async function waitForNetworkIdle(page: Page, timeout = 4_000): Promise<void> {
  await page.waitForLoadState('networkidle', { timeout }).catch(() => undefined);
}
