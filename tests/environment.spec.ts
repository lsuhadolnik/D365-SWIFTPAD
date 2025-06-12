import { test, expect } from '@playwright/test';
import { harnessUrl } from './utils';

test('Environment details copy', async ({ page }) => {
  const url = harnessUrl({ page: 'record', test: 'env details' });
  await page.goto(url);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('openSpotlight')));
  await page.fill('#dl-spotlight-input', 'Environment Details');
  await page.click('li[data-id="environmentDetails"]');
  await expect(page.locator('#dl-spotlight-info .dl-copy')).toBeVisible();
  await page.evaluate(() => {
    (window as any).copied = '';
    navigator.clipboard.writeText = (t: string) => {
      (window as any).copied = t;
      return Promise.resolve();
    };
  });
  await page.click('#dl-spotlight-info .dl-copy');
  const c = await page.evaluate(() => (window as any).copied);
  expect(c).not.toBe('');
});
