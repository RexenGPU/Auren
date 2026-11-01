import type {
  ActivityEntry,
  AppInfo,
  AurenDocument,
  AurenSettings,
  AISecretStatus,
  DocumentMeta,
  DocumentSummary,
  DraftInfo,
  ExportFormat,
  ExportOptions,
  ExportResult,
  ImportResult,
  LibraryFilter,
  LibraryStats,
  PageSettings,
  RecoveryCandidate,
  SpellCheckResult,
  Version,
  VersionMeta,
  Workspace
} from './types';

export interface ConversionPreview {
  html: string;
  warnings: string[];
  title?: string;
  pageSettings?: PageSettings;
  content?: unknown;
  sourceFormat: string;
  fileName: string;
  suggestedTitle: string;
}

export interface SaveDocumentPayload {
  title?: string;
  content: unknown;
  html: string;
  wordCount: number;
  charCount: number;
  excerpt: string;
  searchText?: string;
  pageSettings?: PageSettings;
  activity?: boolean;
}

export interface CreateDocumentPayload {
  title?: string;
  html?: string;
  content?: unknown;
  pageSettings?: PageSettings;
  workspaceId?: string | null;
  folder?: string | null;
  importedFrom?: string | null;
}

export interface TemplateRecord {
  id: string;
  title: string;
  category: string;
  description: string;
  createdAt: number;
  updatedAt: number;
}

export interface TemplateFull extends TemplateRecord {
  html: string;
  content: unknown;
  pageSettings: PageSettings;
}

export interface TemplateSavePayload {
  id?: string;
  title: string;
  category: string;
  description: string;
  html: string;
  content: unknown;
  pageSettings: PageSettings;
}

export interface AurenApi {
  app: {
    info(): Promise<AppInfo>;
    minimize(): void;
    toggleMaximize(): void;
    close(): void;
    isMaximized(): Promise<boolean>;
    onMaximizeChange(cb: (maximized: boolean) => void): () => void;
    openExternal(url: string): Promise<boolean>;
    showItemInFolder(path: string): void;
    openPath(path: string): Promise<string>;
    onFlushRequest(cb: () => void): () => void;
    flushDone(): void;
    installUpdate(): Promise<{ launched: boolean; message: string }>;
  };
  library: {
    list(filter?: LibraryFilter): Promise<DocumentSummary[]>;
    get(id: string): Promise<AurenDocument>;
    create(payload: CreateDocumentPayload): Promise<AurenDocument>;
    save(id: string, payload: SaveDocumentPayload): Promise<AurenDocument>;
    rename(id: string, title: string): Promise<DocumentMeta>;
    duplicate(id: string): Promise<AurenDocument>;
    trash(id: string): Promise<void>;
    restore(id: string): Promise<void>;
    purge(id: string): Promise<void>;
    emptyTrash(): Promise<number>;
    updateMeta(id: string, patch: Partial<Pick<DocumentMeta, 'favorite' | 'workspaceId' | 'folder' | 'pageSettings'>>): Promise<DocumentMeta>;
    search(query: string): Promise<DocumentSummary[]>;
    versions(id: string): Promise<VersionMeta[]>;
    version(id: string, versionId: string): Promise<Version>;
    createVersion(id: string, label: string): Promise<VersionMeta>;
    restoreVersion(id: string, versionId: string): Promise<AurenDocument>;
    drafts(): Promise<DraftInfo[]>;
    recovery(): Promise<RecoveryCandidate[]>;
    draft(id: string): Promise<{ documentId: string; savedAt: number; title: string; content: unknown; html: string; wordCount: number } | null>;
    saveDraft(id: string, payload: { content: unknown; html: string; title: string; wordCount: number }): Promise<void>;
    clearDraft(id: string): Promise<void>;
    workspaces(): Promise<Workspace[]>;
    createWorkspace(name: string, color: string, description?: string): Promise<Workspace>;
    updateWorkspace(id: string, patch: Partial<Pick<Workspace, 'name' | 'color' | 'description'>>): Promise<Workspace>;
    deleteWorkspace(id: string): Promise<void>;
    folders(): Promise<string[]>;
    stats(): Promise<LibraryStats>;
    activity(limit?: number): Promise<ActivityEntry[]>;
    listTemplates(): Promise<TemplateRecord[]>;
    saveTemplate(payload: TemplateSavePayload): Promise<{ id: string }>;
    getTemplate(id: string): Promise<TemplateFull>;
    deleteTemplate(id: string): Promise<void>;
  };
  files: {
    pickImport(): Promise<string | null>;
    importPreview(filePath: string): Promise<ConversionPreview>;
    exportDocument(id: string, format: ExportFormat, options?: ExportOptions): Promise<ExportResult>;
    pathForFile(file: File): string;
    pickFolder(title?: string): Promise<string | null>;
  };
  settings: {
    get(): Promise<AurenSettings>;
    update(patch: Partial<AurenSettings>): Promise<AurenSettings>;
    secrets(provider: string): Promise<AISecretStatus>;
    setSecret(provider: string, key: string): Promise<AISecretStatus>;
    clearSecret(provider: string): Promise<AISecretStatus>;
    testAI(provider: string, model: string, baseUrl: string, key?: string): Promise<{ ok: boolean; message: string }>;
    changeRoot(): Promise<{ changed: boolean; root: string; warnings: string[] }>;
    backup(): Promise<ExportResult>;
  };
  ai: {
    chat(payload: { requestId: string; messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>; includeDocument: boolean }): Promise<{ text: string }>;
    cancel(requestId: string): Promise<void>;
    onChunk(cb: (payload: { requestId: string; chunk: string }) => void): () => void;
  };
  spell: {
    check(words: string[], languages: string[]): Promise<SpellCheckResult>;
    suggest(word: string, languages: string[]): Promise<string[]>;
  };
  clipboard: {
    writeText(text: string): Promise<void>;
  };
  events: {
    onMenuCommand(cb: (command: string) => void): () => void;
  };
}

declare global {
  interface Window {
    auren: AurenApi;
  }
}
