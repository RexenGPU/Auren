import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownUp,
  ArrowRight,
  FileText,
  FolderClosed,
  FolderOpen,
  Grid2X2,
  List,
  MoreHorizontal,
  Plus,
  Search,
  Star,
  Trash2,
  X
} from 'lucide-react';
import { useAppStore } from '../store/app';
import { useT } from '../lib/utils';
import { DocumentCard, type DocView } from '../components/DocumentCard';
import { ConfirmDialog, ContextMenu, EmptyState, Modal, PromptDialog, Select, type MenuItem } from '../components/ui';
import type { AurenDocument, DocumentSummary } from '../../shared/types';

type Target = { doc: DocumentSummary; x: number; y: number } | null;

export function LibraryView() {
  const t = useT();
  const view = useAppStore((state) => state.view);
  const docs = useAppStore((state) => state.docs);
  const docsLoading = useAppStore((state) => state.docsLoading);
  const filter = useAppStore((state) => state.libraryFilter);
  const workspaces = useAppStore((state) => state.workspaces);
  const setLibraryFilter = useAppStore((state) => state.setLibraryFilter);
  const navigate = useAppStore((state) => state.navigate);
  const openDocument = useAppStore((state) => state.openDocument);
  const createDocument = useAppStore((state) => state.createDocument);
  const duplicateDocument = useAppStore((state) => state.duplicateDocument);
  const toggleFavorite = useAppStore((state) => state.toggleFavorite);
  const renameDocument = useAppStore((state) => state.renameDocument);
  const trashDocument = useAppStore((state) => state.trashDocument);
  const restoreDocument = useAppStore((state) => state.restoreDocument);
  const purgeDocument = useAppStore((state) => state.purgeDocument);
  const emptyTrash = useAppStore((state) => state.emptyTrash);
  const moveDocument = useAppStore((state) => state.moveDocument);
  const folders = useAppStore((state) => state.folders);
  const updateSettings = useAppStore((state) => state.updateSettings);

  const [layout, setLayout] = useState<DocView>(() => (localStorage.getItem('auren.docLayout') === 'list' ? 'list' : 'grid'));
  const [search, setSearch] = useState(filter.search || '');
  const [menu, setMenu] = useState<Target>(null);
  const [renameTarget, setRenameTarget] = useState<DocumentSummary | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DocumentSummary | null>(null);
  const [purgeTarget, setPurgeTarget] = useState<DocumentSummary | null>(null);
  const [moveTarget, setMoveTarget] = useState<DocumentSummary | null>(null);
  const [previewTarget, setPreviewTarget] = useState<DocumentSummary | null>(null);
  const [previewDoc, setPreviewDoc] = useState<AurenDocument | null>(null);
  const [emptyConfirm, setEmptyConfirm] = useState(false);
  const [moveWorkspace, setMoveWorkspace] = useState('');
  const [moveFolder, setMoveFolder] = useState('');

  const trashed = view === 'trash';
  const title = view === 'trash' ? t('view.docs.trashTitle') : view === 'favorites' ? t('view.docs.favoritesTitle') : view === 'recent' ? t('view.docs.recentTitle') : t('view.docs.title');
  const subtitle = view === 'trash' ? t('view.docs.trashSubtitle') : view === 'favorites' ? t('view.docs.favoritesSubtitle') : view === 'recent' ? t('view.docs.recentSubtitle') : t('view.docs.subtitle');
  const activeWorkspace = workspaces.find((workspace) => workspace.id === filter.workspaceId);

  useEffect(() => {
    setSearch(filter.search || '');
  }, [filter.search]);

  useEffect(() => {
    document.title = `${title} · AUREN`;
  }, [title]);

  useEffect(() => {
    if (search === (filter.search || '')) return;
    const timer = window.setTimeout(() => {
      void setLibraryFilter({ search });
    }, 220);
    return () => window.clearTimeout(timer);
  }, [search, filter.search, setLibraryFilter]);

  useEffect(() => {
    if (!moveTarget) return;
    setMoveWorkspace(moveTarget.workspaceId || '');
    setMoveFolder(moveTarget.folder || '');
  }, [moveTarget]);

  useEffect(() => {
    if (!previewTarget) {
      setPreviewDoc(null);
      return;
    }
    let alive = true;
    void window.auren.library.get(previewTarget.id).then((doc) => { if (alive) setPreviewDoc(doc); }).catch(() => { if (alive) setPreviewDoc(null); });
    return () => { alive = false; };
  }, [previewTarget]);

  const changeLayout = (next: DocView) => {
    setLayout(next);
    localStorage.setItem('auren.docLayout', next);
  };

  const menuItems = useMemo<MenuItem[]>(() => {
    if (!menu) return [];
    const doc = menu.doc;
    if (trashed) {
      return [
        { label: 'Preview', icon: <FileText size={14} />, onClick: () => setPreviewTarget(doc) },
        { label: t('common.restore'), icon: <ArrowDownUp size={14} />, onClick: () => void restoreDocument(doc.id) },
        { separator: true, label: '' },
        { label: t('common.delete'), icon: <Trash2 size={14} />, danger: true, onClick: () => setPurgeTarget(doc) }
      ];
    }
    return [
      { label: t('common.open'), icon: <ArrowRight size={14} />, onClick: () => void openDocument(doc.id) },
      { label: 'Preview', icon: <FileText size={14} />, onClick: () => setPreviewTarget(doc) },
      { separator: true, label: '' },
      { label: doc.favorite ? 'Remove from favorites' : 'Add to favorites', icon: <Star size={14} />, onClick: () => void toggleFavorite(doc.id) },
      { label: t('common.rename'), onClick: () => setRenameTarget(doc), shortcut: 'F2' },
      { label: t('common.duplicate'), onClick: () => void duplicateDocument(doc.id) },
      { label: t('view.docs.moveToFolder'), icon: <FolderOpen size={14} />, onClick: () => setMoveTarget(doc) },
      { separator: true, label: '' },
      { label: t('common.delete'), icon: <Trash2 size={14} />, danger: true, onClick: () => setDeleteTarget(doc) }
    ];
  }, [menu, trashed, t, openDocument, restoreDocument, purgeDocument, toggleFavorite, duplicateDocument]);

  const openMenu = (doc: DocumentSummary, event: React.MouseEvent) => {
    setMenu({ doc, x: event.clientX, y: event.clientY });
  };

  const renderDocs = () => {
    if (docsLoading && !docs.length) {
      return <div className="doc-skeleton-grid">{[0, 1, 2, 3].map((key) => <div key={key} className="doc-skeleton" />)}</div>;
    }
    if (!docs.length) {
      return (
        <EmptyState
          icon={trashed ? <Trash2 size={22} /> : search ? <Search size={22} /> : <FileText size={22} />}
          title={trashed ? t('view.docs.emptyTrash') : search ? t('view.docs.searchEmpty') : t('view.docs.empty')}
          body={trashed ? t('view.docs.emptyTrashBody') : search ? 'Try another phrase, or clear the search to see everything.' : t('view.docs.emptyHint')}
          action={!trashed && !search ? <button className="btn btn-primary" onClick={() => void createDocument({})}><Plus size={14} /> {t('nav.newDocument')}</button> : undefined}
        />
      );
    }
    return (
      <div className={layout === 'grid' ? 'doc-grid' : 'doc-list'}>
        {docs.map((doc) => (
          <DocumentCard
            key={doc.id}
            doc={doc}
            view={layout}
            trashed={trashed}
            onOpen={() => { if (trashed) setPreviewTarget(doc); else void openDocument(doc.id); }}
            onMenu={(event) => openMenu(doc, event)}
            onToggleFavorite={() => void toggleFavorite(doc.id)}
            onRestore={() => void restoreDocument(doc.id)}
            onPurge={() => setPurgeTarget(doc)}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="view-scroll">
      <div className="page-wrap library-wrap">
        <header className="page-header">
          <div>
            <div className="breadcrumb">
              <button onClick={() => void navigate('home')}>{t('nav.library')}</button>
              <span>/</span>
              <span>{activeWorkspace?.name || filter.folder || title}</span>
            </div>
            <h1>{activeWorkspace?.name || filter.folder || title}</h1>
            <p>{activeWorkspace?.description || subtitle}</p>
          </div>
          <div className="page-header-actions">
            {trashed ? (
              docs.length > 0 && <button className="btn btn-ghost" onClick={() => setEmptyConfirm(true)}><Trash2 size={14} /> {t('view.trash.empty')}</button>
            ) : (
              <>
                <button className="btn btn-ghost" onClick={() => void useAppStore.getState().beginImport()}><FolderOpen size={14} /> {t('view.home.import')}</button>
                <button className="btn btn-primary" onClick={() => void createDocument({ workspaceId: filter.workspaceId || null, folder: filter.folder || null })}><Plus size={15} /> {t('nav.newDocument')}</button>
              </>
            )}
          </div>
        </header>

        {(activeWorkspace || filter.folder) && (
          <div className="filter-chips">
            {activeWorkspace && <span className="filter-chip"><span className="ws-dot" style={{ background: activeWorkspace.color }} /> {activeWorkspace.name} <button onClick={() => void setLibraryFilter({ workspaceId: null })}><X size={11} /></button></span>}
            {filter.folder && <span className="filter-chip"><FolderClosed size={12} /> {filter.folder} <button onClick={() => void setLibraryFilter({ folder: null })}><X size={11} /></button></span>}
          </div>
        )}

        <div className="library-toolbar">
          <div className="search-field">
            <Search size={15} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('nav.search')} />
            {search && <button className="icon-button" onClick={() => setSearch('')} aria-label={t('common.reset')}><X size={13} /></button>}
          </div>
          <div className="toolbar-right">
            <span className="doc-count">{docs.length} {docs.length === 1 ? 'document' : 'documents'}</span>
            <Select
              value={(filter.sort || 'updated') as 'updated' | 'created' | 'title' | 'opened'}
              onChange={(value) => void setLibraryFilter({ sort: value })}
              options={[
                { value: 'updated', label: t('view.docs.sort.updated') },
                { value: 'created', label: t('view.docs.sort.created') },
                { value: 'opened', label: t('view.docs.sort.opened') },
                { value: 'title', label: t('view.docs.sort.title') }
              ]}
              className="sort-select"
            />
            <button className="icon-button" title={filter.direction === 'asc' ? t('view.docs.sortDesc') : t('view.docs.sortAsc')} onClick={() => void setLibraryFilter({ direction: filter.direction === 'asc' ? 'desc' : 'asc' })}>
              <ArrowDownUp size={14} style={{ transform: filter.direction === 'asc' ? 'scaleY(-1)' : undefined }} />
            </button>
            <div className="segmented layout-toggle">
              <button className={layout === 'grid' ? 'is-active' : ''} onClick={() => changeLayout('grid')} title={t('common.more')}><Grid2X2 size={13} /></button>
              <button className={layout === 'list' ? 'is-active' : ''} onClick={() => changeLayout('list')} title={t('common.more')}><List size={14} /></button>
            </div>
          </div>
        </div>

        {renderDocs()}
      </div>

      {menu && <ContextMenu x={menu.x} y={menu.y} items={menuItems} onClose={() => setMenu(null)} />}

      <PromptDialog
        open={Boolean(renameTarget)}
        title={t('common.rename')}
        initialValue={renameTarget?.title || ''}
        onClose={() => setRenameTarget(null)}
        onConfirm={(value) => { if (renameTarget) void renameDocument(renameTarget.id, value); }}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title={t('view.docs.deleteTitle')}
        description={t('view.docs.deleteBody', { title: deleteTarget?.title || '' })}
        confirmLabel={t('common.delete')}
        destructive
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => { if (deleteTarget) void trashDocument(deleteTarget.id); }}
      />

      <ConfirmDialog
        open={Boolean(purgeTarget)}
        title={t('view.docs.purgeTitle')}
        description={t('view.docs.purgeBody', { title: purgeTarget?.title || '' })}
        confirmLabel={t('common.delete')}
        destructive
        onClose={() => setPurgeTarget(null)}
        onConfirm={() => { if (purgeTarget) void purgeDocument(purgeTarget.id); }}
      />

      <ConfirmDialog
        open={emptyConfirm}
        title={t('view.docs.emptyTrashTitle')}
        description={t('view.docs.emptyTrashBody')}
        confirmLabel={t('view.trash.empty')}
        destructive
        onClose={() => setEmptyConfirm(false)}
        onConfirm={() => void emptyTrash()}
      />

      <Modal
        open={Boolean(moveTarget)}
        title={t('view.docs.moveToFolder')}
        onClose={() => setMoveTarget(null)}
        width={430}
        footer={(<>
          <button className="btn btn-ghost" data-secondary onClick={() => setMoveTarget(null)}>{t('common.cancel')}</button>
          <button className="btn btn-primary" onClick={() => {
            if (moveTarget) void moveDocument(moveTarget.id, { workspaceId: moveWorkspace || null, folder: moveFolder.trim() || null });
            setMoveTarget(null);
          }}>{t('common.apply')}</button>
        </>)}
      >
        <div className="field">
          <label>{t('editor.workspace')}</label>
          <select className="input" value={moveWorkspace} onChange={(event) => setMoveWorkspace(event.target.value)}>
            <option value="">{t('common.none')}</option>
            {workspaces.map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label>{t('editor.folder')}</label>
          <input className="input" list="auren-folders" value={moveFolder} onChange={(event) => setMoveFolder(event.target.value)} placeholder={t('view.docs.noFolder')} />
          <datalist id="auren-folders">{folders.map((folder) => <option key={folder} value={folder} />)}</datalist>
          <span className="field-hint">Type a new name to create a folder.</span>
        </div>
      </Modal>

      <Modal
        open={Boolean(previewTarget)}
        title={previewTarget?.title || t('common.untitled')}
        description={previewTarget ? `${previewTarget.wordCount} ${t('common.words')} · ${previewTarget.readTimeMinutes} ${t('common.minutes')}` : ''}
        onClose={() => setPreviewTarget(null)}
        width={780}
        footer={(<>
          <button className="btn btn-ghost" data-secondary onClick={() => setPreviewTarget(null)}>{t('common.close')}</button>
          {previewTarget && (trashed
            ? <button className="btn btn-primary" onClick={() => { void restoreDocument(previewTarget.id); setPreviewTarget(null); }}>{t('common.restore')}</button>
            : <button className="btn btn-primary" onClick={() => { void openDocument(previewTarget.id); setPreviewTarget(null); }}>{t('common.open')}</button>)}
        </>)}
      >
        <div className="doc-preview-paper">
          {previewDoc ? <div className="doc-preview-content" dangerouslySetInnerHTML={{ __html: previewDoc.html }} /> : <div className="preview-loading">{t('common.loading')}</div>}
        </div>
      </Modal>
    </div>
  );
}
