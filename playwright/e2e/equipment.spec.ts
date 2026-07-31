import { test, expect } from './lib/app';
import { BallsPage } from '../screenshots/pages/equipment.pages';

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

    await expect(balls.active().getByText('Honey Badger U78')).toBeVisible();
    expect(await balls.active().locator('ion-card').count()).toBeLessThan(total);
  });

  test('opens the ball filter modal', async ({ app }) => {
    await app.boot('/tabs/balls', { mockApi: 'balls' });
    const balls = new BallsPage(app.page);
    await balls.waitForBalls();

    await balls.openFilter();

    await expect(app.page.locator('ion-modal.show-modal')).toBeVisible();
  });
});
