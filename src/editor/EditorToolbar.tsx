import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Editor } from '@tiptap/react';
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  ArrowUpRight,
  Baseline,
  Bold,
  BookOpen,
  Captions,
  ChevronDown,
  Code,
  Download,
  FileDown,
  Highlighter,
  Image as ImageIcon,
  Italic,
  Link2,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  Palette,
  Pilcrow,
  Quote,
  Redo2,
  Search,
  Settings2,
  Shapes,
  Sigma,
  SquareDashed,
  Strikethrough,
  Subscript,
  Superscript,
  Table2,
  Trash2,
  Underline,
  Undo2
} from 'lucide-react';
import { useT } from '../lib/utils';
import { useAppStore } from '../store/app';

const FONTS = [
  { value: 'Inter Variable', label: 'Inter' },
  { value: 'Newsreader Variable', label: 'Newsreader' },
  { value: 'Georgia', label: 'Georgia' },
  { value: 'Times New Roman', label: 'Times New Roman' },
  { value: 'Garamond', label: 'Garamond' },
  { value: 'Arial', label: 'Arial' },
  { value: 'Courier New', label: 'Courier New' }
];

const SIZES = [9, 10, 10.5, 11, 12, 13, 14, 16, 18, 20, 24, 28, 32, 36, 42, 48, 60, 72];

const TEXT_COLORS = ['#efedf6', '#282419', '#8b7cf6', '#5aa7f7', '#48c6a2', '#e6a556', '#e8788a', '#b7b2c9'];
const HIGHLIGHTS = ['#fff2a8', '#d7f5e6', '#dce7ff', '#ffe0d8', '#f1dcff', '#ffd6e5'];

function Dropdown({ label, icon, children, className }: { label: string; icon: ReactNode; children: (close: () => void) => ReactNode; className?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [open]);
  return (
    <div className={`tb-dropdown ${className || ''}`} ref={ref}>
      <button type="button" className={`tb-btn ${open ? 'is-open' : ''}`} title={label} aria-label={label} onMouseDown={(event) => event.preventDefault()} onClick={() => setOpen((value) => !value)}>
        {icon}
        <ChevronDown size={9} className="tb-caret" />
      </button>
      {open && <div className="tb-menu" role="menu" onMouseDown={(event) => event.stopPropagation()}>{children(() => setOpen(false))}</div>}
    </div>
  );
}

function Tool({ label, active, disabled, onClick, children }: { label: string; active?: boolean; disabled?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      className={`tb-btn ${active ? 'is-active' : ''}`}
      title={label}
      aria-label={label}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function Div() { return <span className="tb-divider" />; }

export function EditorToolbar({
  editor,
  onFind,
  onImage,
  onLink,
  onFootnote,
  onEquation,
  onShape,
  onTextbox,
  onToc,
  onCaption,
  onPageSetup,
  onExport
}: {
  editor: Editor;
  onFind: () => void;
  onImage: () => void;
  onLink: () => void;
  onFootnote: () => void;
  onEquation: () => void;
  onShape: () => void;
  onTextbox: () => void;
  onToc: () => void;
  onCaption: () => void;
  onPageSetup: () => void;
  onExport: () => void;
}) {
  const t = useT();
  const [, force] = useState(0);
  const density = useAppStore((state) => state.settings?.toolbarDensity || 'comfortable');

  useEffect(() => {
    const update = () => force((value) => value + 1);
    editor.on('transaction', update);
    editor.on('selectionUpdate', update);
    return () => {
      editor.off('transaction', update);
      editor.off('selectionUpdate', update);
    };
  }, [editor]);

  const chain = () => editor.chain().focus();
  const textStyle = editor.getAttributes('textStyle');
  const fontFamily = String(textStyle.fontFamily || '').replace(/["']/g, '');
  const fontSize = parseFloat(String(textStyle.fontSize || '')) || 0;
  const heading = ([1, 2, 3, 4, 5, 6] as const).find((level) => editor.isActive('heading', { level }));
  const blockValue = editor.isActive('blockquote') ? 'quote' : editor.isActive('codeBlock') ? 'code' : heading ? `h${heading}` : 'p';
  const align = editor.isActive({ textAlign: 'center' }) ? 'center' : editor.isActive({ textAlign: 'right' }) ? 'right' : editor.isActive({ textAlign: 'justify' }) ? 'justify' : 'left';

  const insertTable = () => chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();

  return (
    <div className={`editor-toolbar density-${density}`} role="toolbar" aria-label={t('editor.format')}>
      <div className="tb-group">
        <Tool label={t('editor.undo')} onClick={() => chain().undo().run()} disabled={!editor.can().undo()}><Undo2 size={15} /></Tool>
        <Tool label={t('editor.redo')} onClick={() => chain().redo().run()} disabled={!editor.can().redo()}><Redo2 size={15} /></Tool>
      </div>
      <Div />
      <div className="tb-group">
        <span className="tb-select-wrap is-block">
          <select
            className="tb-select"
            value={blockValue}
            aria-label={t('editor.format')}
            onChange={(event) => {
              const value = event.target.value;
              if (value === 'p') chain().setParagraph().run();
              else if (value === 'quote') chain().toggleBlockquote().run();
              else if (value === 'code') chain().toggleCodeBlock().run();
              else chain().setHeading({ level: Number(value.slice(1)) as 1 | 2 | 3 | 4 | 5 | 6 }).run();
            }}
          >
            <option value="p">{t('editor.normal')}</option>
            <option value="h1">{t('editor.heading1')}</option>
            <option value="h2">{t('editor.heading2')}</option>
            <option value="h3">{t('editor.heading3')}</option>
            <option value="h4">Heading 4</option>
            <option value="h5">Heading 5</option>
            <option value="h6">Heading 6</option>
            <option value="quote">{t('editor.quote')}</option>
            <option value="code">{t('editor.code')}</option>
          </select>
        </span>
        <span className="tb-select-wrap is-font">
          <select
            className="tb-select"
            value={fontFamily}
            aria-label={t('editor.font')}
            onChange={(event) => {
              const value = event.target.value;
              if (value) chain().setFontFamily(value).run();
              else chain().unsetFontFamily().run();
            }}
          >
            <option value="">{t('editor.font')}</option>
            {FONTS.map((font) => <option key={font.value} value={font.value}>{font.label}</option>)}
          </select>
        </span>
        <span className="tb-select-wrap is-size">
          <select
            className="tb-select"
            value={fontSize || ''}
            aria-label={t('editor.size')}
            onChange={(event) => {
              const value = event.target.value;
              if (value) chain().setMark('textStyle', { fontSize: `${value}px` }).run();
              else chain().setMark('textStyle', { fontSize: null }).run();
            }}
          >
            <option value="">{t('editor.size')}</option>
            {SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
          </select>
        </span>
      </div>
      <Div />
      <div className="tb-group">
        <Tool label={t('editor.bold')} active={editor.isActive('bold')} onClick={() => chain().toggleBold().run()}><Bold size={15} /></Tool>
        <Tool label={t('editor.italic')} active={editor.isActive('italic')} onClick={() => chain().toggleItalic().run()}><Italic size={15} /></Tool>
        <Tool label={t('editor.underline')} active={editor.isActive('underline')} onClick={() => chain().toggleUnderline().run()}><Underline size={15} /></Tool>
        <Tool label={t('editor.strike')} active={editor.isActive('strike')} onClick={() => chain().toggleStrike().run()}><Strikethrough size={15} /></Tool>
        <Tool label={t('editor.codeInline')} active={editor.isActive('code')} onClick={() => chain().toggleCode().run()}><Code size={15} /></Tool>
        <Tool label={t('editor.superscript')} active={editor.isActive('superscript')} onClick={() => chain().toggleSuperscript().run()}><Superscript size={15} /></Tool>
        <Tool label={t('editor.subscript')} active={editor.isActive('subscript')} onClick={() => chain().toggleSubscript().run()}><Subscript size={15} /></Tool>
      </div>
      <Div />
      <div className="tb-group">
        <Dropdown label={t('editor.color')} icon={<span className="tb-color"><Baseline size={15} /><span style={{ background: String(textStyle.color || 'currentColor') }} /></span>}>
          {(close) => (
            <div className="tb-palette">
              <div className="tb-palette-title">{t('editor.color')}</div>
              <div className="tb-swatches">
                {TEXT_COLORS.map((color) => (
                  <button key={color} type="button" className="tb-swatch" style={{ background: color }} title={color} onClick={() => { chain().setColor(color).run(); close(); }} />
                ))}
              </div>
              <label className="tb-custom-color">
                <span>{t('editor.custom')}</span>
                <input type="color" value={String(textStyle.color || '#8b7cf6')} onChange={(event) => chain().setColor(event.target.value).run()} />
              </label>
              <button type="button" className="tb-menu-item" onClick={() => { chain().unsetColor().run(); close(); }}>{t('common.reset')}</button>
            </div>
          )}
        </Dropdown>
        <Dropdown label={t('editor.highlight')} icon={<span className="tb-color"><Highlighter size={15} /><span style={{ background: String(editor.getAttributes('highlight').color || '#fff2a8') }} /></span>}>
          {(close) => (
            <div className="tb-palette">
              <div className="tb-palette-title">{t('editor.highlight')}</div>
              <div className="tb-swatches">
                {HIGHLIGHTS.map((color) => (
                  <button key={color} type="button" className="tb-swatch" style={{ background: color }} title={color} onClick={() => { chain().toggleHighlight({ color }).run(); close(); }} />
                ))}
              </div>
              <button type="button" className="tb-menu-item" onClick={() => { chain().unsetHighlight().run(); close(); }}>{t('common.reset')}</button>
            </div>
          )}
        </Dropdown>
      </div>
      <Div />
      <div className="tb-group">
        <Tool label={t('editor.alignLeft')} active={align === 'left'} onClick={() => chain().setTextAlign('left').run()}><AlignLeft size={15} /></Tool>
        <Tool label={t('editor.alignCenter')} active={align === 'center'} onClick={() => chain().setTextAlign('center').run()}><AlignCenter size={15} /></Tool>
        <Tool label={t('editor.alignRight')} active={align === 'right'} onClick={() => chain().setTextAlign('right').run()}><AlignRight size={15} /></Tool>
        <Tool label={t('editor.alignJustify')} active={align === 'justify'} onClick={() => chain().setTextAlign('justify').run()}><AlignJustify size={15} /></Tool>
      </div>
      <Div />
      <div className="tb-group">
        <Tool label={t('editor.bulletList')} active={editor.isActive('bulletList')} onClick={() => chain().toggleBulletList().run()}><List size={15} /></Tool>
        <Tool label={t('editor.numberedList')} active={editor.isActive('orderedList')} onClick={() => chain().toggleOrderedList().run()}><ListOrdered size={15} /></Tool>
        <Tool label={t('editor.taskList')} active={editor.isActive('taskList')} onClick={() => chain().toggleTaskList().run()}><ListChecks size={15} /></Tool>
        <Tool label={t('editor.quote')} active={editor.isActive('blockquote')} onClick={() => chain().toggleBlockquote().run()}><Quote size={15} /></Tool>
      </div>
      <Div />
      <div className="tb-group">
        <Dropdown label={t('editor.insert')} icon={<SquareDashed size={15} />} className="tb-insert">
          {(close) => (
            <div className="tb-insert-menu">
              <button type="button" className="tb-menu-item" onClick={() => { onImage(); close(); }}><ImageIcon size={14} /><span>{t('editor.image')}</span></button>
              <button type="button" className="tb-menu-item" onClick={() => { onLink(); close(); }}><Link2 size={14} /><span>{t('editor.link')}</span></button>
              <button type="button" className="tb-menu-item" onClick={() => { insertTable(); close(); }}><Table2 size={14} /><span>{t('editor.table')}</span></button>
              <button type="button" className="tb-menu-item" onClick={() => { chain().setHorizontalRule().run(); close(); }}><Minus size={14} /><span>{t('editor.divider')}</span></button>
              <div className="tb-menu-sep" />
              <button type="button" className="tb-menu-item" onClick={() => { chain().insertContent({ type: 'pageBreak' }).run(); close(); }}><ArrowUpRight size={14} /><span>{t('editor.pageBreak')}</span></button>
              <button type="button" className="tb-menu-item" onClick={() => { onFootnote(); close(); }}><BookOpen size={14} /><span>{t('editor.footnote')}</span></button>
              <button type="button" className="tb-menu-item" onClick={() => { onEquation(); close(); }}><Sigma size={14} /><span>{t('editor.equation')}</span></button>
              <button type="button" className="tb-menu-item" onClick={() => { onTextbox(); close(); }}><SquareDashed size={14} /><span>{t('editor.textbox')}</span></button>
              <button type="button" className="tb-menu-item" onClick={() => { onShape(); close(); }}><Shapes size={14} /><span>{t('editor.shape')}</span></button>
              <button type="button" className="tb-menu-item" onClick={() => { onToc(); close(); }}><List size={14} /><span>{t('editor.toc')}</span></button>
              <button type="button" className="tb-menu-item" onClick={() => { onCaption(); close(); }}><Captions size={14} /><span>{t('editor.caption')}</span></button>
            </div>
          )}
        </Dropdown>
        {editor.isActive('table') && (
          <Dropdown label={t('editor.tableActions')} icon={<Table2 size={15} />} className="tb-table">
            {(close) => (
              <div className="tb-insert-menu">
                <button type="button" className="tb-menu-item" onClick={() => { chain().addRowAfter().run(); close(); }}><span>{t('editor.addRow')}</span></button>
                <button type="button" className="tb-menu-item" onClick={() => { chain().addColumnAfter().run(); close(); }}><span>{t('editor.addColumn')}</span></button>
                <button type="button" className="tb-menu-item" onClick={() => { chain().deleteRow().run(); close(); }}><span>{t('editor.deleteRow')}</span></button>
                <button type="button" className="tb-menu-item" onClick={() => { chain().deleteColumn().run(); close(); }}><span>{t('editor.deleteColumn')}</span></button>
                <div className="tb-menu-sep" />
                <button type="button" className="tb-menu-item" onClick={() => { chain().mergeCells().run(); close(); }}><span>{t('editor.mergeCells')}</span></button>
                <button type="button" className="tb-menu-item" onClick={() => { chain().splitCell().run(); close(); }}><span>{t('editor.splitCell')}</span></button>
                <button type="button" className="tb-menu-item" onClick={() => { chain().toggleHeaderRow().run(); close(); }}><span>{t('editor.headerRow')}</span></button>
                <div className="tb-menu-sep" />
                <button type="button" className="tb-menu-item is-danger" onClick={() => { chain().deleteTable().run(); close(); }}><Trash2 size={14} /><span>{t('editor.deleteTable')}</span></button>
              </div>
            )}
          </Dropdown>
        )}
      </div>
      <span className="tb-spacer" />
      <div className="tb-group">
        <Tool label={t('editor.find')} onClick={onFind}><Search size={15} /></Tool>
        <Tool label={t('editor.pageSettings')} onClick={onPageSetup}><Settings2 size={15} /></Tool>
        <Dropdown label={t('editor.export')} icon={<Download size={15} />} className="tb-export-menu">
          {(close) => (
            <div className="tb-insert-menu">
              <button type="button" className="tb-menu-item" onClick={() => { onExport(); close(); }}><FileDown size={14} /><span>{t('editor.export')}</span></button>
            </div>
          )}
        </Dropdown>
      </div>
    </div>
  );
}
