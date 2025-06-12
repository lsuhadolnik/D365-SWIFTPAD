import { test, expect } from '@playwright/test';
import { harnessUrl } from './utils';

test('FetchXML runner loads results', async ({ page }) => {
  const url = harnessUrl({ page: 'record', test: 'fetchxml' });
  await page.goto(url);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('openSpotlight')));
  await page.fill('#dl-spotlight-input', 'Run FetchXML');
  await page.click('li[data-id="runFetchXmlSpotlight"]');
  await page.fill('#dl-fetchxml', '<fetch><entity name="account" /></fetch>');
  await page.keyboard.press('Control+Enter');
  await expect(page.locator('#dl-spotlight-list li')).toBeVisible();
});
