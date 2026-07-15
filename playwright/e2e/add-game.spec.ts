import { test, expect, type AppHarness } from './lib/app';
import { settle } from '../screenshots/lib/stabilize';
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

  test('carries the selected ball over per throw index and stamps it on saved throws', async ({ app }) => {
    await app.boot('/tabs/add', { seed: 'rich', extraLocal: { pinInputMode: 'true' } });
    const pinInput = app.page.locator('app-pin-input');
    await expect(pinInput).toBeVisible();

    const thumb = pinInput.locator('.ball-selector-corner img.selected-ball-thumb');
    const gutterThrow = async () => {
      await pinInput.locator('.quick-actions ion-button', { hasText: /^\s*-\s*$/ }).click();
      await settle(app.page, 250);
    };

    // Frame 1: strike ball A on throw 1; frame 2 throw 2: spare ball B.
    const ballA = await pickArsenalBall(app, 0);
    const srcA = await thumb.getAttribute('src');
    await gutterThrow(); // F1 T1
    // The very first throw 2 has no ball of its own yet, so it borrows A.
    await expect(thumb).toHaveAttribute('src', srcA!);
    await gutterThrow(); // F1 T2
    await gutterThrow(); // F2 T1
    const ballB = await pickArsenalBall(app, 1);
    const srcB = await thumb.getAttribute('src');
    expect(srcB).not.toBe(srcA);
    await gutterThrow(); // F2 T2

    // From here on, throw 1 defaults to A and throw 2 defaults to B.
    await expect(thumb).toHaveAttribute('src', srcA!); // F3 T1
    await gutterThrow();
    await expect(thumb).toHaveAttribute('src', srcB!); // F3 T2

    // Finish and save, then check the persisted game: every throw carries its
    // ball, first throws stamped with A, second throws with B (frame 1's second
    // throw borrowed A before B existed).
    const addGame = new AddGamePage(app.page);
    await addGame.recordGutterGame();
    await addGame.saveSingleGame();

    // The rich seed pre-loads games, so grab the one we just saved: the newest.
    const games = await readSavedGames(app);
    const saved = games.reduce((a, b) => (a.date > b.date ? a : b));
    const frames = saved.frames as { throws: { ball?: { name: string } }[] }[];
    expect(frames[0].throws.map((t) => t.ball?.name)).toEqual([ballA, ballA]);
    for (const frame of frames.slice(1)) {
      expect(frame.throws[0].ball?.name).toBe(ballA);
      for (const bonus of frame.throws.slice(1)) {
        expect(bonus.ball?.name).toBe(ballB);
      }
    }
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

/**
 * Open the pin deck's corner ball selector and pick the arsenal ball at `index`.
 * Returns the ball's plain name (the "<weight>lbs" suffix of the list label stripped),
 * which is what gets stored on each throw.
 */
async function pickArsenalBall(app: AppHarness, index: number): Promise<string> {
  await app.page.locator('app-pin-input .ball-selector-corner ion-button').click();
  const modal = app.page.locator('ion-modal.show-modal').last();
  await modal.locator('ion-item ion-checkbox').first().waitFor({ state: 'visible' });
  const label = await modal.locator('ion-item h2').nth(index).innerText();
  await modal.locator('ion-item ion-checkbox').nth(index).click();
  await settle(app.page, 200);
  await modal.locator('ion-button', { hasText: 'OK' }).click();
  await settle(app.page, 400);
  return label.replace(/\s+\d+(\.\d+)?lbs$/, '');
}

/** Read all persisted games straight from the app's Ionic Storage IndexedDB. */
async function readSavedGames(app: AppHarness): Promise<Record<string, any>[]> {
  return app.page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const open = indexedDB.open('_ionicstorage', 1);
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(open.error);
    });
    const entries = await new Promise<[string, any][]>((resolve, reject) => {
      const tx = db.transaction('_ionickv', 'readonly');
      const store = tx.objectStore('_ionickv');
      const keysReq = store.getAllKeys();
      const valsReq = store.getAll();
      tx.oncomplete = () => resolve(keysReq.result.map((k, i) => [String(k), valsReq.result[i]]));
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    return entries.filter(([key]) => key.startsWith('game')).map(([, game]) => game);
  });
}

test.describe('add game — series mode', () => {
  test('switches to a 3-game series', async ({ app }) => {
    await app.boot('/tabs/add');

    await new AddGamePage(app.page).selectMode('3 Series');

    // One segment tab per game in the series, plus the series save action.
    await expect(app.active().locator('ion-segment-button')).toHaveCount(3);
    await expect(app.active().locator('ion-button', { hasText: 'Save Series' })).toBeVisible();
  });
});
