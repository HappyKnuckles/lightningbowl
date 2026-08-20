# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Lightning Bowl — an offline-first bowling score tracker shipped as a PWA and as native Android/iOS apps via Capacitor. Users log games (pin-by-pin input is the headline feature), view statistics, manage leagues, track their ball arsenal, browse oil patterns, and find alleys on a map. This repo is the app; sibling repos in `../` (`lightningbowl-bowwwl-proxy`, `lightningbowl-oauth`, `lightningbowl-ocr`, `lightningbowl-patterns`) provide the backend services it calls.

**Stack**: Angular 20 (standalone components, signals), Ionic 8, Capacitor 8, TypeScript 5.9 (strict), RxJS 7.8, Chart.js, Leaflet, ExcelJS, sql.js, Ionic Storage (IndexedDB). Hosted on Vercel; [api/](api/) holds two Vercel serverless functions proxying Nominatim/Overpass for the alley map. Unit tests: Vitest (browser mode, headless Chromium) via the `@angular/build:unit-test` builder; e2e: Playwright.

## Commands

```bash
npm install
npm start                # dev server on http://localhost:4200
npm run build            # prod build to www/ — also the de-facto typecheck
npm run lint             # ESLint (ng lint); warnings acceptable, errors not
npm run stylelint        # Stylelint for src/**/*.scss (defaultSeverity: warning)
npm run pretty           # Prettier --write on whole repo
```

```bash
# Unit tests — Vitest in headless Chromium; watch mode only when attached to a TTY
npm test                              # = ng test
npx ng test --configuration=ci        # explicit non-watch, for scripts
# Single spec:
npx ng test --include='**/league-selector/*.spec.ts'

# Line coverage — separate pipeline, see Gotchas
npm run test:coverage
```

```bash
# e2e — Playwright (separate config, own dev server)
npm run e2e              # headless
npm run e2e:ui           # interactive
npm run e2e:report       # last HTML report
```

```bash
# Mobile (per .github/copilot-instructions.md)
npx cap sync             # copy www/ into android/ and ios/
npx cap open android     # requires Android SDK
```

Playwright drives three separate configs — [playwright.e2e.config.ts](playwright.e2e.config.ts) (the e2e suite, 10 spec files under [playwright/e2e/](playwright/e2e/)), [playwright.config.ts](playwright.config.ts) and [playwright.capture.config.ts](playwright.capture.config.ts) (screenshot tooling). No CI. Husky pre-commit runs lint-staged (Prettier on staged files + ESLint on `*.ts`).

## Architecture

```
src/app/
├── app.routes.ts          # all routes; pages lazy-loaded via loadComponent()
├── tabs/tabs.page.ts      # 4 main tabs (add, stats, history, league) + "More" modal (moreTabs array)
├── core/
│   ├── stores/            # signal-based state: games, balls, leagues, patterns, settings + app.facade.ts
│   ├── services/          # one folder per service (toast, storage, game-stats, cloud-sync, …)
│   ├── models/            # TS interfaces (game.model.ts, ball.model.ts, …)
│   ├── utils/             # pure functions (game-utils/, sort-utils/, stat-utils/)
│   ├── constants/         # TOAST_MESSAGES, app constants
│   ├── configs/           # filter/stat-definition/typeahead config objects
│   └── directives/
├── pages/                 # one folder per routed page (*.page.ts)
└── shared/
    ├── components/        # reusable UI (*.component.ts)
    ├── pipes/
    └── animations/
```

- **State**: no NgRx. Each store in [core/stores/](src/app/core/stores/) exposes `signal()`s and persists through `StorageRepository` (Ionic Storage → IndexedDB) using key builders from [storage-keys.ts](src/app/core/services/storage/storage-keys.ts). `AppFacade` coordinates cross-store operations (e.g. `editLeague` touches leagues + games).
- **Startup**: `provideAppInitializer` in [main.ts](src/main.ts) runs `AppFacade.init()` (creates storage, requests persistent storage, loads all stores in parallel) and `CloudSyncService.init()`.
- **Offline-first**: local IndexedDB is the source of truth; external APIs (`environments/environment*.ts` — bowwwl proxy, pattern scraper, OCR, analytics) fill caches when reachable. API failures in dev are expected and handled gracefully. Service worker config in `ngsw-config.json` (prod/test builds only).
- **Navigation**: everything lives under `/tabs/…`. A new page needs a folder in `pages/`, a lazy route in `app.routes.ts`, and (if user-reachable) an entry in `tabs.page.ts` `moreTabs`.

## Conventions

- Components are prefixed with the data structure they handle: `ball-filter`, `game-list`, `league-selector` — see [shared/components/](src/app/shared/components/). Class suffix must be `Component` or `Page` (ESLint-enforced), selector prefix `app-`.
- Standalone components only (no NgModules). Import individual `Ion*` components from `@ionic/angular/standalone`; register only needed icons via `addIcons({...})` in the constructor ([league-selector.component.ts](src/app/shared/components/league-selector/league-selector.component.ts)).
- Signals-first: `signal`/`computed` for state, `input()`/`output()`/`model()` for component I/O, modern `@if`/`@for` template control flow. ES `#private` fields for internal store/service state, exposed via `.asReadonly()` or public `readonly` signals.
- No template methods: for templates always use `signal`/`computed` so change detection can be easily adjusted to `OnPush`.
- DI: both constructor injection and `inject()` appear; match the file you're editing.
- Services live in `core/services/<name>/<name>.service.ts`; pure logic goes in `core/utils/` as free functions (e.g. [frame.utils.ts](src/app/core/utils/game-utils/frame.utils.ts)).
- Tests: Vitest specs colocated with source. Globals (`describe`/`it`/`expect`) are on — only `vi` needs importing from `vitest`. `TestBed` with mock providers built from `vi.fn()` object literals; set signal inputs via `fixture.componentRef.setInput(...)` ([league-selector.component.spec.ts](src/app/shared/components/league-selector/league-selector.component.spec.ts)).
- Shared test helpers live in [src/testing/](src/testing/): `makeGame`/`makeBall`/`makePattern` fixtures ([fixtures.ts](src/testing/fixtures.ts)) — always build model objects through these rather than casting a partial literal `as Game`, since real code walks fields a partial lacks — and `createSpyObj` ([spy-obj.ts](src/testing/spy-obj.ts)), the Vitest stand-in for `jasmine.createSpyObj`.
- App-wide providers (HttpClient + testing backend, Ionic, router, noop animations, Ionic Storage) are applied to every TestBed via the builder's `providersFile` ([src/testing/test-providers.ts](src/testing/test-providers.ts)) — don't re-declare them per spec.
- User feedback via `ToastService.showToast(TOAST_MESSAGES.x, icon)` with messages from [toast-messages.constants.ts](src/app/core/constants/toast-messages.constants.ts) — don't inline toast strings.
- Spacing: margins and paddings are always multiples of 4px (4, 8, 12, 16, …).
- Prettier: 150 print width, 2 spaces, LF. `no-console` allows only `warn`/`error`.

## Content & writing guidelines

- All user-facing text is English; there is no i18n/localization setup (single locale).
- Toast message pattern: `"<Thing> saved successfully."` / `"Error saving <thing>."` — plain, sentence case, trailing period.
- Domain vocabulary: frames, throws, strikes/spares, clean games, series (3/4/5/6 games), leagues, arsenal (personal ball collection), ball core/coverstock/factory finish, oil patterns, pin leaves.
- 5 color themes as classes on `:root`: `red`, `blue`, `gray`, `lila`, `green` ([variables.scss](src/theme/variables.scss)); `ThemeChangerService` defaults to `Gray`. Style with Ionic CSS variables (`--ion-color-primary`, …) so components work in every theme.
- Font sizes come from a fixed eighth-rem ladder: `0.625 / 0.75 / 0.875 / 1 / 1.125 / 1.375 / 1.5rem` (0.875rem is the standard small-text size). Never invent in-between values (0.7, 0.8, 0.95rem…) — pick the nearest step. A few legacy strays exist in older SCSS; don't copy them and don't mass-fix them unasked.
- Commit messages: short, lowercase, no type prefix (`fix sorting with patterns (#631)`, `added custom loading animation (#632)`); PR-linked issues in parentheses. Branches: `<issue-number>-<kebab-description>`.

## Do / Don't for AI edits

- **Do** prefer Ionic components over custom HTML/CSS, and extend existing components in place rather than extracting new sibling components.
- **Do** route storage access through `StorageRepository` and define new keys in `storage-keys.ts`, not ad-hoc strings (exception: a few UI prefs use `localStorage` directly).
- **Do** keep changes surgical — this codebase's own guidelines (.github/copilot-instructions.md) stress minimal, scoped diffs.
- **Don't** edit generated/build output: `www/`, `project-summary.md` (Capacitor-generated, stale), `.angular/`, native code under `android/`/`ios/` (updated via `npx cap sync`).
- **Don't** trust version/architecture claims in `.github/copilot-instructions.md` or `README.md` — both are stale (they say Angular 18/Capacitor 7 and "four tabs"); `package.json` is the source of truth.
- **Don't** add NgModules, NgRx, or new state containers — extend the existing signal stores.

## Gotchas

- `@angular/build:unit-test` is marked EXPERIMENTAL by its own builder; its option shape may shift in a future Angular minor. Karma is still reachable on the same builder via `runner: "karma"` if it needs walking back.
- Coverage does **not** come from `ng test`. `@angular/build:unit-test` accepts `codeCoverage` but reports `0/0` — its v8 integration collects nothing from the bundles it hands to Vitest (verified on 20.3.23; the Karma runner is not an option since specs use `vi` from `vitest`). `npm run test:coverage` runs the *same* spec files through Vitest directly via [vitest.coverage.config.ts](vitest.coverage.config.ts), compiling with `@analogjs/vite-plugin-angular` against [tsconfig.coverage.json](tsconfig.coverage.json) and bootstrapping TestBed in [src/testing/vitest-setup.ts](src/testing/vitest-setup.ts) (keep that file in sync with `test-providers.ts`). Line coverage has a floor set in the config; raise it as coverage climbs. Angular 22 fixes the builder, so [scripts/coverage-pipeline-status.mjs](scripts/coverage-pipeline-status.mjs) runs before every coverage run and prints the cleanup steps once `@angular/build` reaches 22 — the whole parallel pipeline is meant to be deleted then.
- `--include` filters which specs _run_, but the test build still compiles **all** spec/source files, so one broken file blocks every test run.
- Specs are typechecked by the editor and `npx tsc -p tsconfig.spec.json --noEmit`, not by the test run itself — the builder transpiles without type errors failing the run.
- `src/app/core/services/ad/ad.service.ts` is dead code (nothing injects `AdService`), and its `@capacitor-community/admob` dep drags a nested Capacitor 6 core into `node_modules`. It never reaches the app bundle; its spec runs and passes.
- Build warnings about CommonJS (`sql.js`) are expected (`allowedCommonJsDependencies`).
- Tight style budget: component SCSS errors at 15 KB (angular.json).
- Dev `environment.ts` points `authBackendUrl` at `http://localhost:3000` — the sibling `lightningbowl-oauth` repo; cloud-sync features need it running locally.
- `npm run pretty` formats the entire repo — don't run it as part of an unrelated change or the diff explodes.

## Open questions

- No CI or deploy config found (`.github/` has no workflows; `.vercel/` is empty) — deployment is presumably Vercel Git integration, unverified.
- No `engines` field in package.json; copilot-instructions claims Node 20+; Node 22.19 works locally.
