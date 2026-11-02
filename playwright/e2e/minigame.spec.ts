import { test, expect } from './lib/app';

test('daily rolls persist and practice resets independently', async ({ app, page }) => {
  await app.boot('/tabs/minigame', { seed: 'empty' });
  const active = app.active();
  const roll = active.getByRole('button', { name: 'Roll ball', exact: true });
  await expect(active.getByLabel('Scoresheet').locator('.score-frame')).toHaveCount(10);
  await expect(active.locator('.lane-info')).toContainText('Frame 1 / 10 · Ball 1');
  await roll.click();
  await expect(roll).toBeDisabled();
  await expect(roll).toBeEnabled();
  const firstFrame = await active.getByLabel('Frame 1', { exact: true }).textContent();
  const progress = await active.locator('.lane-info').textContent();
  expect(progress).not.toContain('Frame 1 / 10 · Ball 1');

  await page.reload();
  await expect(app.active().locator('.lane-info')).toHaveText(progress!);
  await expect(app.active().getByLabel('Frame 1', { exact: true })).toHaveText(firstFrame!);

  await app.active().getByRole('button', { name: 'Practice', exact: true }).click();
  await expect(app.active().locator('.lane-info')).toContainText('Frame 1 / 10 · Ball 1');
  await app.active().getByRole('button', { name: 'Roll ball', exact: true }).click();
  await expect(app.active().getByRole('button', { name: 'Roll ball', exact: true })).toBeEnabled();
  await app.active().getByRole('button', { name: 'New practice game' }).click();
  await expect(app.active().locator('.lane-info')).toContainText('Frame 1 / 10 · Ball 1');
  await app.active().getByRole('button', { name: 'Daily', exact: true }).click();
  await expect(app.active().locator('.lane-info')).toHaveText(progress!);
});

test('a full daily game ends after ten frames and stays completed on reload', async ({ app, page }) => {
  await app.boot('/tabs/minigame', { seed: 'empty' });
  const roll = app.active().getByRole('button', { name: 'Roll ball', exact: true });
  for (let delivery = 0; delivery < 21; delivery++) {
    await roll.click();
    await expect(app.active().locator('.game-status')).not.toHaveText('Rolling…');
    if (await app.active().locator('.game-result').isVisible()) break;
  }
  await expect(app.active().locator('.game-result')).toContainText('Daily lane complete');
  await expect(roll).toBeDisabled();
  await page.reload();
  await expect(app.active().locator('.game-result')).toContainText('Daily lane complete');
  await expect(app.active().getByRole('button', { name: 'Roll ball', exact: true })).toBeDisabled();
  await app.active().getByRole('button', { name: 'Keep practicing' }).click();
  await expect(app.active().getByRole('button', { name: 'Roll ball', exact: true })).toBeEnabled();
});

test('pointer swipes roll the ball without consuming taps', async ({ app, page }) => {
  await app.boot('/tabs/minigame', { seed: 'empty' });
  const lane = app.active().getByRole('application', { name: 'Bowling lane' });
  await lane.scrollIntoViewIfNeeded();
  const box = (await lane.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.9);
  await expect(app.active().locator('.lane-info')).toContainText('Frame 1 / 10 · Ball 1');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.9);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.5, { steps: 12 });
  await page.mouse.up();
  await expect(app.active().getByRole('button', { name: 'Roll ball', exact: true })).toBeDisabled();
  await expect(app.active().getByRole('button', { name: 'Roll ball', exact: true })).toBeEnabled();
});

test('keyboard hook and charge controls work on the responsive lane', async ({ app, page }) => {
  await app.boot('/tabs/minigame', { seed: 'empty' });
  const lane = app.active().getByRole('application', { name: 'Bowling lane' });
  await lane.focus();
  await lane.press(']');
  await expect(app.active().locator('.hook-label')).toContainText('Hooks right 1');
  await lane.press('[');
  await expect(app.active().locator('.hook-label')).toContainText('Straight');
  await lane.press('ArrowLeft');
  await page.keyboard.down('Space');
  await expect(app.active().getByRole('progressbar')).not.toHaveAttribute('aria-valuenow', '0');
  await page.keyboard.up('Space');
  await expect(app.active().getByRole('button', { name: 'Roll ball', exact: true })).toBeDisabled();
  await expect(app.active().getByRole('button', { name: 'Roll ball', exact: true })).toBeEnabled();
});
