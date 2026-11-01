import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowRight,
  BookOpen,
  Command,
  Download,
  FileDown,
  FilePlus2,
  FileText,
  Focus,
  FolderOpen,
  History,
  Home,
  LayoutTemplate,
  Maximize,
  MoonStar,
  PanelLeft,
  PanelRight,
  Search,
  Settings2,
  Sparkles,
  SunMedium,
  Upload,
  Wand2
} from 'lucide-react';
import { useAppStore } from '../store/app';
import { timeAgo, useT } from '../lib/utils';
import type { DocumentSummary } from '../../shared/types';
import { Kbd } from './ui';

interface PaletteCommand {
  id: string;
  label: string;
  hint?: string;
  icon: React.ReactNode;
  shortcut?: string;
  run: () => void | Promise<unknown>;
  when?: () => boolean;
}

export function CommandPalette() {
  const t = useT();
  const open = useAppStore((state) => state.paletteOpen);
  const setFlag = useAppStore((state) => state.setFlag);
  const store = useAppStore;
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const [contentDocs, setContentDocs] = useState<DocumentSummary[]>([]);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setSelected(0);
    setContentDocs([]);
    const timer = window.setTimeout(() => inputRef.current?.focus(), 30);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open || query.trim().length < 2) {
      setContentDocs([]);
      return;
    }
    setSearching(true);
    const timer = window.setTimeout(() => {
      void window.auren.library.search(query.trim()).then((results) => {
        setContentDocs(results.slice(0, 6));
        setSearching(false);
      }).catch(() => setSearching(false));
    }, 160);
    return () => window.clearTimeout(timer);
  }, [query, open]);

  const commands: PaletteCommand[] = useMemo(() => {
    const s = store.getState();
    const bridge = s.editorBridge;
    const inEditor = s.view === 'editor' && Boolean(s.activeDoc);
    const list: PaletteCommand[] = [
      { id: 'new', label: t('palette.newDocument'), icon: <FilePlus2 size={15} />, shortcut: 'Ctrl N', run: () => s.createDocument({}) },
      { id: 'import', label: t('palette.import'), icon: <Upload size={15} />, shortcut: 'Ctrl Shift O', run: () => s.beginImport() },
      { id: 'home', label: t('nav.home'), icon: <Home size={15} />, run: () => s.navigate('home') },
      { id: 'documents', label: t('nav.documents'), icon: <FileText size={15} />, run: () => s.showLibrary({ workspaceId: null, folder: null, search: '' }) },
      { id: 'templates', label: t('nav.templates'), icon: <LayoutTemplate size={15} />, run: () => s.navigate('templates') },
      { id: 'workspaces', label: t('nav.workspaces'), icon: <FolderOpen size={15} />, run: () => s.navigate('workspaces') },
      { id: 'settings', label: t('palette.settings'), icon: <Settings2 size={15} />, shortcut: 'Ctrl ,', run: () => s.navigate('settings') },
      { id: 'backup', label: t('palette.backup'), icon: <Download size={15} />, run: async () => {
        const result = await window.auren.settings.backup();
        if (!result.canceled) s.toast(t('toast.backupDone'), 'success');
      } },
      { id: 'theme-midnight', label: t('palette.themeMidnight'), icon: <MoonStar size={15} />, run: () => s.updateSettings({ theme: 'midnight' }) },
      { id: 'theme-paper', label: t('palette.themePaper'), icon: <SunMedium size={15} />, run: () => s.updateSettings({ theme: 'paper' }) },
      { id: 'theme-oled', label: t('palette.themeOled'), icon: <Sparkles size={15} />, run: () => s.updateSettings({ theme: 'oled' }) },
      { id: 'focus', label: t('palette.focus'), icon: <Focus size={15} />, shortcut: 'F8', when: () => inEditor, run: () => s.setFlag('focusMode') },
      { id: 'zen', label: t('palette.zen'), icon: <Maximize size={15} />, shortcut: 'F11', when: () => inEditor, run: () => s.setFlag('zenMode') },
      { id: 'sidebar', label: t('palette.sidebar'), icon: <PanelLeft size={15} />, run: () => s.toggleSidebar() },
      { id: 'inspector', label: t('palette.inspector'), icon: <PanelRight size={15} />, when: () => inEditor, run: () => s.setFlag('inspectorOpen') },
      { id: 'outline', label: t('palette.outline'), icon: <BookOpen size={15} />, when: () => inEditor, run: () => s.setFlag('outlineOpen') },
      { id: 'timeline', label: t('palette.timeline'), icon: <History size={15} />, when: () => inEditor, run: () => s.setFlag('timelineOpen') },
      { id: 'ai', label: t('palette.ai'), icon: <Wand2 size={15} />, when: () => inEditor, run: () => s.setFlag('aiOpen') },
      { id: 'save-version', label: t('palette.saveVersion'), icon: <Command size={15} />, when: () => inEditor, run: () => bridge?.saveVersion() },
      { id: 'page-setup', label: t('palette.pageSetup'), icon: <FileText size={15} />, when: () => inEditor, run: () => bridge?.openPageSetup() },
      { id: 'save-template', label: t('palette.savedTemplate'), icon: <LayoutTemplate size={15} />, when: () => inEditor, run: () => bridge?.saveAsTemplate() },
      { id: 'export-pdf', label: t('palette.exportPdf'), icon: <FileDown size={15} />, when: () => inEditor, run: () => bridge?.exportAs('pdf') },
      { id: 'export-docx', label: t('palette.exportDocx'), icon: <FileDown size={15} />, when: () => inEditor, run: () => bridge?.exportAs('docx') },
      { id: 'help', label: t('palette.help'), icon: <BookOpen size={15} />, run: () => s.setFlag('helpOpen', true) }
    ];
    return list.filter((command) => !command.when || command.when());
  }, [store, t]);

  const localDocs = useMemo(() => {
    const docs = store.getState().recentDocs;
    const q = query.trim().toLowerCase();
    if (!q) return docs.slice(0, 5);
    return docs.filter((doc) => doc.title.toLowerCase().includes(q) || doc.excerpt.toLowerCase().includes(q)).slice(0, 5);
  }, [query, store]);

  const documentResults = useMemo(() => {
    const seen = new Set(localDocs.map((doc) => doc.id));
    return contentDocs.filter((doc) => !seen.has(doc.id)).slice(0, 4);
  }, [contentDocs, localDocs]);

  const filteredCommands = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((command) => command.label.toLowerCase().includes(q) || command.id.includes(q));
  }, [commands, query]);

  const entries = useMemo(() => [
    ...filteredCommands.map((command) => ({ kind: 'command' as const, command })),
    ...documentResults.map((doc) => ({ kind: 'document' as const, doc })),
    ...localDocs.map((doc) => ({ kind: 'document' as const, doc }))
  ], [filteredCommands, localDocs, documentResults]);

  useEffect(() => {
    if (selected >= entries.length) setSelected(Math.max(0, entries.length - 1));
  }, [entries.length, selected]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setFlag('paletteOpen', false);
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        setSelected((index) => Math.min(entries.length - 1, index + 1));
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setSelected((index) => Math.max(0, index - 1));
      } else if (event.key === 'Enter') {
        event.preventDefault();
        const entry = entries[selected];
        if (!entry) return;
        setFlag('paletteOpen', false);
        if (entry.kind === 'command') void entry.command.run();
        else void store.getState().openDocument(entry.doc.id);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, entries, selected, setFlag, store]);

  useEffect(() => {
    const active = listRef.current?.querySelector<HTMLElement>(`[data-index="${selected}"]`);
    active?.scrollIntoView({ block: 'nearest' });
  }, [selected]);

  if (!open) return null;
  let index = -1;

  return createPortal(
    <div className="palette-layer" onMouseDown={(event) => { if (event.target === event.currentTarget) setFlag('paletteOpen', false); }}>
      <div className="palette" role="dialog" aria-modal="true" aria-label={t('nav.command')}>
        <div className="palette-input-row">
          <Search size={17} />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => { setQuery(event.target.value); setSelected(0); }}
            placeholder={t('palette.placeholder')}
            aria-label={t('palette.placeholder')}
          />
          {searching ? <span className="palette-searching">…</span> : <Kbd>Esc</Kbd>}
        </div>
        <div className="palette-results" ref={listRef}>
          {filteredCommands.length > 0 && (
            <>
              <div className="palette-group">{query.trim() ? t('palette.commands') : t('palette.commands')}</div>
              {filteredCommands.map((command) => {
                index++;
                const isSelected = index === selected;
                return (
                  <button
                    key={command.id}
                    data-index={index}
                    className={`palette-item ${isSelected ? 'is-selected' : ''}`}
                    onMouseEnter={() => setSelected(index)}
                    onClick={() => { setFlag('paletteOpen', false); void command.run(); }}
                  >
                    <span className="palette-icon">{command.icon}</span>
                    <span className="palette-label">{command.label}</span>
                    {command.shortcut && <span className="palette-shortcut"><Kbd>{command.shortcut}</Kbd></span>}
                    {isSelected && <ArrowRight size={13} className="palette-arrow" />}
                  </button>
                );
              })}
            </>
          )}
          {(localDocs.length > 0 || documentResults.length > 0) && (
            <>
              <div className="palette-group">{t('palette.documents')}</div>
              {[...documentResults, ...localDocs].map((doc) => {
                index++;
                const isSelected = index === selected;
                return (
                  <button
                    key={doc.id}
                    data-index={index}
                    className={`palette-item ${isSelected ? 'is-selected' : ''}`}
                    onMouseEnter={() => setSelected(index)}
                    onClick={() => { setFlag('paletteOpen', false); void store.getState().openDocument(doc.id); }}
                  >
                    <span className="palette-icon"><span className="doc-dot" style={{ background: doc.color }} /></span>
                    <span className="palette-label">{doc.title || t('common.untitled')}</span>
                    <span className="palette-meta">{timeAgo(doc.updatedAt, store.getState().settings?.language || 'en')}</span>
                  </button>
                );
              })}
            </>
          )}
          {!entries.length && <div className="palette-empty">{t('palette.noResults')}</div>}
        </div>
        <div className="palette-footer">
          <span><Kbd>↑</Kbd><Kbd>↓</Kbd> navigate</span>
          <span><Kbd>↵</Kbd> open</span>
          <span className="palette-footer-brand"><span className="brand-mark" style={{ width: 12, height: 12 }}>◆</span> AUREN</span>
        </div>
      </div>
    </div>,
    document.body
  );
}
