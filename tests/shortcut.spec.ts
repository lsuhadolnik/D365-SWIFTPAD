import { test, expect } from '@playwright/test';
import { harnessUrl } from './utils';

test('Ctrl+Shift+P opens spotlight', async ({ page }) => {
  const url = harnessUrl({ page: 'record', test: 'shortcut' });
  await page.goto(url);
  await page.keyboard.press('Control+Shift+P');
  await expect(page.locator('#dl-spotlight-input')).toBeVisible();
});
