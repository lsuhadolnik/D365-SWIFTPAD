import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.json';
import { resolve } from 'path';

export default defineConfig({
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        options: resolve(__dirname, 'app/pages/options.html'),
        grid: resolve(__dirname, 'app/pages/grid.html'),
        organisationdetails: resolve(__dirname, 'app/pages/organisationdetails.html'),
        processes: resolve(__dirname, 'app/pages/processes.html'),
        userroles: resolve(__dirname, 'app/pages/userroles.html'),
        optionsets: resolve(__dirname, 'app/pages/optionsets.html'),
      },
    },
  },
  plugins: [crx({ manifest })],
});
