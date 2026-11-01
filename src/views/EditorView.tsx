import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BubbleMenu, EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import TextAlign from '@tiptap/extension-text-align';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import FontFamily from '@tiptap/extension-font-family';
import TextStyle from '@tiptap/extension-text-style';
import CharacterCount from '@tiptap/extension-character-count';
import Placeholder from '@tiptap/extension-placeholder';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Superscript from '@tiptap/extension-superscript';
import Subscript from '@tiptap/extension-subscript';
import katex from 'katex';
import {
  AlignLeft,
  ArrowLeft,
  ArrowRight,
  Bold,
  BookOpen,
  CalendarClock,
  Check,
  ChevronLeft,
  Circle,
  Download,
  ExternalLink,
  FileDown,
  FileText,
  Focus,
  History as HistoryIcon,
  Image as ImageIcon,
  Italic,
  LayoutTemplate,
  Link2,
  ListTree,
  Maximize2,
  Minimize2,
  MoreHorizontal,
  PanelRight,
  Ruler,
  Save,
  Search,
  Settings2,
  Shapes,
  Sparkles,
  Square,
  Strikethrough,
  Underline as UnderlineIcon
} from 'lucide-react';
import type { AurenDocument, ExportFormat, ExportOptions, ExportResult, PageSettings } from '../../shared/types';
import { DEFAULT_PAGE_SETTINGS } from '../../shared/types';
import type { EditorBridge } from '../store/app';
import { useAppStore } from '../store/app';
import { countWords, cx, formatDate, useT } from '../lib/utils';
import { PAGE_GAP, FontSize, ParagraphStyle, PageBreak, Footnote, Equation, Callout, Shape, TableOfContents, Caption, ResizableImage, Search as SearchExtension, Pagination, Spellcheck, WritingHints } from '../editor/extensions';
import { createShapePng, type ShapeKind } from '../editor/shapes';
import { EditorToolbar } from '../editor/EditorToolbar';
import { FindReplaceBar } from '../editor/FindReplaceBar';
import { OutlinePanel } from '../editor/OutlinePanel';
import { InspectorPanel } from '../editor/InspectorPanel';
import { TimelinePanel } from '../editor/TimelinePanel';
import { AIPanel } from '../editor/AIPanel';
import { PageSetupDialog } from '../editor/PageSetupDialog';
import { ExportDialog } from '../editor/ExportDialog';
import { IconButton, Modal, PromptDialog, ContextMenu, type MenuItem } from '../components/ui';
import { pagePx, renderPageTokens } from '../lib/page';

type PanelId = 'outline' | 'inspector' | 'timeline' | 'ai';

interface LinkDraft { open: boolean; text: string; url: string; original: string }
interface FootnoteDraft { open: boolean; mode: 'new' | 'edit'; pos?: number; label: string; text: string }
interface EquationDraft { open: boolean; mode: 'new' | 'edit'; pos?: number; latex: string }
interface SpellMenu { x: number; y: number; from: number; to: number; word: string; suggestions: string[] }

const SHAPE_COLORS = ['#8b7cf6', '#5aa7f7', '#48c6a2', '#e6a556', '#e8788a', '#b7b2c9'];
const FONT_STACKS: Record<string, string> = {
  Newsreader: 'Newsreader Variable',
  Inter: 'Inter Variable',
  'JetBrains Mono': 'JetBrains Mono Variable'
};

function cssFont(name: string): string {
  return FONT_STACKS[name] || name || 'Newsreader Variable';
}

function replaceExtension(path: string): string {
  return path.split(/[\\/]/).pop() || path;
}

function paragraphsFromText(text: string) {
  return text.split(/\n{2,}/).map((paragraph) => ({
    type: 'paragraph',
    content: paragraph.trim() ? [{ type: 'text', text: paragraph.replace(/\n/g, ' ') }] : []
  }));
}

export function EditorView() {
  const t = useT();
  const activeDoc = useAppStore((state) => state.activeDoc);
  const settings = useAppStore((state) => state.settings);
  const contentRevision = useAppStore((state) => state.contentRevision);
  const outlineOpen = useAppStore((state) => state.outlineOpen);
  const inspectorOpen = useAppStore((state) => state.inspectorOpen);
  const timelineOpen = useAppStore((state) => state.timelineOpen);
  const aiOpen = useAppStore((state) => state.aiOpen);
  const focusMode = useAppStore((state) => state.focusMode);
  const zenMode = useAppStore((state) => state.zenMode);
  const showPanel = useAppStore((state) => state.showPanel);
  const setFlag = useAppStore((state) => state.setFlag);
  const showLibrary = useAppStore((state) => state.showLibrary);
  const navigate = useAppStore((state) => state.navigate);
  const updatePageSettings = useAppStore((state) => state.updatePageSettings);
  const renameActive = useAppStore((state) => state.renameActive);
  const setEditorBridge = useAppStore((state) => state.setEditorBridge);
  const setSaveState = useAppStore((state) => state.setSaveState);
  const markActiveMeta = useAppStore((state) => state.markActiveMeta);
  const toast = useAppStore((state) => state.toast);
  const language = settings?.language || 'en';
  const pageSettings: PageSettings = activeDoc?.meta.pageSettings || DEFAULT_PAGE_SETTINGS;
  const page = pagePx(pageSettings);

  const [title, setTitle] = useState(activeDoc?.meta.title || t('editor.untitled'));
  const [pages, setPages] = useState(1);
  const [wordCount, setWordCount] = useState(activeDoc?.meta.wordCount || 0);
  const [charCount, setCharCount] = useState(activeDoc?.meta.charCount || 0);
  const [zoom, setZoom] = useState(100);
  const [findOpen, setFindOpen] = useState(false);
  const closeFind = useCallback(() => setFindOpen(false), []);
  const [pageSetupOpen, setPageSetupOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportDefault, setExportDefault] = useState<ExportFormat>(settings?.defaultExportFormat || 'docx');
  const [exportBusy, setExportBusy] = useState(false);
  const [linkDraft, setLinkDraft] = useState<LinkDraft>({ open: false, text: '', url: '', original: '' });
  const [footnoteDraft, setFootnoteDraft] = useState<FootnoteDraft>({ open: false, mode: 'new', label: '1', text: '' });
  const [equationDraft, setEquationDraft] = useState<EquationDraft>({ open: false, mode: 'new', latex: '' });
  const [shapeOpen, setShapeOpen] = useState(false);
  const [shapeKind, setShapeKind] = useState<ShapeKind>('rectangle');
  const [shapeColor, setShapeColor] = useState(SHAPE_COLORS[0]);
  const [shapeWidth, setShapeWidth] = useState(420);
  const [shapePreview, setShapePreview] = useState('');
  const [templateOpen, setTemplateOpen] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateCategory, setTemplateCategory] = useState('Personal');
  const [templateDescription, setTemplateDescription] = useState('');
  const [versionOpen, setVersionOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [spellMenu, setSpellMenu] = useState<SpellMenu | null>(null);
  const [dirty, setDirty] = useState(false);
  const [panelWidth, setPanelWidth] = useState(settings?.rightPanelWidth || 336);
  const [panelResizing, setPanelResizing] = useState(false);

  const imageInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef(title);
  const docRef = useRef<ActiveDoc>(activeDoc);
  const settingsRef = useRef(settings);
  const dirtyRef = useRef(false);
  const revisionRef = useRef(0);
  const savingRef = useRef(false);
  const pendingSaveRef = useRef(false);
  const draftTimerRef = useRef<number | null>(null);
  const autoTimerRef = useRef<number | null>(null);
  const loadedRef = useRef<{ id: string; revision: number } | null>(null);
  const spellSequenceRef = useRef(0);
  const spellTimerRef = useRef<number | null>(null);
  const editorRef = useRef<ReturnType<typeof useEditor>>(null);

  type ActiveDoc = AurenDocument | null;

  titleRef.current = title;
  docRef.current = activeDoc;
  settingsRef.current = settings;

  const refreshStats = useCallback((instance: ReturnType<typeof useEditor>) => {
    if (!instance) return;
    const text = instance.getText({ blockSeparator: '\n' });
    setWordCount(countWords(text));
    setCharCount(text.length);
  }, []);

  const persistDraft = useCallback(async () => {
    const editor = editorRef.current;
    const doc = docRef.current;
    if (!editor || !doc || !dirtyRef.current) return;
    try {
      await window.auren.library.saveDraft(doc.meta.id, {
        content: editor.getJSON(),
        html: editor.getHTML(),
        title: titleRef.current.trim() || doc.meta.title,
        wordCount: countWords(editor.getText({ blockSeparator: '\n' }))
      });
    } catch {
      // A failed recovery draft must never interrupt writing.
    }
  }, []);

  const saveNow = useCallback(async function saveNow(options?: { activity?: boolean; silent?: boolean; force?: boolean }): Promise<void> {
    const editor = editorRef.current;
    const doc = docRef.current;
    if (!editor || !doc) return;
    if (!dirtyRef.current && !options?.force && !options?.activity) return;
    if (savingRef.current) {
      pendingSaveRef.current = true;
      return;
    }
    savingRef.current = true;
    if (draftTimerRef.current) { window.clearTimeout(draftTimerRef.current); draftTimerRef.current = null; }
    setSaveState('saving');
    const revision = revisionRef.current;
    try {
      const text = editor.getText({ blockSeparator: '\n' });
      const excerpt = text.split(/\n+/).map((line) => line.trim()).filter(Boolean).join(' · ').slice(0, 220);
      const saved = await window.auren.library.save(doc.meta.id, {
        title: titleRef.current.trim() || doc.meta.title,
        content: editor.getJSON(),
        html: editor.getHTML(),
        wordCount: countWords(text),
        charCount: text.length,
        excerpt,
        pageSettings: docRef.current?.meta.pageSettings || DEFAULT_PAGE_SETTINGS,
        activity: Boolean(options?.activity)
      });
      markActiveMeta(saved.meta);
      setSaveState('saved', saved.savedAt);
      if (revisionRef.current === revision) {
        dirtyRef.current = false;
        setDirty(false);
      } else {
        void persistDraft();
        if (settingsRef.current?.autosave) {
          if (autoTimerRef.current) window.clearTimeout(autoTimerRef.current);
          autoTimerRef.current = window.setTimeout(() => { void saveNow({ silent: true }); }, Math.max(500, settingsRef.current?.autosaveDelay || 1200));
        }
      }
    } catch (caught) {
      setSaveState('error');
      toast(t('toast.saveFailed', { message: caught instanceof Error ? caught.message : String(caught) }), 'error');
      if (settingsRef.current?.autosave && dirtyRef.current) {
        if (autoTimerRef.current) window.clearTimeout(autoTimerRef.current);
        autoTimerRef.current = window.setTimeout(() => { void saveNow({ silent: true }); }, 4000);
      }
    } finally {
      savingRef.current = false;
      if (pendingSaveRef.current) {
        pendingSaveRef.current = false;
        window.setTimeout(() => { void saveNow({ silent: true }); }, 0);
      }
    }
  }, [markActiveMeta, persistDraft, setSaveState, t, toast]);

  const scheduleDraft = useCallback(() => {
    if (draftTimerRef.current) window.clearTimeout(draftTimerRef.current);
    draftTimerRef.current = window.setTimeout(() => { void persistDraft(); }, 700);
  }, [persistDraft]);

  const scheduleAutosave = useCallback(() => {
    if (!settingsRef.current?.autosave) return;
    if (autoTimerRef.current) window.clearTimeout(autoTimerRef.current);
    autoTimerRef.current = window.setTimeout(() => { void saveNow({ silent: true }); }, Math.max(450, settingsRef.current?.autosaveDelay || 1200));
  }, [saveNow]);

  const markDirty = useCallback((isContent = true) => {
    revisionRef.current += 1;
    if (isContent) dirtyRef.current = true;
    dirtyRef.current = true;
    setDirty(true);
    setSaveState('dirty');
    scheduleDraft();
    scheduleAutosave();
  }, [scheduleAutosave, scheduleDraft, setSaveState]);

  const handleEditorUpdate = useCallback((instance: ReturnType<typeof useEditor>) => {
    if (!instance) return;
    markDirty(true);
    refreshStats(instance);
  }, [markDirty, refreshStats]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3, 4, 5, 6] } }),
      Underline,
      Link.configure({ openOnClick: false, autolink: true, linkOnPaste: true, HTMLAttributes: { rel: 'noopener noreferrer nofollow', target: '_blank' } }),
      TextAlign.configure({ types: ['heading', 'paragraph', 'caption'] }),
      TextStyle,
      FontSize,
      ParagraphStyle,
      FontFamily,
      Color,
      Highlight.configure({ multicolor: true }),
      CharacterCount,
      Placeholder.configure({ placeholder: t('editor.placeholder') }),
      Table.configure({ resizable: true, allowTableNodeSelection: true, HTMLAttributes: { class: 'auren-table' } }),
      TableRow,
      TableHeader,
      TableCell,
      TaskList,
      TaskItem.configure({ nested: true }),
      Superscript,
      Subscript,
      ResizableImage,
      PageBreak,
      Footnote,
      Equation,
      Callout,
      Shape,
      TableOfContents,
      Caption,
      SearchExtension,
      Pagination,
      Spellcheck,
      WritingHints.configure({ enabled: settings?.grammarHints ?? true })
    ],
    content: (activeDoc?.content ?? activeDoc?.html ?? '<p></p>') as never,
    editorProps: {
      attributes: {
        class: 'auren-prose',
        spellcheck: 'false',
        autocapitalize: 'on',
        autocorrect: 'on'
      },
      handleDrop(view, event) {
        const files = Array.from(event.dataTransfer?.files || []).filter((file) => file.type.startsWith('image/'));
        if (!files.length) return false;
        event.preventDefault();
        const position = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos;
        files.forEach((file) => void insertImageFile(file, position));
        return true;
      },
      handlePaste(_view, event) {
        const files = Array.from(event.clipboardData?.files || []).filter((file) => file.type.startsWith('image/'));
        if (!files.length) return false;
        event.preventDefault();
        files.forEach((file) => void insertImageFile(file));
        return true;
      }
    },
    onUpdate: ({ editor: instance }) => handleEditorUpdate(instance)
  // The editor instance is intentionally created once; documents are swapped below.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  editorRef.current = editor;

  useEffect(() => { setPanelWidth(settings?.rightPanelWidth || 336); }, [settings?.rightPanelWidth]);

  useEffect(() => {
    if (!editor) return;
    const dom = editor.view.dom;
    dom.style.fontFamily = `'${cssFont(settings?.defaultFont || 'Newsreader')}', Georgia, serif`;
    dom.style.fontSize = `${settings?.defaultFontSize || 12}pt`;
    window.dispatchEvent(new Event('auren:refresh-pagination'));
  }, [editor, settings?.defaultFont, settings?.defaultFontSize]);

  useEffect(() => {
    if (!editor || !activeDoc) return;
    if (loadedRef.current?.id === activeDoc.meta.id && loadedRef.current.revision === contentRevision) return;
    editor.commands.setContent((activeDoc.content ?? activeDoc.html ?? '<p></p>') as never, false);
    loadedRef.current = { id: activeDoc.meta.id, revision: contentRevision };
    setTitle(activeDoc.meta.title || t('editor.untitled'));
    titleRef.current = activeDoc.meta.title || t('editor.untitled');
    dirtyRef.current = false;
    revisionRef.current = 0;
    setDirty(false);
    setPages(1);
    setSaveState('saved', activeDoc.savedAt);
    refreshStats(editor);
    window.requestAnimationFrame(() => {
      window.dispatchEvent(new Event('auren:refresh-pagination'));
      scrollRef.current?.scrollTo({ top: 0 });
    });
  }, [editor, activeDoc?.meta.id, contentRevision, refreshStats, setSaveState, t]);

  useEffect(() => {
    if (!editor) return;
    const dom = editor.view.dom;
    dom.dataset.pageContentHeight = String(Math.max(40, page.height - page.marginTop - page.marginBottom));
    dom.dataset.pagePitch = String(page.height + PAGE_GAP);
    dom.dataset.columns = String(pageSettings.columns);
    const timer = window.setTimeout(() => window.dispatchEvent(new Event('auren:refresh-pagination')), 20);
    return () => window.clearTimeout(timer);
  }, [editor, page.height, page.marginTop, page.marginBottom, pageSettings.columns]);

  useEffect(() => {
    const onPages = (event: Event) => {
      const detail = (event as CustomEvent<{ pages: number }>).detail;
      if (detail?.pages) setPages(detail.pages);
    };
    window.addEventListener('auren:pages', onPages);
    return () => window.removeEventListener('auren:pages', onPages);
  }, []);

  useEffect(() => {
    if (!editor) return;
    let timer = 0;
    const schedule = () => {
      if (spellTimerRef.current) window.clearTimeout(spellTimerRef.current);
      spellTimerRef.current = window.setTimeout(() => {
        const snapshot = settingsRef.current;
        if (!snapshot?.editorSpellcheck) {
          editor.commands.setSpellErrors([]);
          return;
        }
        const text = editor.getText({ blockSeparator: '\n' });
        const words = Array.from(new Set(text.match(/[\p{L}][\p{L}'’\-]*/gu) || []))
          .filter((word) => word.length > 2)
          .slice(0, 5000);
        if (!words.length) return;
        const sequence = ++spellSequenceRef.current;
        void window.auren.spell.check(words, snapshot.spellLanguages || ['en']).then((result) => {
          if (sequence === spellSequenceRef.current) editor.commands.setSpellErrors(result.unknown);
        }).catch(() => { /* spelling is a quiet helper */ });
      }, 900);
    };
    const onUpdate = () => schedule();
    editor.on('update', onUpdate);
    timer = window.setTimeout(schedule, 500);
    return () => {
      window.clearTimeout(timer);
      if (spellTimerRef.current) window.clearTimeout(spellTimerRef.current);
      editor.off('update', onUpdate);
    };
  }, [editor, activeDoc?.meta.id, contentRevision, settings?.editorSpellcheck, settings?.spellLanguages?.join(',')]);

  const insertImageFile = useCallback(async (file: File, position?: number) => {
    const instance = editorRef.current;
    if (!instance) return;
    if (!file.type.startsWith('image/')) {
      toast('Choose an image file.', 'error');
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      toast('Images must be smaller than 25 MB.', 'error');
      return;
    }
    try {
      const src = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('The image could not be read.'));
        reader.readAsDataURL(file);
      });
      const dimensions = await new Promise<{ width: number; height: number }>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
        image.onerror = () => reject(new Error('The image format is not supported.'));
        image.src = src;
      });
      const maxWidth = Math.max(220, page.width - page.marginLeft - page.marginRight - 4);
      const scale = Math.min(1, maxWidth / Math.max(1, dimensions.width));
      const width = Math.round(dimensions.width * scale);
      const height = Math.round(dimensions.height * scale);
      const node = { type: 'image', attrs: { src, alt: file.name.replace(/\.[^.]+$/, ''), title: file.name, width, height } };
      const chain = instance.chain().focus();
      if (typeof position === 'number') chain.insertContentAt(position, node).run();
      else chain.insertContent(node).run();
    } catch (caught) {
      toast(caught instanceof Error ? caught.message : 'The image could not be inserted.', 'error');
    }
  }, [page.height, page.marginLeft, page.marginRight, page.width, toast]);

  const openLink = useCallback(() => {
    const instance = editorRef.current;
    if (!instance) return;
    const { from, to, empty } = instance.state.selection;
    const selected = empty ? '' : instance.state.doc.textBetween(from, to, ' ');
    setLinkDraft({ open: true, text: selected, url: instance.getAttributes('link').href || '', original: selected });
  }, []);

  const openFootnote = useCallback((target?: { pos: number; text: string; label: string }) => {
    if (target) {
      setFootnoteDraft({ open: true, mode: 'edit', pos: target.pos, label: target.label, text: target.text });
      return;
    }
    const instance = editorRef.current;
    let count = 0;
    instance?.state.doc.descendants((node) => { if (node.type.name === 'footnote') count += 1; return true; });
    setFootnoteDraft({ open: true, mode: 'new', label: String(count + 1), text: '' });
  }, []);

  const openEquation = useCallback((target?: { pos: number; latex: string }) => {
    if (target) {
      setEquationDraft({ open: true, mode: 'edit', pos: target.pos, latex: target.latex });
      return;
    }
    const instance = editorRef.current;
    let selection = '';
    if (instance) {
      const { from, to, empty } = instance.state.selection;
      if (!empty) selection = instance.state.doc.textBetween(from, to, ' ');
    }
    setEquationDraft({ open: true, mode: 'new', latex: selection.trim() });
  }, []);

  const insertTableOfContents = useCallback(() => {
    const instance = editorRef.current;
    if (!instance) return;
    const entries: Array<{ level: number; text: string; index: number }> = [];
    instance.state.doc.descendants((node) => {
      if (node.type.name === 'heading') {
        const text = node.textContent.trim();
        if (text) entries.push({ level: Number(node.attrs.level) || 1, text, index: entries.length });
      }
      return true;
    });
    if (!entries.length) {
      toast(t('editor.outlineEmpty'), 'info');
      return;
    }
    instance.chain().focus().insertContent({ type: 'tableOfContents', attrs: { entries: JSON.stringify(entries) } }).run();
  }, [t, toast]);

  const insertTextbox = useCallback(() => {
    const instance = editorRef.current;
    if (!instance) return;
    instance.chain().focus().insertContent({
      type: 'callout',
      attrs: { variant: 'note' },
      content: [{ type: 'paragraph' }]
    }).run();
  }, []);

  const insertCaption = useCallback(() => {
    const instance = editorRef.current;
    if (!instance) return;
    let count = 0;
    instance.state.doc.descendants((node) => { if (node.type.name === 'caption') count += 1; return true; });
    instance.chain().focus().insertContent({
      type: 'caption',
      content: [{ type: 'text', text: `Figure ${count + 1}. ` }]
    }).run();
  }, []);

  const handleExport = useCallback(async (format: ExportFormat, options?: ExportOptions): Promise<ExportResult | null> => {
    const doc = docRef.current;
    if (!doc) return null;
    await saveNow({ silent: true, force: true });
    try {
      const result = await window.auren.files.exportDocument(doc.meta.id, format, options);
      if (result.canceled) {
        toast(t('editor.exportCanceled'), 'info');
        return result;
      }
      toast(t('editor.exported', { path: result.path ? replaceExtension(result.path) : format.toUpperCase() }), 'success');
      (result.warnings || []).slice(0, 3).forEach((warning) => toast(warning, 'info'));
      return result;
    } catch (caught) {
      toast(t('toast.exportFailed', { message: caught instanceof Error ? caught.message : String(caught) }), 'error');
      return null;
    }
  }, [saveNow, t, toast]);

  const openExport = useCallback((format?: ExportFormat) => {
    setExportDefault(format || settingsRef.current?.defaultExportFormat || 'docx');
    setExportOpen(true);
  }, []);

  const commitTitle = useCallback(async () => {
    const trimmed = titleRef.current.trim() || t('editor.untitled');
    if (!titleRef.current.trim()) {
      setTitle(trimmed);
      titleRef.current = trimmed;
    }
    const doc = docRef.current;
    if (doc && trimmed !== doc.meta.title) await renameActive(trimmed);
  }, [renameActive, t]);

  const flush = useCallback(async () => {
    if (draftTimerRef.current) { window.clearTimeout(draftTimerRef.current); draftTimerRef.current = null; }
    if (autoTimerRef.current) { window.clearTimeout(autoTimerRef.current); autoTimerRef.current = null; }
    if (dirtyRef.current) await saveNow({ silent: true, force: true });
  }, [saveNow]);

  const exportAs = useCallback(async (format: ExportFormat, options?: ExportOptions): Promise<ExportResult | null> => {
    if (format === 'pdf' && !options) {
      openExport('pdf');
      return null;
    }
    return handleExport(format, options);
  }, [handleExport, openExport]);

  const saveAsTemplate = useCallback(() => {
    setTemplateName(titleRef.current || t('editor.untitled'));
    setTemplateCategory('Personal');
    setTemplateDescription('');
    setTemplateOpen(true);
  }, [t]);

  const openVersionDialog = useCallback(async () => {
    await saveNow({ silent: true, force: true });
    setVersionOpen(true);
  }, [saveNow]);

  const bridge = useMemo<EditorBridge>(() => ({
    save: async (options) => { await saveNow({ activity: options?.activity, force: true }); },
    flush,
    focus: () => { editorRef.current?.commands.focus(); },
    getSelectionText: () => {
      const instance = editorRef.current;
      if (!instance) return '';
      const { from, to, empty } = instance.state.selection;
      return empty ? '' : instance.state.doc.textBetween(from, to, '\n');
    },
    getDocumentText: () => editorRef.current?.getText({ blockSeparator: '\n' }) || '',
    insertText: (text) => { editorRef.current?.chain().focus().insertContent(paragraphsFromText(text)).run(); },
    replaceSelection: (text) => { editorRef.current?.chain().focus().deleteSelection().insertContent(paragraphsFromText(text)).run(); },
    openFind: () => setFindOpen(true),
    openPageSetup: () => setPageSetupOpen(true),
    saveVersion: openVersionDialog,
    exportAs,
    saveAsTemplate,
    undo: () => { editorRef.current?.chain().focus().undo().run(); },
    redo: () => { editorRef.current?.chain().focus().redo().run(); }
  }), [exportAs, flush, openVersionDialog, saveAsTemplate, saveNow]);

  useEffect(() => {
    setEditorBridge(bridge);
    return () => {
      if (useAppStore.getState().editorBridge === bridge) setEditorBridge(null);
    };
  }, [bridge, setEditorBridge]);

  useEffect(() => () => {
    if (draftTimerRef.current) window.clearTimeout(draftTimerRef.current);
    if (autoTimerRef.current) window.clearTimeout(autoTimerRef.current);
    if (spellTimerRef.current) window.clearTimeout(spellTimerRef.current);
  }, []);

  useEffect(() => {
    if (!editor) return;
    const dom = editor.view.dom;
    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const anchor = target.closest('a');
      if (anchor && (event.ctrlKey || event.metaKey)) {
        const href = anchor.getAttribute('href');
        if (href && /^(https?:|mailto:)/i.test(href)) {
          event.preventDefault();
          void window.auren.app.openExternal(href);
        }
        return;
      }
      const tocLink = target.closest<HTMLAnchorElement>('a[data-pos], a[data-heading]');
      if (tocLink) {
        event.preventDefault();
        const wanted = Number(tocLink.dataset.heading ?? tocLink.dataset.pos ?? 0);
        let headingIndex = 0;
        let targetPos: number | null = null;
        editor.state.doc.descendants((node, pos) => {
          if (node.type.name === 'heading') {
            if (headingIndex === wanted) targetPos = pos;
            headingIndex += 1;
          }
          return true;
        });
        if (targetPos != null) editor.chain().focus().setTextSelection(Math.min(editor.state.doc.content.size, targetPos + 1)).scrollIntoView().run();
        return;
      }
      try {
        const footnote = target.closest<HTMLElement>('.auren-footnote');
        if (footnote) {
          const pos = editor.view.posAtDOM(footnote, 0);
          const node = editor.state.doc.nodeAt(pos) || editor.state.doc.nodeAt(Math.max(0, pos - 1));
          if (node?.type.name === 'footnote') {
            openFootnote({ pos, text: String(node.attrs.text || ''), label: String(node.attrs.label || '') });
          }
          return;
        }
        const math = target.closest<HTMLElement>('.auren-math');
        if (math) {
          const pos = editor.view.posAtDOM(math, 0);
          const node = editor.state.doc.nodeAt(pos) || editor.state.doc.nodeAt(Math.max(0, pos - 1));
          if (node?.type.name === 'equation') openEquation({ pos, latex: String(node.attrs.latex || '') });
        }
      } catch {
        // Clicking near a leaf can fall outside a text position; ignore.
      }
    };
    const onContext = (event: MouseEvent) => {
      const target = (event.target as HTMLElement).closest<HTMLElement>('.auren-spell-error');
      if (!target) return;
      event.preventDefault();
      const word = target.textContent || '';
      if (!word) return;
      try {
        const from = editor.view.posAtDOM(target, 0);
        const to = from + word.length;
        const snapshot = settingsRef.current;
        void window.auren.spell.suggest(word, snapshot?.spellLanguages || ['en']).then((suggestions) => {
          setSpellMenu({ x: event.clientX, y: event.clientY, from, to, word, suggestions });
        });
      } catch {
        // ignore malformed leaf positions
      }
    };
    dom.addEventListener('click', onClick);
    dom.addEventListener('contextmenu', onContext);
    return () => {
      dom.removeEventListener('click', onClick);
      dom.removeEventListener('contextmenu', onContext);
    };
  }, [editor, openEquation, openFootnote]);

  useEffect(() => {
    if (!moreOpen) return;
    const onDown = (event: MouseEvent) => {
      if (!moreRef.current?.contains(event.target as Node)) setMoreOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [moreOpen]);

  useEffect(() => {
    setShapePreview(createShapePng(shapeKind, shapeColor, shapeWidth, shapeKind === 'line' || shapeKind === 'arrow' ? 100 : 180));
  }, [shapeKind, shapeColor, shapeWidth]);

  const activePanel: PanelId | null = aiOpen ? 'ai' : inspectorOpen ? 'inspector' : outlineOpen ? 'outline' : timelineOpen ? 'timeline' : null;

  const togglePanel = (panel: PanelId) => {
    const isOpen = activePanel === panel;
    showPanel(isOpen ? null : panel);
  };

  const toggleFocus = () => {
    setFlag('focusMode');
    if (!focusMode) showPanel(null);
  };

  const startPanelResize = (event: React.PointerEvent) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = panelWidth;
    setPanelResizing(true);
    const move = (moveEvent: PointerEvent) => {
      const next = Math.max(286, Math.min(560, startWidth + startX - moveEvent.clientX));
      setPanelWidth(next);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      setPanelResizing(false);
      void useAppStore.getState().updateSettings({ rightPanelWidth: panelWidth });
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const stageHeight = Math.max(page.height, pages * (page.height + PAGE_GAP) - PAGE_GAP);
  const headerText = pageSettings.headerEnabled ? pageSettings.header.trim() : '';
  const footerText = pageSettings.footerEnabled ? pageSettings.footer.trim() : '';
  const panelTitle = activePanel === 'ai' ? t('editor.ai') : activePanel === 'inspector' ? t('editor.inspector') : activePanel === 'outline' ? t('editor.outline') : t('editor.timeline');
  const workspaceName = useAppStore((state) => state.workspaces.find((workspace) => workspace.id === activeDoc?.meta.workspaceId)?.name);

  if (!activeDoc) {
    return (
      <div className="editor-view editor-empty-view">
        <div className="empty-state">
          <div className="empty-icon"><FileText size={22} /></div>
          <h3>{t('editor.noDocument')}</h3>
          <button className="btn btn-primary" onClick={() => void showLibrary({ workspaceId: null, folder: null, search: '' })}>{t('nav.documents')}</button>
        </div>
      </div>
    );
  }

  return (
    <div className={cx('editor-view', focusMode && 'is-focus', zenMode && 'is-zen', dirty && 'is-dirty')}>
      {zenMode && (
        <button type="button" className="zen-exit" onClick={() => setFlag('zenMode', false)} title={t('editor.exitZen')}>
          <Minimize2 size={15} /> {t('editor.exitZen')}
        </button>
      )}

      <header className="editor-header">
        <div className="editor-header-left">
          <button type="button" className="editor-back" onClick={() => void showLibrary({ workspaceId: null, folder: null, search: '' })} title={t('nav.documents')}>
            <ChevronLeft size={16} />
          </button>
          <div className="editor-title-block">
            <input
              className="editor-title-input"
              value={title}
              aria-label={t('editor.addTitle')}
              onChange={(event) => { setTitle(event.target.value); markDirty(false); }}
              onBlur={() => void commitTitle()}
              onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); (event.target as HTMLInputElement).blur(); } }}
            />
            <div className="editor-subline">
              <span>{workspaceName || activeDoc.meta.folder || t('view.home.personal')}</span>
              <span className="editor-subline-dot" />
              <span>{dirty ? t('common.unsaved') : t('common.saved')}</span>
              <span className="editor-subline-dot" />
              <span>{pages === 1 ? t('editor.pageOf', { page: 1, total: 1 }) : t('editor.pageOf', { page: pages, total: pages })}</span>
            </div>
          </div>
        </div>
        <div className="editor-header-actions">
          <IconButton label={t('editor.outline')} active={outlineOpen} onClick={() => togglePanel('outline')}><ListTree size={16} /></IconButton>
          <IconButton label={t('editor.inspector')} active={inspectorOpen} onClick={() => togglePanel('inspector')}><PanelRight size={16} /></IconButton>
          <IconButton label={t('editor.timeline')} active={timelineOpen} onClick={() => togglePanel('timeline')}><HistoryIcon size={16} /></IconButton>
          <IconButton label={t('editor.ai')} active={aiOpen} onClick={() => togglePanel('ai')}><Sparkles size={16} /></IconButton>
          <span className="editor-header-divider" />
          <IconButton label={t('editor.focus')} active={focusMode} onClick={toggleFocus}><Focus size={16} /></IconButton>
          <IconButton label={t('editor.zen')} active={zenMode} onClick={() => setFlag('zenMode')}><Maximize2 size={15} /></IconButton>
          <div className="editor-more" ref={moreRef}>
            <IconButton label={t('common.more')} active={moreOpen} onClick={() => setMoreOpen((value) => !value)}><MoreHorizontal size={17} /></IconButton>
            {moreOpen && (
              <div className="editor-more-menu" role="menu">
                <button className="menu-item" onClick={() => { setFindOpen(true); setMoreOpen(false); }}><span className="menu-icon"><Search size={14} /></span><span className="menu-label">{t('editor.find')}</span><span className="menu-shortcut">Ctrl F</span></button>
                <button className="menu-item" onClick={() => { setPageSetupOpen(true); setMoreOpen(false); }}><span className="menu-icon"><Ruler size={14} /></span><span className="menu-label">{t('editor.pageSettings')}</span></button>
                <button className="menu-item" onClick={() => { openExport(); setMoreOpen(false); }}><span className="menu-icon"><FileDown size={14} /></span><span className="menu-label">{t('editor.export')}</span></button>
                <div className="menu-sep" />
                <button className="menu-item" onClick={() => { void openVersionDialog(); setMoreOpen(false); }}><span className="menu-icon"><CalendarClock size={14} /></span><span className="menu-label">{t('editor.saveVersion')}</span><span className="menu-shortcut">Ctrl Shift S</span></button>
                <button className="menu-item" onClick={() => { saveAsTemplate(); setMoreOpen(false); }}><span className="menu-icon"><LayoutTemplate size={14} /></span><span className="menu-label">{t('view.templates.saveAs')}</span></button>
                <div className="menu-sep" />
                <button className="menu-item" onClick={() => { toggleFocus(); setMoreOpen(false); }}><span className="menu-icon"><Focus size={14} /></span><span className="menu-label">{focusMode ? t('editor.exitFocus') : t('editor.focus')}</span><span className="menu-shortcut">F8</span></button>
                <button className="menu-item" onClick={() => { setFlag('zenMode'); setMoreOpen(false); }}><span className="menu-icon"><Maximize2 size={14} /></span><span className="menu-label">{zenMode ? t('editor.exitZen') : t('editor.zen')}</span><span className="menu-shortcut">F11</span></button>
              </div>
            )}
          </div>
        </div>
      </header>

      {!zenMode && (
        <EditorToolbar
          editor={editor!}
          onFind={() => setFindOpen(true)}
          onImage={() => imageInputRef.current?.click()}
          onLink={openLink}
          onFootnote={() => openFootnote()}
          onEquation={() => openEquation()}
          onShape={() => setShapeOpen(true)}
          onTextbox={insertTextbox}
          onToc={insertTableOfContents}
          onCaption={insertCaption}
          onPageSetup={() => setPageSetupOpen(true)}
          onExport={() => openExport()}
        />
      )}

      {findOpen && editor && <FindReplaceBar editor={editor} open={findOpen} onClose={closeFind} />}

      <div className="editor-workspace">
        <div className="editor-canvas-scroll" ref={scrollRef}>
          <div className="editor-canvas">
            <div
              className="editor-page-stage"
              ref={stageRef}
              data-page-guides={settings?.pageGuides ? 'on' : 'off'}
              style={{ width: page.width, minHeight: stageHeight, zoom: zoom / 100 } as React.CSSProperties}
            >
              <div className="page-deck" aria-hidden="true">
                {Array.from({ length: pages }, (_, index) => (
                  <div
                    className="page-card"
                    key={index}
                    style={{ top: index * (page.height + PAGE_GAP), width: page.width, height: page.height }}
                  >
                    {headerText && (
                      <div className="page-card-header" style={{ top: Math.max(18, page.marginTop * 0.42), left: page.marginLeft, right: page.marginRight }}>
                        <span>{renderPageTokens(headerText, { page: index + 1, total: pages, title })}</span>
                      </div>
                    )}
                    {(footerText || pageSettings.pageNumbering) && (
                      <div className="page-card-footer" style={{ bottom: Math.max(16, page.marginBottom * 0.38), left: page.marginLeft, right: page.marginRight }}>
                        {footerText && <span>{renderPageTokens(footerText, { page: index + 1, total: pages, title })}</span>}
                        {pageSettings.pageNumbering && <span className="page-card-number">{index + 1} / {pages}</span>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <EditorContent
                editor={editor}
                className="editor-sheet"
                style={{
                  minHeight: stageHeight,
                  paddingTop: page.marginTop,
                  paddingRight: page.marginRight,
                  paddingBottom: page.marginBottom,
                  paddingLeft: page.marginLeft
                }}
              />
            </div>
          </div>
          <div className="editor-canvas-foot">
            <span>{t('editor.pageOf', { page: pages, total: pages })}</span>
          </div>
        </div>

        {activePanel && (
          <aside className={`editor-side-panel ${panelResizing ? 'is-resizing' : ''}`} style={{ width: panelWidth }}>
            <header className="editor-panel-header">
              <div className="editor-panel-title">
                {activePanel === 'ai' ? <Sparkles size={14} /> : activePanel === 'inspector' ? <PanelRight size={14} /> : activePanel === 'outline' ? <ListTree size={14} /> : <HistoryIcon size={14} />}
                <span>{panelTitle}</span>
              </div>
              <IconButton label={t('common.close')} onClick={() => showPanel(null)}><ChevronLeft size={15} /></IconButton>
            </header>
            {activePanel === 'outline' && editor && <OutlinePanel editor={editor} />}
            {activePanel === 'inspector' && editor && <InspectorPanel editor={editor} doc={activeDoc} pages={pages} onPageSetup={() => setPageSetupOpen(true)} />}
            {activePanel === 'timeline' && <TimelinePanel doc={activeDoc} onRestored={() => { setFindOpen(false); }} />}
            {activePanel === 'ai' && editor && <AIPanel editor={editor} onConfigure={() => void navigate('settings')} />}
            <div className="panel-resizer" onPointerDown={startPanelResize} />
          </aside>
        )}
      </div>

      <footer className="editor-statusbar">
        <div className="statusbar-left">
          {settings?.showWordCount !== false && <span>{wordCount.toLocaleString(language === 'fr' ? 'fr-FR' : 'en-US')} {t('common.words')}</span>}
          <span className="statusbar-dot" />
          <span>{charCount.toLocaleString(language === 'fr' ? 'fr-FR' : 'en-US')} {t('common.characters')}</span>
          {settings?.showReadingTime && <><span className="statusbar-dot" /><span>{t('editor.wordsRead', { count: Math.max(1, Math.ceil(wordCount / 230)) })}</span></>}
          <span className="statusbar-dot" />
          <span>{t('editor.pageOf', { page: pages, total: pages })}</span>
        </div>
        <div className="statusbar-right">
          <button type="button" className={cx('statusbar-btn', settings?.editorSpellcheck && 'is-on')} onClick={() => void navigate('settings')} title={t('settings.spellcheck')}>
            {settings?.editorSpellcheck ? `${t('settings.spellcheck')} · ${(settings.spellLanguages || []).join(', ')}` : t('editor.statusError')}
          </button>
          <span className="statusbar-divider" />
          <div className="editor-zoom">
            <button type="button" onClick={() => setZoom((value) => Math.max(60, value - 10))} aria-label="Zoom out">−</button>
            <button type="button" className="editor-zoom-value" onClick={() => setZoom(100)}>{zoom}%</button>
            <button type="button" onClick={() => setZoom((value) => Math.min(160, value + 10))} aria-label="Zoom in">+</button>
          </div>
          <span className="statusbar-divider" />
          <button type="button" className={cx('statusbar-btn', focusMode && 'is-on')} onClick={toggleFocus}><Focus size={12} /> {t('editor.focus')}</button>
          <button type="button" className={cx('statusbar-btn', zenMode && 'is-on')} onClick={() => setFlag('zenMode')}><Maximize2 size={12} /> {t('editor.zen')}</button>
        </div>
      </footer>

      {editor && (
        <BubbleMenu
          editor={editor}
          tippyOptions={{ duration: 120, placement: 'top', maxWidth: 520 }}
          shouldShow={({ editor: instance, from, to }) => from !== to && !instance.isActive('image') && !instance.isActive('codeBlock')}
          className="bubble-toolbar"
        >
          <button type="button" className={cx(editor.isActive('bold') && 'is-active')} onClick={() => editor.chain().focus().toggleBold().run()} title={t('editor.bold')}><Bold size={14} /></button>
          <button type="button" className={cx(editor.isActive('italic') && 'is-active')} onClick={() => editor.chain().focus().toggleItalic().run()} title={t('editor.italic')}><Italic size={14} /></button>
          <button type="button" className={cx(editor.isActive('underline') && 'is-active')} onClick={() => editor.chain().focus().toggleUnderline().run()} title={t('editor.underline')}><UnderlineIcon size={14} /></button>
          <button type="button" className={cx(editor.isActive('strike') && 'is-active')} onClick={() => editor.chain().focus().toggleStrike().run()} title={t('editor.strike')}><Strikethrough size={14} /></button>
          <span className="bubble-divider" />
          <button type="button" className={cx(editor.isActive('link') && 'is-active')} onClick={openLink} title={t('editor.link')}><Link2 size={14} /></button>
          <button type="button" className={cx(editor.isActive('highlight') && 'is-active')} onClick={() => editor.chain().focus().toggleHighlight({ color: '#fff2a8' }).run()} title={t('editor.highlight')}><span className="bubble-highlight" /></button>
          <button type="button" className={cx(editor.isActive({ textAlign: 'left' }) && 'is-active')} onClick={() => editor.chain().focus().setTextAlign('left').run()} title={t('editor.alignLeft')}><AlignLeft size={14} /></button>
          <span className="bubble-divider" />
          <button type="button" className="bubble-ai" onClick={() => showPanel('ai')} title={t('editor.ai')}><Sparkles size={13} /> AI</button>
        </BubbleMenu>
      )}

      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void insertImageFile(file);
          event.target.value = '';
        }}
      />

      <PageSetupDialog
        open={pageSetupOpen}
        pageSettings={pageSettings}
        onClose={() => setPageSetupOpen(false)}
        onApply={async (patch) => {
          await updatePageSettings(patch);
          window.setTimeout(() => window.dispatchEvent(new Event('auren:refresh-pagination')), 40);
        }}
      />

      <ExportDialog
        open={exportOpen}
        defaultFormat={exportDefault}
        pageSettings={pageSettings}
        busy={exportBusy}
        onClose={() => setExportOpen(false)}
        onExport={async (format, options) => {
          setExportBusy(true);
          try {
            await handleExport(format, options);
            setExportOpen(false);
          } finally {
            setExportBusy(false);
          }
        }}
      />

      <Modal
        open={linkDraft.open}
        title={t('editor.linkTitle')}
        description={t('editor.linkUrl')}
        onClose={() => setLinkDraft((draft) => ({ ...draft, open: false }))}
        width={460}
        footer={(
          <>
            {linkDraft.url && <button className="btn btn-ghost" data-secondary onClick={() => { editor?.chain().focus().extendMarkRange('link').unsetLink().run(); setLinkDraft((draft) => ({ ...draft, open: false })); }}>{t('common.remove')}</button>}
            <button className="btn btn-ghost" onClick={() => setLinkDraft((draft) => ({ ...draft, open: false }))}>{t('common.cancel')}</button>
            <button className="btn btn-primary" onClick={() => {
              let href = linkDraft.url.trim();
              if (!href) {
                editor?.chain().focus().extendMarkRange('link').unsetLink().run();
                setLinkDraft((draft) => ({ ...draft, open: false }));
                return;
              }
              if (!/^(https?:|mailto:|#)/i.test(href)) href = `https://${href}`;
              if (!/^(https?:|mailto:|#)/i.test(href)) {
                toast(t('editor.linkUrl'), 'error');
                return;
              }
              const display = linkDraft.text.trim();
              if (display && display !== linkDraft.original) {
                editor?.chain().focus().insertContent({ type: 'text', text: display, marks: [{ type: 'link', attrs: { href } }] }).run();
              } else if (display && !linkDraft.original) {
                editor?.chain().focus().insertContent({ type: 'text', text: display, marks: [{ type: 'link', attrs: { href } }] }).run();
              } else {
                editor?.chain().focus().extendMarkRange('link').setLink({ href }).run();
              }
              setLinkDraft((draft) => ({ ...draft, open: false }));
            }}>{t('common.apply')}</button>
          </>
        )}
      >
        <div className="field">
          <label>{t('editor.linkText')}</label>
          <input className="input" value={linkDraft.text} onChange={(event) => setLinkDraft((draft) => ({ ...draft, text: event.target.value }))} placeholder={t('editor.linkText')} />
        </div>
        <div className="field">
          <label>{t('editor.linkUrl')}</label>
          <input className="input" value={linkDraft.url} onChange={(event) => setLinkDraft((draft) => ({ ...draft, url: event.target.value }))} placeholder="https://" autoFocus />
        </div>
      </Modal>

      <Modal
        open={footnoteDraft.open}
        title={t('editor.footnoteTitle')}
        description={t('editor.footnoteText')}
        onClose={() => setFootnoteDraft((draft) => ({ ...draft, open: false }))}
        width={460}
        footer={(
          <>
            <button className="btn btn-ghost" data-secondary onClick={() => setFootnoteDraft((draft) => ({ ...draft, open: false }))}>{t('common.cancel')}</button>
            <button className="btn btn-primary" onClick={() => {
              const text = footnoteDraft.text.trim() || t('editor.footnoteTitle');
              const instance = editorRef.current;
              if (!instance) return;
              if (footnoteDraft.mode === 'edit' && typeof footnoteDraft.pos === 'number') {
                instance.chain().focus().setNodeSelection(footnoteDraft.pos).updateAttributes('footnote', { text, label: footnoteDraft.label }).run();
              } else {
                instance.chain().focus().insertContent({ type: 'footnote', attrs: { text, label: footnoteDraft.label } }).run();
              }
              setFootnoteDraft((draft) => ({ ...draft, open: false }));
            }}>{t('common.save')}</button>
          </>
        )}
      >
        <div className="field-row">
          <div className="field">
            <label>#</label>
            <input className="input" value={footnoteDraft.label} onChange={(event) => setFootnoteDraft((draft) => ({ ...draft, label: event.target.value }))} />
          </div>
          <div className="field" style={{ gridColumn: 'span 1' }}>
            <label>{t('editor.footnoteText')}</label>
            <input className="input" value={footnoteDraft.text} onChange={(event) => setFootnoteDraft((draft) => ({ ...draft, text: event.target.value }))} autoFocus />
          </div>
        </div>
      </Modal>

      <Modal
        open={equationDraft.open}
        title={t('editor.equationTitle')}
        description={t('editor.equationHint')}
        onClose={() => setEquationDraft((draft) => ({ ...draft, open: false }))}
        width={540}
        footer={(
          <>
            <button className="btn btn-ghost" data-secondary onClick={() => setEquationDraft((draft) => ({ ...draft, open: false }))}>{t('common.cancel')}</button>
            <button className="btn btn-primary" disabled={!equationDraft.latex.trim()} onClick={() => {
              const instance = editorRef.current;
              if (!instance) return;
              if (equationDraft.mode === 'edit' && typeof equationDraft.pos === 'number') {
                instance.chain().focus().setNodeSelection(equationDraft.pos).updateAttributes('equation', { latex: equationDraft.latex.trim() }).run();
              } else {
                instance.chain().focus().insertContent({ type: 'equation', attrs: { latex: equationDraft.latex.trim() } }).run();
              }
              setEquationDraft((draft) => ({ ...draft, open: false }));
            }}>{t('editor.equationTitle')}</button>
          </>
        )}
      >
        <div className="field">
          <label>LaTeX</label>
          <textarea className="textarea mono" rows={4} value={equationDraft.latex} onChange={(event) => setEquationDraft((draft) => ({ ...draft, latex: event.target.value }))} placeholder="E = mc^2" autoFocus />
        </div>
        <div className="equation-preview">
          {equationDraft.latex.trim()
            ? <span dangerouslySetInnerHTML={{ __html: katex.renderToString(equationDraft.latex, { throwOnError: false, output: 'mathml' }) }} />
            : <span className="field-hint">E = mc²</span>}
        </div>
      </Modal>

      <Modal
        open={shapeOpen}
        title={t('editor.shapeTitle')}
        onClose={() => setShapeOpen(false)}
        width={540}
        footer={(
          <>
            <button className="btn btn-ghost" data-secondary onClick={() => setShapeOpen(false)}>{t('common.cancel')}</button>
            <button className="btn btn-primary" onClick={() => {
              const pngDataUrl = createShapePng(shapeKind, shapeColor, shapeWidth, shapeKind === 'line' || shapeKind === 'arrow' ? 100 : 180);
              editorRef.current?.chain().focus().insertContent({
                type: 'shape',
                attrs: { shape: shapeKind, color: shapeColor, width: shapeWidth, height: shapeKind === 'line' || shapeKind === 'arrow' ? 100 : 180, pngDataUrl, alt: `${shapeKind} shape` }
              }).run();
              setShapeOpen(false);
            }}>{t('editor.shapeTitle')}</button>
          </>
        )}
      >
        <div className="shape-options">
          {([
            ['rectangle', <Square size={17} key="r" />],
            ['ellipse', <Circle size={17} key="e" />],
            ['line', <ArrowRight size={17} key="l" />],
            ['arrow', <ArrowRight size={17} key="a" />]
          ] as Array<[ShapeKind, React.ReactNode]>).map(([kind, icon]) => (
            <button key={kind} type="button" className={cx('shape-option', shapeKind === kind && 'is-active')} onClick={() => setShapeKind(kind)}>
              {icon}
              <span>{kind === 'rectangle' ? t('editor.rectangle') : kind === 'ellipse' ? t('editor.ellipse') : kind === 'line' ? t('editor.line') : t('editor.arrow')}</span>
            </button>
          ))}
        </div>
        <div className="shape-preview"><img src={shapePreview} alt="" /></div>
        <div className="shape-settings">
          <div className="field">
            <label>{t('editor.fill')}</label>
            <div className="swatch-row">
              {SHAPE_COLORS.map((color) => <button key={color} type="button" className={cx('swatch', shapeColor === color && 'is-selected')} style={{ background: color }} onClick={() => setShapeColor(color)} aria-label={color} />)}
            </div>
          </div>
          <div className="field">
            <label>{t('editor.width')}</label>
            <div className="segmented">
              {[280, 420, 560].map((width) => <button key={width} className={shapeWidth === width ? 'is-active' : ''} onClick={() => setShapeWidth(width)}>{width}</button>)}
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        open={templateOpen}
        title={t('view.templates.saveAs')}
        description={t('editor.templateDescription')}
        onClose={() => setTemplateOpen(false)}
        width={500}
        footer={(
          <>
            <button className="btn btn-ghost" data-secondary onClick={() => setTemplateOpen(false)}>{t('common.cancel')}</button>
            <button className="btn btn-primary" disabled={!templateName.trim()} onClick={async () => {
              const instance = editorRef.current;
              if (!instance) return;
              try {
                await window.auren.library.saveTemplate({
                  title: templateName.trim(),
                  category: templateCategory.trim() || 'Personal',
                  description: templateDescription.trim(),
                  html: instance.getHTML(),
                  content: instance.getJSON(),
                  pageSettings
                });
                toast(t('editor.templateSaved'), 'success');
                setTemplateOpen(false);
              } catch (caught) {
                toast(caught instanceof Error ? caught.message : String(caught), 'error');
              }
            }}><Save size={13} /> {t('common.save')}</button>
          </>
        )}
      >
        <div className="field">
          <label>{t('editor.templateName')}</label>
          <input className="input" value={templateName} onChange={(event) => setTemplateName(event.target.value)} autoFocus />
        </div>
        <div className="field">
          <label>{t('editor.templateCategory')}</label>
          <input className="input" value={templateCategory} onChange={(event) => setTemplateCategory(event.target.value)} placeholder="Personal" />
        </div>
        <div className="field">
          <label>{t('editor.templateDescription')}</label>
          <input className="input" value={templateDescription} onChange={(event) => setTemplateDescription(event.target.value)} />
        </div>
      </Modal>

      <PromptDialog
        open={versionOpen}
        title={t('editor.saveVersion')}
        description={t('editor.versionLabel')}
        initialValue={`${t('editor.versions')} · ${formatDate(Date.now(), language, 'short')}`}
        confirmLabel={t('common.save')}
        onClose={() => setVersionOpen(false)}
        onConfirm={async (label) => {
          const doc = docRef.current;
          if (!doc) return;
          try {
            await window.auren.library.createVersion(doc.meta.id, label);
            toast(t('editor.versionSaved'), 'success');
            window.dispatchEvent(new Event('auren:version-saved'));
          } catch (caught) {
            toast(caught instanceof Error ? caught.message : String(caught), 'error');
          }
        }}
      />

      {spellMenu && (
        <ContextMenu
          x={spellMenu.x}
          y={spellMenu.y}
          onClose={() => setSpellMenu(null)}
          items={[
            ...(spellMenu.suggestions.length
              ? spellMenu.suggestions.slice(0, 6).map((suggestion) => ({
                label: suggestion,
                icon: <Check size={13} />,
                onClick: () => editorRef.current?.chain().focus().insertContentAt({ from: spellMenu.from, to: spellMenu.to }, suggestion).run()
              }))
              : [{ label: t('common.none'), disabled: true }]),
            { separator: true } as MenuItem,
            {
              label: t('editor.ignoreSpelling'),
              icon: <ExternalLink size={13} />,
              onClick: () => editorRef.current?.commands.ignoreSpellWord(spellMenu.word)
            }
          ]}
        />
      )}
    </div>
  );
}
