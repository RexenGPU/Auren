import { _electron as electron } from 'playwright';
import electronPath from 'electron';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import assert from 'node:assert/strict';

const root = path.join(os.tmpdir(), `auren-editor-ui-${Date.now()}`);
const user = path.join(root, 'user');
const library = path.join(root, 'library');
fs.mkdirSync(user, { recursive: true });
fs.mkdirSync(library, { recursive: true });

const shots = path.join(process.cwd(), 'qa-shots');
fs.mkdirSync(shots, { recursive: true });
const imagePath = path.join(process.cwd(), 'build', 'icon-512.png');

const launch = async () => {
  const app = await electron.launch({
    executablePath: electronPath,
    args: ['.'],
    cwd: process.cwd(),
    env: {
      ...process.env,
      AUREN_TEST_MODE: '1',
      AUREN_USER_DATA: user,
      AUREN_DATA_DIR: library
    }
  });
  const win = await app.firstWindow({ timeout: 30000 });
  win.on('console', (msg) => { if (msg.type() === 'error') console.log('[renderer error]', msg.text()); });
  win.on('pageerror', (error) => console.log('[pageerror]', error.message));
  await win.waitForLoadState('domcontentloaded');
  await win.waitForTimeout(1600);
  return { app, win };
};

const nodeTypes = (node, types = new Set()) => {
  if (!node || typeof node !== 'object') return types;
  if (node.type) types.add(node.type);
  if (Array.isArray(node.content)) for (const child of node.content) nodeTypes(child, types);
  return types;
};
const collectText = (node, out = []) => {
  if (!node || typeof node !== 'object') return out;
  if (typeof node.text === 'string') out.push(node.text);
  if (Array.isArray(node.content)) for (const child of node.content) collectText(child, out);
  return out;
};
const findNode = (node, type) => {
  if (!node || typeof node !== 'object') return null;
  if (node.type === type) return node;
  if (Array.isArray(node.content)) {
    for (const child of node.content) {
      const found = findNode(child, type);
      if (found) return found;
    }
  }
  return null;
};
const countNodes = (node, type) => {
  if (!node || typeof node !== 'object') return 0;
  let count = node.type === type ? 1 : 0;
  if (Array.isArray(node.content)) for (const child of node.content) count += countNodes(child, type);
  return count;
};

let app;
try {
  ({ app } = await launch());
  let win = await app.firstWindow();

  await win.evaluate(() => window.auren.settings.update({
    onboardingComplete: true,
    showLaunchScreen: false,
    editorSpellcheck: true,
    spellLanguages: ['en', 'fr'],
    uiScale: 1,
    theme: 'midnight',
    language: 'en'
  }));
  await win.reload();
  await win.waitForTimeout(1800);
  await win.locator('.home-wrap').waitFor({ timeout: 15000 });

  /* --------------------------------------------------------- rich document */
  await win.keyboard.press('Control+N');
  const prose = win.locator('.editor-view .ProseMirror').first();
  await prose.waitFor({ timeout: 15000 });
  await prose.click();

  await win.keyboard.insertText('Quarterly Report');
  await win.keyboard.press('Enter');
  await win.keyboard.insertText('A calm body with teh typo and a small team.');

  await win.evaluate(() => {
    const editor = document.querySelector('.editor-view .ProseMirror').editor;
    const heading = editor.state.doc.firstChild;
    editor.chain().focus().setTextSelection({ from: 1, to: 1 + heading.content.size }).run();
  });
  await win.locator('select[aria-label="Formatting"]').selectOption('h1');
  await win.waitForTimeout(200);
  const headingTag = await prose.locator('h1').first().innerText().catch(() => '');
  assert.match(headingTag, /Quarterly Report/, 'heading is applied through the toolbar');

  await prose.locator('p', { hasText: 'A calm body' }).first().click();
  await win.keyboard.press('End');
  await win.keyboard.press('Enter');
  await win.keyboard.insertText('A bold phrase.');
  await win.evaluate(() => {
    const editor = document.querySelector('.editor-view .ProseMirror').editor;
    const last = editor.state.doc.lastChild;
    const to = editor.state.doc.content.size - 1;
    const from = to - last.content.size;
    editor.chain().focus().setTextSelection({ from, to }).run();
  });
  await win.locator('.editor-toolbar button[aria-label="Bold"]').first().click();
  await win.waitForTimeout(250);
  const boldText = await prose.locator('strong').allInnerTexts();
  assert.ok(boldText.join(' ').includes('A bold phrase'), 'bold button marks the selected text');
  await win.evaluate(() => document.querySelector('.editor-view .ProseMirror').editor.commands.focus('end'));
  await win.waitForTimeout(150);

  /* Move the caret into a fresh trailing paragraph. The UI buttons below still
     perform every insertion; this only keeps the document flow predictable. */
  const prepareEnd = async () => {
    await win.evaluate(() => {
      const editor = document.querySelector('.editor-view .ProseMirror').editor;
      if (!editor) throw new Error('TipTap editor is not available');
      const last = editor.state.doc.lastChild;
      if (!last || last.type.name !== 'paragraph' || last.content.size > 0) {
        editor.commands.insertContentAt(editor.state.doc.content.size, { type: 'paragraph' });
      }
      editor.commands.focus('end');
    });
    await win.waitForTimeout(120);
  };
  await prepareEnd();

  /* --------------------------------------------------------- spellcheck UI */
  const misspelling = prose.locator('.auren-spell-error', { hasText: 'teh' }).first();
  await misspelling.waitFor({ timeout: 8000 });
  assert.ok(await misspelling.count(), 'misspelled word is decorated');
  await misspelling.click({ button: 'right' });
  await win.locator('.context-menu').waitFor({ timeout: 5000 });
  const suggestion = win.locator('.context-menu button').first();
  const suggestionLabel = (await suggestion.innerText()).trim();
  console.log('SPELL SUGGESTION', suggestionLabel);
  await suggestion.click();
  await win.waitForTimeout(500);
  assert.ok(!(await prose.innerText()).includes('teh'), 'spellcheck suggestion replaced the word');
  console.log('SPELLCHECK CONTEXT MENU OK');

  /* ------------------------------------------------------------- insert menu */
  const openInsert = async (label) => {
    await win.locator('button[aria-label="Insert"]').click();
    await win.locator('.tb-insert-menu').waitFor({ timeout: 3000 });
    await win.locator('.tb-insert-menu .tb-menu-item', { hasText: label }).first().click();
    await win.waitForTimeout(250);
  };

  await win.locator('input[type=file]').setInputFiles(imagePath);
  await prose.locator('img').first().waitFor({ timeout: 8000 });
  assert.ok(await prose.locator('img').count() >= 1, 'image inserted');
  console.log('IMAGE OK');

  await prepareEnd();
  await openInsert('Page break');
  await prose.locator('[data-page-break="true"]').first().waitFor({ timeout: 5000 });
  assert.ok(await prose.locator('[data-page-break="true"]').count() >= 1, 'page break inserted');

  await prepareEnd();
  await openInsert('Footnote');
  await win.locator('.modal').waitFor({ timeout: 4000 });
  await win.locator('.modal input.input').nth(1).fill('A test footnote survives.');
  await win.locator('.modal .btn-primary').click();
  await win.waitForTimeout(350);
  assert.ok(await prose.locator('sup[data-auren-footnote]').count() >= 1, 'footnote inserted');

  await prepareEnd();
  await openInsert('Table of contents');
  await win.waitForTimeout(400);
  assert.ok(await prose.locator('nav[data-auren-toc]').count() >= 1, 'table of contents inserted');
  assert.match(await prose.locator('nav[data-auren-toc]').first().innerText(), /Quarterly Report/, 'TOC includes heading');

  await prepareEnd();
  await openInsert('Text box');
  assert.ok(await prose.locator('[data-auren-textbox="true"]').count() >= 1, 'text box inserted');

  await prepareEnd();
  await openInsert('Shape');
  await win.locator('.modal').waitFor({ timeout: 4000 });
  await win.locator('.modal .btn-primary').click();
  await win.waitForTimeout(300);
  assert.ok(await prose.locator('[data-auren-shape="true"]').count() >= 1, 'shape inserted');

  await prepareEnd();
  await openInsert('Caption');
  assert.ok(await prose.locator('[data-caption="true"]').count() >= 1, 'caption inserted');
  console.log('PAGE BREAK + FOOTNOTE + TOC + TEXTBOX + SHAPE + CAPTION OK');

  await prepareEnd();
  await openInsert('Insert table');
  await prose.locator('table').first().waitFor({ timeout: 5000 });
  assert.equal(await prose.locator('table').count(), 1, 'table inserted');
  await win.locator('button[aria-label="Table"]').click();
  await win.locator('.tb-insert-menu .tb-menu-item', { hasText: 'Add row' }).first().click();
  await win.waitForTimeout(200);
  assert.equal(await prose.locator('table tr').count(), 4, 'table row added through the table menu');
  console.log('TABLE OK');

  /* ------------------------------------------------------------ find replace */
  await win.keyboard.press('Control+F');
  await win.locator('.find-bar').waitFor({ timeout: 4000 });
  await win.locator('.find-input').first().fill('calm');
  await win.waitForTimeout(400);
  assert.match(await win.locator('.find-count').innerText(), /1 of 1/, 'find reports one match');
  await win.locator('.find-toggle').click();
  await win.locator('.find-bar-row.is-replace .find-input').fill('serene');
  await win.locator('.find-bar-row.is-replace .btn', { hasText: 'Replace all' }).click();
  await win.waitForTimeout(400);
  assert.match(await prose.innerText(), /serene body/, 'replace all updated the document');
  await win.keyboard.press('Escape');
  await win.waitForTimeout(200);
  assert.equal(await win.locator('.find-bar').count(), 0, 'find bar closes with Escape');
  console.log('FIND & REPLACE OK');

  /* --------------------------------------------------------------- focus/zen */
  await win.locator('.statusbar-btn', { hasText: 'Focus mode' }).click();
  await win.waitForTimeout(300);
  assert.ok(await win.locator('.editor-view.is-focus').count(), 'focus mode class applied');
  await win.locator('.statusbar-btn', { hasText: 'Focus mode' }).click();
  await win.waitForTimeout(200);

  await win.locator('button[aria-label="Zen mode"]').first().click();
  await win.waitForTimeout(400);
  assert.ok(await win.locator('.editor-view.is-zen').count(), 'zen mode class applied');
  assert.equal(await win.locator('.editor-toolbar').count(), 0, 'toolbar hidden in zen mode');
  await win.locator('.zen-exit').click();
  await win.waitForTimeout(300);
  assert.equal(await win.locator('.editor-view.is-zen').count(), 0, 'zen mode exits');
  console.log('FOCUS + ZEN OK');

  /* -------------------------------------------------------------- page setup */
  const stage = win.locator('.editor-page-stage');
  const widthBefore = await stage.evaluate((element) => parseFloat(element.style.width));
  assert.ok(widthBefore > 700 && widthBefore < 850, `A4 stage width is ${widthBefore}`);
  await win.locator('button[aria-label="Page setup"]').click();
  await win.locator('.page-setup select').selectOption('Letter');
  await win.locator('.page-orientation button', { hasText: 'Landscape' }).click();
  await win.locator('.page-setup .segmented').nth(1).getByRole('button', { name: '2', exact: true }).click();
  await win.locator('.modal .btn-primary', { hasText: 'Apply to document' }).click();
  await win.waitForTimeout(600);
  const widthAfter = await stage.evaluate((element) => parseFloat(element.style.width));
  assert.ok(Math.abs(widthAfter - 1056) < 3, `Letter landscape stage width is ${widthAfter}`);
  const columnCount = await prose.evaluate((element) => getComputedStyle(element).columnCount);
  assert.equal(columnCount, '2', 'two-column layout applied');
  console.log('PAGE SETUP + COLUMNS OK', widthBefore, '->', widthAfter);

  /* ------------------------------------------------------------------- save */
  const titleInput = win.locator('.editor-title-input');
  await titleInput.fill('Editor interaction test');
  await titleInput.press('Enter');
  await win.waitForTimeout(300);
  await win.keyboard.press('Control+S');
  await win.waitForTimeout(1200);

  const saved = await win.evaluate(async () => {
    const list = await window.auren.library.list({ view: 'documents' });
    const item = list.find((entry) => entry.title === 'Editor interaction test');
    if (!item) return null;
    return window.auren.library.get(item.id);
  });
  assert.ok(saved, 'saved document is found');
  const types = nodeTypes(saved.content);
  for (const expected of ['heading', 'table', 'image', 'pageBreak', 'footnote', 'tableOfContents', 'callout', 'shape', 'caption']) {
    assert.ok(types.has(expected), `saved document contains ${expected}`);
  }
  const textNodes = [];
  const walk = (node) => {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'text' && Array.isArray(node.marks) && node.marks.some((mark) => mark.type === 'bold')) textNodes.push(node.text);
    if (Array.isArray(node.content)) node.content.forEach(walk);
  };
  walk(saved.content);
  assert.ok(textNodes.join(' ').includes('bold phrase'), 'bold mark persists in saved JSON');
  assert.equal(countNodes(saved.content, 'tableRow'), 4, 'saved table has four rows');
  assert.equal(saved.meta.pageSettings.size, 'Letter');
  assert.equal(saved.meta.pageSettings.orientation, 'landscape');
  assert.equal(saved.meta.pageSettings.columns, 2);
  assert.match(collectText(saved.content).join(' '), /serene body/, 'saved text includes the replacement');
  console.log('SAVED RICH DOCUMENT OK', saved.meta.id, 'pages:', saved.meta.pageSettings.size);

  /* ------------------------------------------------------------- pagination */
  await win.keyboard.press('Control+N');
  await win.waitForTimeout(900);
  await prose.click();
  for (let index = 1; index <= 45; index += 1) {
    await win.keyboard.insertText(`Paragraph ${index}. AUREN paginates real content across real pages, keeping margins, headers, and typographic rhythm intact.`);
    await win.keyboard.press('Enter');
    await win.keyboard.press('Enter');
  }
  await win.waitForFunction(() => {
    const element = document.querySelector('.editor-view .ProseMirror');
    return element && Number(element.dataset.pages || '0') >= 2;
  }, null, { timeout: 15000 });
  const pagination = await win.evaluate(() => {
    const element = document.querySelector('.editor-view .ProseMirror');
    return {
      pages: Number(element.dataset.pages || '0'),
      cards: document.querySelectorAll('.page-deck .page-card').length,
      spacers: document.querySelectorAll('.auren-page-spacer').length,
      subline: document.querySelector('.editor-subline')?.textContent || ''
    };
  });
  console.log('PAGINATION', JSON.stringify(pagination));
  assert.ok(pagination.pages >= 2, 'long document paginates');
  assert.equal(pagination.cards, pagination.pages, 'page deck matches reported pages');
  assert.ok(pagination.spacers >= 1, 'page spacers push blocks across page boundaries');
  await win.screenshot({ path: path.join(shots, '70-editor-pagination.png') });

  /* --------------------------------------------------------------- narrow */
  await app.evaluate(({ BrowserWindow }) => {
    const window = BrowserWindow.getAllWindows()[0];
    window.setSize(1000, 700);
  });
  await win.waitForTimeout(700);
  const overflow = await win.evaluate(() => ({
    viewport: window.innerWidth,
    docWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth,
    toolbarClient: document.querySelector('.editor-toolbar')?.clientWidth || 0,
    toolbarScroll: document.querySelector('.editor-toolbar')?.scrollWidth || 0
  }));
  console.log('NARROW', JSON.stringify(overflow));
  assert.ok(overflow.docWidth <= overflow.viewport + 2, 'no page-level horizontal overflow at 1000px');
  await win.screenshot({ path: path.join(shots, '71-editor-narrow.png') });

  /* ------------------------------------------- settings scale + themes UI */
  await win.keyboard.press('Control+,');
  await win.locator('.settings-layout').waitFor({ timeout: 10000 });
  await win.waitForTimeout(600);
  assert.equal(await win.evaluate(() => document.documentElement.dataset.theme), 'midnight');

  const scale = win.locator('.settings-content input[type=range]').first();
  await scale.evaluate((element) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(element, '1.15');
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await win.waitForTimeout(600);
  const zoom = await win.evaluate(() => getComputedStyle(document.body).zoom);
  assert.equal(zoom, '1.15', 'UI scale applies to the app');
  await scale.evaluate((element) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(element, '1');
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await win.waitForTimeout(500);
  console.log('UI SCALE OK');

  const paperCard = win.locator('.theme-card', { hasText: 'Paper' }).first();
  await paperCard.click();
  await win.waitForTimeout(600);
  assert.equal(await win.evaluate(() => document.documentElement.dataset.theme), 'paper');
  const paperBackground = await win.evaluate(() => getComputedStyle(document.body).backgroundColor);
  await win.screenshot({ path: path.join(shots, '72-settings-paper.png') });

  const oledCard = win.locator('.theme-card', { hasText: 'OLED' }).first();
  await oledCard.click();
  await win.waitForTimeout(600);
  assert.equal(await win.evaluate(() => document.documentElement.dataset.theme), 'oled');
  const oledBackground = await win.evaluate(() => getComputedStyle(document.body).backgroundColor);
  assert.notEqual(paperBackground, oledBackground, 'paper and OLED themes differ');
  await win.screenshot({ path: path.join(shots, '73-settings-oled.png') });

  const midnightCard = win.locator('.theme-card', { hasText: 'Midnight' }).first();
  await midnightCard.click();
  await win.waitForTimeout(500);
  assert.equal(await win.evaluate(() => document.documentElement.dataset.theme), 'midnight');
  console.log('THEMES OK', paperBackground, oledBackground);

  /* ------------------------------------------- encryption row visual check */
  const storageNav = win.locator('.settings-nav button, .settings-nav a', { hasText: 'Storage' }).first();
  if (await storageNav.count()) {
    await storageNav.click();
    await win.waitForTimeout(400);
    const toggle = win.locator('button[role="switch"][aria-label="Encrypt local library"]').first();
    if (await toggle.count()) {
      await toggle.click();
      await win.waitForTimeout(900);
      await win.screenshot({ path: path.join(shots, '73-settings-encrypted.png') });
      await toggle.click();
      await win.waitForTimeout(700);
      console.log('ENCRYPTION TOGGLE UI OK');
    }
  }

  console.log('EDITOR UI TEST PASSED');
} finally {
  try { await app?.close(); } catch { /* ignore */ }
  fs.rmSync(root, { recursive: true, force: true });
}
