import { test, expect } from '@playwright/test';
import { harnessUrl } from './utils';

test('Auto reload toast appears and closes', async ({ page }) => {
  const url = harnessUrl({ page: 'record', test: 'autoreload' });
  await page.goto(url);
  await page.waitForFunction(() => (window as any).pref !== undefined);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('openSpotlight')));
  await page.fill('#dl-spotlight-input', 'Auto Reload');
  await page.click('li[data-id="autoReload"]');
  await expect(page.locator('#dl-auto-reload-toast')).toBeVisible();
  await page.click('#dl-auto-reload-toast button:has-text("Stop")');
  await expect(page.locator('#dl-auto-reload-toast')).toHaveCount(0);
});
