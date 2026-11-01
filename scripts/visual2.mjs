import { _electron as electron } from 'playwright';
import electronPath from 'electron';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';

const root = path.join(os.tmpdir(), `auren-visual2-${Date.now()}`);
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
  await win.waitForTimeout(450);
  await win.screenshot({ path: path.join(shots, `${name}.png`) });
  console.log('SHOT', name);
};
const nav = async (win, label) => {
  await win.locator('.nav-item', { hasText: label }).first().click();
  await win.waitForTimeout(700);
};
const closePalette = async (win) => {
  if (await win.locator('.palette-layer').count()) {
    await win.keyboard.press('Escape');
    await win.waitForTimeout(300);
  }
};

try {
  const win = await app.firstWindow({ timeout: 30000 });
  win.on('console', (msg) => { if (msg.type() === 'error') console.log('[error]', msg.text()); });
  win.on('pageerror', (error) => console.log('[pageerror]', error.message));
  await win.waitForLoadState('domcontentloaded');
  await win.waitForTimeout(2600);

  await win.locator('button:has-text("Explore a sample document")').first().click();
  await win.waitForTimeout(1600);
  await closePalette(win);

  // library grid
  await nav(win, 'Documents');
  await shot(win, '40-library-grid');

  // list view
  const listBtn = win.locator('.layout-toggle button').last();
  await listBtn.click();
  await win.waitForTimeout(500);
  await shot(win, '41-library-list');

  // search
  await win.locator('.search-field input').fill('welcome');
  await win.waitForTimeout(500);
  await shot(win, '42-library-search');
  await win.locator('.search-field input').fill('');
  await win.waitForTimeout(300);

  // doc card menu
  await win.locator('.doc-row .doc-row-actions button').first().click().catch(async () => {
    await win.locator('.doc-card .doc-card-actions button').first().click();
  });
  await win.waitForTimeout(350);
  await shot(win, '43-doc-context-menu');
  await win.keyboard.press('Escape');

  // create doc through sidebar new button
  await win.locator('.new-document-btn').click();
  await win.waitForTimeout(1300);
  await win.locator('.ProseMirror').click();
  await win.keyboard.type('Product launch brief\n\nA short internal brief for the October release. This document tests the editor, autosave, and library metadata.\n\nGoals\n\n- Ship the new export pipeline\n- Verify DOCX compatibility\n- Publish the release notes');
  await win.waitForTimeout(900);
  await win.keyboard.press('Control+S');
  await win.waitForTimeout(700);
  await shot(win, '44-new-doc-saved');

  // back to library
  await win.locator('.editor-back').click();
  await win.waitForTimeout(800);
  await shot(win, '45-library-two-docs');

  // favorites toggle via context menu maybe
  // templates
  await nav(win, 'Templates');
  await shot(win, '46-templates');

  // workspaces via command palette
  await win.keyboard.press('Control+K');
  await win.waitForTimeout(250);
  await win.keyboard.type('workspaces');
  await win.waitForTimeout(350);
  await win.keyboard.press('Enter');
  await win.waitForTimeout(800);
  await closePalette(win);
  await shot(win, '47-workspaces');

  // create workspace dialog via sidebar plus
  await win.locator('.sidebar-section-title button').first().click();
  await win.waitForTimeout(400);
  await shot(win, '48-workspace-dialog');
  await win.locator('.modal input.input').first().fill('Research');
  await win.locator('.modal input.input').nth(1).fill('Long-form research and source notes.');
  await win.locator('.modal button:has-text("Create")').first().click();
  await win.waitForTimeout(900);
  await shot(win, '49-workspaces-with-research');

  // settings pages
  await nav(win, 'Settings');
  await shot(win, '50-settings-appearance');
  for (const [label, name] of [
    ['Editor', '51-settings-editor'],
    ['Language & writing', '52-settings-writing'],
    ['Documents', '53-settings-documents'],
    ['Storage & backup', '54-settings-storage'],
    ['Privacy', '55-settings-privacy'],
    ['AI assistant', '56-settings-ai'],
    ['Shortcuts', '57-settings-shortcuts'],
    ['Updates', '58-settings-updates'],
    ['About', '59-settings-about']
  ]) {
    await win.locator('.settings-nav button', { hasText: label }).first().click();
    await shot(win, name);
  }

  // back to appearance, switch French
  await win.locator('.settings-nav button', { hasText: 'Appearance' }).first().click();
  await win.locator('.settings-panel select').first().selectOption('fr');
  await win.waitForTimeout(900);
  await shot(win, '60-settings-french');
  await win.locator('.settings-panel select').first().selectOption('en');
  await win.waitForTimeout(600);

  // themes on settings
  await win.locator('.settings-nav button', { hasText: 'Appearance' }).first().click();
  await win.locator('.theme-card', { hasText: 'OLED' }).first().click();
  await shot(win, '61-settings-oled');
  await win.locator('.theme-card', { hasText: 'Midnight' }).first().click();
  await shot(win, '62-settings-midnight');
  await win.locator('.theme-card', { hasText: 'Paper' }).first().click();
  await shot(win, '63-settings-paper');

  // home in each theme
  await nav(win, 'Home');
  await shot(win, '64-home-paper');
  await win.locator('.theme-card').first().count().catch(() => {});
  console.log('DONE');
} finally {
  try { await app.close(); } catch { /* ignore */ }
  fs.rmSync(root, { recursive: true, force: true });
}
