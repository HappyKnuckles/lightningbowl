/**
 * THE SCREENSHOT REGISTRY — the single source of truth.
 *
 * To add a new screenshot: append one entry here and run
 *   npm run update:screenshots
 *
 * Each entry renders to:  src/assets/screenshots/<feature>/<name>.png   (mobile)
 *                         src/assets/screenshots/<feature>/<name>_wide.png (desktop)
 *
 * `prepare` performs the interaction needed to reach the state (open a modal,
 * switch a tab, type a search, …) using the page objects in ./pages. Keep the
 * registry declarative — selectors belong in the page objects.
 */
import { makeDraft } from './fixtures-data/drafts';
import type { ShotDefinition } from './lib/types';
import { AddGamePage } from './pages/add-game.page';
import { AlleyMapPage } from './pages/alley-map.page';
import { ArsenalPage, BallComparisonPage, BallsPage } from './pages/equipment.pages';
import { HistoryPage } from './pages/history.page';
import { LeaguePage } from './pages/league.page';
import { PatternPage } from './pages/pattern.page';
import { SettingsPage } from './pages/settings.page';
import { StatsPage } from './pages/stats.page';

const R = {
  add: '/tabs/add',
  stats: '/tabs/stats',
  history: '/tabs/history',
  league: '/tabs/league',
  balls: '/tabs/balls',
  arsenal: '/tabs/arsenal',
  comparison: '/tabs/ball-comparison',
  pattern: '/tabs/pattern',
  map: '/tabs/map',
  settings: '/tabs/settings',
  minigame: '/tabs/minigame',
};

// A complete, clean ~mark-every-frame game used to show a populated scorecard.
const SCORE_ENTRY_DRAFT = makeDraft({
  mode: 'Single',
  frameSets: [[[10], [9, 1], [8, 2], [10], [9, 1], [8, 2], [10], [9, 1], [8, 2], [9, 1, 10]]],
});

export const REGISTRY: ShotDefinition[] = [
  // ───────────────────────────── Games / score entry ─────────────────────
  { id: 'games.new-game', feature: 'games', name: 'new-game', route: R.add, description: 'Fresh single-game score board' },
  {
    id: 'games.score-entry',
    feature: 'games',
    name: 'score-entry',
    route: R.add,
    description: 'Populated scorecard',
    extraLocal: { bowling_game_draft: SCORE_ENTRY_DRAFT },
    prepare: ({ page }) => new AddGamePage(page).resumeDraft(),
  },
  {
    id: 'games.pin-input',
    feature: 'games',
    name: 'pin-input',
    route: R.add,
    target: 'app',
    description: 'Pin-deck input mode',
    prepare: ({ page }) => new AddGamePage(page).enablePinInput(),
  },
  {
    id: 'games.series',
    feature: 'games',
    name: 'series',
    route: R.add,
    description: '3-game series mode',
    prepare: ({ page }) => new AddGamePage(page).selectMode('3 Series'),
  },
  {
    id: 'games.mode-select',
    feature: 'games',
    name: 'mode-select',
    route: R.add,
    description: 'Series mode action sheet',
    prepare: ({ page }) => new AddGamePage(page).openModeSheet(),
  },
  {
    id: 'games.history',
    feature: 'games',
    name: 'history',
    route: R.history,
    description: 'Game history list',
    prepare: ({ page }) => new HistoryPage(page).waitForGames(),
  },
  {
    id: 'games.game-details',
    feature: 'games',
    name: 'game-details',
    route: R.history,
    target: 'app',
    description: 'Expanded game scorecard',
    prepare: ({ page }) => new HistoryPage(page).expandFirstGame(),
  },

  // ───────────────────────────── Statistics ──────────────────────────────
  { id: 'stats.overall', feature: 'statistics', name: 'overall', route: R.stats, target: 'app', description: 'Overall stats + charts' },
  {
    id: 'stats.throws',
    feature: 'statistics',
    name: 'throws',
    route: R.stats,
    target: 'app',
    description: 'Throw stats + distribution',
    prepare: ({ page }) => new StatsPage(page).openTab('Throws'),
  },
  {
    id: 'stats.spares',
    feature: 'statistics',
    name: 'spares',
    route: R.stats,
    target: 'app',
    description: 'Spare conversion + charts',
    prepare: ({ page }) => new StatsPage(page).openTab('Spares'),
  },
  {
    id: 'stats.pins',
    feature: 'statistics',
    name: 'pins',
    route: R.stats,
    target: 'app',
    description: 'Pin leaves + diagrams',
    prepare: ({ page }) => new StatsPage(page).openTab('Pins'),
  },
  {
    id: 'stats.sessions',
    feature: 'statistics',
    name: 'sessions',
    route: R.stats,
    description: 'Per-session stats + date picker',
    prepare: ({ page }) => new StatsPage(page).openTab('Sessions'),
  },
  {
    id: 'stats.overall.scrolled',
    feature: 'statistics',
    name: 'overall-scrolled',
    route: R.stats,
    description: 'Overall stats + charts',
    ready: ({ page }) => new StatsPage(page).scrollDown(600),
  },
  {
    id: 'stats.throws.scrolled',
    feature: 'statistics',
    name: 'throws-scrolled',
    route: R.stats,
    description: 'Throw stats + distribution',
    prepare: ({ page }) => new StatsPage(page).openTab('Throws'),
    ready: ({ page }) => new StatsPage(page).scrollDown(),
  },
  {
    id: 'stats.spares.scrolled',
    feature: 'statistics',
    name: 'spares-scrolled',
    route: R.stats,
    description: 'Spare conversion + charts',
    prepare: ({ page }) => new StatsPage(page).openTab('Spares'),
    ready: ({ page }) => new StatsPage(page).scrollDown(),
  },
  {
    id: 'stats.pins.scrolled',
    feature: 'statistics',
    name: 'pins-scrolled',
    route: R.stats,
    description: 'Pin leaves + diagrams',
    prepare: ({ page }) => new StatsPage(page).openTab('Pins'),
    ready: ({ page }) => new StatsPage(page).scrollDown(),
  },
  {
    id: 'stats.sessions.scrolled',
    feature: 'statistics',
    name: 'sessions-scrolled',
    route: R.stats,
    description: 'Per-session stats + date picker',
    prepare: ({ page }) => new StatsPage(page).openTab('Sessions'),
    ready: ({ page }) => new StatsPage(page).scrollDown(),
  },
  {
    id: 'stats.filter',
    feature: 'statistics',
    name: 'filter',
    route: R.stats,
    description: 'Stats filter modal',
    prepare: ({ page }) => new StatsPage(page).openFilter(),
  },

  // ───────────────────────────── Leagues ─────────────────────────────────
  {
    id: 'leagues.list',
    feature: 'leagues',
    name: 'list',
    route: R.league,
    target: 'app',
    description: 'League list with stats',
    prepare: ({ page }) => new LeaguePage(page).waitForLeagues(),
  },
  {
    id: 'leagues.detail-overall',
    feature: 'leagues',
    name: 'detail-overall',
    route: R.league,
    description: 'League detail — overall',
    prepare: ({ page }) => new LeaguePage(page).openFirstLeague(),
  },
  {
    id: 'leagues.create',
    feature: 'leagues',
    name: 'create',
    route: R.league,
    description: 'Create league dialog',
    prepare: ({ page }) => new LeaguePage(page).openCreateDialog(),
  },
  {
    id: 'leagues.visibility-edit',
    feature: 'leagues',
    name: 'visibility-edit',
    route: R.league,
    description: 'League visibility checkboxes',
    prepare: ({ page }) => new LeaguePage(page).enterVisibilityEdit(),
  },
  // ───────────────────────────── Equipment ───────────────────────────────
  {
    id: 'equipment.ball-library',
    feature: 'equipment',
    name: 'ball-library',
    route: R.balls,
    target: 'app',
    description: 'Ball library grid',
    prepare: ({ page }) => new BallsPage(page).waitForBalls(),
  },
  {
    id: 'equipment.ball-filter',
    feature: 'equipment',
    name: 'ball-filter',
    route: R.balls,
    description: 'Ball filter modal',
    prepare: async ({ page }) => {
      const p = new BallsPage(page);
      await p.waitForBalls();
      await p.openFilter();
    },
  },
  {
    id: 'equipment.similar-balls',
    feature: 'equipment',
    name: 'similar-balls',
    route: R.balls,
    description: 'Similar-movement bottom sheet',
    prepare: ({ page }) => new BallsPage(page).openSimilarBalls(),
  },
  {
    id: 'equipment.arsenal',
    feature: 'equipment',
    name: 'arsenal',
    route: R.arsenal,
    target: 'app',
    description: 'Arsenal list',
    prepare: ({ page }) => new ArsenalPage(page).waitForArsenal(),
  },
  {
    id: 'equipment.ball-details',
    feature: 'equipment',
    name: 'ball-details',
    route: R.arsenal,
    description: 'Ball detail modal (core/coverstock)',
    prepare: ({ page }) => new ArsenalPage(page).openFirstBall(),
  },
  {
    id: 'equipment.arsenal-add',
    feature: 'equipment',
    name: 'arsenal-add',
    route: R.arsenal,
    description: 'Add-ball typeahead',
    prepare: ({ page }) => new ArsenalPage(page).openAddBall(),
  },
  {
    id: 'equipment.comparison',
    feature: 'equipment',
    name: 'comparison',
    route: R.comparison,
    target: 'app',
    description: 'Ball comparison cards + radar',
    prepare: ({ page }) => new BallComparisonPage(page).addBalls(3),
  },
  {
    id: 'equipment.comparison-chart',
    feature: 'equipment',
    name: 'comparison-chart',
    route: R.comparison,
    description: 'Ball comparison distribution chart',
    prepare: async ({ page }) => {
      const p = new BallComparisonPage(page);
      await p.addBalls(3);
      await p.openChartTab();
    },
  },

  // ───────────────────────────── Patterns ────────────────────────────────
  {
    id: 'patterns.library',
    feature: 'patterns',
    name: 'library',
    route: R.pattern,
    target: 'app',
    description: 'Oil pattern library',
    prepare: ({ page }) => new PatternPage(page).waitForPatterns(),
  },
  {
    id: 'patterns.search',
    feature: 'patterns',
    name: 'search',
    route: R.pattern,
    description: 'Pattern search results',
    prepare: async ({ page }) => {
      const p = new PatternPage(page);
      await p.waitForPatterns();
      await p.search('PBA');
    },
  },
  {
    id: 'patterns.detail',
    feature: 'patterns',
    name: 'detail',
    route: R.pattern,
    description: 'Pattern detail modal',
    prepare: ({ page }) => new PatternPage(page).openFirstPattern(),
  },

  // ───────────────────────────── Alley map ───────────────────────────────
  {
    id: 'alley-map.overview',
    feature: 'alley-map',
    name: 'overview',
    route: R.map,
    description: 'Map with alley markers',
    prepare: ({ page }) => new AlleyMapPage(page).waitForMap(),
  },
  {
    id: 'alley-map.selected',
    feature: 'alley-map',
    name: 'selected',
    route: R.map,
    description: 'Selected alley popup',
    prepare: ({ page }) => new AlleyMapPage(page).selectFirstAlley(),
  },
  {
    id: 'alley-map.search',
    feature: 'alley-map',
    name: 'search',
    route: R.map,
    description: 'Map search recenter',
    prepare: ({ page }) => new AlleyMapPage(page).searchLocation('Brooklyn'),
  },

  // ───────────────────────────── Profile / settings ──────────────────────
  { id: 'profile.settings', feature: 'profile', name: 'settings', route: R.settings, description: 'Settings list' },
  {
    id: 'profile.cloud-sync',
    feature: 'profile',
    name: 'cloud-sync',
    route: R.settings,
    description: 'Cloud sync modal',
    prepare: ({ page }) => new SettingsPage(page).openCloudSync(),
  },
  {
    id: 'profile.theme',
    feature: 'profile',
    name: 'theme',
    route: R.settings,
    description: 'Color theme picker',
    prepare: ({ page }) => new SettingsPage(page).openThemePicker(),
  },

  // ───────────────────────────── Minigame ────────────────────────────────
  { id: 'minigame.play', feature: 'minigame', name: 'play', route: R.minigame, description: 'Bowling minigame canvas' },
];
