import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  base: '/dxr3d-sky-combat/',
  server: {
    host: '127.0.0.1',
    port: 5188,
    strictPort: true,
  },
  preview: {
    host: '127.0.0.1',
    port: 4188,
    strictPort: true,
  },
  build: {
    sourcemap: true,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        multiplayer: resolve(__dirname, 'multiplayer.html'),
      },
    },
  },
});
