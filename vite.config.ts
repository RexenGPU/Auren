import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  root: '.',
  base: './',
  plugins: [react()],
  build: {
    outDir: 'dist/renderer',
    emptyOutDir: true,
    sourcemap: false,
    chunkSizeWarningLimit: 2500,
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'index.html')
      }
    }
  },
  server: {
    port: 5199,
    strictPort: true
  }
});
