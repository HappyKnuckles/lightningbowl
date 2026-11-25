import { test, expect } from './lib/app';
import { crc32, deflateSync } from 'node:zlib';
import { BallsPage } from '../screenshots/pages/equipment.pages';

/** A plain orange PNG, standing in for a photo of a ball. */
function solidPng(width: number, height: number): Buffer {
  const chunk = (type: string, data: Buffer) => {
    const body = Buffer.concat([Buffer.from(type), data]);
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([length, body, crc]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 2, 0, 0, 0], 8); // 8-bit RGB
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(width * 3, Buffer.from([230, 120, 30]))]);
  const pixels = deflateSync(Buffer.concat(Array.from({ length: height }, () => row)));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', pixels),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/**
 * Ball Library against a mocked bowwwl catalogue (the real API is network-backed,
 * so `boot('/tabs/balls', { mockApi: 'balls' })` serves the fixture). Covers the
 * grid rendering and the searchbar narrowing the list.
 */
test.describe('ball library (mocked API)', () => {
  test('renders the catalogue and search narrows it', async ({ app }) => {
    await app.boot('/tabs/balls', { mockApi: 'balls' });
    const balls = new BallsPage(app.page);
    await balls.waitForBalls();

    const total = await balls.active().locator('ion-card').count();
    expect(total).toBeGreaterThanOrEqual(3);

    await balls.search('Honey Badger');

    await expect(balls.active().locator('ion-card').filter({ hasText: 'Honey Badger U78' }).first()).toBeVisible();
    expect(await balls.active().locator('ion-card').count()).toBeLessThan(total);
  });

  test('finds balls by photo and searches for the one picked', async ({ app }) => {
    await app.boot('/tabs/balls', { mockApi: 'balls' });
    const balls = new BallsPage(app.page);
    await balls.waitForBalls();

    const chooser = app.page.waitForEvent('filechooser');
    await balls.active().getByRole('button', { name: 'Search by photo' }).click();
    await (await chooser).setFiles({ name: 'ball.png', mimeType: 'image/png', buffer: solidPng(64, 48) });

    const sheet = app.page.locator('ion-modal.show-modal');
    await expect(sheet.getByText('Balls like your photo')).toBeVisible();
    const results = sheet.locator('ion-item');
    await expect(results).toHaveCount(3);
    const first = (await results.first().locator('h2').textContent())!.trim();

    await results.first().click();

    // the sheet stays open to try the next match; the library behind it searches for the pick
    await expect(app.page.locator('app-balls ion-searchbar input')).toHaveValue(first);
  });

  test('opens the ball filter modal', async ({ app }) => {
    await app.boot('/tabs/balls', { mockApi: 'balls' });
    const balls = new BallsPage(app.page);
    await balls.waitForBalls();

    await balls.openFilter();

    await expect(app.page.locator('ion-modal.show-modal')).toBeVisible();
  });
});
