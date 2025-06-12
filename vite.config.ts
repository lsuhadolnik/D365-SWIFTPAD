import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.json';
import { resolve } from 'path';

const keepDebug = process.env.KEEP_DEBUG === 'true';

export default defineConfig({
  build: {
    minify: keepDebug ? false : 'esbuild',
    outDir: 'dist',
    esbuild: keepDebug ? {} : { drop: ['debugger'] },
    rollupOptions: {
      input: {
        grid: resolve(__dirname, 'app/pages/grid.html'),
        organisationdetails: resolve(__dirname, 'app/pages/organisationdetails.html'),
        processes: resolve(__dirname, 'app/pages/processes.html'),
        userroles: resolve(__dirname, 'app/pages/userroles.html'),
        optionsets: resolve(__dirname, 'app/pages/optionsets.html'),
        gridScript: resolve(__dirname, 'app/scripts/grid.js'),
        organisationScript: resolve(__dirname, 'app/scripts/organisationdetails.js'),
        processesScript: resolve(__dirname, 'app/scripts/processes.js'),
        userrolesScript: resolve(__dirname, 'app/scripts/userroles.js'),
        optionsetsScript: resolve(__dirname, 'app/scripts/optionsets.js'),
        listLib: resolve(__dirname, 'app/libraries/list.min.js'),
      },
      output: {
        entryFileNames: (chunk) => {
          const mapping: Record<string, string> = {
            gridScript: 'app/scripts/grid.js',
            organisationScript: 'app/scripts/organisationdetails.js',
            processesScript: 'app/scripts/processes.js',
            userrolesScript: 'app/scripts/userroles.js',
            optionsetsScript: 'app/scripts/optionsets.js',
            listLib: 'app/libraries/list.min.js',
          };
          return mapping[chunk.name] || 'assets/[name]-[hash].js';
        },
      },
    },
  },
  plugins: [crx({ manifest })],
});
