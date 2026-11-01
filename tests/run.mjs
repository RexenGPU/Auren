import { spawnSync } from 'node:child_process';

function run(label, command, args) {
  console.log(`\n=== ${label} ===`);
  const result = process.platform === 'win32' && command === 'npm'
    ? spawnSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', `npm ${args.join(' ')}`], { stdio: 'inherit' })
    : spawnSync(command, args, { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    console.error(`\n${label} failed with exit code ${result.status}.`);
    process.exit(result.status ?? 1);
  }
}

run('TypeScript typecheck', 'npm', ['run', 'typecheck']);
run('Production build', 'npm', ['run', 'build']);
run('End-to-end formats and library', process.execPath, ['scripts/e2e.mjs']);
run('Rich editor interaction', process.execPath, ['scripts/editor-ui.mjs']);
run('Encrypted library', process.execPath, ['scripts/encryption-test.mjs']);

console.log('\nAll AUREN tests passed.');
