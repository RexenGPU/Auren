import { spawn } from 'node:child_process';
import { createServer } from 'vite';
import { build } from 'esbuild';

const server = await createServer({ server: { port: 5199, strictPort: true } });
await server.listen();

const common = {
  bundle: true, platform: 'node', target: 'node22', format: 'cjs',
  external: ['electron', 'pdf-parse', 'word-extractor', 'nspell'], sourcemap: true, logLevel: 'info'
};
await build({ ...common, entryPoints: ['electron/main.ts'], outfile: 'dist/main/main.js' });
await build({ ...common, entryPoints: ['electron/preload.ts'], outfile: 'dist/main/preload.js' });

const child = spawn('npx', ['electron', '.'], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, VITE_DEV_SERVER_URL: 'http://localhost:5199' }
});
child.on('exit', async (code) => {
  await server.close();
  process.exit(code ?? 0);
});
