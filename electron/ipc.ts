import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import {
  app,
  BrowserWindow,
  clipboard,
  dialog,
  ipcMain,
  nativeTheme,
  shell
} from 'electron';
import type { AurenSettings, ExportFormat, ExportOptions, PageSettings } from '../shared/types';
import { DEFAULT_PAGE_SETTINGS } from '../shared/types';
import type { ConversionPreview, CreateDocumentPayload, SaveDocumentPayload, TemplateSavePayload } from '../shared/api';
import { Library, wordStats } from './library';
import { SettingsStore } from './settings';
import { SpellService } from './spell';
import { AIService } from './ai';
import { importDocx } from './formats/docx-import';
import { exportDocx } from './formats/docx-export';
import { importDoc, importPdf } from './formats/legacy';
import { importOdt, exportOdt } from './formats/odt';
import {
  exportMarkdown,
  exportRtf,
  exportStandaloneHtml,
  htmlToPlainText,
  importHtml,
  importMarkdown,
  importRtf,
  importTxt,
  sanitizeHtmlBasic
} from './formats/markup';
import { exportPdf } from './formats/printing';

interface IpcContext {
  getLibrary: () => Library;
  setLibrary: (lib: Library) => void;
  getDataRoot: () => string;
  getWindow: () => BrowserWindow | null;
  settings: SettingsStore;
  spell: SpellService;
  ai: AIService;
}

const IMPORT_EXTENSIONS = ['.docx', '.doc', '.odt', '.rtf', '.txt', '.md', '.markdown', '.html', '.htm', '.pdf', '.auren'];

function safeName(title: string): string {
  return (title || 'Untitled')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '')
    .replace(/[. ]+$/g, '')
    .slice(0, 82) || 'Untitled';
}

function extOf(file: string) { return path.extname(file).toLowerCase(); }

function libraryOptions(settings: SettingsStore) {
  const encrypted = settings.get().encryptedStorage;
  return { encrypted, key: settings.libraryKey(encrypted) };
}

function defaultPdfOptions(): NonNullable<ExportOptions['pdf']> {
  return {
    range: 'all', fromPage: 1, toPage: 1,
    includeBackground: true, includeHeaderFooter: true, includePageNumbers: true,
    quality: 'high'
  };
}

function sanitizePageSettings(value: PageSettings | undefined): PageSettings {
  if (!value) return { ...DEFAULT_PAGE_SETTINGS };
  return {
    ...DEFAULT_PAGE_SETTINGS,
    ...value,
    marginTop: Math.max(0, Math.min(100, value.marginTop)),
    marginRight: Math.max(0, Math.min(100, value.marginRight)),
    marginBottom: Math.max(0, Math.min(100, value.marginBottom)),
    marginLeft: Math.max(0, Math.min(100, value.marginLeft)),
    widthMm: Math.max(50, Math.min(2000, value.widthMm)),
    heightMm: Math.max(50, Math.min(2000, value.heightMm)),
    columns: Math.max(1, Math.min(3, value.columns || 1))
  };
}

function copyDirectory(source: string, destination: string) {
  fs.mkdirSync(destination, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const from = path.join(source, entry.name);
    const to = path.join(destination, entry.name);
    if (entry.isDirectory()) copyDirectory(from, to);
    else if (entry.isFile()) fs.copyFileSync(from, to);
  }
}

function isSubPath(parent: string, child: string): boolean {
  const relative = path.relative(parent, child);
  return Boolean(relative) && !relative.startsWith('..') && !path.isAbsolute(relative);
}

function directoryEmpty(dir: string): boolean {
  try {
    return fs.readdirSync(dir).filter((f) => f !== 'desktop.ini' && f !== '.DS_Store').length === 0;
  } catch {
    return true;
  }
}

async function conversionPreview(filePath: string): Promise<ConversionPreview> {
  const stat = fs.statSync(filePath);
  if (!stat.isFile()) throw new Error('The selected path is not a file.');
  if (stat.size > 250 * 1024 * 1024) throw new Error('This file is larger than the 250 MB import limit.');
  const ext = extOf(filePath);
  if (!IMPORT_EXTENSIONS.includes(ext)) throw new Error(`Unsupported file type "${ext || 'unknown'}".`);
  const buffer = fs.readFileSync(filePath);
  const fileName = path.basename(filePath);
  const fallbackTitle = path.basename(filePath, ext).replace(/[_-]+/g, ' ').trim() || 'Imported document';
  let html = '<p></p>';
  let warnings: string[] = [];
  let title = '';
  let pageSettings: PageSettings | undefined;
  let content: unknown | undefined;
  switch (ext) {
    case '.docx': {
      const result = await importDocx(buffer);
      html = result.html; warnings = result.warnings; title = result.title; pageSettings = result.pageSettings;
      break;
    }
    case '.doc': {
      const result = await importDoc(buffer);
      html = result.html; warnings = result.warnings;
      break;
    }
    case '.odt': {
      const result = await importOdt(buffer);
      html = result.html; warnings = result.warnings; title = result.title || ''; pageSettings = result.pageSettings;
      break;
    }
    case '.rtf': {
      const result = importRtf(buffer);
      html = result.html; warnings = result.warnings;
      break;
    }
    case '.txt': {
      const result = importTxt(buffer);
      html = result.html; warnings = result.warnings;
      break;
    }
    case '.md':
    case '.markdown': {
      const result = importMarkdown(buffer, filePath);
      html = result.html; warnings = result.warnings; title = result.title || '';
      break;
    }
    case '.html':
    case '.htm': {
      const result = importHtml(buffer, filePath);
      html = result.html; warnings = result.warnings; title = result.title || '';
      break;
    }
    case '.pdf': {
      const result = await importPdf(buffer);
      html = result.html; warnings = result.warnings;
      break;
    }
    case '.auren': {
      const parsed = JSON.parse(buffer.toString('utf8'));
      if (!parsed || typeof parsed.html !== 'string') throw new Error('This is not a valid AUREN document.');
      html = parsed.html;
      content = parsed.content ?? undefined;
      title = String(parsed.title || '');
      pageSettings = parsed.pageSettings ? sanitizePageSettings(parsed.pageSettings) : undefined;
      warnings = ['AUREN document imported. Formatting and page setup were preserved.'];
      break;
    }
    default:
      throw new Error('Unsupported file type.');
  }
  return {
    html: sanitizeHtmlBasic(html),
    warnings,
    title: title || undefined,
    pageSettings: pageSettings ? sanitizePageSettings(pageSettings) : undefined,
    content,
    sourceFormat: ext.replace('.', '').toUpperCase(),
    fileName,
    suggestedTitle: (title || fallbackTitle).slice(0, 180)
  };
}

function exportFilter(format: ExportFormat): Electron.FileFilter {
  const map: Record<ExportFormat, Electron.FileFilter> = {
    docx: { name: 'Microsoft Word Document', extensions: ['docx'] },
    pdf: { name: 'PDF Document', extensions: ['pdf'] },
    odt: { name: 'OpenDocument Text', extensions: ['odt'] },
    html: { name: 'Web Page', extensions: ['html'] },
    md: { name: 'Markdown', extensions: ['md'] },
    txt: { name: 'Plain Text', extensions: ['txt'] },
    rtf: { name: 'Rich Text Format', extensions: ['rtf'] },
    auren: { name: 'AUREN Document', extensions: ['auren'] }
  };
  return map[format];
}

export function registerIpc(context: IpcContext) {
  const { settings, spell, ai } = context;

  ipcMain.handle('app:info', () => ({
    version: app.getVersion(),
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
    platform: `${process.platform} ${process.arch}`,
    dataRoot: context.getDataRoot(),
    packaged: app.isPackaged,
    encryptionAvailable: settings.encryptionAvailable()
  }));

  ipcMain.on('window:minimize', () => context.getWindow()?.minimize());
  ipcMain.on('window:toggle-maximize', () => {
    const win = context.getWindow();
    if (!win) return;
    if (win.isMaximized()) win.unmaximize();
    else win.maximize();
  });
  ipcMain.on('window:close', () => context.getWindow()?.close());
  ipcMain.handle('window:is-maximized', () => context.getWindow()?.isMaximized() || false);
  ipcMain.handle('app:open-external', async (_e, url: string) => {
    if (!/^(https?:|mailto:)/i.test(url)) return false;
    await shell.openExternal(url);
    return true;
  });
  ipcMain.on('app:show-item', (_e, itemPath: string) => {
    if (itemPath) shell.showItemInFolder(itemPath);
  });
  ipcMain.handle('app:open-path', async (_e, itemPath: string) => {
    if (!itemPath) return 'No path provided.';
    return shell.openPath(itemPath);
  });
  ipcMain.on('app:flush-done', () => {
    const win = context.getWindow();
    if (win) (win as BrowserWindow & { __aurenFlushAck?: boolean }).__aurenFlushAck = true;
    app.emit('auren:flush-done');
  });
  ipcMain.handle('clipboard:write', (_e, text: string) => { clipboard.writeText(String(text ?? '')); });
  ipcMain.handle('app:install-update', async () => {
    const win = context.getWindow();
    const result = win
      ? await dialog.showOpenDialog(win, { title: 'Install AUREN update', filters: [{ name: 'AUREN Installer', extensions: ['exe'] }], properties: ['openFile'] })
      : await dialog.showOpenDialog({ title: 'Install AUREN update', filters: [{ name: 'AUREN Installer', extensions: ['exe'] }], properties: ['openFile'] });
    if (result.canceled || !result.filePaths[0]) return { launched: false, message: 'No installer selected.' };
    const installer = result.filePaths[0];
    if (!path.basename(installer).toLowerCase().includes('auren')) {
      return { launched: false, message: 'The selected file does not look like an AUREN installer.' };
    }
    const response = await dialog.showMessageBox(win || undefined as unknown as BrowserWindow, {
      type: 'question', buttons: ['Install update', 'Cancel'], defaultId: 1, cancelId: 1,
      title: 'Install AUREN update',
      message: 'AUREN will close while the installer runs.',
      detail: path.basename(installer)
    });
    if (response.response !== 0) return { launched: false, message: 'Update cancelled.' };
    const child = spawn(installer, [], { detached: true, stdio: 'ignore' });
    child.unref();
    setTimeout(() => app.quit(), 600);
    return { launched: true, message: 'Installer launched.' };
  });

  /* -------------------------------------------------------------- library */
  ipcMain.handle('library:list', (_e, filter) => context.getLibrary().list(filter));
  ipcMain.handle('library:get', (_e, id: string) => context.getLibrary().get(id));
  ipcMain.handle('library:create', (_e, payload: CreateDocumentPayload) => context.getLibrary().create({
    title: payload.title || 'Untitled document',
    html: payload.html,
    content: payload.content,
    pageSettings: sanitizePageSettings(payload.pageSettings),
    workspaceId: payload.workspaceId || null,
    folder: payload.folder || null,
    importedFrom: payload.importedFrom || null
  }));
  ipcMain.handle('library:save', (_e, id: string, payload: SaveDocumentPayload) => {
    if (!id) throw new Error('Missing document identifier.');
    if (typeof payload.html !== 'string') throw new Error('Invalid document payload.');
    return context.getLibrary().save(id, {
      title: payload.title,
      content: payload.content,
      html: payload.html,
      wordCount: Math.max(0, Number(payload.wordCount) || 0),
      charCount: Math.max(0, Number(payload.charCount) || 0),
      excerpt: String(payload.excerpt || ''),
      searchText: payload.searchText,
      pageSettings: payload.pageSettings ? sanitizePageSettings(payload.pageSettings) : undefined,
      activity: Boolean(payload.activity)
    });
  });
  ipcMain.handle('library:rename', (_e, id: string, title: string) => context.getLibrary().rename(id, String(title || '').slice(0, 240)));
  ipcMain.handle('library:duplicate', (_e, id: string) => context.getLibrary().duplicate(id));
  ipcMain.handle('library:trash', (_e, id: string) => context.getLibrary().trash(id));
  ipcMain.handle('library:restore', (_e, id: string) => context.getLibrary().restore(id));
  ipcMain.handle('library:purge', (_e, id: string) => context.getLibrary().purge(id));
  ipcMain.handle('library:empty-trash', () => context.getLibrary().emptyTrash());
  ipcMain.handle('library:update-meta', (_e, id: string, patch) => {
    const safePatch: Record<string, unknown> = {};
    if (patch && typeof patch === 'object') {
      if ('favorite' in patch) safePatch.favorite = Boolean(patch.favorite);
      if ('workspaceId' in patch) safePatch.workspaceId = patch.workspaceId ? String(patch.workspaceId) : null;
      if ('folder' in patch) safePatch.folder = patch.folder ? String(patch.folder).slice(0, 120) : null;
      if ('pageSettings' in patch) safePatch.pageSettings = sanitizePageSettings(patch.pageSettings);
    }
    return context.getLibrary().updateMeta(id, safePatch);
  });
  ipcMain.handle('library:search', (_e, query: string) => context.getLibrary().search(String(query || '')));
  ipcMain.handle('library:versions', (_e, id: string) => context.getLibrary().listVersions(id));
  ipcMain.handle('library:version', (_e, id: string, versionId: string) => context.getLibrary().getVersion(id, versionId));
  ipcMain.handle('library:create-version', (_e, id: string, label: string) => context.getLibrary().createVersion(id, String(label || ''), 'manual'));
  ipcMain.handle('library:restore-version', (_e, id: string, versionId: string) => context.getLibrary().restoreVersion(id, versionId));
  ipcMain.handle('library:drafts', () => context.getLibrary().listDrafts());
  ipcMain.handle('library:recovery', () => context.getLibrary().recoveryCandidates());
  ipcMain.handle('library:draft', (_e, id: string) => context.getLibrary().getDraft(id));
  ipcMain.handle('library:save-draft', (_e, id: string, payload) => context.getLibrary().saveDraft(id, payload));
  ipcMain.handle('library:clear-draft', (_e, id: string) => context.getLibrary().clearDraft(id));
  ipcMain.handle('library:workspaces', () => context.getLibrary().workspaces());
  ipcMain.handle('library:create-workspace', (_e, name: string, color: string, description?: string) => context.getLibrary().createWorkspace(name, color, description || ''));
  ipcMain.handle('library:update-workspace', (_e, id: string, patch) => context.getLibrary().updateWorkspace(id, patch || {}));
  ipcMain.handle('library:delete-workspace', (_e, id: string) => context.getLibrary().deleteWorkspace(id));
  ipcMain.handle('library:folders', () => context.getLibrary().folders());
  ipcMain.handle('library:stats', () => context.getLibrary().stats());
  ipcMain.handle('library:activity', (_e, limit?: number) => context.getLibrary().activity(limit || 30));
  ipcMain.handle('library:list-templates', () => context.getLibrary().listTemplates());
  ipcMain.handle('library:save-template', (_e, payload: TemplateSavePayload) => context.getLibrary().saveTemplate({
    ...payload,
    pageSettings: sanitizePageSettings(payload.pageSettings)
  }));
  ipcMain.handle('library:get-template', (_e, id: string) => context.getLibrary().getTemplate(id));
  ipcMain.handle('library:delete-template', (_e, id: string) => context.getLibrary().deleteTemplate(id));

  /* ---------------------------------------------------------------- files */
  ipcMain.handle('files:pick-import', async () => {
    const win = context.getWindow();
    const options: Electron.OpenDialogOptions = {
      title: 'Import document',
      properties: ['openFile'],
      filters: [
        { name: 'Documents', extensions: ['docx', 'doc', 'odt', 'rtf', 'txt', 'md', 'markdown', 'html', 'htm', 'pdf', 'auren'] },
        { name: 'All files', extensions: ['*'] }
      ]
    };
    const result = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options);
    return result.canceled ? null : result.filePaths[0] || null;
  });
  ipcMain.handle('files:import-preview', (_e, filePath: string) => conversionPreview(String(filePath)));
  ipcMain.handle('files:pick-folder', async (_e, title?: string) => {
    const win = context.getWindow();
    const options: Electron.OpenDialogOptions = { title: title || 'Choose folder', properties: ['openDirectory', 'createDirectory'] };
    const result = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options);
    return result.canceled ? null : result.filePaths[0] || null;
  });
  ipcMain.handle('files:export', async (_e, id: string, format: ExportFormat, options?: ExportOptions) => {
    const library = context.getLibrary();
    const doc = library.get(id, false);
    if (!doc) throw new Error('Document not found.');
    if (!exportFilter(format)) throw new Error('Unknown export format.');
    const ext = format;
    const win = context.getWindow();
    const saveOptions: Electron.SaveDialogOptions = {
      title: `Export ${format.toUpperCase()}`,
      defaultPath: `${safeName(doc.meta.title)}.${ext}`,
      filters: [exportFilter(format)]
    };
    const saveResult = win ? await dialog.showSaveDialog(win, saveOptions) : await dialog.showSaveDialog(saveOptions);
    if (saveResult.canceled || !saveResult.filePath) return { canceled: true };
    const target = saveResult.filePath;
    const warnings = new Set<string>();
    let buffer: Buffer;
    const pageSettings = sanitizePageSettings(doc.meta.pageSettings);
    const needsContent = ['docx', 'odt', 'rtf', 'auren'].includes(format);
    if (needsContent && !doc.content) {
      throw new Error('Open and save this document once in the editor before exporting to this format.');
    }
    switch (format) {
      case 'docx': {
        const result = await exportDocx({
          title: doc.meta.title,
          content: doc.content as never,
          pageSettings,
          defaultFont: settings.get().defaultFont,
          defaultFontSize: settings.get().defaultFontSize,
          createdAt: doc.meta.createdAt,
          updatedAt: doc.meta.updatedAt
        });
        buffer = result.buffer;
        result.warnings.forEach((w) => warnings.add(w));
        break;
      }
      case 'pdf': {
        const pdfOptions = { ...defaultPdfOptions(), ...(options?.pdf || {}) };
        const result = await exportPdf({ title: doc.meta.title, html: doc.html, pageSettings, options: pdfOptions });
        buffer = result.buffer;
        result.warnings.filter((w) => !w.startsWith('Standard quality')).forEach((w) => warnings.add(w));
        warnings.add(`Exported ${result.pages} page${result.pages === 1 ? '' : 's'}.`);
        break;
      }
      case 'odt': {
        const result = await exportOdt(doc.content as never, doc.meta.title, pageSettings, settings.get().defaultFont);
        buffer = result.buffer;
        result.warnings.forEach((w) => warnings.add(w));
        break;
      }
      case 'html': {
        buffer = Buffer.from(exportStandaloneHtml(doc.meta.title, doc.html, pageSettings), 'utf8');
        break;
      }
      case 'md': {
        buffer = Buffer.from(exportMarkdown(doc.html), 'utf8');
        break;
      }
      case 'txt': {
        buffer = Buffer.from(htmlToPlainText(doc.html) + '\n', 'utf8');
        break;
      }
      case 'rtf': {
        const result = exportRtf(doc.content as never, doc.meta.title);
        buffer = result.buffer;
        result.warnings.forEach((w) => warnings.add(w));
        break;
      }
      case 'auren': {
        buffer = Buffer.from(JSON.stringify({
          format: 'auren-document',
          version: 1,
          title: doc.meta.title,
          pageSettings,
          html: doc.html,
          content: doc.content,
          createdAt: doc.meta.createdAt,
          updatedAt: doc.meta.updatedAt,
          generator: 'AUREN 1.0'
        }, null, 2), 'utf8');
        break;
      }
      default:
        throw new Error('Unsupported export format.');
    }
    if (!buffer || buffer.length === 0) throw new Error('The export produced an empty file.');
    fs.writeFileSync(target, buffer);
    library.addActivity(id, 'exported', `${doc.meta.title} → ${format.toUpperCase()}`);
    return { canceled: false, path: target, warnings: [...warnings] };
  });

  /* ------------------------------------------------------------- settings */
  ipcMain.handle('settings:get', () => settings.get());
  ipcMain.handle('settings:update', (_e, patch: Partial<AurenSettings>) => {
    const safe: Partial<AurenSettings> = { ...patch };
    delete (safe as Record<string, unknown>).dataRoot;
    delete (safe as Record<string, unknown>).lastBackupAt;
    const wantsEncryption = typeof patch.encryptedStorage === 'boolean'
      ? patch.encryptedStorage
      : settings.get().encryptedStorage;
    const encryptionChanged = wantsEncryption !== settings.get().encryptedStorage;
    if (encryptionChanged) {
      const library = context.getLibrary();
      if (wantsEncryption) {
        if (!settings.encryptionAvailable()) {
          throw new Error('Windows secure storage is unavailable, so AUREN cannot create a protected library key on this device.');
        }
        const key = settings.libraryKey(true);
        if (!key) throw new Error('AUREN could not create a library encryption key.');
        library.configureEncryption(true, key);
      } else {
        library.configureEncryption(false);
      }
      delete (safe as Record<string, unknown>).encryptedStorage;
    }
    const next = settings.update(encryptionChanged ? { ...safe, encryptedStorage: wantsEncryption } : safe);
    try {
      nativeTheme.themeSource = next.theme === 'paper' ? 'light' : 'dark';
    } catch { /* ignore */ }
    return next;
  });
  ipcMain.handle('settings:secrets', (_e, provider: string) => ({
    configured: settings.hasSecret(provider),
    provider,
    encryptionAvailable: settings.encryptionAvailable()
  }));
  ipcMain.handle('settings:set-secret', (_e, provider: string, key: string) => {
    settings.setSecret(provider, String(key || ''));
    return { configured: settings.hasSecret(provider), provider, encryptionAvailable: settings.encryptionAvailable() };
  });
  ipcMain.handle('settings:clear-secret', (_e, provider: string) => {
    settings.setSecret(provider, '');
    return { configured: false, provider, encryptionAvailable: settings.encryptionAvailable() };
  });
  ipcMain.handle('settings:test-ai', async (_e, provider: string, model: string, baseUrl: string, key?: string) => {
    const keyToUse = key || settings.getSecret(provider);
    if (!keyToUse) return { ok: false, message: 'Enter an API key first.' };
    const testAi = new AIService(() => ({
      provider: provider as AurenSettings['aiProvider'],
      model: model || 'gpt-4o-mini',
      baseUrl: baseUrl || '',
      systemPrompt: ''
    }), () => keyToUse);
    return testAi.test({
      provider: provider as AurenSettings['aiProvider'],
      model: model || 'gpt-4o-mini',
      baseUrl: baseUrl || '',
      systemPrompt: ''
    }, keyToUse);
  });
  ipcMain.handle('settings:change-root', async () => {
    const win = context.getWindow();
    const chooseOptions: Electron.OpenDialogOptions = {
      title: 'Choose a new AUREN library location',
      buttonLabel: 'Use this folder',
      properties: ['openDirectory', 'createDirectory']
    };
    const chosen = win ? await dialog.showOpenDialog(win, chooseOptions) : await dialog.showOpenDialog(chooseOptions);
    if (chosen.canceled || !chosen.filePaths[0]) return { changed: false, root: context.getDataRoot(), warnings: [] };
    const newRoot = path.join(chosen.filePaths[0], 'AUREN Library');
    const oldRoot = context.getDataRoot();
    if (path.resolve(newRoot) === path.resolve(oldRoot)) {
      return { changed: false, root: oldRoot, warnings: ['The selected folder is already the active library location.'] };
    }
    if (isSubPath(oldRoot, newRoot) || isSubPath(newRoot, oldRoot)) {
      return { changed: false, root: oldRoot, warnings: ['Choose a location outside the current library.'] };
    }
    if (fs.existsSync(newRoot) && !directoryEmpty(newRoot)) {
      return { changed: false, root: oldRoot, warnings: ['That destination already contains files. Choose an empty folder to avoid overwriting data.'] };
    }
    const oldLibrary = context.getLibrary();
    let copied = false;
    try {
      fs.mkdirSync(path.dirname(newRoot), { recursive: true });
      oldLibrary.close();
      copyDirectory(oldRoot, newRoot);
      copied = true;
      const next = new Library(newRoot, libraryOptions(settings));
      context.setLibrary(next);
      settings.setDataRoot(newRoot);
      return {
        changed: true,
        root: newRoot,
        warnings: [`Library moved to ${newRoot}. The previous copy remains at ${oldRoot} as a safety backup.`]
      };
    } catch (error) {
      if (copied) {
        try { fs.rmSync(newRoot, { recursive: true, force: true }); } catch { /* ignore */ }
      }
      try {
        context.setLibrary(new Library(oldRoot, libraryOptions(settings)));
      } catch { /* app continues with existing instance if possible */ }
      return { changed: false, root: oldRoot, warnings: [`The library could not be moved: ${error instanceof Error ? error.message : 'unknown error'}`] };
    }
  });
  ipcMain.handle('settings:backup', async () => {
    const win = context.getWindow();
    const date = new Date().toISOString().slice(0, 10);
    const options: Electron.SaveDialogOptions = {
      title: 'Create AUREN library backup',
      defaultPath: `AUREN-Backup-${date}.zip`,
      filters: [{ name: 'AUREN Backup', extensions: ['zip'] }]
    };
    const result = win ? await dialog.showSaveDialog(win, options) : await dialog.showSaveDialog(options);
    if (result.canceled || !result.filePath) return { canceled: true };
    await context.getLibrary().backup(result.filePath);
    settings.update({ lastBackupAt: Date.now() });
    return { canceled: false, path: result.filePath, warnings: [] };
  });

  /* ------------------------------------------------------------------ AI */
  ipcMain.handle('ai:chat', async (event, payload: { requestId: string; messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>; includeDocument: boolean }) => {
    if (!settings.get().aiEnabled) throw new Error('AI is disabled in Settings.');
    if (!payload || typeof payload.requestId !== 'string' || !Array.isArray(payload.messages)) throw new Error('Invalid AI request.');
    if (payload.messages.length === 0) throw new Error('Nothing to send.');
    const total = payload.messages.reduce((sum, m) => sum + (m.content?.length || 0), 0);
    if (total > 220000) throw new Error('The request is too large. Select a shorter section of text.');
    return ai.chat({ requestId: payload.requestId, messages: payload.messages }, event.sender);
  });
  ipcMain.handle('ai:cancel', (_e, requestId: string) => { ai.cancel(requestId); });

  /* --------------------------------------------------------------- spell */
  ipcMain.handle('spell:check', (_e, words: string[], languages: string[]) => {
    const list = Array.isArray(words) ? words.slice(0, 6000).map(String) : [];
    return { unknown: spell.check(list, Array.isArray(languages) ? languages : ['en']) };
  });
  ipcMain.handle('spell:suggest', (_e, word: string, languages: string[]) => spell.suggest(String(word || ''), Array.isArray(languages) ? languages : ['en']));
}
