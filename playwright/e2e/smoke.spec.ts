import { test, expect } from './lib/app';

/**
 * Smoke coverage: every locally-driven tab boots, reaches `ion-app`, clears its
 * loaders/skeletons and renders its header. These are the cheap "is the route
 * even alive" guards — deeper behaviour lives in the per-feature specs.
 *
 * Routes backed purely by the seed (no live API) are asserted here. The
 * network-backed libraries (Ball Library, Pattern Library, Alley Map) are left
 * out so the core suite stays deterministic offline.
 */
const ROUTES: { name: string; route: string; title: string }[] = [
  { name: 'New Game', route: '/tabs/add', title: 'New Game' },
  { name: 'Stats', route: '/tabs/stats', title: 'Stats' },
  { name: 'History', route: '/tabs/history', title: 'History' },
  { name: 'Leagues', route: '/tabs/league', title: 'Leagues' },
  { name: 'Arsenal', route: '/tabs/arsenal', title: 'Arsenal' },
  { name: 'Settings', route: '/tabs/settings', title: 'Settings' },
  { name: 'Minigame', route: '/tabs/minigame', title: 'Minigame' },
];

for (const { name, route, title } of ROUTES) {
  test(`${name} loads`, async ({ app }) => {
    await app.boot(route);

    // The active (non-hidden) page shows the expected header title.
    await expect(app.active().locator('ion-title').first()).toContainText(title);
    // The bottom tab bar is always present once the shell is up.
    await expect(app.page.locator('ion-tab-bar')).toBeVisible();
  });
}

test('unknown route redirects to New Game', async ({ app }) => {
  await app.boot('/');
  await expect(app.page).toHaveURL(/\/tabs\/add/);
  await expect(app.active().locator('ion-title').first()).toContainText('New Game');
});
