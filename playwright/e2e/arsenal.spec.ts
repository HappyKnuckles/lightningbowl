import type { Page } from '@playwright/test';
import { test, expect } from './lib/app';
import { ArsenalPage } from '../screenshots/pages/equipment.pages';
import { settle } from '../screenshots/lib/stabilize';

interface StoredBall {
  arsenalId?: string;
  ball_name: string;
  core_weight: string;
}

interface StoredGame {
  balls?: { arsenalId?: string; name: string; weight?: string }[];
}

/** Everything Ionic Storage holds under keys starting with `prefix`. */
function readStorage<T>(page: Page, prefix: string): Promise<{ key: string; value: T }[]> {
  return page.evaluate(
    (keyPrefix) =>
      new Promise<{ key: string; value: never }[]>((resolve, reject) => {
        const open = indexedDB.open('_ionicstorage');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const entries: { key: string; value: never }[] = [];
          const cursor = open.result.transaction('_ionickv').objectStore('_ionickv').openCursor();
          cursor.onerror = () => reject(cursor.error);
          cursor.onsuccess = () => {
            const at = cursor.result;
            if (!at) return resolve(entries);
            if (String(at.key).startsWith(keyPrefix)) entries.push({ key: String(at.key), value: at.value as never });
            at.continue();
          };
        };
      }),
    prefix,
  ) as Promise<{ key: string; value: T }[]>;
}

/**
 * The seed stores the arsenal the way it was before arsenal balls had their own id (one record per
 * ball and weight), and games that name their balls by name and weight. Booting the app migrates both.
 */
test.describe('arsenal', () => {
  test('gives the stored balls their own id and links the games to them', async ({ app }) => {
    await app.boot('/tabs/arsenal');
    const arsenal = new ArsenalPage(app.page);
    await arsenal.waitForArsenal();

    await expect(app.active().locator('ion-reorder-group ion-item-sliding')).toHaveCount(5);

    const balls = await readStorage<StoredBall>(app.page, 'arsenal_');
    expect(balls).toHaveLength(5);
    for (const { key, value } of balls) {
      expect(value.arsenalId).toBeTruthy();
      expect(key).toBe(`arsenal_${value.arsenalId}`);
    }

    // every game ball that is in the arsenal now says which arsenal ball it is
    const ids = new Map(balls.map(({ value }) => [`${value.ball_name}|${value.core_weight}`, value.arsenalId]));
    const games = await readStorage<StoredGame>(app.page, 'game');
    const gameBalls = games.flatMap(({ value }) => value.balls ?? []);
    const owned = gameBalls.filter((ball) => ids.has(`${ball.name}|${ball.weight}`));
    expect(owned.length).toBeGreaterThan(0);
    for (const ball of owned) expect(ball.arsenalId).toBe(ids.get(`${ball.name}|${ball.weight}`));
    for (const ball of gameBalls.filter((b) => !ids.has(`${b.name}|${b.weight}`))) expect(ball.arsenalId).toBeUndefined();
  });

  test('keeps the same balls after a reload', async ({ app }) => {
    await app.boot('/tabs/arsenal');
    const arsenal = new ArsenalPage(app.page);
    await arsenal.waitForArsenal();
    const before = (await readStorage<StoredBall>(app.page, 'arsenal_')).map(({ key }) => key).sort();

    await app.page.reload();
    await arsenal.waitForArsenal();

    await expect(app.active().locator('ion-reorder-group ion-item-sliding')).toHaveCount(5);
    expect((await readStorage<StoredBall>(app.page, 'arsenal_')).map(({ key }) => key).sort()).toEqual(before);
  });

  test('adds a second one of a ball already in the arsenal, after asking', async ({ app }) => {
    await app.boot('/tabs/arsenal', { mockApi: 'balls' });
    const arsenal = new ArsenalPage(app.page);
    await arsenal.waitForArsenal();
    const name = (await app.active().locator('ion-reorder-group ion-item h1').first().innerText()).trim();

    await arsenal.openAddBall();
    const modal = app.page.locator('ion-modal.show-modal');
    await modal.locator('ion-searchbar input').fill(name);
    await modal.locator('ion-item', { hasText: name }).first().locator('ion-checkbox').click();
    await modal.locator('ion-buttons[slot="end"] ion-button', { hasText: 'Save' }).click();

    const ask = app.page.locator('ion-alert', { hasText: 'Add another one?' });
    await expect(ask).toContainText(`${name} 15lbs is already in your arsenal`);
    await ask.locator('button', { hasText: 'Add Another' }).click();
    await app.page.locator('ion-alert', { hasText: 'Add drilling?' }).locator('button', { hasText: 'Later' }).click();
    await settle(app.page, 400);

    const items = app.active().locator('ion-reorder-group ion-item-sliding');
    await expect(items).toHaveCount(6);
    // nothing but their number tells the two apart yet
    await expect(items.filter({ hasText: name }).locator('ion-chip', { hasText: /^#[12]$/ })).toHaveCount(2);
    const stored = (await readStorage<StoredBall>(app.page, 'arsenal_')).filter(({ value }) => value.ball_name === name);
    expect(new Set(stored.map(({ value }) => value.arsenalId)).size).toBe(2);
  });

  test('does not add a second one when the question is cancelled', async ({ app }) => {
    await app.boot('/tabs/arsenal', { mockApi: 'balls' });
    const arsenal = new ArsenalPage(app.page);
    await arsenal.waitForArsenal();
    const name = (await app.active().locator('ion-reorder-group ion-item h1').first().innerText()).trim();

    await arsenal.openAddBall();
    const modal = app.page.locator('ion-modal.show-modal');
    await modal.locator('ion-searchbar input').fill(name);
    await modal.locator('ion-item', { hasText: name }).first().locator('ion-checkbox').click();
    await modal.locator('ion-buttons[slot="end"] ion-button', { hasText: 'Save' }).click();
    await app.page.locator('ion-alert', { hasText: 'Add another one?' }).locator('button', { hasText: 'Cancel' }).click();
    await settle(app.page, 400);

    await expect(app.active().locator('ion-reorder-group ion-item-sliding')).toHaveCount(5);
  });
});
