import { _electron as electron } from 'playwright';
import electronPath from 'electron';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';

const root = path.join(os.tmpdir(), `auren-logo-${Date.now()}`);
const shots = path.join(process.cwd(), 'qa-shots');
fs.mkdirSync(path.join(root, 'user'), { recursive: true });
fs.mkdirSync(path.join(root, 'library'), { recursive: true });
fs.mkdirSync(shots, { recursive: true });

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
  win.on('pageerror', (error) => console.log('[pageerror]', error.message));
  await win.waitForLoadState('domcontentloaded');
  await win.waitForTimeout(2600);
  await app.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0].setSize(1440, 900);
  });
  await win.waitForTimeout(500);

  const onboardingLogo = await win.evaluate(() => {
    const img = document.querySelector('.onboarding-brand .brand-logo');
    if (!img) return null;
    const rect = img.getBoundingClientRect();
    return { src: img.getAttribute('src'), width: rect.width, height: rect.height, natural: [img.naturalWidth, img.naturalHeight] };
  });
  console.log('ONBOARDING LOGO', JSON.stringify(onboardingLogo));
  await win.screenshot({ path: path.join(shots, '80-onboarding-new-logo.png') });
  await win.locator('.onboarding-brand').screenshot({ path: path.join(shots, '81-brand-onboarding.png') });

  await win.locator('.onboarding button', { hasText: 'Continue' }).first().click();
  await win.waitForTimeout(400);
  await win.locator('.onboarding button', { hasText: 'Continue' }).first().click();
  await win.waitForTimeout(400);
  await win.locator('.onboarding button', { hasText: 'Enter AUREN' }).first().click();
  await win.waitForTimeout(1600);

  const titleLogo = await win.evaluate(() => {
    const img = document.querySelector('.titlebar-brand .brand-logo');
    if (!img) return null;
    const rect = img.getBoundingClientRect();
    return { src: img.getAttribute('src'), width: rect.width, height: rect.height, natural: [img.naturalWidth, img.naturalHeight] };
  });
  console.log('TITLEBAR LOGO', JSON.stringify(titleLogo));
  await win.screenshot({ path: path.join(shots, '82-home-new-logo.png') });
  await win.locator('.titlebar-brand').screenshot({ path: path.join(shots, '83-brand-titlebar.png') });

  console.log('LOGO SHOTS PASSED');
} finally {
  try { await app.close(); } catch { /* ignore */ }
  fs.rmSync(root, { recursive: true, force: true });
}
