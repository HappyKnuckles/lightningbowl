# Functional E2E Tests

Behaviour-level Playwright tests that drive the real app and assert what it does
— distinct from [`../screenshots`](../screenshots/README.md), which only
generates the PWA's bundled images.

```bash
npm run e2e            # run everything headless
npm run e2e:ui         # interactive UI mode (great for debugging)
npm run e2e:headed     # watch it drive a real browser
npm run e2e:report     # open the last HTML report
npx playwright test --config=playwright.e2e.config.ts -g "history"
```

## How it works

Every spec uses the `app` fixture from [`lib/app.ts`](lib/app.ts), which **reuses
the screenshot system's infrastructure** so the two never drift:

```ts
import { test, expect } from './lib/app';

test('history lists the seeded games', async ({ app }) => {
  await app.boot('/tabs/history');          // seed → navigate → wait for Ionic ready
  await expect(app.page.locator('ion-accordion').first()).toBeVisible();
});
```

`app.boot(route, opts)` runs the same deterministic pipeline as a screenshot
capture — `installMocks` (neutralise telemetry/OCR/update checks) →
`installStabilizers` (reduced motion, killed animations, pinned RNG) →
`applySeed` (write games/leagues/arsenal into IndexedDB + localStorage on a blank
page before the app boots) → navigate → `waitForAppReady`.

- `opts.seed`: `'rich'` (default — a full season of games/leagues/arsenal) or
  `'empty'` (for empty-state assertions).
- `opts.extraLocal`: extra `localStorage` merged on top of the seed (drafts,
  `pinInputMode`, …).
- `opts.mockApi`: `'balls'` or `'patterns'` — serve a fixed fixture for a
  network-backed library so its page is deterministic offline (see
  [lib/api-mocks.ts](lib/api-mocks.ts)). Omit to leave the live API in place.

The **page objects** in [`../screenshots/pages`](../screenshots/pages) (selectors
+ Ionic-aware interactions) are imported as-is, so a selector lives in exactly one
place across both suites.

## What's covered

| spec | focus |
|------|-------|
| `smoke.spec.ts` | every locally-driven tab boots and renders its header |
| `navigation.spec.ts` | bottom tab bar + the "More" sheet route correctly |
| `add-game.spec.ts` | **pin-input** toggle, a full game played on the deck → saved → shown in history, draft restore, series mode |
| `history.spec.ts` | seeded list + count badge, expand a scorecard, empty state, filter modal |
| `filters.spec.ts` | filter modal → narrowed list + active-filter chips + consistent counts; Reset clears |
| `stats.spec.ts` | overall average + charts, segment switching, empty state, **adding games updates the Stats view** |
| `leagues.spec.ts` | list, add-league dialog, detail modal, empty state |
| `settings.spec.ts` | list, theme change persists + applies, cloud-sync modal |
| `equipment.spec.ts` | Ball Library (mocked API): grid renders, search narrows, filter modal |
| `patterns.spec.ts` | Pattern Library (mocked API): list renders, search narrows |

### Test-strategy split (why some things aren't here)

These e2e tests assert **wiring** — modal → service → list/chips/counts, add →
stats — not every predicate. The **pure logic** is covered by fast unit tests
instead:

- `src/app/core/services/game-filter/game-filter.service.spec.ts` — exhaustive
  `filterGames()` cases (score range, leagues, balls/patterns multi-select,
  practice/clean/perfect, dates).
- `src/app/core/services/game-stats/game-stats-calculator/overall-stats-calculator.service.spec.ts`
  — score-derived aggregates (games, average, high/low, clean %).

> ⚠️ `npm test` (Karma) is currently **red on `master` for unrelated reasons**
> (several component specs from the signal-inputs migration + a bad import in
> `bowling-score-display.pipe.ts`), so the whole spec program fails to compile.
> The two specs above were verified type-correct in isolation; they'll run once
> the suite is unbroken.

Every `ion-searchbar` lives on a network-backed page (Ball/Pattern Library,
Map), so search coverage uses `mockApi` fixtures (`equipment`/`patterns` specs);
the seed-backed pages use the filter modal, not search.

## Adding a test

1. Pick a route and seed profile.
2. `await app.boot(route, { seed })`.
3. Reuse a page object from `../screenshots/pages` for the interaction (or add a
   method there if a selector is missing — both suites benefit).
4. Assert on user-visible state.
