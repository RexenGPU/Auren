import { useMemo, useState } from 'react';
import { ArrowUpRight, FolderOpen, MoreHorizontal, Plus, Users, FolderPlus } from 'lucide-react';
import { useAppStore } from '../store/app';
import { timeAgo, useT } from '../lib/utils';
import { DOC_COLORS, type Workspace } from '../../shared/types';
import { ConfirmDialog, ContextMenu, EmptyState, Modal, type MenuItem } from '../components/ui';

export function WorkspacesView() {
  const t = useT();
  const language = useAppStore((state) => state.settings?.language ?? 'en');
  const workspaces = useAppStore((state) => state.workspaces);
  const recentDocs = useAppStore((state) => state.recentDocs);
  const showLibrary = useAppStore((state) => state.showLibrary);
  const createWorkspace = useAppStore((state) => state.createWorkspace);
  const updateWorkspace = useAppStore((state) => state.updateWorkspace);
  const deleteWorkspace = useAppStore((state) => state.deleteWorkspace);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Workspace | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(DOC_COLORS[0]);
  const [menu, setMenu] = useState<{ workspace: Workspace; x: number; y: number } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Workspace | null>(null);

  const openCreate = () => {
    setEditing(null);
    setName('');
    setDescription('');
    setColor(DOC_COLORS[Math.floor(Math.random() * DOC_COLORS.length)]);
    setDialogOpen(true);
  };

  const openEdit = (workspace: Workspace) => {
    setEditing(workspace);
    setName(workspace.name);
    setDescription(workspace.description);
    setColor(workspace.color);
    setDialogOpen(true);
  };

  const submit = async () => {
    if (!name.trim()) return;
    if (editing) await updateWorkspace(editing.id, { name: name.trim(), description: description.trim(), color });
    else await createWorkspace(name.trim(), color, description.trim());
    setDialogOpen(false);
  };

  const menuItems = useMemo<MenuItem[]>(() => menu ? [
    { label: t('view.workspaces.edit'), icon: <FolderOpen size={14} />, onClick: () => openEdit(menu.workspace) },
    { separator: true, label: '' },
    { label: t('common.delete'), danger: true, onClick: () => setDeleteTarget(menu.workspace) }
  ] : [], [menu, t]);

  return (
    <div className="view-scroll">
      <div className="page-wrap">
        <header className="page-header">
          <div>
            <div className="breadcrumb"><button onClick={() => void useAppStore.getState().navigate('home')}>{t('nav.library')}</button><span>/</span><span>{t('nav.workspaces')}</span></div>
            <h1>{t('view.workspaces.title')}</h1>
            <p>{t('view.workspaces.subtitle')}</p>
          </div>
          <div className="page-header-actions">
            <button className="btn btn-primary" onClick={openCreate}><Plus size={15} /> {t('view.workspaces.new')}</button>
          </div>
        </header>

        {workspaces.length ? (
          <div className="workspace-grid">
            {workspaces.map((workspace) => {
              const docs = recentDocs.filter((doc) => doc.workspaceId === workspace.id);
              return (
                <article key={workspace.id} className="workspace-card" style={{ '--ws-color': workspace.color } as React.CSSProperties}>
                  <div className="workspace-card-glow" />
                  <div className="workspace-card-head">
                    <span className="workspace-card-icon"><FolderOpen size={20} /></span>
                    <button className="icon-button" onClick={(event) => {
                      const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
                      setMenu({ workspace, x: rect.right - 4, y: rect.bottom + 6 });
                    }}><MoreHorizontal size={16} /></button>
                  </div>
                  <button className="workspace-card-body" onClick={() => void showLibrary({ workspaceId: workspace.id, folder: null, search: '' })}>
                    <h3>{workspace.name}</h3>
                    <p>{workspace.description || t('view.workspaces.empty')}</p>
                    <span className="workspace-count">{t('view.workspaces.docs', { count: docs.length })}</span>
                  </button>
                  <div className="workspace-doc-list">
                    {docs.slice(0, 3).map((doc) => (
                      <button key={doc.id} onClick={() => void useAppStore.getState().openDocument(doc.id)}>
                        <span className="doc-dot" style={{ background: doc.color }} />
                        <span>{doc.title}</span>
                        <em>{timeAgo(doc.updatedAt, language)}</em>
                      </button>
                    ))}
                    {!docs.length && <span className="workspace-empty-docs"><FolderPlus size={13} /> {t('view.workspaces.empty')}</span>}
                  </div>
                  <div className="workspace-card-footer">
                    <span>Updated {timeAgo(workspace.updatedAt, language)}</span>
                    <button className="btn-link" onClick={() => void showLibrary({ workspaceId: workspace.id, folder: null, search: '' })}>{t('common.open')} <ArrowUpRight size={12} /></button>
                  </div>
                </article>
              );
            })}
            <button className="workspace-card workspace-create-card" onClick={openCreate}>
              <span className="workspace-create-icon"><Plus size={22} /></span>
              <strong>{t('view.workspaces.new')}</strong>
              <em>Give a project its own room, color, and focus.</em>
            </button>
          </div>
        ) : (
          <EmptyState
            icon={<Users size={22} />}
            title={t('view.workspaces.title')}
            body={t('view.workspaces.subtitle')}
            action={<button className="btn btn-primary" onClick={openCreate}><Plus size={14} /> {t('view.workspaces.new')}</button>}
          />
        )}
      </div>

      <Modal
        open={dialogOpen}
        title={editing ? t('view.workspaces.edit') : t('view.workspaces.new')}
        description={t('view.workspaces.subtitle')}
        onClose={() => setDialogOpen(false)}
        width={460}
        footer={(<>
          <button className="btn btn-ghost" data-secondary onClick={() => setDialogOpen(false)}>{t('common.cancel')}</button>
          <button className="btn btn-primary" disabled={!name.trim()} onClick={() => void submit()}>{editing ? t('common.save') : t('common.create')}</button>
        </>)}
      >
        <div className="field">
          <label>{t('view.workspaces.name')}</label>
          <input className="input" value={name} onChange={(event) => setName(event.target.value)} placeholder="Atlas" onKeyDown={(event) => { if (event.key === 'Enter') void submit(); }} />
        </div>
        <div className="field">
          <label>{t('view.workspaces.description')}</label>
          <input className="input" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Research, drafts, and long-form work" />
        </div>
        <div className="field">
          <label>{t('view.workspaces.color')}</label>
          <div className="swatch-row">
            {DOC_COLORS.map((swatch) => (
              <button key={swatch} type="button" className={`swatch ${color === swatch ? 'is-selected' : ''}`} style={{ background: swatch }} onClick={() => setColor(swatch)} aria-label={swatch} />
            ))}
          </div>
        </div>
      </Modal>

      {menu && <ContextMenu x={menu.x} y={menu.y} items={menuItems} onClose={() => setMenu(null)} align="right" />}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title={t('view.workspaces.deleteTitle')}
        description={t('view.workspaces.deleteBody', { name: deleteTarget?.name || '' })}
        confirmLabel={t('common.delete')}
        destructive
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => { if (deleteTarget) void deleteWorkspace(deleteTarget.id); }}
      />
    </div>
  );
}
