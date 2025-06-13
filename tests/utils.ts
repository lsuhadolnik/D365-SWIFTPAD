import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.resolve(__dirname, '../dist');
const manifest = JSON.parse(fs.readFileSync(path.join(distPath, 'manifest.json'), 'utf-8'));
const loader = manifest.content_scripts[0].js[0];
const cmdsBase64 = Buffer.from(fs.readFileSync(path.join(distPath, 'app/commands.json'), 'utf-8')).toString('base64');

export function harnessUrl(options: { page?: 'record' | 'grid'; test?: string }) {
  const page = options.page || 'record';
  const test = options.test || '';
  const harness = path.resolve(__dirname, 'harness.html');
  return (
    'file://' +
    harness +
    `?dist=${encodeURIComponent(distPath)}&loader=${encodeURIComponent(loader)}&cmds=${encodeURIComponent(cmdsBase64)}&page=${page}&test=${encodeURIComponent(test)}`
  );
}
