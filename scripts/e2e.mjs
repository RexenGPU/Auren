import { _electron as electron } from 'playwright';
import electronPath from 'electron';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { PDFDocument } from 'pdf-lib';
import { PDFParse } from 'pdf-parse';

const root = path.join(os.tmpdir(), `auren-e2e-${Date.now()}`);
const user = path.join(root, 'user');
const library = path.join(root, 'library');
const out = path.join(root, 'exports');
fs.mkdirSync(user, { recursive: true });
fs.mkdirSync(library, { recursive: true });
fs.mkdirSync(out, { recursive: true });

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
const PAGE_SETTINGS = {
  size: 'A4',
  width: 210,
  height: 297,
  orientation: 'portrait',
  marginTop: 20,
  marginRight: 20,
  marginBottom: 20,
  marginLeft: 20,
  columns: 1,
  headerEnabled: true,
  header: 'AUREN · {{title}} · Confidential draft',
  footerEnabled: true,
  footer: 'Page {{page}} of {{total}}',
  pageNumbering: true,
  pageNumberStart: 1,
  background: '#ffffff',
  pageBorders: false
};

const paragraph = (text) => ({ type: 'paragraph', content: [{ type: 'text', text }] });
const listItem = (text) => ({ type: 'listItem', content: [paragraph(text)] });

const richContent = {
  type: 'doc',
  content: [
    { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'AUREN End-to-End' }] },
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'A real document with ' },
        { type: 'text', marks: [{ type: 'bold' }], text: 'bold' },
        { type: 'text', text: ', ' },
        { type: 'text', marks: [{ type: 'italic' }], text: 'italic' },
        { type: 'text', text: ', a ' },
        { type: 'text', marks: [{ type: 'link', attrs: { href: 'https://example.com' } }], text: 'link' },
        { type: 'text', text: ', an equation ' },
        { type: 'equation', attrs: { latex: 'E = mc^2' } },
        { type: 'text', text: ' and a footnote' },
        { type: 'footnote', attrs: { text: 'A footnote survives the round trip.', label: '1' } },
        { type: 'text', text: '.' }
      ]
    },
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Structure' }] },
    { type: 'bulletList', content: [listItem('First bullet'), listItem('Second bullet')] },
    { type: 'orderedList', content: [listItem('First step'), listItem('Second step')] },
    {
      type: 'taskList',
      content: [
        { type: 'taskItem', attrs: { checked: true }, content: [paragraph('Finished task')] },
        { type: 'taskItem', attrs: { checked: false }, content: [paragraph('Open task')] }
      ]
    },
    { type: 'blockquote', content: [paragraph('A quoted idea worth keeping.')] },
    { type: 'codeBlock', attrs: { language: null }, content: [{ type: 'text', text: 'const answer = 42;' }] },
    {
      type: 'table',
      content: [
        {
          type: 'tableRow',
          content: [
            { type: 'tableHeader', attrs: { colspan: 1, rowspan: 1, colwidth: null }, content: [paragraph('Metric')] },
            { type: 'tableHeader', attrs: { colspan: 1, rowspan: 1, colwidth: null }, content: [paragraph('Value')] }
          ]
        },
        {
          type: 'tableRow',
          content: [
            { type: 'tableCell', attrs: { colspan: 1, rowspan: 1, colwidth: null }, content: [paragraph('Words')] },
            { type: 'tableCell', attrs: { colspan: 1, rowspan: 1, colwidth: null }, content: [paragraph('1,204')] }
          ]
        }
      ]
    },
    { type: 'image', attrs: { src: PNG, alt: 'A pixel', title: null, width: 64, height: 64 } },
    { type: 'caption', content: [{ type: 'text', text: 'Figure 1. A one-pixel image.' }] },
    { type: 'pageBreak' },
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Second page' }] },
    paragraph('Content after a real page break.'),
    {
      type: 'callout',
      attrs: { variant: 'note' },
      content: [paragraph('A callout becomes a styled table in DOCX.')]
    },
    {
      type: 'tableOfContents',
      attrs: { entries: JSON.stringify([{ level: 1, text: 'AUREN End-to-End', pos: 0 }, { level: 2, text: 'Structure', pos: 40 }]) }
    },
    {
      type: 'shape',
      attrs: { shape: 'rectangle', color: '#8b7cf6', width: 200, height: 80, pngDataUrl: PNG, alt: 'Decorative bar' }
    }
  ]
};

const longParagraphs = [];
for (let i = 1; i <= 90; i += 1) {
  longParagraphs.push(`Paragraph ${i}. AUREN keeps long documents calm and readable, with real pagination, generous margins, and a typographic rhythm that survives export. This line exists to push the document across several pages so that page ranges and headers can be verified.`);
}
for (const text of longParagraphs) richContent.content.push(paragraph(text));

const richHtml = `
<h1>AUREN End-to-End</h1>
<p>A real document with <strong>bold</strong>, <em>italic</em>, a <a href="https://example.com">link</a>, an equation <span data-latex="E = mc^2" class="auren-math">E = mc^2</span> and a footnote<sup data-auren-footnote="A footnote survives the round trip." data-label="1">1</sup>.</p>
<h2>Structure</h2>
<ul><li><p>First bullet</p></li><li><p>Second bullet</p></li></ul>
<ol><li><p>First step</p></li><li><p>Second step</p></li></ol>
<ul data-type="taskList"><li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked><span></span></label><div><p>Finished task</p></div></li><li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>Open task</p></div></li></ul>
<blockquote><p>A quoted idea worth keeping.</p></blockquote>
<pre><code>const answer = 42;</code></pre>
<table><tbody><tr><th><p>Metric</p></th><th><p>Value</p></th></tr><tr><td><p>Words</p></td><td><p>1,204</p></td></tr></tbody></table>
<img src="${PNG}" alt="A pixel" width="64" height="64">
<p data-caption="true" class="auren-caption">Figure 1. A one-pixel image.</p>
<div data-page-break="true"></div>
<h2>Second page</h2>
<p>Content after a real page break.</p>
<div data-auren-textbox="true" data-callout="note"><p>A callout becomes a styled table in DOCX.</p></div>
<nav data-auren-toc="true" data-entries='[{"level":1,"text":"AUREN End-to-End","pos":0},{"level":2,"text":"Structure","pos":40}]'><div class="auren-toc-title">Contents</div><div class="auren-toc-row level-1"><a href="#">AUREN End-to-End</a></div><div class="auren-toc-row level-2"><a href="#">Structure</a></div></nav>
<div data-auren-shape="true" data-shape="rectangle" data-shape-color="#8b7cf6" data-width="200" data-height="80" data-alt="Decorative bar"><img src="${PNG}" alt="Decorative bar"></div>
${longParagraphs.map((text) => `<p>${text}</p>`).join('\n')}
`;

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
  await win.waitForTimeout(1800);
  return { app, win };
};

const stubSave = async (app, target) => {
  await app.evaluate(({ dialog }, filePath) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath });
  }, target);
};

const exportDocument = async (app, win, id, format, target, options) => {
  await stubSave(app, target);
  const result = await win.evaluate(async ({ id, format, options }) => {
    return window.auren.files.exportDocument(id, format, options);
  }, { id, format, options });
  assert.equal(result.canceled, false, `${format} export was not canceled`);
  assert.equal(result.path, target, `${format} export path`);
  assert.ok(fs.existsSync(target), `${format} file exists`);
  console.log('EXPORT', format, fs.statSync(target).size, 'bytes', result.warnings.length ? `warnings: ${result.warnings.join(' | ')}` : '');
  return result;
};

let app;
try {
  ({ app } = await launch());
  let win = await app.firstWindow();

  /* ------------------------------------------------------- create + rich doc */
  const created = await win.evaluate(async ({ content, html, pageSettings }) => {
    const doc = await window.auren.library.create({
      title: 'AUREN End-to-End',
      content,
      html,
      pageSettings
    });
    await window.auren.library.save(doc.meta.id, {
      title: 'AUREN End-to-End',
      content,
      html,
      wordCount: 980,
      charCount: 6200,
      excerpt: 'AUREN End-to-End · A real document with bold, italic, a link, an equation and a footnote.',
      pageSettings,
      activity: true
    });
    return doc;
  }, { content: richContent, html: richHtml, pageSettings: PAGE_SETTINGS });
  const richId = created.meta.id;
  console.log('RICH DOC', richId);

  const listed = await win.evaluate(() => window.auren.library.list({ view: 'documents' }));
  const richSummary = listed.find((item) => item.id === richId);
  assert.ok(richSummary, 'rich document appears in list');
  assert.match(richSummary.excerpt, /AUREN End-to-End · A real document/);
  assert.equal(richSummary.wordCount, 980);

  /* ------------------------------------------------------------- exports */
  const docxPath = path.join(out, 'AUREN-End-to-End.docx');
  const docxResult = await exportDocument(app, win, richId, 'docx', docxPath);
  const docxZip = await JSZip.loadAsync(fs.readFileSync(docxPath));
  const docXml = await docxZip.file('word/document.xml').async('string');
  assert.match(docXml, /AUREN End-to-End/);
  assert.match(docXml, /<w:tbl>/);
  assert.match(docXml, /<w:drawing>/);
  const docxHeader = await docxZip.file('word/header1.xml').async('string');
  const docxFooter = await docxZip.file('word/footer1.xml').async('string');
  assert.ok(docxHeader, 'DOCX has a header');
  assert.ok(docxFooter, 'DOCX has a footer');
  assert.match(docxHeader, /AUREN End-to-End/, 'DOCX header resolves the {{title}} token');
  assert.match(docxFooter, /PAGE/, 'DOCX footer carries a live page field');
  assert.match(docxFooter, /NUMPAGES/, 'DOCX footer carries a live total-pages field');
  assert.ok(docxZip.file('word/footnotes.xml'), 'DOCX has footnotes');
  const mediaFiles = Object.keys(docxZip.files).filter((name) => name.startsWith('word/media/'));
  assert.ok(mediaFiles.length >= 1, 'DOCX embeds images');
  console.log('DOCX STRUCTURE OK', mediaFiles.length, 'media files');

  const pdfPath = path.join(out, 'AUREN-End-to-End.pdf');
  const pdfResult = await exportDocument(app, win, richId, 'pdf', pdfPath, {
    pdf: { range: 'all', fromPage: 1, toPage: 1, includeBackground: true, includeHeaderFooter: true, includePageNumbers: true, quality: 'high' }
  });
  const pdfBytes = fs.readFileSync(pdfPath);
  assert.equal(pdfBytes.subarray(0, 5).toString(), '%PDF-');
  const pdf = await PDFDocument.load(pdfBytes);
  const pdfPages = pdf.getPageCount();
  assert.ok(pdfPages >= 3, `PDF should have multiple pages, got ${pdfPages}`);
  const pdfParser = new PDFParse({ data: pdfBytes });
  try {
    const pdfText = (await pdfParser.getText()).text;
    assert.match(pdfText, /AUREN\s+End-to-End/, 'PDF header resolves the {{title}} token');
    assert.match(pdfText, new RegExp(`Page\\s+1\\s+of\\s+${pdfPages}`), 'PDF footer resolves {{page}} and {{total}}');
  } finally {
    await pdfParser.destroy().catch(() => {});
  }
  console.log('PDF PAGES', pdfPages, 'warning:', pdfResult.warnings.join(' | '));

  const rangePath = path.join(out, 'AUREN-range.pdf');
  await exportDocument(app, win, richId, 'pdf', rangePath, {
    pdf: { range: 'custom', fromPage: 1, toPage: 2, includeBackground: false, includeHeaderFooter: false, includePageNumbers: false, quality: 'standard' }
  });
  const rangePdf = await PDFDocument.load(fs.readFileSync(rangePath));
  assert.equal(rangePdf.getPageCount(), 2, 'PDF page range is trimmed to two pages');

  const odtPath = path.join(out, 'AUREN-End-to-End.odt');
  await exportDocument(app, win, richId, 'odt', odtPath);
  const odtZip = await JSZip.loadAsync(fs.readFileSync(odtPath));
  const odtXml = await odtZip.file('content.xml').async('string');
  const odtStyles = await odtZip.file('styles.xml').async('string');
  assert.match(odtXml, /AUREN End-to-End/);
  assert.match(odtStyles, /AUREN End-to-End/, 'ODT header resolves the {{title}} token');
  assert.match(odtStyles, /text:page-count/, 'ODT footer carries a total-pages field');
  assert.ok(odtZip.file('META-INF/manifest.xml'), 'ODT manifest exists');

  const rtfPath = path.join(out, 'AUREN-End-to-End.rtf');
  await exportDocument(app, win, richId, 'rtf', rtfPath);
  const rtf = fs.readFileSync(rtfPath, 'utf8');
  assert.ok(rtf.startsWith('{\\rtf'), 'RTF header');
  assert.match(rtf, /AUREN End-to-End/);

  const mdPath = path.join(out, 'AUREN-End-to-End.md');
  await exportDocument(app, win, richId, 'md', mdPath);
  const markdown = fs.readFileSync(mdPath, 'utf8');
  assert.match(markdown, /# AUREN End-to-End/);
  assert.match(markdown, /First bullet/);

  const htmlPath = path.join(out, 'AUREN-End-to-End.html');
  await exportDocument(app, win, richId, 'html', htmlPath);
  const standalone = fs.readFileSync(htmlPath, 'utf8');
  assert.match(standalone, /<h1>AUREN End-to-End<\/h1>/);
  assert.match(standalone, /@page/);

  const txtPath = path.join(out, 'AUREN-End-to-End.txt');
  await exportDocument(app, win, richId, 'txt', txtPath);
  const plain = fs.readFileSync(txtPath, 'utf8');
  assert.match(plain, /AUREN End-to-End/);
  assert.match(plain, /Paragraph 90/);

  const aurenPath = path.join(out, 'AUREN-End-to-End.auren');
  await exportDocument(app, win, richId, 'auren', aurenPath);
  const aurenJson = JSON.parse(fs.readFileSync(aurenPath, 'utf8'));
  assert.equal(aurenJson.format, 'auren-document');
  assert.match(aurenJson.html, /AUREN End-to-End/);

  /* ------------------------------------------------------------ imports */
  const importChecks = [];
  for (const [format, file] of [['docx', docxPath], ['odt', odtPath], ['rtf', rtfPath], ['md', mdPath], ['html', htmlPath], ['txt', txtPath], ['pdf', pdfPath], ['auren', aurenPath]]) {
    const preview = await win.evaluate((filePath) => window.auren.files.importPreview(filePath), file);
    assert.ok(preview.html && preview.html.length > 20, `${format} preview has HTML`);
    assert.ok(preview.suggestedTitle, `${format} preview has a title`);
    importChecks.push({ format, htmlLength: preview.html.length, warnings: preview.warnings, pageSettings: preview.pageSettings });
    console.log('IMPORT PREVIEW', format, preview.html.length, 'chars', preview.warnings.length, 'warnings');
  }
  const docxPreview = importChecks.find((item) => item.format === 'docx');
  assert.match(docxPreview.warnings.join(' '), /footnote|endnote|header|footer|image/i, 'DOCX import reports fidelity notes');
  const docxPreviewHtml = (await win.evaluate((filePath) => window.auren.files.importPreview(filePath), docxPath)).html;
  assert.match(docxPreviewHtml, /AUREN End-to-End/);
  assert.match(docxPreviewHtml, /Metric/);
  assert.match(docxPreviewHtml, /<table|<w:tbl/i);
  assert.match(docxPreviewHtml, /data:image|<img/i);
  assert.match(docxPreview.pageSettings.header, /Confidential draft/, 'DOCX header text survives import');
  assert.match(docxPreview.pageSettings.footer, /Page/, 'DOCX footer text survives import');
  assert.equal(docxPreview.pageSettings.headerEnabled, true, 'DOCX header is enabled after import');
  assert.equal(docxPreview.pageSettings.footerEnabled, true, 'DOCX footer is enabled after import');
  assert.match(docxPreviewHtml, /footnote survives/i, 'DOCX footnote text survives import');
  const imported = await win.evaluate(async ({ html, pageSettings }) => {
    return window.auren.library.create({
      title: 'Imported from DOCX',
      html,
      content: null,
      pageSettings,
      importedFrom: 'AUREN-End-to-End.docx'
    });
  }, { html: docxPreviewHtml, pageSettings: PAGE_SETTINGS });
  const importedDoc = await win.evaluate((id) => window.auren.library.get(id), imported.meta.id);
  assert.match(importedDoc.html, /AUREN End-to-End/);
  assert.match(importedDoc.html, /<table/i);
  console.log('DOCX RE-IMPORT OK', imported.meta.id);

  /* --------------------------------------------- management + versioning */
  const second = await win.evaluate(async () => {
    const workspace = await window.auren.library.createWorkspace('Research', '#5aa7f7', 'Long-form work');
    const doc = await window.auren.library.create({ title: 'Second document', html: '<p>Second body</p>', workspaceId: workspace.id, folder: 'Notes' });
    return { workspace, doc };
  });
  const secondId = second.doc.meta.id;
  await win.evaluate(async ({ id, workspaceId }) => {
    await window.auren.library.updateMeta(id, { favorite: true, folder: 'Briefs', workspaceId });
    await window.auren.library.rename(id, 'Renamed second document');
  }, { id: secondId, workspaceId: second.workspace.id });
  const renamed = await win.evaluate((id) => window.auren.library.get(id), secondId);
  assert.equal(renamed.meta.title, 'Renamed second document');
  assert.equal(renamed.meta.favorite, true);
  assert.equal(renamed.meta.folder, 'Briefs');
  assert.equal(renamed.meta.workspaceId, second.workspace.id);

  const duplicate = await win.evaluate((id) => window.auren.library.duplicate(id), secondId);
  assert.match(duplicate.meta.title, /copy$/);
  const favorites = await win.evaluate(() => window.auren.library.list({ view: 'favorites' }));
  assert.ok(favorites.some((item) => item.id === secondId), 'favorite filter works');
  const search = await win.evaluate(() => window.auren.library.search('Renamed'));
  assert.ok(search.some((item) => item.id === secondId), 'search finds renamed document');
  const sorted = await win.evaluate(() => window.auren.library.list({ view: 'documents', sort: 'title', direction: 'asc' }));
  assert.ok(sorted.length >= 3, 'sorted list has documents');

  const version = await win.evaluate((id) => window.auren.library.createVersion(id, 'Before edit'), secondId);
  await win.evaluate(async (id) => {
    const doc = await window.auren.library.get(id, false);
    await window.auren.library.save(id, {
      title: doc.meta.title,
      content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Changed body' }] }] },
      html: '<p>Changed body</p>',
      wordCount: 2,
      charCount: 12,
      excerpt: 'Changed body',
      pageSettings: doc.meta.pageSettings
    });
  }, secondId);
  const versions = await win.evaluate((id) => window.auren.library.versions(id), secondId);
  assert.ok(versions.some((item) => item.id === version.id), 'version list contains version');
  const restored = await win.evaluate(({ id, versionId }) => window.auren.library.restoreVersion(id, versionId), { id: secondId, versionId: version.id });
  assert.match(restored.html, /Second body/);

  const draft = await win.evaluate(async (id) => {
    await new Promise((resolve) => setTimeout(resolve, 650));
    await window.auren.library.saveDraft(id, {
      content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Unsaved draft body' }] }] },
      html: '<p>Unsaved draft body</p>',
      title: 'Renamed second document',
      wordCount: 3
    });
    return window.auren.library.recovery();
  }, secondId);
  assert.ok(draft.some((item) => item.documentId === secondId), 'recovery candidate is reported');
  const draftBody = await win.evaluate((id) => window.auren.library.draft(id), secondId);
  assert.match(draftBody.html, /Unsaved draft body/);
  await win.evaluate((id) => window.auren.library.clearDraft(id), secondId);
  const cleared = await win.evaluate((id) => window.auren.library.draft(id), secondId);
  assert.equal(cleared, null);

  await win.evaluate((id) => window.auren.library.trash(id), secondId);
  const trash = await win.evaluate(() => window.auren.library.list({ view: 'trash' }));
  assert.ok(trash.some((item) => item.id === secondId), 'trash contains document');
  await win.evaluate((id) => window.auren.library.restore(id), secondId);
  const restoredList = await win.evaluate(() => window.auren.library.list({ view: 'documents' }));
  assert.ok(restoredList.some((item) => item.id === secondId), 'restore returns document');

  await win.evaluate((id) => window.auren.library.updateMeta(id, { workspaceId: null }), secondId);
  await win.evaluate((id) => window.auren.library.deleteWorkspace(id), second.workspace.id);
  const workspaces = await win.evaluate(() => window.auren.library.workspaces());
  assert.ok(!workspaces.some((item) => item.id === second.workspace.id), 'workspace deleted');

  const template = await win.evaluate((pageSettings) => window.auren.library.saveTemplate({
    title: 'E2E Template',
    category: 'Reports',
    description: 'Template created by the end-to-end test.',
    html: '<h1>Template</h1><p>Body</p>',
    content: { type: 'doc', content: [{ type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Template' }] }] },
    pageSettings
  }), PAGE_SETTINGS);
  const templates = await win.evaluate(() => window.auren.library.listTemplates());
  assert.ok(templates.some((item) => item.id === template.id), 'custom template listed');
  const templateFull = await win.evaluate((id) => window.auren.library.getTemplate(id), template.id);
  assert.match(templateFull.html, /Template/);
  await win.evaluate((id) => window.auren.library.deleteTemplate(id), template.id);

  const stats = await win.evaluate(() => window.auren.library.stats());
  assert.ok(stats.documentCount >= 4, 'stats count documents');
  assert.ok(stats.bytes > 0, 'stats count bytes');
  const activity = await win.evaluate(() => window.auren.library.activity(10));
  assert.ok(activity.length > 0, 'activity log has entries');

  const purgeTarget = duplicate.meta.id;
  await win.evaluate((id) => window.auren.library.trash(id), purgeTarget);
  await win.evaluate((id) => window.auren.library.purge(id), purgeTarget);
  const afterPurge = await win.evaluate(() => window.auren.library.list({ view: 'trash' }));
  assert.ok(!afterPurge.some((item) => item.id === purgeTarget), 'purge removes document');

  /* ------------------------------------------------------ spell + AI paths */
  const spell = await win.evaluate(() => window.auren.spell.check(['teh', 'bonjour', 'hello'], ['en', 'fr']));
  assert.ok(Array.isArray(spell.unknown), 'spellcheck returns an unknown-word list');
  assert.ok(spell.unknown.includes('teh'), 'spellcheck flags a misspelling');
  assert.ok(!spell.unknown.includes('bonjour'), 'French dictionary recognizes bonjour');
  console.log('SPELL', JSON.stringify(spell.unknown));

  const aiDisabled = await win.evaluate(async () => {
    try {
      await window.auren.ai.chat({ requestId: 'test-disabled', messages: [{ role: 'user', content: 'Hello' }], includeDocument: false });
      return 'unexpected-success';
    } catch (error) {
      return String(error?.message || error);
    }
  });
  assert.match(aiDisabled, /disabled/i, 'AI chat is refused while disabled');
  await win.evaluate(() => window.auren.settings.update({ aiEnabled: true, aiProvider: 'openai', aiModel: 'gpt-4o-mini' }));
  const aiNoKey = await win.evaluate(async () => {
    try {
      await window.auren.ai.chat({ requestId: 'test-no-key', messages: [{ role: 'user', content: 'Hello' }], includeDocument: false });
      return 'unexpected-success';
    } catch (error) {
      return String(error?.message || error);
    }
  });
  assert.match(aiNoKey, /key|configured|API/i, 'AI chat requires a key');
  await win.evaluate(() => window.auren.settings.update({ aiEnabled: false }));
  console.log('AI ERROR PATHS OK');

  /* ---------------------------------------------------------- settings */
  const changed = await win.evaluate(() => window.auren.settings.update({
    theme: 'oled',
    language: 'fr',
    defaultFont: 'Inter',
    defaultFontSize: 13,
    autosaveDelay: 900,
    toolbarDensity: 'compact',
    pageGuides: false
  }));
  assert.equal(changed.theme, 'oled');
  assert.equal(changed.language, 'fr');
  assert.equal(changed.defaultFont, 'Inter');
  assert.equal(changed.autosaveDelay, 900);

  await app.close();
  ({ app } = await launch());
  win = await app.firstWindow();
  const persisted = await win.evaluate(() => window.auren.settings.get());
  assert.equal(persisted.theme, 'oled');
  assert.equal(persisted.language, 'fr');
  assert.equal(persisted.defaultFont, 'Inter');
  assert.equal(persisted.autosaveDelay, 900);
  assert.equal(persisted.pageGuides, false);
  console.log('SETTINGS PERSISTENCE OK');

  /* ------------------------------------------------------- UI shortcuts */
  await win.evaluate(() => window.auren.settings.update({ onboardingComplete: true, theme: 'midnight', language: 'en' }));
  await win.reload();
  await win.waitForTimeout(1600);
  await win.keyboard.press('Control+K');
  await win.waitForTimeout(350);
  assert.ok(await win.locator('.palette-layer').count(), 'command palette opens with Ctrl+K');
  await win.keyboard.press('Escape');
  await win.waitForTimeout(250);
  await win.keyboard.press('Control+N');
  await win.waitForTimeout(1500);
  const prose = win.locator('.ProseMirror').first();
  await prose.waitFor({ timeout: 10000 });
  await prose.click();
  await win.keyboard.type('UI shortcut document');
  await win.keyboard.press('Enter');
  await win.keyboard.type('Typed in the editor and saved with Ctrl+S.');
  await win.keyboard.press('Control+S');
  await win.waitForTimeout(900);
  const uiDocs = await win.evaluate(() => window.auren.library.list({ view: 'documents' }));
  const uiDoc = uiDocs.find((item) => item.title === 'Untitled document' || item.excerpt.includes('UI shortcut document'));
  assert.ok(uiDoc, 'Ctrl+S saved the UI-created document');
  assert.match(uiDoc.excerpt, /UI shortcut document/);
  console.log('UI SHORTCUTS OK', uiDoc.id);

  console.log('E2E TEST PASSED');
} finally {
  try { await app?.close(); } catch { /* ignore */ }
  if (!process.env.AUREN_KEEP_E2E) fs.rmSync(root, { recursive: true, force: true });
  else console.log('KEPT', root);
}
