import { test, expect } from './lib/app';
import { PatternPage } from '../screenshots/pages/pattern.page';

/**
 * Pattern Library against a mocked pattern API (`boot('/tabs/pattern',
 * { mockApi: 'patterns' })` serves the fixture). Covers the list rendering and
 * the searchbar narrowing to a matching pattern.
 */
test.describe('pattern library (mocked API)', () => {
  test('renders patterns and search narrows them', async ({ app }) => {
    await app.boot('/tabs/pattern', { mockApi: 'patterns' });
    const patterns = new PatternPage(app.page);
    await patterns.waitForPatterns();

    const total = await patterns.active().locator('ion-card').count();
    expect(total).toBeGreaterThanOrEqual(3);

    await patterns.search('Cheetah');

    await expect(patterns.active().locator('ion-card').filter({ hasText: 'PBA Cheetah 35' }).first()).toBeVisible();
    expect(await patterns.active().locator('ion-card').count()).toBeLessThan(total);
  });
});
