import { PlaywrightTestConfig } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const config: PlaywrightTestConfig = {
  testDir: './tests',
  use: {
    headless: true,
    launchOptions: {
      args: ['--allow-file-access-from-files'],
    },
  },
};

export default config;
