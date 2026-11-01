export type ThemeId = 'midnight' | 'paper' | 'oled';
export type Language = 'en' | 'fr';

export type PageSizeName = 'A4' | 'A3' | 'Letter' | 'Legal' | 'Custom';

export interface PageSettings {
  size: PageSizeName;
  widthMm: number;
  heightMm: number;
  orientation: 'portrait' | 'landscape';
  marginTop: number;
  marginRight: number;
  marginBottom: number;
  marginLeft: number;
  columns: number;
  headerEnabled: boolean;
  footerEnabled: boolean;
  header: string;
  footer: string;
  pageNumbering: boolean;
}

export interface DocumentMeta {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  openedAt: number;
  favorite: boolean;
  workspaceId: string | null;
  folder: string | null;
  trashedAt: number | null;
  wordCount: number;
  charCount: number;
  excerpt: string;
  pageSettings: PageSettings;
  importedFrom: string | null;
  color: string;
}

export interface AurenDocument {
  meta: DocumentMeta;
  content: unknown | null;
  html: string;
  savedAt: number;
}

export interface DocumentSummary extends DocumentMeta {
  readTimeMinutes: number;
}

export interface Workspace {
  id: string;
  name: string;
  color: string;
  description: string;
  createdAt: number;
  updatedAt: number;
}

export interface VersionMeta {
  id: string;
  documentId: string;
  createdAt: number;
  label: string;
  reason: 'manual' | 'auto' | 'restore' | 'import';
  wordCount: number;
}

export interface Version extends VersionMeta {
  content: unknown | null;
  html: string;
}

export interface ActivityEntry {
  id: number;
  documentId: string | null;
  type: 'created' | 'saved' | 'imported' | 'exported' | 'restored' | 'deleted';
  detail: string;
  createdAt: number;
}

export interface DraftInfo {
  documentId: string;
  savedAt: number;
  title: string;
}

export interface AurenSettings {
  theme: ThemeId;
  language: Language;
  showLaunchScreen: boolean;
  reducedMotion: boolean;
  uiScale: number;
  sidebarWidth: number;
  rightPanelWidth: number;
  sidebarCollapsed: boolean;
  defaultFont: string;
  defaultFontSize: number;
  defaultPageSize: PageSizeName;
  editorSpellcheck: boolean;
  spellLanguages: string[];
  grammarHints: boolean;
  autosave: boolean;
  autosaveDelay: number;
  showWordCount: boolean;
  showReadingTime: boolean;
  focusDim: boolean;
  toolbarDensity: 'comfortable' | 'compact';
  visibleToolbarGroups: string[];
  pageGuides: boolean;
  aiEnabled: boolean;
  aiProvider: 'openai' | 'anthropic' | 'gemini' | 'custom';
  aiModel: string;
  aiBaseUrl: string;
  aiConsentRemember: boolean;
  aiSystemPrompt: string;
  onboardingComplete: boolean;
  defaultExportFormat: 'docx' | 'pdf' | 'odt' | 'html' | 'md' | 'txt' | 'rtf';
  updateChannel: 'manual';
  encryptedStorage: boolean;
  dataRoot: string;
  lastBackupAt: number | null;
  localeFormat: 'system' | 'en' | 'fr';
}

export type AppView =
  | 'home'
  | 'documents'
  | 'recent'
  | 'favorites'
  | 'workspaces'
  | 'templates'
  | 'trash'
  | 'settings'
  | 'editor';

export interface LibraryFilter {
  view?: 'documents' | 'recent' | 'favorites' | 'trash';
  search?: string;
  workspaceId?: string | null;
  folder?: string | null;
  sort?: 'updated' | 'created' | 'title' | 'opened';
  direction?: 'asc' | 'desc';
}

export interface SearchHit {
  document: DocumentSummary;
  snippet: string;
}

export interface LibraryStats {
  documentCount: number;
  trashedCount: number;
  favoriteCount: number;
  wordCount: number;
  bytes: number;
  versionCount: number;
}

export interface ImportResult {
  document: AurenDocument;
  warnings: string[];
  sourceFormat: string;
}

export type ExportFormat = 'docx' | 'pdf' | 'odt' | 'html' | 'md' | 'txt' | 'rtf' | 'auren';

export interface ExportPdfOptions {
  range: 'all' | 'custom';
  fromPage: number;
  toPage: number;
  includeBackground: boolean;
  includeHeaderFooter: boolean;
  includePageNumbers: boolean;
  quality: 'standard' | 'high';
  margins?: { top: number; right: number; bottom: number; left: number };
}

export interface ExportOptions {
  pdf?: ExportPdfOptions;
}

export interface ExportResult {
  canceled: boolean;
  path?: string;
  warnings?: string[];
}

export interface AIChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIRequest {
  requestId: string;
  messages: AIChatMessage[];
  includeDocument: boolean;
  provider?: AurenSettings['aiProvider'];
  model?: string;
}

export interface AISecretStatus {
  configured: boolean;
  provider: string;
  encryptionAvailable: boolean;
}

export interface RecoveryCandidate extends DraftInfo {
  meta: DocumentMeta;
}

export interface AppInfo {
  version: string;
  electron: string;
  chrome: string;
  node: string;
  platform: string;
  dataRoot: string;
  packaged: boolean;
  encryptionAvailable: boolean;
}

export interface NativeMenuRequest {
  type: 'text' | 'document';
  x: number;
  y: number;
}

export interface SpellCheckRequest {
  words: string[];
  languages: string[];
}

export interface SpellCheckResult {
  unknown: string[];
}

export const DEFAULT_PAGE_SETTINGS: PageSettings = {
  size: 'A4',
  widthMm: 210,
  heightMm: 297,
  orientation: 'portrait',
  marginTop: 25.4,
  marginRight: 22,
  marginBottom: 25.4,
  marginLeft: 22,
  columns: 1,
  headerEnabled: true,
  footerEnabled: true,
  header: '',
  footer: '',
  pageNumbering: true
};

export const PAGE_SIZES: Record<Exclude<PageSizeName, 'Custom'>, { width: number; height: number }> = {
  A4: { width: 210, height: 297 },
  A3: { width: 297, height: 420 },
  Letter: { width: 215.9, height: 279.4 },
  Legal: { width: 215.9, height: 355.6 }
};

export function pageDimensionsMm(page: PageSettings): { width: number; height: number } {
  let width = page.widthMm;
  let height = page.heightMm;
  if (page.size !== 'Custom' && PAGE_SIZES[page.size]) {
    width = PAGE_SIZES[page.size].width;
    height = PAGE_SIZES[page.size].height;
  }
  if (page.orientation === 'landscape') {
    return { width: Math.max(width, height), height: Math.min(width, height) };
  }
  return { width: Math.min(width, height), height: Math.max(width, height) };
}

export const DOC_COLORS = ['#8B7CF6', '#5AA7F7', '#48C6A2', '#E6A556', '#E8788A', '#B7B2C9'];
