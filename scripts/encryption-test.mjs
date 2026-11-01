import { _electron as electron } from 'playwright';
import electronPath from 'electron';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import assert from 'node:assert/strict';

const root = path.join(os.tmpdir(), `auren-encryption-${Date.now()}`);
const user = path.join(root, 'user');
const library = path.join(root, 'library');
fs.mkdirSync(user, { recursive: true });
fs.mkdirSync(library, { recursive: true });

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
  win.on('console', (msg) => { if (msg.type() === 'error') console.log('[error]', msg.text()); });
  win.on('pageerror', (error) => console.log('[pageerror]', error.message));
  await win.waitForLoadState('domcontentloaded');
  await win.waitForTimeout(1800);
  return { app, win };
};

const readDocFile = (id) => fs.readFileSync(path.join(library, 'docs', `${id}.json`), 'utf8');

let app;
try {
  ({ app } = await launch());
  let win = await app.firstWindow();
  const created = await win.evaluate(async () => {
    const doc = await window.auren.library.create({
      title: 'Encryption round trip',
      html: '<h1>Private heading</h1><p>Body text that should survive encryption.</p><ul><li>One item</li><li>Two item</li></ul>'
    });
    await window.auren.library.save(doc.meta.id, {
      title: 'Encryption round trip',
      content: doc.content,
      html: doc.html,
      wordCount: 12,
      charCount: 80,
      excerpt: 'Private heading · Body text that should survive encryption.',
      activity: false
    });
    await window.auren.library.createVersion(doc.meta.id, 'Before encryption');
    await window.auren.library.saveDraft(doc.meta.id, {
      content: doc.content,
      html: doc.html,
      title: 'Encryption round trip',
      wordCount: 12
    });
    await window.auren.library.saveTemplate({
      title: 'Encrypted template',
      category: 'Personal',
      description: 'Template used for encryption testing.',
      html: '<p>Template body</p>',
      content: null,
      pageSettings: doc.meta.pageSettings
    });
    const list = await window.auren.library.list({ view: 'documents' });
    return { id: doc.meta.id, excerpt: list.find((item) => item.id === doc.meta.id)?.excerpt };
  });
  const id = created.id;
  console.log('CREATED', id, 'EXCERPT', created.excerpt);
  assert.match(created.excerpt, /Private heading · Body text/, 'excerpt should separate blocks');

  const before = readDocFile(id);
  assert.ok(before.startsWith('{'), 'document starts as plain JSON');

  const enabled = await win.evaluate(() => window.auren.settings.update({ encryptedStorage: true }));
  assert.equal(enabled.encryptedStorage, true);
  const encryptedRaw = readDocFile(id);
  const envelope = JSON.parse(encryptedRaw);
  assert.equal(envelope.__aurenEncrypted, 1, 'document file is encrypted');
  assert.ok(!encryptedRaw.includes('Private heading'), 'plaintext heading is not present');
  console.log('ENCRYPTED DOC BYTES', encryptedRaw.length);

  const versionId = await win.evaluate(async (docId) => {
    const versions = await window.auren.library.versions(docId);
    return versions[0].id;
  }, id);
  const versionRaw = fs.readFileSync(path.join(library, 'versions', id, `${versionId}.json`), 'utf8');
  assert.equal(JSON.parse(versionRaw).__aurenEncrypted, 1, 'version file is encrypted');
  const draftRaw = fs.readFileSync(path.join(library, 'drafts', `${id}.json`), 'utf8');
  assert.equal(JSON.parse(draftRaw).__aurenEncrypted, 1, 'draft file is encrypted');
  const templateFile = fs.readdirSync(path.join(library, 'templates')).find((file) => file.endsWith('.json'));
  assert.ok(templateFile, 'template exists');
  const templateRaw = fs.readFileSync(path.join(library, 'templates', templateFile), 'utf8');
  assert.equal(JSON.parse(templateRaw).__aurenEncrypted, 1, 'template file is encrypted');

  const decrypted = await win.evaluate(async (docId) => {
    const doc = await window.auren.library.get(docId);
    const versions = await window.auren.library.versions(docId);
    const version = await window.auren.library.version(docId, versions[0].id);
    const draft = await window.auren.library.draft(docId);
    return { html: doc.html, versionHtml: version.html, draftHtml: draft?.html };
  }, id);
  assert.match(decrypted.html, /Private heading/);
  assert.match(decrypted.versionHtml, /Private heading/);
  assert.match(decrypted.draftHtml, /Private heading/);
  console.log('IN-SESSION DECRYPT OK');

  await app.close();
  ({ app } = await launch());
  win = await app.firstWindow();
  const afterRestart = await win.evaluate(async (docId) => {
    const settings = await window.auren.settings.get();
    const doc = await window.auren.library.get(docId);
    return { encrypted: settings.encryptedStorage, html: doc.html };
  }, id);
  assert.equal(afterRestart.encrypted, true);
  assert.match(afterRestart.html, /Private heading/);
  console.log('RESTART DECRYPT OK');

  const disabled = await win.evaluate(() => window.auren.settings.update({ encryptedStorage: false }));
  assert.equal(disabled.encryptedStorage, false);
  const plainAgain = readDocFile(id);
  assert.ok(plainAgain.includes('Private heading'), 'document returns to plaintext');
  assert.ok(!plainAgain.includes('__aurenEncrypted'), 'no envelope after disabling');
  console.log('DISABLE MIGRATION OK');

  console.log('ENCRYPTION TEST PASSED');
} finally {
  try { await app?.close(); } catch { /* ignore */ }
  fs.rmSync(root, { recursive: true, force: true });
}
