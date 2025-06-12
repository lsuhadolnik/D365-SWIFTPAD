import { PlaywrightTestConfig } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const headless = process.env.HEADLESS !== 'false';
const slowMo = !headless ? Number(process.env.SLOWMO || '250') : 0;
const config: PlaywrightTestConfig = {
  testDir: './tests',
  use: {
    headless,
    slowMo,
    launchOptions: {
      args: ['--allow-file-access-from-files'],
    },
  },
};

export default config;
