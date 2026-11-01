import { _electron as electron } from 'playwright';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import JSZip from 'jszip';

const root = path.join(os.tmpdir(), `auren-packaged-${Date.now()}`);
const user = path.join(root, 'user');
const library = path.join(root, 'library');
const out = path.join(root, 'exports');
for (const dir of [user, library, out]) fs.mkdirSync(dir, { recursive: true });

const exe = process.env.AUREN_EXE || path.join(process.cwd(), 'release', 'win-unpacked', 'Auren.exe');
assert.ok(fs.existsSync(exe), 'packaged executable exists');

const app = await electron.launch({
  executablePath: exe,
  args: [],
  cwd: path.dirname(exe),
  timeout: 60000,
  env: {
    ...process.env,
    AUREN_TEST_MODE: '1',
    AUREN_USER_DATA: user,
    AUREN_DATA_DIR: library
  }
});

try {
  const win = await app.firstWindow({ timeout: 40000 });
  win.on('console', (message) => { if (message.type() === 'error') console.log('[renderer error]', message.text()); });
  win.on('pageerror', (error) => console.log('[pageerror]', error.message));
  await win.waitForLoadState('domcontentloaded');
  await win.waitForTimeout(2200);

  const info = await win.evaluate(() => window.auren.app.info());
  console.log('PACKAGED INFO', JSON.stringify(info));
  assert.equal(info.packaged, true);
  assert.ok(info.version);

  await win.evaluate(() => window.auren.settings.update({
    onboardingComplete: true,
    showLaunchScreen: false,
    editorSpellcheck: true,
    spellLanguages: ['en', 'fr'],
    theme: 'midnight',
    language: 'en',
    uiScale: 1
  }));
  await win.reload();
  await win.waitForTimeout(2000);
  await win.locator('.home-wrap').waitFor({ timeout: 15000 });

  /* Local spellcheck runtime from the packaged asar. */
  const spell = await win.evaluate(async () => ({
    check: await window.auren.spell.check(['teh', 'calm', 'bonjour'], ['en', 'fr']),
    suggest: await window.auren.spell.suggest('teh', ['en'])
  }));
  console.log('PACKAGED SPELL', JSON.stringify(spell));
  assert.ok(spell.check.unknown.includes('teh'), 'packaged nspell flags a misspelling');
  assert.ok(spell.suggest.some((word) => word.toLowerCase() === 'ten' || word.toLowerCase() === 'the'), 'packaged nspell suggests a correction');

  /* Create and save a document through the real UI. */
  await win.keyboard.press('Control+N');
  const prose = win.locator('.editor-view .ProseMirror').first();
  await prose.waitFor({ timeout: 15000 });
  await prose.click();
  await win.keyboard.insertText('Packaged AUREN document');
  await win.keyboard.press('Enter');
  await win.keyboard.insertText('This build runs without Node, Rust, Python, or Visual Studio installed.');
  await win.waitForTimeout(300);
  await win.locator('.editor-title-input').fill('Packaged smoke document');
  await win.locator('.editor-title-input').press('Enter');
  await win.keyboard.press('Control+S');
  await win.waitForTimeout(1200);
  const saved = await win.evaluate(async () => {
    const list = await window.auren.library.list({ view: 'documents' });
    const item = list.find((entry) => entry.title === 'Packaged smoke document');
    return item ? window.auren.library.get(item.id) : null;
  });
  assert.ok(saved, 'document saved through the packaged UI');
  assert.match(saved.html, /Packaged AUREN document/);
  console.log('PACKAGED SAVE OK', saved.meta.id);

  /* Export DOCX + PDF with a stubbed save dialog, then re-import both. */
  const stubSave = async (target) => {
    await app.evaluate(({ dialog }, filePath) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath });
    }, target);
  };
  const docxPath = path.join(out, 'packaged.docx');
  await stubSave(docxPath);
  const docxResult = await win.evaluate(({ id, target }) => window.auren.files.exportDocument(id, 'docx', { path: target }), { id: saved.meta.id, target: docxPath });
  assert.equal(docxResult.canceled, false);
  assert.ok(fs.existsSync(docxPath));
  const zip = await JSZip.loadAsync(fs.readFileSync(docxPath));
  const documentXml = await zip.file('word/document.xml').async('string');
  assert.match(documentXml, /Packaged AUREN document/);
  console.log('PACKAGED DOCX OK', fs.statSync(docxPath).size, 'bytes');

  const pdfPath = path.join(out, 'packaged.pdf');
  await stubSave(pdfPath);
  const pdfResult = await win.evaluate(({ id, target }) => window.auren.files.exportDocument(id, 'pdf', {
    path: target,
    pdf: { range: 'all', fromPage: 1, toPage: 1, includeBackground: true, includeHeaderFooter: true, includePageNumbers: true, quality: 'high' }
  }), { id: saved.meta.id, target: pdfPath });
  assert.equal(pdfResult.canceled, false);
  assert.ok(fs.existsSync(pdfPath) && fs.statSync(pdfPath).size > 1000);
  console.log('PACKAGED PDF OK', fs.statSync(pdfPath).size, 'bytes', pdfResult.warnings.join(' | '));

  const docxPreview = await win.evaluate((filePath) => window.auren.files.importPreview(filePath), docxPath);
  assert.match(docxPreview.html, /Packaged AUREN document/);
  console.log('PACKAGED DOCX IMPORT OK', docxPreview.html.length, 'chars');

  const pdfPreview = await win.evaluate((filePath) => window.auren.files.importPreview(filePath), pdfPath);
  assert.match(pdfPreview.html, /Packaged AUREN document/);
  console.log('PACKAGED PDF IMPORT OK', pdfPreview.html.length, 'chars');

  /* Settings persistence across a reload, and all three themes. */
  for (const theme of ['paper', 'oled', 'midnight']) {
    await win.evaluate((value) => window.auren.settings.update({ theme: value }), theme);
    await win.reload();
    await win.waitForTimeout(1200);
    const current = await win.evaluate(() => document.documentElement.dataset.theme);
    assert.equal(current, theme, `theme ${theme} applies after reload`);
  }
  const stored = await win.evaluate(() => window.auren.settings.get());
  assert.equal(stored.theme, 'midnight');
  assert.equal(stored.editorSpellcheck, true);
  console.log('PACKAGED SETTINGS + THEMES OK');

  /* Optional encryption migration in the packaged build. */
  const encryption = await win.evaluate(async () => {
    const enabled = await window.auren.settings.update({ encryptedStorage: true });
    const list = await window.auren.library.list({ view: 'documents' });
    const doc = list.find((item) => item.title === 'Packaged smoke document');
    const loaded = doc ? await window.auren.library.get(doc.id) : null;
    const disabled = await window.auren.settings.update({ encryptedStorage: false });
    return { enabled: enabled.encryptedStorage, disabled: disabled.encryptedStorage, html: loaded?.html || '' };
  });
  assert.equal(encryption.enabled, true);
  assert.equal(encryption.disabled, false);
  assert.match(encryption.html, /Packaged AUREN document/);
  console.log('PACKAGED ENCRYPTION OK');

  console.log('PACKAGED SMOKE TEST PASSED');
} finally {
  try { await app.close(); } catch { /* ignore */ }
  fs.rmSync(root, { recursive: true, force: true });
}
