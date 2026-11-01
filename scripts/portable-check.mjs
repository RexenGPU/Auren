import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const endpoint = process.env.AUREN_CDP || 'http://127.0.0.1:9222';
const browser = await chromium.connectOverCDP(endpoint);
try {
  const context = browser.contexts()[0];
  assert.ok(context, 'portable app exposes a browser context');
  const page = context.pages()[0];
  assert.ok(page, 'portable app exposes a window');
  page.on('pageerror', (error) => console.log('[pageerror]', error.message));

  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1500);
  const info = await page.evaluate(() => window.auren.app.info());
  console.log('PORTABLE INFO', JSON.stringify(info));
  assert.equal(info.packaged, true);

  await page.evaluate(() => window.auren.settings.update({
    onboardingComplete: true,
    showLaunchScreen: false,
    theme: 'midnight',
    language: 'en',
    editorSpellcheck: true,
    spellLanguages: ['en', 'fr']
  }));
  await page.reload();
  await page.waitForTimeout(1800);
  await page.locator('.home-wrap').waitFor({ timeout: 15000 });
  console.log('PORTABLE HOME OK');

  const spell = await page.evaluate(async () => ({
    check: await window.auren.spell.check(['teh', 'calm'], ['en']),
    suggest: await window.auren.spell.suggest('teh', ['en'])
  }));
  assert.ok(spell.check.unknown.includes('teh'));
  assert.ok(spell.suggest.length > 0);
  console.log('PORTABLE SPELL OK', spell.suggest.slice(0, 3).join(', '));

  await page.keyboard.press('Control+N');
  const prose = page.locator('.editor-view .ProseMirror').first();
  await prose.waitFor({ timeout: 15000 });
  await prose.click();
  await page.keyboard.insertText('Portable AUREN document');
  await page.keyboard.press('Enter');
  await page.keyboard.insertText('The portable build runs from a single executable.');
  await page.waitForTimeout(300);
  await page.locator('.editor-title-input').fill('Portable smoke document');
  await page.locator('.editor-title-input').press('Enter');
  await page.keyboard.press('Control+S');
  await page.waitForTimeout(1200);
  const saved = await page.evaluate(async () => {
    const list = await window.auren.library.list({ view: 'documents' });
    const item = list.find((entry) => entry.title === 'Portable smoke document');
    return item ? window.auren.library.get(item.id) : null;
  });
  assert.ok(saved, 'portable document saves');
  assert.match(saved.html, /Portable AUREN document/);
  console.log('PORTABLE SAVE OK', saved.meta.id);

  for (const theme of ['paper', 'oled', 'midnight']) {
    await page.evaluate((value) => window.auren.settings.update({ theme: value }), theme);
    await page.reload();
    await page.waitForTimeout(1100);
    assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), theme);
  }
  console.log('PORTABLE THEMES OK');

  await page.screenshot({ path: 'qa-shots/75-portable.png' });
  console.log('PORTABLE CHECK PASSED');
} finally {
  await browser.close().catch(() => {});
}
