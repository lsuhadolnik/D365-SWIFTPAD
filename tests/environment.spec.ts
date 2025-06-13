import { test, expect } from '@playwright/test';
import { harnessUrl } from './utils';

// Workflow:
// 1. Run the "Environment Details" command.
// 2. Copy information using the copy button and ensure text was captured.
test('Environment details copy', async ({ page }) => {
  const url = harnessUrl({ page: 'record', test: 'env details' });
  await page.goto(url);
  await page.waitForFunction(() => (window as any).pref !== undefined);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('openSpotlight')));
  await page.waitForSelector('#dl-spotlight-input');
  await page.fill('#dl-spotlight-input', 'Environment Details');
  await page.click('li[data-id="environmentDetails"]');
  const copy = page.locator('#dl-spotlight-info .dl-copy').first();
  await expect(copy).toBeVisible();
  await page.evaluate(() => {
    (window as any).copied = '';
    navigator.clipboard.writeText = (t: string) => {
      (window as any).copied = t;
      return Promise.resolve();
    };
  });
  await copy.click();
  const c = await page.evaluate(() => (window as any).copied);
  expect(c).not.toBe('');
});
