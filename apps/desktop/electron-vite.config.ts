import { defineConfig } from 'electron-vite';
import path from 'path';

export default defineConfig({
  main: {},
  preload: {},
  renderer: {
    root: path.resolve(__dirname, 'src/renderer'),
    build: {
      rollupOptions: {
        input: path.resolve(__dirname, 'src/renderer/index.html'),
      },
    },
  },
});
