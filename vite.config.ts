import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';
import { resolve } from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        // Main process entry file
        entry: 'electron/main/index.ts',
        onstart(options) {
          options.startup();
        },
        vite: {
          build: {
            outDir: 'dist-electron/main',
            rollupOptions: {
              // Externalize most node_modules for electron main process,
              // BUT bundle openclaw submodules (e.g. openclaw/plugin-sdk)
              // because openclaw is shipped as extraResources, not in
              // node_modules — runtime require() can't find it.
              external: (id) => {
                if (id.startsWith('electron')) return true;
                if (id.startsWith('node:')) return true;
                // openclaw submodules must be bundled, not externalized
                if (id === 'openclaw' || id.startsWith('openclaw/')) return false;
                if (!id.startsWith('.') && !id.startsWith('/') && !id.includes(':')) return true;
                return false;
              },
            },
          },
        },
      },
      {
        // Preload scripts entry file
        entry: 'electron/preload/index.ts',
        onstart(options) {
          options.reload();
        },
        vite: {
          build: {
            outDir: 'dist-electron/preload',
            rollupOptions: {
              external: ['electron'],
            },
          },
        },
      },
    ]),
    renderer(),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@electron': resolve(__dirname, 'electron'),
    },
  },
  server: {
    port: 5173,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
