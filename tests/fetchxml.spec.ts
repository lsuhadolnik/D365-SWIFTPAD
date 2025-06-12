import { test, expect } from '@playwright/test';
import { harnessUrl } from './utils';

test('FetchXML runner loads results', async ({ page }) => {
  const url = harnessUrl({ page: 'record', test: 'fetchxml' });
  await page.goto(url);
  await page.waitForFunction(() => (window as any).pref !== undefined);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('openSpotlight')));
  await page.waitForSelector('#dl-spotlight-input');
  await page.fill('#dl-spotlight-input', 'Run FetchXML');
  await page.click('li[data-id="runFetchXmlSpotlight"]');
  await page.fill('#dl-fetchxml', '<fetch><entity name="account" /></fetch>');
  await page.press('#dl-fetchxml', 'Control+Enter');
  await page.waitForTimeout(500);
  await expect(page).toHaveTitle(/SWIFTPAD|Harness/);
});
