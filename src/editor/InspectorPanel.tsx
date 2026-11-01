import { useEffect, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { AlignLeft, CalendarDays, Clock3, FileText, Hash, Layers, MoveRight, Palette, Ruler, Settings2, Type, Wand2 } from 'lucide-react';
import type { AurenDocument } from '../../shared/types';
import { useT, formatDate } from '../lib/utils';
import { useAppStore } from '../store/app';
import { writingHintStats } from './extensions';

export function InspectorPanel({ editor, doc, pages, onPageSetup }: { editor: Editor; doc: AurenDocument; pages: number; onPageSetup: () => void }) {
  const t = useT();
  const settings = useAppStore((state) => state.settings);
  const workspaces = useAppStore((state) => state.workspaces);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const update = () => setTick((value) => value + 1);
    editor.on('transaction', update);
    return () => { editor.off('transaction', update); };
  }, [editor]);

  const text = editor.getText({ blockSeparator: '\n' });
  const words = editor.storage.characterCount?.words?.() ?? (text.trim().match(/[\p{L}\p{N}][\p{L}\p{N}'’\-]*/gu) || []).length;
  const characters = text.length;
  const paragraphs = editor.state.doc.childCount;
  const readMinutes = Math.max(1, Math.ceil(words / 230));
  const hints = writingHintStats(editor);
  const activeType = editor.isActive('heading') ? 'heading' : 'paragraph';
  const attrs = editor.getAttributes(activeType);
  const workspace = workspaces.find((item) => item.id === doc.meta.workspaceId);
  const language = settings?.language || 'en';

  const updateFormat = (patch: Record<string, unknown>) => {
    editor.chain().focus().updateAttributes(activeType, patch).run();
  };

  return (
    <div className="panel-body inspector-panel" data-tick={tick}>
      <section className="inspector-section">
        <div className="inspector-heading"><FileText size={13} /> {t('editor.document')}</div>
        <div className="inspector-stat-grid">
          <div className="inspector-stat"><strong>{words.toLocaleString()}</strong><span>{t('common.words')}</span></div>
          <div className="inspector-stat"><strong>{characters.toLocaleString()}</strong><span>{t('view.home.stats.characters')}</span></div>
          <div className="inspector-stat"><strong>{paragraphs.toLocaleString()}</strong><span>{t('view.home.stats.paragraphs')}</span></div>
          <div className="inspector-stat"><strong>{pages}</strong><span>{t('view.home.stats.pages')}</span></div>
        </div>
        <div className="inspector-meta-row"><Clock3 size={12} /><span>{t('editor.wordsRead', { count: readMinutes })}</span></div>
        <div className="inspector-meta-row"><CalendarDays size={12} /><span>{t('editor.updated')} {formatDate(doc.meta.updatedAt, language, 'long')}</span></div>
        <div className="inspector-meta-row"><Layers size={12} /><span>{workspace?.name || (doc.meta.folder ? doc.meta.folder : t('view.home.personal'))}</span></div>
      </section>

      <section className="inspector-section">
        <div className="inspector-heading"><Ruler size={13} /> {t('editor.pageSettings')}
          <button type="button" className="btn-link" onClick={onPageSetup}>{t('common.edit') || 'Edit'}</button>
        </div>
        <div className="inspector-page-card">
          <div className="inspector-page-shape" data-orientation={doc.meta.pageSettings.orientation} />
          <div>
            <strong>{doc.meta.pageSettings.size === 'Custom' ? t('editor.custom') : doc.meta.pageSettings.size}</strong>
            <span>{doc.meta.pageSettings.orientation === 'portrait' ? t('editor.portrait') : t('editor.landscape')} · {doc.meta.pageSettings.columns} col</span>
          </div>
        </div>
        <div className="inspector-meta-row"><AlignLeft size={12} /><span>T {doc.meta.pageSettings.marginTop} · R {doc.meta.pageSettings.marginRight} · B {doc.meta.pageSettings.marginBottom} · L {doc.meta.pageSettings.marginLeft} mm</span></div>
      </section>

      <section className="inspector-section">
        <div className="inspector-heading"><Type size={13} /> {t('editor.format')}</div>
        <div className="inspector-field">
          <label>{t('editor.lineHeight')}</label>
          <select className="input" value={Number(attrs.lineHeight) || ''} onChange={(event) => updateFormat({ lineHeight: event.target.value ? Number(event.target.value) : null })}>
            <option value="">Default</option>
            {[1, 1.15, 1.3, 1.45, 1.6, 1.75, 2].map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </div>
        <div className="field-row">
          <div className="inspector-field">
            <label>{t('editor.spaceBefore')}</label>
            <input className="input" type="number" min={0} max={72} step={1} value={Number(attrs.marginTopPt) || 0} onChange={(event) => updateFormat({ marginTopPt: Number(event.target.value) || null })} />
          </div>
          <div className="inspector-field">
            <label>{t('editor.spaceAfter')}</label>
            <input className="input" type="number" min={0} max={72} step={1} value={Number(attrs.marginBottomPt) || 0} onChange={(event) => updateFormat({ marginBottomPt: Number(event.target.value) || null })} />
          </div>
        </div>
        <div className="inspector-field">
          <label>{t('editor.indentLeft')}</label>
          <div className="inspector-inline">
            <button className="btn btn-ghost btn-sm" onClick={() => updateFormat({ indentLeftPt: Math.max(0, (Number(attrs.indentLeftPt) || 0) - 12) })}>−</button>
            <span>{Number(attrs.indentLeftPt) || 0} pt</span>
            <button className="btn btn-ghost btn-sm" onClick={() => updateFormat({ indentLeftPt: (Number(attrs.indentLeftPt) || 0) + 12 })}>+</button>
            <button className="btn btn-ghost btn-sm" onClick={() => updateFormat({ indentLeftPt: null, textIndentPt: null })}><MoveRight size={12} /></button>
          </div>
        </div>
        <label className="inspector-color">
          <span><Palette size={12} /> {t('editor.background')}</span>
          <input type="color" value={attrs.background || '#ffffff'} onChange={(event) => updateFormat({ background: event.target.value })} />
          <button type="button" className="btn-link" onClick={() => updateFormat({ background: null })}>{t('common.reset')}</button>
        </label>
      </section>

      <section className="inspector-section">
        <div className="inspector-heading"><Wand2 size={13} /> {t('settings.grammar')}</div>
        <div className="inspector-hint-row"><Hash size={12} /><span>{hints.repeated} {t('editor.grammarRepeated').toLowerCase()}</span></div>
        <div className="inspector-hint-row"><Hash size={12} /><span>{hints.spacing} {t('editor.grammarDoubleSpace').toLowerCase()}</span></div>
        <div className="inspector-hint-row"><Hash size={12} /><span>{hints.punctuation} {t('editor.grammarMissingSpace').toLowerCase()}</span></div>
        <div className="field-hint">{settings?.grammarHints ? t('settings.grammarHint') : t('settings.grammar')}</div>
      </section>

      <section className="inspector-section">
        <div className="inspector-heading"><Settings2 size={13} /> {t('editor.metadata')}</div>
        <div className="inspector-meta-row"><CalendarDays size={12} /><span>{t('editor.created')} {formatDate(doc.meta.createdAt, language)}</span></div>
        <div className="inspector-meta-row"><FileText size={12} /><span>{doc.meta.importedFrom ? `${t('editor.metadata')} · ${doc.meta.importedFrom}` : 'AUREN'}</span></div>
      </section>
    </div>
  );
}
