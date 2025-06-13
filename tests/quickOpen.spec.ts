import { test, expect } from '@playwright/test';
import { harnessUrl } from './utils';

// Workflow:
// 1. Use the "Quick open" command to choose an entity.
// 2. Select a record by GUID and verify a runtime message was sent.
test('Quick open list and record', async ({ page }) => {
  const url = harnessUrl({ page: 'record', test: 'quick open' });
  await page.goto(url);
  await page.waitForFunction(() => (window as any).pref !== undefined);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('openSpotlight')));
  await page.waitForSelector('#dl-spotlight-input');
  await page.fill('#dl-spotlight-input', 'Quick open');
  await page.click('li[data-id="openRecordSpotlight"]');
  await expect(page.locator('#dl-spotlight-input')).toHaveAttribute('placeholder', 'Search entity...');
  await page.fill('#dl-spotlight-input', 'account');
  await page.click('li.dl-listitem');
  await expect(page.locator('#dl-spotlight-input')).toHaveAttribute(
    'placeholder',
    'Enter GUID or start typing the name of the entity'
  );
  await page.fill('#dl-spotlight-input', '00000000-0000-0000-0000-000000000001');
  await page.keyboard.press('Enter');
  const messages = await page.evaluate(() => (window as any).recordedMessages);
  expect(messages.some((m: any) => m.type && m.type.includes('openRecordQuick'))).toBeTruthy();
});

// Workflow:
// 1. Trigger "Open List" and search for an entity.
// 2. Validate the first suggestion shows the correct entity.
test('Quick open list last', async ({ page }) => {
  const url = harnessUrl({ page: 'record', test: 'quick open list' });
  await page.goto(url);
  await page.waitForFunction(() => (window as any).pref !== undefined);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('openSpotlight')));
  await page.waitForSelector('#dl-spotlight-input');
  await page.fill('#dl-spotlight-input', 'Open List');
  await page.click('li[data-id="openList"]');
  await page.fill('#dl-spotlight-input', 'account');
  const first = page.locator('#dl-spotlight-list li').first();
  await expect(first).toHaveText(/Account/);
});
