import { test } from '@playwright/test';

test('debug app load', async ({ page, baseURL }) => {
  const logs: string[] = [];
  page.on('console', (m) => logs.push(`[console.${m.type()}] ${m.text()}`));
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
  page.on('requestfailed', (r) => logs.push(`[reqfail] ${r.url()} ${r.failure()?.errorText}`));

  await page.goto(`${baseURL}/tabs/settings`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(8000);

  const hasIonApp = (await page.locator('ion-app').count()) > 0;
  const appRootHtml = await page
    .locator('app-root')
    .innerHTML()
    .catch(() => '<no app-root>');
  // eslint-disable-next-line no-console
  console.log('=== hasIonApp:', hasIonApp);
  // eslint-disable-next-line no-console
  console.log('=== app-root html (first 600):', appRootHtml.slice(0, 600));
  // eslint-disable-next-line no-console
  console.log('=== LOGS:\n' + logs.slice(0, 40).join('\n'));
});
