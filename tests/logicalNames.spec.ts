import { test, expect } from '@playwright/test';
import { harnessUrl } from './utils';

// Workflow:
// 1. Run "Logical Names" and verify helper labels show.
// 2. Copy a label to the clipboard.
// 3. Execute "Clear Logical names" to remove the labels.
test('Logical names and clearing', async ({ page }) => {
  const url = harnessUrl({ page: 'record', test: 'logical names' });
  await page.goto(url);
  await page.waitForFunction(() => (window as any).pref !== undefined);
  await page.waitForSelector('#name');
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('openSpotlight')));
  await page.waitForSelector('#dl-spotlight-input');
  await page.fill('#dl-spotlight-input', 'Logical Names');
  await page.click('li[data-id="displayLogicalNames"]');
  await expect(page.locator('.levelupschema').first()).toBeVisible();
  await page.evaluate(() => {
    (window as any).copied = '';
    navigator.clipboard.writeText = (t: string) => {
      (window as any).copied = t;
      return Promise.resolve();
    };
  });
  await page.click('.levelupschema');
  const copied = await page.evaluate(() => (window as any).copied);
  expect(copied).not.toBe('');
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('openSpotlight')));
  await page.fill('#dl-spotlight-input', 'Clear Logical names');
  await page.click('li[data-id="clearLogicalNames"]');
  await expect(page.locator('.levelupschema')).toHaveCount(0);
});
