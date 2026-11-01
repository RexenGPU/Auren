import { Clock3, FileText, MoreHorizontal, RotateCcw, Star, Trash2 } from 'lucide-react';
import type { DocumentSummary } from '../../shared/types';
import { timeAgo, useT } from '../lib/utils';
import { useAppStore } from '../store/app';

export type DocView = 'grid' | 'list';

export function DocumentCard({
  doc,
  view = 'grid',
  onOpen,
  onMenu,
  onToggleFavorite,
  onRestore,
  onPurge,
  trashed = false
}: {
  doc: DocumentSummary;
  view?: DocView;
  onOpen: () => void;
  onMenu: (event: React.MouseEvent) => void;
  onToggleFavorite?: () => void;
  onRestore?: () => void;
  onPurge?: () => void;
  trashed?: boolean;
}) {
  const t = useT();
  const language = useAppStore((state) => state.settings?.language ?? 'en');
  const open = (event: React.MouseEvent) => {
    if ((event.target as HTMLElement).closest('button')) return;
    onOpen();
  };
  const meta = (
    <>
      <span className="doc-meta-item"><Clock3 size={11} /> {timeAgo(doc.updatedAt, language)}</span>
      <span className="doc-meta-sep" />
      <span className="doc-meta-item">{doc.wordCount.toLocaleString(language === 'fr' ? 'fr-FR' : 'en-US')} {t('common.words')}</span>
      <span className="doc-meta-sep" />
      <span className="doc-meta-item">{doc.readTimeMinutes} {t('common.minutes')}</span>
    </>
  );

  if (view === 'list') {
    return (
      <div className={`doc-row ${trashed ? 'is-trashed' : ''}`} onClick={open} onDoubleClick={onOpen} onContextMenu={(event) => { event.preventDefault(); onMenu(event); }} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === 'Enter') onOpen(); }}>
        <span className="doc-avatar" style={{ background: `color-mix(in srgb, ${doc.color} 18%, transparent)`, color: doc.color }}><FileText size={15} /></span>
        <div className="doc-row-main">
          <div className="doc-row-title">{doc.title || t('common.untitled')}</div>
          <div className="doc-row-excerpt">{doc.excerpt || t('view.docs.empty')}</div>
        </div>
        <div className="doc-row-workspace">{doc.workspaceId ? '' : ''}</div>
        <div className="doc-row-meta">{meta}</div>
        <div className="doc-row-actions">
          {trashed ? (
            <>
              <button className="icon-button" title={t('common.restore')} onClick={(event) => { event.stopPropagation(); onRestore?.(); }}><RotateCcw size={14} /></button>
              <button className="icon-button is-danger" title={t('common.delete')} onClick={(event) => { event.stopPropagation(); onPurge?.(); }}><Trash2 size={14} /></button>
            </>
          ) : (
            <>
              <button className={`icon-button ${doc.favorite ? 'is-favorite' : ''}`} title={doc.favorite ? t('common.remove') : t('common.add')} onClick={(event) => { event.stopPropagation(); onToggleFavorite?.(); }}><Star size={14} fill={doc.favorite ? 'currentColor' : 'none'} /></button>
              <button className="icon-button" title={t('common.more')} onClick={(event) => { event.stopPropagation(); onMenu(event); }}><MoreHorizontal size={15} /></button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <article className={`doc-card ${trashed ? 'is-trashed' : ''}`} onClick={open} onDoubleClick={onOpen} onContextMenu={(event) => { event.preventDefault(); onMenu(event); }} tabIndex={0} onKeyDown={(event) => { if (event.key === 'Enter') onOpen(); }}>
      <div className="doc-card-accent" style={{ background: `linear-gradient(90deg, ${doc.color}, color-mix(in srgb, ${doc.color} 35%, transparent))` }} />
      <div className="doc-card-top">
        <span className="doc-avatar" style={{ background: `color-mix(in srgb, ${doc.color} 17%, transparent)`, color: doc.color }}>
          <FileText size={16} />
        </span>
        <div className="doc-card-actions">
          {trashed ? (
            <>
              <button className="icon-button" title={t('common.restore')} onClick={(event) => { event.stopPropagation(); onRestore?.(); }}><RotateCcw size={14} /></button>
              <button className="icon-button is-danger" title={t('common.delete')} onClick={(event) => { event.stopPropagation(); onPurge?.(); }}><Trash2 size={14} /></button>
            </>
          ) : (
            <>
              <button className={`icon-button ${doc.favorite ? 'is-favorite' : ''}`} title={t('common.add')} onClick={(event) => { event.stopPropagation(); onToggleFavorite?.(); }}><Star size={14} fill={doc.favorite ? 'currentColor' : 'none'} /></button>
              <button className="icon-button" title={t('common.more')} onClick={(event) => { event.stopPropagation(); onMenu(event); }}><MoreHorizontal size={15} /></button>
            </>
          )}
        </div>
      </div>
      <h3 className="doc-card-title">{doc.title || t('common.untitled')}</h3>
      <p className="doc-card-excerpt">{doc.excerpt || t('view.docs.empty')}</p>
      <div className="doc-card-footer">
        <div className="doc-card-meta">{meta}</div>
      </div>
      {doc.importedFrom && <span className="doc-imported">{doc.importedFrom.split('.').pop()?.toUpperCase()}</span>}
    </article>
  );
}
