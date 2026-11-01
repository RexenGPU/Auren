import { create } from 'zustand';
import type {
  ActivityEntry,
  AppInfo,
  AurenDocument,
  AurenSettings,
  AppView,
  DocumentSummary,
  ExportFormat,
  ExportOptions,
  ExportResult,
  LibraryFilter,
  LibraryStats,
  RecoveryCandidate,
  VersionMeta,
  Workspace
} from '../../shared/types';
import type { ConversionPreview, CreateDocumentPayload } from '../../shared/api';
import { createPageSettings } from '../lib/page';

export type SaveState = 'saved' | 'dirty' | 'saving' | 'error';
export type ToastKind = 'info' | 'success' | 'error';

export interface Toast {
  id: number;
  message: string;
  kind: ToastKind;
}

export interface EditorBridge {
  save(options?: { activity?: boolean; silent?: boolean }): Promise<void>;
  flush(): Promise<void>;
  focus(): void;
  getSelectionText(): string;
  getDocumentText(): string;
  insertText(text: string): void;
  replaceSelection(text: string): void;
  openFind(): void;
  openPageSetup(): void;
  saveVersion(): Promise<void>;
  exportAs(format: ExportFormat, options?: ExportOptions): Promise<ExportResult | null>;
  saveAsTemplate(): void;
  undo(): void;
  redo(): void;
}

interface AppState {
  booted: boolean;
  bootError: string | null;
  settings: AurenSettings | null;
  appInfo: AppInfo | null;
  view: AppView;
  activeDoc: AurenDocument | null;
  contentRevision: number;
  docs: DocumentSummary[];
  recentDocs: DocumentSummary[];
  workspaces: Workspace[];
  folders: string[];
  stats: LibraryStats | null;
  activity: ActivityEntry[];
  recovery: RecoveryCandidate[];
  pendingImport: ConversionPreview | null;
  libraryFilter: LibraryFilter;
  docsLoading: boolean;
  saveState: SaveState;
  lastSavedAt: number | null;
  sidebarCollapsed: boolean;
  inspectorOpen: boolean;
  outlineOpen: boolean;
  timelineOpen: boolean;
  aiOpen: boolean;
  focusMode: boolean;
  zenMode: boolean;
  paletteOpen: boolean;
  helpOpen: boolean;
  toasts: Toast[];
  editorBridge: EditorBridge | null;

  initialize(): Promise<void>;
  updateSettings(patch: Partial<AurenSettings>): Promise<AurenSettings>;
  applyAppearance(): void;
  toast(message: string, kind?: ToastKind): void;
  dismissToast(id: number): void;
  navigate(view: AppView): Promise<void>;
  showLibrary(filter?: Partial<LibraryFilter>): Promise<void>;
  setLibraryFilter(patch: Partial<LibraryFilter>): Promise<void>;
  refreshLibrary(): Promise<void>;
  loadDashboard(): Promise<void>;
  openDocument(id: string): Promise<void>;
  createDocument(payload: CreateDocumentPayload): Promise<AurenDocument | null>;
  importDocument(filePath: string): Promise<ConversionPreview | null>;
  beginImport(): Promise<void>;
  clearPendingImport(): void;
  createFromPreview(preview: ConversionPreview, workspaceId?: string | null, folder?: string | null): Promise<AurenDocument | null>;
  saveCurrent(options?: { activity?: boolean; silent?: boolean }): Promise<void>;
  renameActive(title: string): Promise<void>;
  renameDocument(id: string, title: string): Promise<void>;
  duplicateDocument(id: string): Promise<void>;
  toggleFavorite(id: string): Promise<void>;
  trashDocument(id: string): Promise<void>;
  restoreDocument(id: string): Promise<void>;
  purgeDocument(id: string): Promise<void>;
  emptyTrash(): Promise<void>;
  moveDocument(id: string, patch: { workspaceId?: string | null; folder?: string | null }): Promise<void>;
  updatePageSettings(patch: Partial<AurenDocument['meta']['pageSettings']>): Promise<void>;
  createWorkspace(name: string, color: string, description?: string): Promise<Workspace | null>;
  updateWorkspace(id: string, patch: Partial<Pick<Workspace, 'name' | 'color' | 'description'>>): Promise<void>;
  deleteWorkspace(id: string): Promise<void>;
  saveVersion(label: string): Promise<void>;
  restoreVersion(versionId: string): Promise<void>;
  recoverDraft(candidate: RecoveryCandidate): Promise<void>;
  discardDraft(candidate: RecoveryCandidate): Promise<void>;
  setEditorBridge(bridge: EditorBridge | null): void;
  setFlag(flag: 'inspectorOpen' | 'outlineOpen' | 'timelineOpen' | 'aiOpen' | 'focusMode' | 'zenMode' | 'paletteOpen' | 'helpOpen', value?: boolean): void;
  showPanel(panel: 'inspector' | 'outline' | 'timeline' | 'ai' | null): void;
  toggleSidebar(): void;
  setSaveState(state: SaveState, savedAt?: number): void;
  markActiveMeta(meta: AurenDocument['meta']): void;
}

let toastSeq = 0;
let initStarted = false;
let refreshSeq = 0;

function applyTheme(theme: AurenSettings['theme']) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme === 'paper' ? 'light' : 'dark';
}

function filterViewFor(view: AppView): LibraryFilter['view'] {
  if (view === 'recent') return 'recent';
  if (view === 'favorites') return 'favorites';
  if (view === 'trash') return 'trash';
  return 'documents';
}

export const useAppStore = create<AppState>((set, get) => ({
  booted: false,
  bootError: null,
  settings: null,
  appInfo: null,
  view: 'home',
  activeDoc: null,
  contentRevision: 0,
  docs: [],
  recentDocs: [],
  workspaces: [],
  folders: [],
  stats: null,
  activity: [],
  recovery: [],
  pendingImport: null,
  libraryFilter: { view: 'documents', search: '', sort: 'updated', direction: 'desc' },
  docsLoading: false,
  saveState: 'saved',
  lastSavedAt: null,
  sidebarCollapsed: false,
  inspectorOpen: false,
  outlineOpen: false,
  timelineOpen: false,
  aiOpen: false,
  focusMode: false,
  zenMode: false,
  paletteOpen: false,
  helpOpen: false,
  toasts: [],
  editorBridge: null,

  async initialize() {
    if (initStarted) return;
    initStarted = true;
    try {
      const [settings, appInfo, workspaces, folders, stats, activity, recentDocs, docs, recovery] = await Promise.all([
        window.auren.settings.get(),
        window.auren.app.info(),
        window.auren.library.workspaces(),
        window.auren.library.folders(),
        window.auren.library.stats(),
        window.auren.library.activity(40),
        window.auren.library.list({ view: 'recent', sort: 'opened', direction: 'desc' }),
        window.auren.library.list({ view: 'documents', sort: 'updated', direction: 'desc' }),
        window.auren.library.recovery()
      ]);
      applyTheme(settings.theme);
      document.documentElement.lang = settings.language;
      set({
        booted: true,
        settings,
        appInfo,
        workspaces,
        folders,
        stats,
        activity,
        recentDocs,
        docs,
        recovery,
        sidebarCollapsed: settings.sidebarCollapsed,
        view: settings.onboardingComplete ? 'home' : 'home'
      });
      document.documentElement.style.setProperty('--ui-scale', String(settings.uiScale || 1));
      document.documentElement.dataset.motion = settings.reducedMotion ? 'reduced' : 'full';
    } catch (error) {
      set({ bootError: error instanceof Error ? error.message : String(error), booted: true });
    }
  },

  async updateSettings(patch) {
    const previous = get().settings;
    if (!previous) throw new Error('Settings are not ready.');
    const optimistic = { ...previous, ...patch };
    set({ settings: optimistic });
    applyTheme(optimistic.theme);
    document.documentElement.lang = optimistic.language;
    document.documentElement.style.setProperty('--ui-scale', String(optimistic.uiScale || 1));
    document.documentElement.dataset.motion = optimistic.reducedMotion ? 'reduced' : 'full';
    if (patch.sidebarCollapsed !== undefined) set({ sidebarCollapsed: patch.sidebarCollapsed });
    try {
      const saved = await window.auren.settings.update(patch);
      set({ settings: saved });
      return saved;
    } catch (error) {
      set({ settings: previous });
      applyTheme(previous.theme);
      get().toast(error instanceof Error ? error.message : String(error), 'error');
      throw error;
    }
  },

  applyAppearance() {
    const settings = get().settings;
    if (!settings) return;
    applyTheme(settings.theme);
    document.documentElement.lang = settings.language;
    document.documentElement.style.setProperty('--ui-scale', String(settings.uiScale || 1));
    document.documentElement.dataset.motion = settings.reducedMotion ? 'reduced' : 'full';
  },

  toast(message, kind = 'info') {
    const id = ++toastSeq;
    set((state) => ({ toasts: [...state.toasts.slice(-3), { id, message, kind }] }));
    window.setTimeout(() => get().dismissToast(id), 4600);
  },

  dismissToast(id) {
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
  },

  async navigate(view) {
    if (view === 'editor') {
      set({ view });
      return;
    }
    if (get().activeDoc) await get().saveCurrent({ silent: true });
    set({
      view,
      activeDoc: null,
      focusMode: false,
      zenMode: false,
      timelineOpen: false,
      aiOpen: false,
      inspectorOpen: false,
      outlineOpen: false
    });
    if (view === 'home') await get().loadDashboard();
    else if (view === 'documents' || view === 'recent' || view === 'favorites' || view === 'trash') {
      await get().refreshLibrary();
    } else if (view === 'workspaces') {
      await get().loadDashboard();
    }
  },

  async showLibrary(filter = {}) {
    if (get().activeDoc) await get().saveCurrent({ silent: true });
    const view = (filter.view || 'documents') as LibraryFilter['view'];
    set((state) => ({
      view: 'documents',
      activeDoc: null,
      libraryFilter: { ...state.libraryFilter, ...filter, view },
      focusMode: false,
      zenMode: false
    }));
    await get().refreshLibrary();
  },

  async setLibraryFilter(patch) {
    const next = { ...get().libraryFilter, ...patch };
    set({ libraryFilter: next });
    if (!['documents', 'recent', 'favorites', 'trash'].includes(get().view)) {
      set({ view: 'documents' });
    }
    await get().refreshLibrary();
  },

  async refreshLibrary() {
    const seq = ++refreshSeq;
    set({ docsLoading: true });
    try {
      const state = get();
      const view = ['documents', 'recent', 'favorites', 'trash'].includes(state.view) ? state.view : 'documents';
      const filter: LibraryFilter = {
        ...state.libraryFilter,
        view: view as LibraryFilter['view']
      };
      const [docs, workspaces, folders] = await Promise.all([
        window.auren.library.list(filter),
        window.auren.library.workspaces(),
        window.auren.library.folders()
      ]);
      if (seq !== refreshSeq) return;
      set({ docs, workspaces, folders });
    } catch (error) {
      get().toast(error instanceof Error ? error.message : String(error), 'error');
    } finally {
      if (seq === refreshSeq) set({ docsLoading: false });
    }
  },

  async loadDashboard() {
    try {
      const [recentDocs, stats, activity, workspaces, folders] = await Promise.all([
        window.auren.library.list({ view: 'recent', sort: 'opened', direction: 'desc', search: '' }),
        window.auren.library.stats(),
        window.auren.library.activity(40),
        window.auren.library.workspaces(),
        window.auren.library.folders()
      ]);
      set({ recentDocs, stats, activity, workspaces, folders });
    } catch (error) {
      get().toast(error instanceof Error ? error.message : String(error), 'error');
    }
  },

  async openDocument(id) {
    if (get().activeDoc?.meta.id === id && get().view === 'editor') return;
    if (get().activeDoc && get().activeDoc?.meta.id !== id) await get().saveCurrent({ silent: true });
    try {
      const doc = await window.auren.library.get(id);
      set((state) => ({
        activeDoc: doc,
        view: 'editor',
        contentRevision: state.contentRevision + 1,
        saveState: 'saved',
        lastSavedAt: doc.savedAt,
        focusMode: false,
        zenMode: false
      }));
      void get().loadDashboard();
    } catch (error) {
      get().toast(error instanceof Error ? error.message : String(error), 'error');
    }
  },

  async createDocument(payload) {
    try {
      const settings = get().settings;
      const nextPayload: CreateDocumentPayload = {
        ...payload,
        pageSettings: payload.pageSettings || createPageSettings(settings?.defaultPageSize || 'A4')
      };
      const doc = await window.auren.library.create(nextPayload);
      set((state) => ({
        activeDoc: doc,
        view: 'editor',
        contentRevision: state.contentRevision + 1,
        saveState: 'saved',
        lastSavedAt: doc.savedAt
      }));
      get().toast('Document created.', 'success');
      void get().loadDashboard();
      return doc;
    } catch (error) {
      get().toast(error instanceof Error ? error.message : String(error), 'error');
      return null;
    }
  },

  async importDocument(filePath) {
    try {
      const preview = await window.auren.files.importPreview(filePath);
      return preview;
    } catch (error) {
      get().toast(`Import failed: ${error instanceof Error ? error.message : String(error)}`, 'error');
      return null;
    }
  },

  async beginImport() {
    try {
      const filePath = await window.auren.files.pickImport();
      if (!filePath) return;
      const preview = await get().importDocument(filePath);
      if (preview) set({ pendingImport: preview });
    } catch (error) {
      get().toast(`Import failed: ${error instanceof Error ? error.message : String(error)}`, 'error');
    }
  },

  clearPendingImport() {
    set({ pendingImport: null });
  },

  async createFromPreview(preview, workspaceId = null, folder = null) {
    const doc = await get().createDocument({
      title: preview.suggestedTitle || preview.fileName,
      html: preview.html,
      content: preview.content ?? null,
      pageSettings: preview.pageSettings,
      workspaceId,
      folder,
      importedFrom: preview.fileName
    });
    set({ pendingImport: null });
    if (doc) {
      if (preview.warnings.length) {
        preview.warnings.slice(0, 2).forEach((warning) => get().toast(warning, 'info'));
      }
      get().toast(`Imported “${doc.meta.title}”.`, 'success');
    }
    return doc;
  },

  async saveCurrent(options) {
    const bridge = get().editorBridge;
    if (!bridge) return;
    await bridge.save(options);
  },

  async renameActive(title) {
    const doc = get().activeDoc;
    if (!doc) return;
    const next = title.trim() || doc.meta.title;
    if (next === doc.meta.title) return;
    const meta = await window.auren.library.rename(doc.meta.id, next);
    set((state) => ({
      activeDoc: state.activeDoc ? { ...state.activeDoc, meta } : null,
      docs: state.docs.map((d) => d.id === meta.id ? { ...d, ...meta } : d),
      recentDocs: state.recentDocs.map((d) => d.id === meta.id ? { ...d, ...meta } : d)
    }));
    get().toast('Document renamed.', 'success');
  },

  async renameDocument(id, title) {
    try {
      const meta = await window.auren.library.rename(id, title.trim());
      set((state) => ({
        docs: state.docs.map((d) => d.id === id ? { ...d, ...meta } : d),
        recentDocs: state.recentDocs.map((d) => d.id === id ? { ...d, ...meta } : d),
        activeDoc: state.activeDoc?.meta.id === id ? { ...state.activeDoc, meta } : state.activeDoc
      }));
      get().toast('Document renamed.', 'success');
    } catch (error) {
      get().toast(error instanceof Error ? error.message : String(error), 'error');
    }
  },

  async duplicateDocument(id) {
    try {
      const doc = await window.auren.library.duplicate(id);
      await get().refreshLibrary();
      get().toast('Document duplicated.', 'success');
      await get().openDocument(doc.meta.id);
    } catch (error) {
      get().toast(error instanceof Error ? error.message : String(error), 'error');
    }
  },

  async toggleFavorite(id) {
    const all = [...get().docs, ...get().recentDocs];
    const current = all.find((d) => d.id === id);
    try {
      const meta = await window.auren.library.updateMeta(id, { favorite: !current?.favorite });
      set((state) => ({
        docs: state.docs.map((d) => d.id === id ? { ...d, ...meta } : d),
        recentDocs: state.recentDocs.map((d) => d.id === id ? { ...d, ...meta } : d),
        activeDoc: state.activeDoc?.meta.id === id ? { ...state.activeDoc, meta } : state.activeDoc,
        stats: state.stats ? { ...state.stats, favoriteCount: Math.max(0, state.stats.favoriteCount + (meta.favorite ? 1 : -1)) } : null
      }));
      get().toast(meta.favorite ? 'Added to favorites.' : 'Removed from favorites.', 'success');
    } catch (error) {
      get().toast(error instanceof Error ? error.message : String(error), 'error');
    }
  },

  async trashDocument(id) {
    try {
      await get().saveCurrent({ silent: true });
      await window.auren.library.trash(id);
      if (get().activeDoc?.meta.id === id) set({ activeDoc: null, view: 'documents' });
      set((state) => ({ docs: state.docs.filter((d) => d.id !== id), recentDocs: state.recentDocs.filter((d) => d.id !== id) }));
      await get().refreshLibrary();
      get().toast('Moved to Trash.', 'success');
    } catch (error) {
      get().toast(error instanceof Error ? error.message : String(error), 'error');
    }
  },

  async restoreDocument(id) {
    try {
      await window.auren.library.restore(id);
      await get().refreshLibrary();
      get().toast('Document restored.', 'success');
    } catch (error) {
      get().toast(error instanceof Error ? error.message : String(error), 'error');
    }
  },

  async purgeDocument(id) {
    try {
      await window.auren.library.purge(id);
      set((state) => ({ docs: state.docs.filter((d) => d.id !== id) }));
      get().toast('Document deleted permanently.', 'success');
    } catch (error) {
      get().toast(error instanceof Error ? error.message : String(error), 'error');
    }
  },

  async emptyTrash() {
    try {
      const removed = await window.auren.library.emptyTrash();
      set({ docs: [] });
      get().toast(`${removed} document${removed === 1 ? '' : 's'} deleted permanently.`, 'success');
    } catch (error) {
      get().toast(error instanceof Error ? error.message : String(error), 'error');
    }
  },

  async moveDocument(id, patch) {
    try {
      const meta = await window.auren.library.updateMeta(id, patch);
      set((state) => ({
        docs: state.docs.map((d) => d.id === id ? { ...d, ...meta } : d),
        recentDocs: state.recentDocs.map((d) => d.id === id ? { ...d, ...meta } : d),
        activeDoc: state.activeDoc?.meta.id === id ? { ...state.activeDoc, meta } : state.activeDoc
      }));
      const folders = await window.auren.library.folders();
      set({ folders });
      get().toast('Document moved.', 'success');
    } catch (error) {
      get().toast(error instanceof Error ? error.message : String(error), 'error');
    }
  },

  async updatePageSettings(patch) {
    const doc = get().activeDoc;
    if (!doc) return;
    const pageSettings = { ...doc.meta.pageSettings, ...patch };
    try {
      const meta = await window.auren.library.updateMeta(doc.meta.id, { pageSettings });
      set((state) => ({
        activeDoc: state.activeDoc ? { ...state.activeDoc, meta } : null,
        docs: state.docs.map((d) => d.id === meta.id ? { ...d, ...meta } : d)
      }));
    } catch (error) {
      get().toast(error instanceof Error ? error.message : String(error), 'error');
    }
  },

  async createWorkspace(name, color, description = '') {
    try {
      const workspace = await window.auren.library.createWorkspace(name.trim(), color, description.trim());
      set((state) => ({ workspaces: [workspace, ...state.workspaces] }));
      get().toast('Workspace created.', 'success');
      return workspace;
    } catch (error) {
      get().toast(error instanceof Error ? error.message : String(error), 'error');
      return null;
    }
  },

  async updateWorkspace(id, patch) {
    try {
      const workspace = await window.auren.library.updateWorkspace(id, patch);
      set((state) => ({ workspaces: state.workspaces.map((w) => w.id === id ? workspace : w) }));
      get().toast('Workspace updated.', 'success');
    } catch (error) {
      get().toast(error instanceof Error ? error.message : String(error), 'error');
    }
  },

  async deleteWorkspace(id) {
    try {
      await window.auren.library.deleteWorkspace(id);
      set((state) => ({ workspaces: state.workspaces.filter((w) => w.id !== id) }));
      get().toast('Workspace deleted.', 'success');
    } catch (error) {
      get().toast(error instanceof Error ? error.message : String(error), 'error');
    }
  },

  async saveVersion(label) {
    const doc = get().activeDoc;
    if (!doc) return;
    await get().saveCurrent({ silent: true });
    await window.auren.library.createVersion(doc.meta.id, label);
    get().toast('Version saved.', 'success');
  },

  async restoreVersion(versionId) {
    const doc = get().activeDoc;
    if (!doc) return;
    try {
      const restored = await window.auren.library.restoreVersion(doc.meta.id, versionId);
      set((state) => ({
        activeDoc: restored,
        contentRevision: state.contentRevision + 1,
        saveState: 'saved',
        lastSavedAt: restored.savedAt
      }));
      get().toast('Version restored.', 'success');
    } catch (error) {
      get().toast(error instanceof Error ? error.message : String(error), 'error');
    }
  },

  async recoverDraft(candidate) {
    try {
      const draft = await window.auren.library.draft(candidate.documentId);
      if (!draft) return;
      const plain = draft.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      await window.auren.library.save(candidate.documentId, {
        title: draft.title,
        content: draft.content,
        html: draft.html,
        wordCount: draft.wordCount,
        charCount: plain.length,
        excerpt: plain.slice(0, 220)
      });
      await window.auren.library.clearDraft(candidate.documentId);
      set((state) => ({ recovery: state.recovery.filter((r) => r.documentId !== candidate.documentId) }));
      await get().openDocument(candidate.documentId);
      get().toast(`Recovered your unsaved changes from ${new Date(candidate.savedAt).toLocaleTimeString()}.`, 'success');
    } catch (error) {
      get().toast(error instanceof Error ? error.message : String(error), 'error');
    }
  },

  async discardDraft(candidate) {
    try {
      await window.auren.library.clearDraft(candidate.documentId);
      set((state) => ({ recovery: state.recovery.filter((r) => r.documentId !== candidate.documentId) }));
    } catch {
      set((state) => ({ recovery: state.recovery.filter((r) => r.documentId !== candidate.documentId) }));
    }
  },

  setEditorBridge(bridge) {
    set({ editorBridge: bridge });
  },

  setFlag(flag, value) {
    set((state) => ({ [flag]: value ?? !state[flag] } as Pick<AppState, typeof flag>));
  },

  showPanel(panel) {
    set({
      inspectorOpen: panel === 'inspector',
      outlineOpen: panel === 'outline',
      timelineOpen: panel === 'timeline',
      aiOpen: panel === 'ai'
    });
  },

  toggleSidebar() {
    const next = !get().sidebarCollapsed;
    set({ sidebarCollapsed: next });
    void window.auren.settings.update({ sidebarCollapsed: next });
  },

  setSaveState(state, savedAt) {
    set({ saveState: state, ...(savedAt ? { lastSavedAt: savedAt } : {}) });
  },

  markActiveMeta(meta) {
    set((state) => ({
      activeDoc: state.activeDoc ? { ...state.activeDoc, meta } : null,
      docs: state.docs.map((d) => d.id === meta.id ? { ...d, ...meta, readTimeMinutes: Math.max(1, Math.ceil(meta.wordCount / 230)) } : d),
      recentDocs: state.recentDocs.map((d) => d.id === meta.id ? { ...d, ...meta, readTimeMinutes: Math.max(1, Math.ceil(meta.wordCount / 230)) } : d)
    }));
  }
}));

export function resetInitializationForTests() {
  initStarted = false;
}
