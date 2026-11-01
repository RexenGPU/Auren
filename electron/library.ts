import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import JSZip from 'jszip';
import type {
  AurenDocument,
  DocumentMeta,
  DocumentSummary,
  LibraryFilter,
  LibraryStats,
  ActivityEntry,
  Version,
  VersionMeta,
  Workspace,
  PageSettings,
  DraftInfo,
  RecoveryCandidate
} from '../shared/types';
import { DEFAULT_PAGE_SETTINGS, DOC_COLORS } from '../shared/types';

interface SavePayload {
  title?: string;
  content: unknown | null;
  html: string;
  wordCount: number;
  charCount: number;
  excerpt: string;
  searchText?: string;
  pageSettings?: PageSettings;
  activity?: boolean;
}

interface CreatePayload {
  title: string;
  html?: string;
  content?: unknown | null;
  pageSettings?: PageSettings;
  workspaceId?: string | null;
  folder?: string | null;
  importedFrom?: string | null;
}

interface LibraryOptions {
  key?: Buffer | null;
  encrypted?: boolean;
}

const ENCRYPTION_AAD = Buffer.from('Auren Library v1');

function now() { return Date.now(); }
function id() { return crypto.randomUUID(); }
function escapeLike(input: string): string {
  return input.replace(/[\\%_]/g, (m) => `\\${m}`);
}
function clampText(input: string, max: number): string {
  return input.length > max ? input.slice(0, max) : input;
}
function hexColorFor(value: string): string {
  let h = 0;
  for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) >>> 0;
  return DOC_COLORS[h % DOC_COLORS.length];
}
function decodeEntities(input: string): string {
  return input
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function plainFromHtml(html: string): string {
  return decodeEntities(html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<\/(p|h[1-6]|li|tr|div|blockquote)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim());
}

function excerptFromHtml(html: string): string {
  const text = decodeEntities(html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<\/(p|h[1-6]|li|tr|div|blockquote)>/gi, ' · ')
    .replace(/<br\s*\/?>/gi, ' · ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/(\s*·\s*)+/g, ' · ')
    .replace(/\s+/g, ' ')
    .trim());
  return clampText(text, 220);
}

function safePageSettings(raw: unknown): PageSettings {
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return { ...DEFAULT_PAGE_SETTINGS, ...(parsed as object) };
  } catch {
    return { ...DEFAULT_PAGE_SETTINGS };
  }
}

function toSummary(meta: DocumentMeta): DocumentSummary {
  return {
    ...meta,
    pageSettings: safePageSettings(meta.pageSettings),
    readTimeMinutes: Math.max(1, Math.ceil(meta.wordCount / 230))
  };
}

export class Library {
  readonly root: string;
  private db: DatabaseSync;
  private encryptionKey: Buffer | null;
  private encrypted: boolean;

  constructor(root: string, options: LibraryOptions = {}) {
    this.root = root;
    this.encryptionKey = options.key && options.key.length === 32 ? Buffer.from(options.key) : null;
    this.encrypted = Boolean(options.encrypted);
    if (this.encrypted && !this.encryptionKey) {
      throw new Error('The library is encrypted, but its key is unavailable.');
    }
    fs.mkdirSync(root, { recursive: true });
    fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
    fs.mkdirSync(path.join(root, 'versions'), { recursive: true });
    fs.mkdirSync(path.join(root, 'drafts'), { recursive: true });
    fs.mkdirSync(path.join(root, 'templates'), { recursive: true });
    this.db = this.openDatabase();
    this.migrate();
    this.reconcile();
    this.cleanupDrafts();
  }

  isEncrypted(): boolean {
    return this.encrypted;
  }

  private decodeFile(raw: string): unknown {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      throw new Error('A library file is not valid JSON.');
    }
    if (parsed && parsed.__aurenEncrypted === 1) {
      if (!this.encryptionKey) {
        throw new Error('This library is encrypted. Its key is stored in your Windows user profile and is not available here.');
      }
      if (parsed.alg !== 'aes-256-gcm' || typeof parsed.iv !== 'string' || typeof parsed.tag !== 'string' || typeof parsed.data !== 'string') {
        throw new Error('A library file uses an unsupported encryption envelope.');
      }
      try {
        const decipher = crypto.createDecipheriv('aes-256-gcm', this.encryptionKey, Buffer.from(parsed.iv, 'base64'));
        decipher.setAAD(ENCRYPTION_AAD);
        decipher.setAuthTag(Buffer.from(parsed.tag, 'base64'));
        const plain = Buffer.concat([
          decipher.update(Buffer.from(parsed.data, 'base64')),
          decipher.final()
        ]).toString('utf8');
        return JSON.parse(plain);
      } catch {
        throw new Error('A library file could not be decrypted. The key may have changed.');
      }
    }
    return parsed;
  }

  private encodeFile(value: unknown): string {
    const plain = JSON.stringify(value);
    if (!this.encrypted) return plain;
    if (!this.encryptionKey) throw new Error('The library encryption key is unavailable.');
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    cipher.setAAD(ENCRYPTION_AAD);
    const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    return JSON.stringify({
      __aurenEncrypted: 1,
      alg: 'aes-256-gcm',
      iv: iv.toString('base64'),
      tag: cipher.getAuthTag().toString('base64'),
      data: data.toString('base64')
    });
  }

  private readJson<T>(file: string): T {
    return this.decodeFile(fs.readFileSync(file, 'utf8')) as T;
  }

  private writeJson(file: string, value: unknown) {
    this.writeAtomic(file, this.encodeFile(value));
  }

  configureEncryption(enabled: boolean, key?: Buffer | null): boolean {
    if (key) {
      if (key.length !== 32) throw new Error('The library encryption key must be 32 bytes.');
      this.encryptionKey = Buffer.from(key);
    }
    if (enabled && !this.encryptionKey) throw new Error('The library encryption key is unavailable.');
    if (enabled === this.encrypted) return this.encrypted;
    const previous = this.encrypted;
    this.encrypted = enabled;
    try {
      this.rewriteAllFiles();
    } catch (error) {
      this.encrypted = previous;
      throw error;
    }
    return this.encrypted;
  }

  private rewriteAllFiles() {
    const visit = (file: string) => {
      if (!fs.existsSync(file)) return;
      const value = this.readJson(file);
      this.writeJson(file, value);
    };
    const docs = path.join(this.root, 'docs');
    for (const file of fs.readdirSync(docs)) if (file.endsWith('.json')) visit(path.join(docs, file));
    const versions = path.join(this.root, 'versions');
    for (const entry of fs.readdirSync(versions, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const dir = path.join(versions, entry.name);
      for (const file of fs.readdirSync(dir)) if (file.endsWith('.json')) visit(path.join(dir, file));
    }
    const drafts = path.join(this.root, 'drafts');
    for (const file of fs.readdirSync(drafts)) if (file.endsWith('.json')) visit(path.join(drafts, file));
    const templates = path.join(this.root, 'templates');
    for (const file of fs.readdirSync(templates)) if (file.endsWith('.json')) visit(path.join(templates, file));
  }

  private openDatabase(): DatabaseSync {
    const dbPath = path.join(this.root, 'library.db');
    try {
      const db = new DatabaseSync(dbPath);
      db.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL; PRAGMA foreign_keys = ON;');
      db.exec('SELECT 1 FROM sqlite_master LIMIT 1;');
      return db;
    } catch (error) {
      const stamp = Date.now();
      try { fs.renameSync(dbPath, `${dbPath}.corrupt-${stamp}`); } catch { /* ignore */ }
      const db = new DatabaseSync(dbPath);
      db.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL;');
      return db;
    }
  }

  private migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        opened_at INTEGER NOT NULL,
        favorite INTEGER NOT NULL DEFAULT 0,
        workspace_id TEXT,
        folder TEXT,
        trashed_at INTEGER,
        word_count INTEGER NOT NULL DEFAULT 0,
        char_count INTEGER NOT NULL DEFAULT 0,
        excerpt TEXT NOT NULL DEFAULT '',
        search_text TEXT NOT NULL DEFAULT '',
        page_settings TEXT NOT NULL,
        imported_from TEXT,
        color TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_documents_updated ON documents(updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_documents_trashed ON documents(trashed_at);
      CREATE TABLE IF NOT EXISTS versions (
        id TEXT PRIMARY KEY,
        document_id TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        label TEXT NOT NULL,
        reason TEXT NOT NULL,
        word_count INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_versions_doc ON versions(document_id, created_at DESC);
      CREATE TABLE IF NOT EXISTS workspaces (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        color TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS activity (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        document_id TEXT,
        type TEXT NOT NULL,
        detail TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_activity_time ON activity(created_at DESC);
      CREATE TABLE IF NOT EXISTS templates (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        category TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
  }

  private reconcile() {
    const docsDir = path.join(this.root, 'docs');
    const files = fs.readdirSync(docsDir).filter((f) => f.endsWith('.json'));
    const seen = new Set<string>();
    for (const file of files) {
      const filePath = path.join(docsDir, file);
      try {
        const doc = this.readJson<AurenDocument>(filePath);
        if (!doc?.meta?.id) continue;
        seen.add(doc.meta.id);
        const existing = this.db.prepare('SELECT updated_at FROM documents WHERE id = ?').get(doc.meta.id) as { updated_at?: number } | undefined;
        if (!existing || (existing.updated_at || 0) < doc.meta.updatedAt) {
          this.upsertMeta(doc.meta, plainFromHtml(doc.html || ''));
        }
      } catch {
        // A malformed individual file must never block the library from opening.
      }
    }
    const rows = this.db.prepare('SELECT id FROM documents').all() as Array<{ id: string }>;
    for (const row of rows) {
      if (!seen.has(row.id)) {
        const docPath = this.docPath(row.id);
        if (!fs.existsSync(docPath)) {
          this.db.prepare('DELETE FROM documents WHERE id = ?').run(row.id);
          this.db.prepare('DELETE FROM versions WHERE document_id = ?').run(row.id);
        }
      }
    }
  }

  private docPath(documentId: string) {
    return path.join(this.root, 'docs', `${documentId}.json`);
  }

  private versionDir(documentId: string) {
    return path.join(this.root, 'versions', documentId);
  }

  private draftPath(documentId: string) {
    return path.join(this.root, 'drafts', `${documentId}.json`);
  }

  private writeAtomic(file: string, data: string | Buffer) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = `${file}.tmp-${process.pid}-${Date.now()}`;
    fs.writeFileSync(tmp, data);
    fs.renameSync(tmp, file);
  }

  private upsertMeta(meta: DocumentMeta, searchText: string) {
    this.db.prepare(`
      INSERT INTO documents (id,title,created_at,updated_at,opened_at,favorite,workspace_id,folder,trashed_at,word_count,char_count,excerpt,search_text,page_settings,imported_from,color)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET
        title=excluded.title, updated_at=excluded.updated_at, opened_at=excluded.opened_at,
        favorite=excluded.favorite, workspace_id=excluded.workspace_id, folder=excluded.folder,
        trashed_at=excluded.trashed_at, word_count=excluded.word_count, char_count=excluded.char_count,
        excerpt=excluded.excerpt, search_text=excluded.search_text, page_settings=excluded.page_settings,
        imported_from=excluded.imported_from, color=excluded.color
    `).run(
      meta.id, meta.title, meta.createdAt, meta.updatedAt, meta.openedAt,
      meta.favorite ? 1 : 0, meta.workspaceId, meta.folder, meta.trashedAt,
      meta.wordCount, meta.charCount, meta.excerpt, clampText(searchText, 120000),
      JSON.stringify(meta.pageSettings), meta.importedFrom, meta.color
    );
  }

  private rowToMeta(row: Record<string, unknown>): DocumentMeta {
    return {
      id: String(row.id),
      title: String(row.title),
      createdAt: Number(row.created_at),
      updatedAt: Number(row.updated_at),
      openedAt: Number(row.opened_at),
      favorite: Boolean(row.favorite),
      workspaceId: row.workspace_id ? String(row.workspace_id) : null,
      folder: row.folder ? String(row.folder) : null,
      trashedAt: row.trashed_at == null ? null : Number(row.trashed_at),
      wordCount: Number(row.word_count),
      charCount: Number(row.char_count),
      excerpt: String(row.excerpt || ''),
      pageSettings: safePageSettings(row.page_settings),
      importedFrom: row.imported_from ? String(row.imported_from) : null,
      color: String(row.color || DOC_COLORS[0])
    };
  }

  list(filter: LibraryFilter = {}): DocumentSummary[] {
    const clauses: string[] = [];
    const params: Array<string | number> = [];
    const view = filter.view || 'documents';
    if (view === 'trash') clauses.push('trashed_at IS NOT NULL');
    else clauses.push('trashed_at IS NULL');
    if (view === 'favorites') clauses.push('favorite = 1');
    if (filter.workspaceId) { clauses.push('workspace_id = ?'); params.push(filter.workspaceId); }
    if (filter.folder) { clauses.push('folder = ?'); params.push(filter.folder); }
    if (filter.search?.trim()) {
      clauses.push("(title LIKE ? ESCAPE '\\' OR search_text LIKE ? ESCAPE '\\')");
      const like = `%${escapeLike(filter.search.trim())}%`;
      params.push(like, like);
    }
    const sortMap: Record<string, string> = {
      updated: 'updated_at', created: 'created_at', title: 'title COLLATE NOCASE', opened: 'opened_at'
    };
    const sort = sortMap[filter.sort || (view === 'recent' ? 'opened' : 'updated')] || 'updated_at';
    const dir = filter.direction === 'asc' ? 'ASC' : 'DESC';
    const sql = `SELECT * FROM documents WHERE ${clauses.join(' AND ')} ORDER BY ${sort} ${dir}`;
    const rows = this.db.prepare(sql).all(...params) as Array<Record<string, unknown>>;
    return rows.map((row) => toSummary(this.rowToMeta(row)));
  }

  get(documentId: string, touch = true): AurenDocument {
    const doc = this.readJson<AurenDocument>(this.docPath(documentId));
    doc.meta.pageSettings = safePageSettings(doc.meta.pageSettings);
    if (touch) {
      doc.meta.openedAt = now();
      this.writeJson(this.docPath(documentId), doc);
      this.db.prepare('UPDATE documents SET opened_at = ? WHERE id = ?').run(doc.meta.openedAt, documentId);
    }
    return doc;
  }

  exists(documentId: string): boolean {
    return fs.existsSync(this.docPath(documentId));
  }

  create(payload: CreatePayload): AurenDocument {
    const stamp = now();
    const documentId = id();
    const pageSettings = safePageSettings(payload.pageSettings || DEFAULT_PAGE_SETTINGS);
    const html = payload.html || '<p></p>';
    const excerpt = excerptFromHtml(html);
    const meta: DocumentMeta = {
      id: documentId,
      title: payload.title || 'Untitled document',
      createdAt: stamp,
      updatedAt: stamp,
      openedAt: stamp,
      favorite: false,
      workspaceId: payload.workspaceId || null,
      folder: payload.folder || null,
      trashedAt: null,
      wordCount: countWords(plainFromHtml(html)),
      charCount: plainFromHtml(html).length,
      excerpt,
      pageSettings,
      importedFrom: payload.importedFrom || null,
      color: hexColorFor(documentId)
    };
    const doc: AurenDocument = { meta, content: payload.content ?? null, html, savedAt: stamp };
    this.writeJson(this.docPath(documentId), doc);
    this.upsertMeta(meta, plainFromHtml(html));
    this.addActivity(documentId, 'created', meta.title);
    return doc;
  }

  save(documentId: string, payload: SavePayload): AurenDocument {
    const current = this.get(documentId, false);
    const stamp = now();
    const meta: DocumentMeta = {
      ...current.meta,
      title: payload.title?.trim() || current.meta.title,
      updatedAt: stamp,
      wordCount: payload.wordCount,
      charCount: payload.charCount,
      excerpt: clampText(payload.excerpt.replace(/\s+/g, ' ').trim(), 220),
      pageSettings: safePageSettings(payload.pageSettings || current.meta.pageSettings)
    };
    const doc: AurenDocument = {
      meta,
      content: payload.content,
      html: payload.html,
      savedAt: stamp
    };
    this.writeJson(this.docPath(documentId), doc);
    this.upsertMeta(meta, payload.searchText || plainFromHtml(payload.html));
    if (payload.activity) this.addActivity(documentId, 'saved', meta.title);
    try { fs.rmSync(this.draftPath(documentId), { force: true }); } catch { /* ignore */ }
    return doc;
  }

  rename(documentId: string, title: string) {
    const doc = this.get(documentId, false);
    doc.meta.title = title.trim() || doc.meta.title;
    doc.meta.updatedAt = now();
    this.writeJson(this.docPath(documentId), doc);
    this.upsertMeta(doc.meta, plainFromHtml(doc.html));
    return doc.meta;
  }

  updateMeta(documentId: string, patch: Partial<Pick<DocumentMeta, 'favorite' | 'workspaceId' | 'folder' | 'pageSettings'>>) {
    const doc = this.get(documentId, false);
    doc.meta = { ...doc.meta, ...patch };
    if (patch.pageSettings) doc.meta.pageSettings = safePageSettings(patch.pageSettings);
    doc.meta.updatedAt = now();
    this.writeJson(this.docPath(documentId), doc);
    this.upsertMeta(doc.meta, plainFromHtml(doc.html));
    return doc.meta;
  }

  duplicate(documentId: string): AurenDocument {
    const source = this.get(documentId, false);
    return this.create({
      title: `${source.meta.title} — copy`,
      html: source.html,
      content: source.content,
      pageSettings: source.meta.pageSettings,
      workspaceId: source.meta.workspaceId,
      folder: source.meta.folder
    });
  }

  trash(documentId: string) {
    const stamp = now();
    this.db.prepare('UPDATE documents SET trashed_at = ?, updated_at = ? WHERE id = ?').run(stamp, stamp, documentId);
    const doc = this.get(documentId, false);
    this.addActivity(documentId, 'deleted', doc.meta.title);
  }

  restore(documentId: string) {
    this.db.prepare('UPDATE documents SET trashed_at = NULL, updated_at = ? WHERE id = ?').run(now(), documentId);
  }

  purge(documentId: string) {
    try { fs.rmSync(this.docPath(documentId), { force: true }); } catch { /* ignore */ }
    try { fs.rmSync(this.versionDir(documentId), { recursive: true, force: true }); } catch { /* ignore */ }
    try { fs.rmSync(this.draftPath(documentId), { force: true }); } catch { /* ignore */ }
    this.db.prepare('DELETE FROM versions WHERE document_id = ?').run(documentId);
    this.db.prepare('DELETE FROM documents WHERE id = ?').run(documentId);
    this.db.prepare('DELETE FROM activity WHERE document_id = ?').run(documentId);
  }

  emptyTrash(): number {
    const rows = this.db.prepare('SELECT id FROM documents WHERE trashed_at IS NOT NULL').all() as Array<{ id: string }>;
    for (const row of rows) this.purge(row.id);
    return rows.length;
  }

  createVersion(documentId: string, label: string, reason: VersionMeta['reason']): VersionMeta {
    const doc = this.get(documentId, false);
    const versionId = id();
    const stamp = now();
    const version: Version = {
      id: versionId,
      documentId,
      createdAt: stamp,
      label: label || new Date(stamp).toLocaleString(),
      reason,
      wordCount: doc.meta.wordCount,
      content: doc.content,
      html: doc.html
    };
    this.writeJson(path.join(this.versionDir(documentId), `${versionId}.json`), version);
    this.db.prepare('INSERT INTO versions (id,document_id,created_at,label,reason,word_count) VALUES (?,?,?,?,?,?)')
      .run(versionId, documentId, stamp, version.label, reason, version.wordCount);
    this.pruneVersions(documentId);
    return { id: versionId, documentId, createdAt: stamp, label: version.label, reason, wordCount: version.wordCount };
  }

  private pruneVersions(documentId: string) {
    const rows = this.db.prepare('SELECT id FROM versions WHERE document_id = ? ORDER BY created_at DESC').all(documentId) as Array<{ id: string }>;
    for (const row of rows.slice(50)) {
      try { fs.rmSync(path.join(this.versionDir(documentId), `${row.id}.json`), { force: true }); } catch { /* ignore */ }
      this.db.prepare('DELETE FROM versions WHERE id = ?').run(row.id);
    }
  }

  listVersions(documentId: string): VersionMeta[] {
    const rows = this.db.prepare('SELECT * FROM versions WHERE document_id = ? ORDER BY created_at DESC').all(documentId) as Array<Record<string, unknown>>;
    return rows.map((row) => ({
      id: String(row.id),
      documentId: String(row.document_id),
      createdAt: Number(row.created_at),
      label: String(row.label),
      reason: String(row.reason) as VersionMeta['reason'],
      wordCount: Number(row.word_count)
    }));
  }

  getVersion(documentId: string, versionId: string): Version {
    return this.readJson<Version>(path.join(this.versionDir(documentId), `${versionId}.json`));
  }

  restoreVersion(documentId: string, versionId: string): AurenDocument {
    const version = this.getVersion(documentId, versionId);
    const current = this.get(documentId, false);
    this.createVersion(documentId, 'Before restore', 'auto');
    const stamp = now();
    const doc: AurenDocument = {
      meta: { ...current.meta, updatedAt: stamp, wordCount: version.wordCount },
      content: version.content,
      html: version.html,
      savedAt: stamp
    };
    this.writeJson(this.docPath(documentId), doc);
    this.upsertMeta(doc.meta, plainFromHtml(version.html));
    this.addActivity(documentId, 'restored', doc.meta.title);
    return doc;
  }

  saveDraft(documentId: string, payload: { content: unknown; html: string; title: string; wordCount: number }) {
    const draft = {
      documentId,
      savedAt: now(),
      title: payload.title,
      content: payload.content,
      html: payload.html,
      wordCount: payload.wordCount
    };
    this.writeJson(this.draftPath(documentId), draft);
  }

  getDraft(documentId: string): { documentId: string; savedAt: number; title: string; content: unknown; html: string; wordCount: number } | null {
    try {
      return this.readJson(this.draftPath(documentId));
    } catch {
      return null;
    }
  }

  clearDraft(documentId: string) {
    try { fs.rmSync(this.draftPath(documentId), { force: true }); } catch { /* ignore */ }
  }

  listDrafts(): DraftInfo[] {
    const dir = path.join(this.root, 'drafts');
    const result: DraftInfo[] = [];
    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith('.json')) continue;
      try {
        const draft = this.readJson<{ documentId: string; savedAt: number; title: string }>(path.join(dir, file));
        result.push({ documentId: draft.documentId, savedAt: draft.savedAt, title: draft.title });
      } catch { /* ignore */ }
    }
    return result.sort((a, b) => b.savedAt - a.savedAt);
  }

  recoveryCandidates(): RecoveryCandidate[] {
    const result: RecoveryCandidate[] = [];
    for (const draft of this.listDrafts()) {
      try {
        const doc = this.get(draft.documentId, false);
        if (draft.savedAt > doc.savedAt + 500) {
          result.push({ ...draft, meta: doc.meta });
        } else {
          this.clearDraft(draft.documentId);
        }
      } catch {
        // Draft for a document that was removed.
      }
    }
    return result;
  }

  private cleanupDrafts() {
    const cutoff = now() - 1000 * 60 * 60 * 24 * 14;
    for (const draft of this.listDrafts()) {
      if (draft.savedAt < cutoff) this.clearDraft(draft.documentId);
    }
  }

  search(query: string): DocumentSummary[] {
    if (!query.trim()) return this.list({ view: 'documents' });
    return this.list({ view: 'documents', search: query });
  }

  workspaces(): Workspace[] {
    const rows = this.db.prepare('SELECT * FROM workspaces ORDER BY updated_at DESC').all() as Array<Record<string, unknown>>;
    return rows.map((row) => ({
      id: String(row.id),
      name: String(row.name),
      color: String(row.color),
      description: String(row.description || ''),
      createdAt: Number(row.created_at),
      updatedAt: Number(row.updated_at)
    }));
  }

  createWorkspace(name: string, color: string, description = ''): Workspace {
    const workspace: Workspace = {
      id: id(), name: name.trim() || 'Untitled workspace', color, description,
      createdAt: now(), updatedAt: now()
    };
    this.db.prepare('INSERT INTO workspaces (id,name,color,description,created_at,updated_at) VALUES (?,?,?,?,?,?)')
      .run(workspace.id, workspace.name, workspace.color, workspace.description, workspace.createdAt, workspace.updatedAt);
    return workspace;
  }

  updateWorkspace(workspaceId: string, patch: Partial<Pick<Workspace, 'name' | 'color' | 'description'>>): Workspace {
    const current = this.workspaces().find((w) => w.id === workspaceId);
    if (!current) throw new Error('Workspace not found');
    const next = { ...current, ...patch, updatedAt: now() };
    this.db.prepare('UPDATE workspaces SET name=?,color=?,description=?,updated_at=? WHERE id=?')
      .run(next.name, next.color, next.description, next.updatedAt, workspaceId);
    return next;
  }

  deleteWorkspace(workspaceId: string) {
    this.db.prepare('UPDATE documents SET workspace_id = NULL WHERE workspace_id = ?').run(workspaceId);
    this.db.prepare('DELETE FROM workspaces WHERE id = ?').run(workspaceId);
  }

  folders(): string[] {
    const rows = this.db.prepare("SELECT DISTINCT folder FROM documents WHERE folder IS NOT NULL AND folder != '' AND trashed_at IS NULL ORDER BY folder COLLATE NOCASE").all() as Array<{ folder: string }>;
    return rows.map((r) => r.folder);
  }

  activity(limit = 30): ActivityEntry[] {
    const rows = this.db.prepare('SELECT * FROM activity ORDER BY created_at DESC LIMIT ?').all(limit) as Array<Record<string, unknown>>;
    return rows.map((row) => ({
      id: Number(row.id),
      documentId: row.document_id ? String(row.document_id) : null,
      type: String(row.type) as ActivityEntry['type'],
      detail: String(row.detail),
      createdAt: Number(row.created_at)
    }));
  }

  addActivity(documentId: string | null, type: ActivityEntry['type'], detail: string) {
    this.db.prepare('INSERT INTO activity (document_id,type,detail,created_at) VALUES (?,?,?,?)')
      .run(documentId, type, detail, now());
  }

  stats(): LibraryStats {
    const docs = this.db.prepare('SELECT COUNT(*) AS c, COALESCE(SUM(word_count),0) AS w FROM documents WHERE trashed_at IS NULL').get() as { c: number; w: number };
    const trashed = this.db.prepare('SELECT COUNT(*) AS c FROM documents WHERE trashed_at IS NOT NULL').get() as { c: number };
    const favorites = this.db.prepare('SELECT COUNT(*) AS c FROM documents WHERE favorite = 1 AND trashed_at IS NULL').get() as { c: number };
    const versions = this.db.prepare('SELECT COUNT(*) AS c FROM versions').get() as { c: number };
    let bytes = 0;
    for (const dir of ['docs', 'versions', 'drafts', 'templates']) {
      const full = path.join(this.root, dir);
      if (!fs.existsSync(full)) continue;
      const stack = [full];
      while (stack.length) {
        const current = stack.pop()!;
        for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
          const p = path.join(current, entry.name);
          if (entry.isDirectory()) stack.push(p);
          else { try { bytes += fs.statSync(p).size; } catch { /* ignore */ } }
        }
      }
    }
    try { bytes += fs.statSync(path.join(this.root, 'library.db')).size; } catch { /* ignore */ }
    return {
      documentCount: Number(docs.c), trashedCount: Number(trashed.c), favoriteCount: Number(favorites.c),
      wordCount: Number(docs.w), bytes, versionCount: Number(versions.c)
    };
  }

  async backup(destination: string): Promise<void> {
    this.db.exec('PRAGMA wal_checkpoint(FULL);');
    const zip = new JSZip();
    const addDir = (dir: string, prefix: string) => {
      const full = path.join(this.root, dir);
      if (!fs.existsSync(full)) return;
      for (const entry of fs.readdirSync(full, { withFileTypes: true })) {
        const p = path.join(full, entry.name);
        if (entry.isDirectory()) addDir(path.join(dir, entry.name), `${prefix}${entry.name}/`);
        else zip.file(`${prefix}${entry.name}`, fs.readFileSync(p));
      }
    };
    addDir('docs', 'docs/');
    addDir('versions', 'versions/');
    addDir('drafts', 'drafts/');
    addDir('templates', 'templates/');
    try { zip.file('library.db', fs.readFileSync(path.join(this.root, 'library.db'))); } catch { /* ignore */ }
    zip.file('AUREN-BACKUP.json', JSON.stringify({ app: 'Auren', version: 1, createdAt: now() }, null, 2));
    const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 6 } });
    this.writeAtomic(destination, buffer);
  }

  templateFiles() {
    return fs.readdirSync(path.join(this.root, 'templates')).filter((f) => f.endsWith('.json'));
  }

  saveTemplate(payload: { id?: string; title: string; category: string; description: string; html: string; content: unknown; pageSettings: PageSettings }) {
    const templateId = payload.id || id();
    const stamp = now();
    const data = { ...payload, id: templateId, createdAt: stamp, updatedAt: stamp };
    this.writeJson(path.join(this.root, 'templates', `${templateId}.json`), data);
    this.db.prepare(`
      INSERT INTO templates (id,title,category,description,created_at,updated_at) VALUES (?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET title=excluded.title, category=excluded.category, description=excluded.description, updated_at=excluded.updated_at
    `).run(templateId, payload.title, payload.category, payload.description, stamp, stamp);
    return { id: templateId };
  }

  listTemplates() {
    const rows = this.db.prepare('SELECT * FROM templates ORDER BY updated_at DESC').all() as Array<Record<string, unknown>>;
    return rows.map((row) => ({
      id: String(row.id), title: String(row.title), category: String(row.category),
      description: String(row.description || ''), createdAt: Number(row.created_at), updatedAt: Number(row.updated_at)
    }));
  }

  getTemplate(templateId: string) {
    return this.readJson(path.join(this.root, 'templates', `${templateId}.json`));
  }

  deleteTemplate(templateId: string) {
    try { fs.rmSync(path.join(this.root, 'templates', `${templateId}.json`), { force: true }); } catch { /* ignore */ }
    this.db.prepare('DELETE FROM templates WHERE id = ?').run(templateId);
  }

  close() {
    try { this.db.close(); } catch { /* ignore */ }
  }
}

export function countWords(text: string): number {
  const matches = text.trim().match(/[\p{L}\p{N}][\p{L}\p{N}'’\-]*/gu);
  return matches ? matches.length : 0;
}

export function wordStats(html: string): { words: number; chars: number; text: string } {
  const text = plainFromHtml(html);
  return { words: countWords(text), chars: text.length, text };
}
