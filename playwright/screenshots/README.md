# Automated Screenshot System

Deterministic, maintainable screenshots of **every page and important state** of
Lightning Bowl, rendered at mobile **and** desktop sizes for documentation, the
README, app‑store listings and marketing.

```bash
npm run update:screenshots          # regenerate everything (mobile + desktop)
npm run update:screenshots:mobile   # only iPhone shots
npm run update:screenshots:desktop  # only 1440×900 shots
npm run update:screenshots:ui       # interactive Playwright UI (debug)
npx playwright test -g "leagues."   # regenerate just the league shots
```

Output lands in [`src/assets/screenshots/`](../../src/assets/screenshots) as
`feature/page.png` (mobile) and `feature/page_wide.png` (desktop), plus a
generated `manifest.json`.

---

## How it works

```
playwright.config.ts                # 2 projects: mobile (iPhone 15 Pro) + desktop (1440×900)
playwright/screenshots/
├── registry.ts                     # ★ THE SOURCE OF TRUTH — every shot is one entry
├── screenshot.spec.ts              # turns each registry entry into a test
├── capture-fixtures.spec.ts        # opt-in: record live API responses (npm run capture:fixtures)
├── pages/                          # page objects — all selectors/interactions live here
│   ├── base.page.ts                #   shared primitives (modals, segments, search, long-press…)
│   ├── add-game.page.ts  stats.page.ts  history.page.ts  league.page.ts
│   ├── equipment.pages.ts (balls / arsenal / comparison)
│   └── pattern.page.ts  alley-map.page.ts  settings.page.ts
├── fixtures-data/                  # deterministic data
│   ├── seed-profiles.ts            #   games / leagues / arsenal + localStorage ("rich"/"empty")
│   ├── drafts.ts                   #   in-progress game draft (for the score-entry shot)
│   └── remote.ts                   #   balls / patterns / alleys served to the network mocks
└── lib/                            # the engine
    ├── capture.ts                  #   per-shot pipeline (seed → navigate → wait → shoot → validate)
    ├── seed.ts                     #   writes Ionic Storage (IndexedDB) + localStorage
    ├── mocks.ts                    #   intercepts every external API and serves fixtures
    ├── stabilize.ts                #   kills animations, pins Math.random, waits for fonts/imgs/charts
    ├── assets.ts                   #   inline SVG placeholders (ball thumbs, map tiles, charts…)
    ├── scoring.ts                  #   standalone ten-pin scorer + game builders
    ├── viewports.ts  constants.ts  types.ts  manifest.ts  global-setup.ts
```

### Determinism (why these screenshots never flake)

- **Local data is seeded** directly into Ionic Storage's IndexedDB (`_ionicstorage`/
  `_ionickv`) and `localStorage` before the app boots — games, leagues, arsenal,
  favourites, username, prefs. See `fixtures-data/seed-profiles.ts`.
- **Remote data is mocked** from `fixtures-data/remote.ts` (Ball Library, Pattern
  Library, Alley Map / Overpass / Nominatim, OSM tiles, marker icons). Telemetry,
  OCR, GitHub and analytics endpoints are neutralised. The run is fully offline.
- **Time** is fixed: every displayed date derives from `REFERENCE_NOW`
  (`lib/constants.ts`), and seeded game dates are computed from it.
- **Randomness** is pinned (`Math.random` → seeded mulberry32).
- **Motion is removed**: CSS transitions/animations are zeroed, `prefers-reduced-motion`
  is forced, and the pipeline waits for fonts, images, charts (canvas pixel
  stability) and map tiles before shooting. Skeletons/spinners are never captured.

### Validation

`lib/capture.ts` enforces the naming convention (kebab-case `feature`/`name`),
creates folders as needed, **overwrites** old files, and fails the shot if the
PNG is missing or suspiciously small. Invalid registry paths throw.

---

## Add a new screenshot

1. Open `registry.ts` and add an entry:

   ```ts
   {
     id: 'statistics.average-chart',     // unique, used for -g filtering
     feature: 'statistics',              // → src/assets/screenshots/statistics/
     name: 'average-chart',              // → average-chart.png + average-chart_wide.png
     route: '/tabs/stats',
     description: 'Average progression chart',
     fullPage: true,
     prepare: ({ page }) => new StatsPage(page).openTab('Overall'),
   }
   ```

2. If you need a new interaction, add a method to the relevant page object in
   `pages/` (keep selectors out of the registry).

3. Run `npm run update:screenshots`. Done.

### Options on a registry entry

| field        | purpose |
|--------------|---------|
| `seed`       | `'rich'` (default) or `'empty'` for empty-state shots |
| `viewports`  | restrict to `['mobile']` / `['desktop']` (default: both) |
| `prepare`    | reach the desired state (open modal, switch tab, search…) |
| `ready`      | extra readiness wait beyond the defaults |
| `fullPage`   | capture the full scrollable Ionic content, not just the viewport |
| `clip`       | screenshot a single element by selector |
| `extraLocal` | extra `localStorage` merged onto the seed (e.g. a game draft) |

---

## Refreshing the fixtures from live data

The mocked Ball/Pattern data is a curated snapshot. To re-snapshot from the live
APIs:

```bash
npm run capture:fixtures
```

This records the real responses to `fixtures-data/captured/*.json` (git-ignored).
Review them and merge the relevant parts into `remote.ts`.

> Prefer real map imagery for marketing? Drop the `tile.openstreetmap.org`
> route in `lib/mocks.ts` to let live tiles through (at the cost of determinism).

---

## Viewports

| project | size | DSF | file suffix |
|---------|------|-----|-------------|
| mobile  | 393×852 (iPhone 15 Pro, iOS mode) | 3 | _none_ |
| desktop | 1440×900 | 2 | `_wide` |

Change or add sizes in `lib/viewports.ts` + a matching project in
`playwright.config.ts`.
