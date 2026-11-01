import { _electron as electron } from 'playwright';
import electronPath from 'electron';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';

const root = path.join(os.tmpdir(), `auren-visual-${Date.now()}`);
const shots = path.join(process.cwd(), 'qa-shots');
fs.mkdirSync(root, { recursive: true });
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

const shot = async (win, name) => {
  await win.waitForTimeout(320);
  const file = path.join(shots, `${name}.png`);
  await win.screenshot({ path: file });
  console.log('SHOT', file);
};

const clickText = async (win, text) => {
  const loc = win.locator(`button:has-text("${text}")`).first();
  await loc.waitFor({ timeout: 10000 });
  await loc.click();
};

try {
  const win = await app.firstWindow({ timeout: 30000 });
  win.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') console.log(`[${msg.type()}]`, msg.text());
  });
  win.on('pageerror', (error) => console.log('[pageerror]', error.message));
  await win.waitForLoadState('domcontentloaded');
  await win.waitForTimeout(2600);

  console.log('SIZE', await win.evaluate(() => ({ w: window.innerWidth, h: window.innerHeight, dpr: devicePixelRatio })));

  await shot(win, '01-onboarding-welcome');
  await clickText(win, 'Continue');
  await shot(win, '02-onboarding-theme');
  await clickText(win, 'Paper');
  await shot(win, '03-onboarding-paper');
  await clickText(win, 'Continue');
  await shot(win, '04-onboarding-ready');
  await clickText(win, 'Enter AUREN');
  await win.waitForTimeout(1000);
  await shot(win, '05-home-midnight');

  await win.keyboard.press('Control+K');
  await win.waitForTimeout(400);
  await shot(win, '06-command-palette');
  await win.keyboard.press('Escape');
  await win.waitForTimeout(250);

  await win.keyboard.press('Control+N');
  await win.waitForTimeout(1600);
  await shot(win, '07-editor-empty');

  const prose = win.locator('.ProseMirror').first();
  await prose.waitFor({ timeout: 10000 });
  await prose.click();
  await win.keyboard.type('Auren visual check\n\n');
  await win.keyboard.type('The page is not a container. It is a place to think. This document is written in the editor, with real pagination, typography, and a private local library behind it.\n\n');
  await win.keyboard.press('Control+Shift+2');
  await win.keyboard.type('A heading worth reading\n\n');
  await win.keyboard.type('A second paragraph with ');
  await win.keyboard.press('Control+B');
  await win.keyboard.type('bold emphasis');
  await win.keyboard.press('Control+B');
  await win.keyboard.type(', a link, and enough words to make the page feel like a real document rather than an empty shell.\n\n');
  await win.waitForTimeout(1200);
  await shot(win, '08-editor-written');

  // panels
  const openPanel = async (title) => {
    const btn = win.locator(`button[title="${title}"]`).first();
    if (await btn.count()) {
      await btn.click();
      await win.waitForTimeout(500);
    }
  };
  await openPanel('Outline');
  await shot(win, '09-outline-panel');
  await openPanel('Inspector');
  await shot(win, '10-inspector-panel');
  await openPanel('History');
  await shot(win, '11-timeline-panel');
  await openPanel('AI assistant');
  await shot(win, '12-ai-panel');

  await win.keyboard.press('Control+K');
  await win.waitForTimeout(300);
  await win.keyboard.type('settings');
  await win.waitForTimeout(400);
  await shot(win, '13-palette-settings');
  await win.keyboard.press('Enter');
  await win.waitForTimeout(1000);
  await shot(win, '14-settings-appearance');

  // library
  await win.evaluate(() => window.auren && null);
  await clickText(win, 'Documents');
  await win.waitForTimeout(900);
  await shot(win, '15-library');

  await clickText(win, 'Templates');
  await win.waitForTimeout(700);
  await shot(win, '16-templates');

  await clickText(win, 'Workspaces');
  await win.waitForTimeout(700);
  await shot(win, '17-workspaces');

  // themes
  await clickText(win, 'Settings');
  await win.waitForTimeout(700);
  await clickText(win, 'Midnight');
  await shot(win, '18-settings-midnight');
  await clickText(win, 'OLED');
  await shot(win, '19-settings-oled');
  await clickText(win, 'Paper');
  await shot(win, '20-settings-paper');

  // narrow layout
  await win.setViewportSize({ width: 1100, height: 760 });
  await win.waitForTimeout(500);
  await shot(win, '21-settings-narrow');

  console.log('DONE');
} finally {
  try { await app.close(); } catch { /* ignore */ }
  fs.rmSync(root, { recursive: true, force: true });
}
