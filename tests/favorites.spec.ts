import { test, expect } from '@playwright/test';
import { harnessUrl } from './utils';

// Workflow:
// 1. Add the "Logical Names" command to favorites.
// 2. Reopen Spotlight to confirm it appears.
// 3. Reload the page and verify the favorite persists.
test('Favorites add and persist', async ({ page }) => {
  const url = harnessUrl({ page: 'record', test: 'favs' });
  await page.goto(url);
  await page.waitForFunction(() => (window as any).pref !== undefined);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('openSpotlight')));
  await page.waitForSelector('#dl-spotlight-input');
  await page.fill('#dl-spotlight-input', 'Logical Names');
  const star = page.locator('li[data-id="displayLogicalNames"] .dl-star');
  await star.click();
  await page.keyboard.press('Escape');
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('openSpotlight')));
  await page.waitForSelector('#dl-spotlight-input');
  await expect(page.locator('#dl-spotlight-favs .dl-fav')).toHaveCount(1);
  await page.reload();
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('openSpotlight')));
  await page.waitForSelector('#dl-spotlight-input');
  await expect(page.locator('#dl-spotlight-favs .dl-fav')).toHaveCount(1);
});
