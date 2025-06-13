import { PlaywrightTestConfig } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const inspect = !!process.env.INSPECT;
const headless = inspect ? false : process.env.HEADLESS !== 'false';
const slowMo = inspect ? 1000 : !headless ? Number(process.env.SLOWMO || '250') : 0;
const launchOptions: any = { args: ['--allow-file-access-from-files'] };
if (slowMo) launchOptions.slowMo = slowMo;
const config: PlaywrightTestConfig = {
  testDir: './tests',
  use: {
    headless,
    launchOptions,
  },
  workers: inspect ? 1 : undefined,
};

export default config;
