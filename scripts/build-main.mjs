import { build } from 'esbuild';
import { rmSync } from 'node:fs';

rmSync('dist/main', { recursive: true, force: true });

const shared = {
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  external: ['electron', 'pdf-parse', 'word-extractor', 'nspell'],
  sourcemap: false,
  logLevel: 'info',
  legalComments: 'none'
};

await build({
  ...shared,
  entryPoints: ['electron/main.ts'],
  outfile: 'dist/main/main.js'
});

await build({
  ...shared,
  entryPoints: ['electron/preload.ts'],
  outfile: 'dist/main/preload.js'
});
