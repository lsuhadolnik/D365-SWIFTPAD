import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const home = process.env.HOME || process.env.USERPROFILE;
const cacheDir = path.join(home, '.cache', 'ms-playwright');
const hasBrowsers = fs.existsSync(cacheDir) && fs.readdirSync(cacheDir).length > 0;

if (!hasBrowsers) {
  console.log('Installing Playwright browsers...');
  execSync('npx playwright install --with-deps', { stdio: 'inherit' });
} else {
  console.log('Playwright browsers already installed.');
}
