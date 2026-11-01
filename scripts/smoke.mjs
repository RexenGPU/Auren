import { _electron as electron } from 'playwright';
import electronPath from 'electron';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';

const root = path.join(os.tmpdir(), `auren-smoke-${Date.now()}`);
fs.mkdirSync(root, { recursive: true });
const app = await electron.launch({
  executablePath: electronPath,
  args: ['.'],
  cwd: process.cwd(),
  env: {
    ...process.env,
    AUREN_TEST_MODE: '1',
    AUREN_USER_DATA: path.join(root, 'user'),
    AUREN_DATA_DIR: path.join(root, 'library')
  }
});
try {
  const win = await app.firstWindow({ timeout: 30000 });
  win.on('console', (msg) => console.log('[console]', msg.type(), msg.text()));
  win.on('pageerror', (error) => console.log('[pageerror]', error.message));
  await win.waitForLoadState('domcontentloaded');
  await win.waitForTimeout(2500);
  console.log('TITLE:', await win.title());
  console.log('BODY:', (await win.locator('body').innerText()).slice(0, 1200));
  await app.close();
} finally {
  try { await app.close(); } catch { /* ignore */ }
  fs.rmSync(root, { recursive: true, force: true });
}
