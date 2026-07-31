# Automated Screenshot System

Generates the **small, curated set of screenshots that the PWA actually bundles**
— the images shown in the install/download modal and the ones declared in the
web app manifest — at iPhone (and where needed, desktop) sizes, deterministically.

```bash
npm run update:screenshots          # regenerate everything (mobile + the few wide ones)
npm run update:screenshots:mobile   # only the iPhone shots
npm run update:screenshots:desktop  # only the _wide shots
npm run update:screenshots:ui       # interactive Playwright UI (debug)
npx playwright test -g "stats"      # regenerate just the stats shots
```

Each shot's `target` decides where it lands (`<feature>/<name>.png` for mobile,
`<name>_wide.png` for desktop):

- `target: 'app'` → [`src/assets/screenshots/`](../../src/assets/screenshots) —
  bundled into the PWA; these are the ones the install prompt and web manifest
  reference.
- `target: 'docs'` (the **default**) → `docs/features/` — feature documentation
  only, **not** shipped, since Angular only copies `src/assets`.

A `manifest.json` (recording every file and its real path) is written alongside
the app images.

## What gets generated & where it's used

| file | used by | viewports |
|------|---------|-----------|
| `start.png` / `start_wide.png` | install modal + manifest | mobile + wide |
| `stats.png` / `stats_wide.png` | install modal + manifest | mobile + wide |
| `history.png` / `history_wide.png` | install modal + manifest | mobile + wide |
| `stats2.png` | manifest | mobile |
| `arsenal.png` | install modal | mobile |
| `balls.png` | install modal | mobile |
| `pattern.png` | install modal | mobile |

- **Install modal** → [`pwa-install-prompt.component.ts`](../../src/app/shared/components/pwa-install-prompt/pwa-install-prompt.component.ts) `images[]` references `start, stats, history, arsenal, balls, pattern`.
- **Manifest** → [`src/manifest.webmanifest`](../../src/manifest.webmanifest) `screenshots[]` references the `_wide` trio + `start, stats, stats2, history`.

Wide (`_wide`) variants are **only** produced for `start`, `stats`, `history`
(the manifest's `form_factor: "wide"` entries) — everything else is mobile-only.

## Real images (no placeholders)

The Ball Library, Arsenal and Pattern Library are captured against the **live
APIs**, so they show genuine balls/patterns and real product imagery:

- `lib/mocks.ts` mocks **nothing** data-related; it only neutralises telemetry
  / analytics / OCR / the GitHub update check so they don't error or pop a
  prompt over a shot.
- The seeded **Arsenal** and ball favourites use real balls captured in
  `fixtures-data/real-balls.json` (so their thumbnails resolve on bowwwl.com).

> Because balls/patterns are live, those three screenshots reflect the current
> catalogue and need network access at capture time. Refresh the seeded arsenal
> balls anytime with `npm run capture:fixtures` (or re-fetch the balls API).

The local screens (`start`, `stats`, `stats2`, `history`) are driven entirely by
**seeded, fixed data** (games/leagues from `fixtures-data/seed-profiles.ts`), so
they stay visually stable run-to-run.

## Architecture

```
playwright.config.ts                # 2 projects: mobile (iPhone 15 Pro) + desktop (1440×900)
playwright/screenshots/
├── registry.ts                     # ★ THE SOURCE OF TRUTH — the curated shot list
├── screenshot.spec.ts              # turns each registry entry into a test
├── capture-fixtures.spec.ts        # opt-in: refresh real-balls.json from the live API
├── pages/                          # page objects — all selectors/interactions
│   ├── base.page.ts  add-game.page.ts  stats.page.ts  history.page.ts
│   ├── equipment.pages.ts          #   balls + arsenal (+ comparison, unused)
│   └── pattern.page.ts  league.page.ts  alley-map.page.ts  settings.page.ts (reusable, unused)
├── fixtures-data/
│   ├── seed-profiles.ts            #   seeded games/leagues/arsenal + localStorage
│   ├── drafts.ts                   #   the populated scorecard shown on `start`
│   └── real-balls.json             #   real balls for the arsenal/favourites seed
└── lib/
    ├── capture.ts                  #   per-shot pipeline (seed → navigate → wait → shoot → validate)
    ├── seed.ts                     #   writes Ionic Storage (IndexedDB) + localStorage
    ├── mocks.ts                    #   neutralises telemetry/side-effect endpoints only
    ├── stabilize.ts                #   kills animations, pins Math.random, waits fonts/imgs/charts
    ├── scoring.ts                  #   standalone ten-pin scorer + game builders
    └── viewports.ts  constants.ts  types.ts  manifest.ts  global-setup.ts
```

### Determinism / anti-flake

- Local data (games, leagues, arsenal, favourites, prefs) is seeded into Ionic
  Storage's IndexedDB + localStorage **before** the app boots.
- All displayed dates derive from `REFERENCE_NOW`; `Math.random` is pinned;
  CSS animations/transitions are zeroed and reduced-motion is forced.
- The pipeline waits for the Ionic shell, fonts, images and chart-canvas pixel
  stability, and rides out the dev server's first-load vite optimisation with a
  reload-retry. Skeletons/spinners are never captured.

### Validation

`lib/capture.ts` enforces kebab-case names, creates the folder, **overwrites**
old files, and fails a shot if the PNG is missing or suspiciously small.

## Add / change a screenshot

Edit `registry.ts` (and, if you want it bundled, reference it from the manifest
and/or the install-prompt component), then run `npm run update:screenshots`.

```ts
{
  id: 'stats2',
  name: 'stats2',                 // → src/assets/screenshots/stats2.png
  route: '/tabs/stats',
  viewports: ['mobile'],          // omit `desktop` to skip the _wide variant
  prepare: ({ page }) => new StatsPage(page).openTab('Spares'),
}
```

| field | purpose |
|-------|---------|
| `target` | `'app'` → `src/assets/screenshots` (bundled) · `'docs'` (default) → `docs/features` (not shipped) |
| `seed` | `'rich'` (default) or `'empty'` |
| `viewports` | `['mobile']`, `['desktop']`, or both (controls whether `_wide` is made) |
| `prepare` | reach the desired state (open modal, switch tab, …) |
| `extraLocal` | extra `localStorage` merged onto the seed (e.g. the `start` draft) |
| `fullPage` / `clip` | full scrollable capture / single-element capture |

## Viewports

| project | size | DSF | output |
|---------|------|-----|--------|
| mobile  | 393×852 (iPhone 15 Pro, iOS mode) | 3 | `<name>.png` → 1179×2556 |
| desktop | 1440×900 | 2 | `<name>_wide.png` → 2880×1800 |
