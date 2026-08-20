import { test, expect } from './lib/app';
import { AddGamePage } from '../screenshots/pages/add-game.page';
import { makePinDraft } from '../screenshots/fixtures-data/drafts';
import { firstBall, op, sp, X } from '../screenshots/lib/scoring';

/**
 * The pin-by-pin scoring deck is the app's headline feature, so it gets the
 * deepest e2e coverage: toggling into it, playing a full game through the deck,
 * persisting it, and restoring an in-progress draft.
 */
test.describe('add game — pin input', () => {
  test('toggles between grid mode and the pin deck', async ({ app }) => {
    // The seed defaults pinInputMode to "false", so we start in grid mode.
    await app.boot('/tabs/add');
    await expect(app.page.locator('app-pin-input')).toHaveCount(0);
    await expect(app.active().locator('.grid-container ion-input').first()).toBeVisible();

    await new AddGamePage(app.page).enablePinInput();

    await expect(app.page.locator('app-pin-input')).toBeVisible();
  });

  test('plays a full game on the pin deck, saves it, and it appears in history', async ({ app }) => {
    await app.boot('/tabs/add', { seed: 'empty', extraLocal: { pinInputMode: 'true' } });
    await expect(app.page.locator('app-pin-input')).toBeVisible();

    // Gutter a complete game (total 0 — deterministic and alert-free), then save.
    const addGame = new AddGamePage(app.page);
    await addGame.recordGutterGame();
    expect(await addGame.isGameComplete()).toBe(true);
    await addGame.saveSingleGame();

    // The saved game shows up in history as the only game, scoring 0. Scope to
    // the active page: the now-hidden Add tab keeps its own accordion in the DOM.
    await app.tapTab('history');
    await expect(app.active().locator('ion-accordion')).toHaveCount(1);
    await expect(app.active().locator('.score-text').first()).toHaveText('0');
  });

  test('restores an in-progress pin-mode draft', async ({ app }) => {
    const draft = makePinDraft([X(), sp([7, 10]), op([10])], firstBall([10]));
    await app.boot('/tabs/add', { seed: 'empty', extraLocal: { bowling_game_draft: draft } });

    await new AddGamePage(app.page).resumeDraft();

    // Restored, thrown balls render mini pin-decks in the score grid; a fresh
    // game has none.
    await expect(app.page.locator('app-pin-input')).toBeVisible();
    expect(await app.active().locator('.grid-container app-pin-deck').count()).toBeGreaterThan(0);
  });
});

test.describe('add game — series mode', () => {
  test('switches to a 3-game series', async ({ app }) => {
    await app.boot('/tabs/add');

    await new AddGamePage(app.page).selectMode('3-Series');

    // One segment tab per game in the series, plus the series save action.
    await expect(app.active().locator('ion-segment-button')).toHaveCount(3);
    await expect(app.active().locator('ion-button', { hasText: 'Save Series' })).toBeVisible();
  });
});
