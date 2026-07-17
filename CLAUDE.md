# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Lightning Bowl — an offline-first bowling score tracker shipped as a PWA and as native Android/iOS apps via Capacitor. Users log games (pin-by-pin input is the headline feature), view statistics, manage leagues, track their ball arsenal, browse oil patterns, and find alleys on a map. This repo is the app; sibling repos in `../` (`lightningbowl-bowwwl-proxy`, `lightningbowl-oauth`, `lightningbowl-ocr`, `lightningbowl-patterns`) provide the backend services it calls.

**Stack**: Angular 20 (standalone components, signals), Ionic 8, Capacitor 8, TypeScript 5.9 (strict), RxJS 7.8, Chart.js, Leaflet, ExcelJS, sql.js, Ionic Storage (IndexedDB). Hosted on Vercel; [api/](api/) holds two Vercel serverless functions proxying Nominatim/Overpass for the alley map. Tests: Karma + Jasmine.

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
# Tests — karma.conf.js has browsers: [], so plain `npm test` starts Karma
# without launching a browser. Use:
npx ng test --browsers=ChromeHeadless --watch=false
# Single spec (verified working):
npx ng test --browsers=ChromeHeadless --watch=false --include='**/league-selector/*.spec.ts'
```

```bash
# Mobile (per .github/copilot-instructions.md)
npx cap sync             # copy www/ into android/ and ios/
npx cap open android     # requires Android SDK
```

No e2e suite and no CI workflows exist. Husky pre-commit runs lint-staged (Prettier on staged files + ESLint on `*.ts`).

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
- DI: both constructor injection and `inject()` appear; match the file you're editing.
- Services live in `core/services/<name>/<name>.service.ts`; pure logic goes in `core/utils/` as free functions (e.g. [frame.utils.ts](src/app/core/utils/game-utils/frame.utils.ts)).
- Tests: Jasmine specs colocated with source; `TestBed` with mock providers built from `jasmine.createSpy` object literals; set signal inputs via `fixture.componentRef.setInput(...)` ([league-selector.component.spec.ts](src/app/shared/components/league-selector/league-selector.component.spec.ts)).
- User feedback via `ToastService.showToast(TOAST_MESSAGES.x, icon)` with messages from [toast-messages.constants.ts](src/app/core/constants/toast-messages.constants.ts) — don't inline toast strings.
- Spacing: margins and paddings are always multiples of 4px (4, 8, 12, 16, …).
- Prettier: 150 print width, 2 spaces, LF. `no-console` allows only `warn`/`error`.

## Content & writing guidelines

- All user-facing text is English; there is no i18n/localization setup (single locale).
- Toast message pattern: `"<Thing> saved successfully."` / `"Error saving <thing>."` — plain, sentence case, trailing period.
- Domain vocabulary: frames, throws, strikes/spares, clean games, series (3/4/5/6 games), leagues, arsenal (personal ball collection), ball core/coverstock/factory finish, oil patterns, pin leaves.
- 5 color themes as classes on `:root`: `red`, `blue`, `gray`, `lila`, `green` ([variables.scss](src/theme/variables.scss)); `ThemeChangerService` defaults to `Gray`. Style with Ionic CSS variables (`--ion-color-primary`, …) so components work in every theme.
- Commit messages: short, lowercase, no type prefix (`fix sorting with patterns (#631)`, `added custom loading animation (#632)`); PR-linked issues in parentheses. Branches: `<issue-number>-<kebab-description>`.

## Do / Don't for AI edits

- **Do** prefer Ionic components over custom HTML/CSS, and extend existing components in place rather than extracting new sibling components.
- **Do** route storage access through `StorageRepository` and define new keys in `storage-keys.ts`, not ad-hoc strings (exception: a few UI prefs use `localStorage` directly).
- **Do** keep changes surgical — this codebase's own guidelines (.github/copilot-instructions.md) stress minimal, scoped diffs.
- **Don't** edit generated/build output: `www/`, `project-summary.md` (Capacitor-generated, stale), `.angular/`, native code under `android/`/`ios/` (updated via `npx cap sync`).
- **Don't** trust version/architecture claims in `.github/copilot-instructions.md` or `README.md` — both are stale (they say Angular 18/Capacitor 7 and "four tabs"); `package.json` is the source of truth.
- **Don't** add NgModules, NgRx, or new state containers — extend the existing signal stores.

## Gotchas

- `npm test` without `--browsers=ChromeHeadless` launches no browser (`browsers: []` in karma.conf.js) — it just waits.
- `--include` filters which specs _run_, but the test build still compiles **all** spec/source files, so one broken file blocks every test run. As of 2026-07, [bowling-score-display.pipe.ts](src/app/shared/pipes/bowling-score-display/bowling-score-display.pipe.ts) has a stale import (`getThrowValue` moved from `game.model` to `frame.utils`), breaking the whole test build while `npm run build` still passes (the app build only compiles from `main.ts`).
- Build warnings about CommonJS (`sql.js`) are expected (`allowedCommonJsDependencies`).
- Tight style budget: component SCSS errors at 15 KB (angular.json).
- Dev `environment.ts` points `authBackendUrl` at `http://localhost:3000` — the sibling `lightningbowl-oauth` repo; cloud-sync features need it running locally.
- `npm run pretty` formats the entire repo — don't run it as part of an unrelated change or the diff explodes.

## Open questions

- `playwright/` contains only empty artifact folders; no Playwright config or dependency exists in this repo — the screenshot tooling that produced them appears to live outside this repo.
- No CI or deploy config found (`.github/` has no workflows; `.vercel/` is empty) — deployment is presumably Vercel Git integration, unverified.
- No `engines` field in package.json; copilot-instructions claims Node 20+; Node 22.19 works locally.
