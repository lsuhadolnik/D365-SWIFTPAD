import { test, expect } from '@playwright/test';
import { harnessUrl } from './utils';

// Workflow:
// 1. Press Ctrl+Shift+P to open Spotlight.
test('Ctrl+Shift+P opens spotlight', async ({ page }) => {
  const url = harnessUrl({ page: 'record', test: 'shortcut' });
  await page.goto(url);
  await page.waitForFunction(() => (window as any).pref !== undefined);
  await page.keyboard.press('Control+Shift+P');
  await expect(page.locator('#dl-spotlight-input')).toBeVisible();
});

// Workflow:
// 1. Press Ctrl+P to launch Quick Open directly.
test('Ctrl+P opens quick open', async ({ page }) => {
  const url = harnessUrl({ page: 'record', test: 'ctrl+p' });
  await page.goto(url);
  await page.waitForFunction(() => (window as any).pref !== undefined);
  await page.keyboard.press('Control+P');
  await page.waitForSelector('#dl-spotlight-input');
  await expect(page.locator('#dl-spotlight-input')).toHaveAttribute('placeholder', 'Search entity...');
});
