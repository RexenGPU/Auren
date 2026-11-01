import { useRef, useState } from 'react';
import {
  Archive,
  Clock3,
  FileText,
  FolderClosed,
  Home,
  LayoutTemplate,
  LockKeyhole,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Settings2,
  Star,
  Trash2,
  Users
} from 'lucide-react';
import { useAppStore } from '../store/app';
import { useT } from '../lib/utils';
import { DOC_COLORS } from '../../shared/types';
import { Modal } from './ui';

function WorkspaceCreateDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const createWorkspace = useAppStore((state) => state.createWorkspace);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(DOC_COLORS[0]);
  const submit = async () => {
    if (!name.trim()) return;
    await createWorkspace(name, color, description);
    setName('');
    setDescription('');
    setColor(DOC_COLORS[0]);
    onClose();
  };
  return (
    <Modal
      open={open}
      title={t('view.workspaces.new')}
      description={t('view.workspaces.subtitle')}
      onClose={onClose}
      width={450}
      footer={(<>
        <button className="btn btn-ghost" data-secondary onClick={onClose}>{t('common.cancel')}</button>
        <button className="btn btn-primary" disabled={!name.trim()} onClick={() => void submit()}>{t('common.create')}</button>
      </>)}
    >
      <div className="field">
        <label>{t('view.workspaces.name')}</label>
        <input className="input" value={name} onChange={(event) => setName(event.target.value)} placeholder="Atlas" onKeyDown={(event) => { if (event.key === 'Enter') void submit(); }} />
      </div>
      <div className="field">
        <label>{t('view.workspaces.description')}</label>
        <input className="input" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Long-form work, research, and drafts" />
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
  );
}

export function Sidebar() {
  const t = useT();
  const view = useAppStore((state) => state.view);
  const settings = useAppStore((state) => state.settings);
  const collapsed = useAppStore((state) => state.sidebarCollapsed);
  const setFlag = useAppStore((state) => state.setFlag);
  const toggleSidebar = useAppStore((state) => state.toggleSidebar);
  const navigate = useAppStore((state) => state.navigate);
  const showLibrary = useAppStore((state) => state.showLibrary);
  const updateSettings = useAppStore((state) => state.updateSettings);
  const workspaces = useAppStore((state) => state.workspaces);
  const folders = useAppStore((state) => state.folders);
  const recentDocs = useAppStore((state) => state.recentDocs);
  const stats = useAppStore((state) => state.stats);
  const filter = useAppStore((state) => state.libraryFilter);
  const [createWorkspaceOpen, setCreateWorkspaceOpen] = useState(false);
  const [dragWidth, setDragWidth] = useState<number | null>(null);
  const widthRef = useRef(settings?.sidebarWidth ?? 252);

  const width = collapsed ? 68 : (dragWidth ?? settings?.sidebarWidth ?? 252);
  widthRef.current = width;

  const startResize = (event: React.PointerEvent) => {
    if (collapsed) return;
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = widthRef.current;
    setDragWidth(startWidth);
    const onMove = (moveEvent: PointerEvent) => {
      const next = Math.max(216, Math.min(360, startWidth + moveEvent.clientX - startX));
      setDragWidth(next);
      widthRef.current = next;
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      setDragWidth(null);
      void updateSettings({ sidebarWidth: widthRef.current });
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const isLibrary = view === 'documents' || view === 'recent' || view === 'favorites' || view === 'trash';
  const openWorkspace = async (id: string) => {
    await showLibrary({ view: 'documents', workspaceId: id, folder: null, search: '' });
  };
  const openFolder = async (folder: string) => {
    await showLibrary({ view: 'documents', workspaceId: null, folder, search: '' });
  };
  const countForWorkspace = (id: string) => recentDocs.filter((doc) => doc.workspaceId === id).length;
  const countForFolder = (folder: string) => recentDocs.filter((doc) => doc.folder === folder).length;

  return (
    <aside className={`sidebar ${collapsed ? 'is-collapsed' : ''}`} style={{ width }}>
      <button className="sidebar-collapse-btn" onClick={toggleSidebar} title={collapsed ? t('nav.expand') : t('nav.collapse')} aria-label={collapsed ? t('nav.expand') : t('nav.collapse')}>
        {collapsed ? <PanelLeftOpen size={12} /> : <PanelLeftClose size={12} />}
      </button>
      <div className="sidebar-inner">
        <div className="sidebar-top">
          <button className="new-document-btn" onClick={() => { setFlag('paletteOpen', false); void useAppStore.getState().createDocument({}); }} title={t('nav.newDocument')}>
            <span className="plus"><Plus size={13} strokeWidth={2.2} /></span>
            <span className="btn-text">{t('nav.newDocument')}</span>
          </button>
          <button className="sidebar-search-btn" onClick={() => setFlag('paletteOpen', true)}>
            <FileText size={14} />
            <span>{t('nav.search')}</span>
            <span className="shortcut"><kbd className="kbd">Ctrl K</kbd></span>
          </button>
        </div>

        <nav className="sidebar-nav">
          <NavItem icon={<Home size={15} />} label={t('nav.home')} active={view === 'home'} collapsed={collapsed} onClick={() => void navigate('home')} />
          <NavItem icon={<FileText size={15} />} label={t('nav.documents')} active={view === 'documents' && !filter.workspaceId && !filter.folder} count={stats?.documentCount} collapsed={collapsed} onClick={() => void showLibrary({ workspaceId: null, folder: null, search: '' })} />
          <NavItem icon={<Clock3 size={15} />} label={t('nav.recent')} active={view === 'recent'} collapsed={collapsed} onClick={() => void navigate('recent')} />
          <NavItem icon={<Star size={15} />} label={t('nav.favorites')} active={view === 'favorites'} count={stats?.favoriteCount} collapsed={collapsed} onClick={() => void navigate('favorites')} />
        </nav>

        <div>
          <div className="sidebar-section-title">
            <span>{t('nav.workspaces')}</span>
            <button onClick={() => setCreateWorkspaceOpen(true)} title={t('view.workspaces.new')}><Plus size={12} /></button>
          </div>
          <div className="workspace-list">
            {workspaces.slice(0, 8).map((workspace) => (
              <button key={workspace.id} className={`workspace-row ${isLibrary && filter.workspaceId === workspace.id ? 'is-active' : ''}`} onClick={() => void openWorkspace(workspace.id)} title={workspace.name}>
                <span className="ws-dot" style={{ background: workspace.color }} />
                <span className="ws-label">{workspace.name}</span>
                <span className="count">{countForWorkspace(workspace.id)}</span>
              </button>
            ))}
            {!workspaces.length && !collapsed && (
              <button className="workspace-row" onClick={() => setCreateWorkspaceOpen(true)} style={{ color: 'var(--muted)' }}>
                <Users size={13} />
                <span className="ws-label">{t('view.workspaces.new')}</span>
              </button>
            )}
          </div>
        </div>

        {folders.length > 0 && (
          <div>
            <div className="sidebar-section-title"><span>{t('editor.folder')}</span></div>
            <div className="workspace-list">
              {folders.slice(0, 6).map((folder) => (
                <button key={folder} className={`workspace-row ${isLibrary && filter.folder === folder ? 'is-active' : ''}`} onClick={() => void openFolder(folder)} title={folder}>
                  <FolderClosed size={13} style={{ color: 'var(--muted)' }} />
                  <span className="ws-label">{folder}</span>
                  <span className="count">{countForFolder(folder)}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <nav className="sidebar-nav">
          <div className="sidebar-section-title"><span>{t('nav.organize')}</span></div>
          <NavItem icon={<LayoutTemplate size={15} />} label={t('nav.templates')} active={view === 'templates'} collapsed={collapsed} onClick={() => void navigate('templates')} />
          <NavItem icon={<Trash2 size={15} />} label={t('nav.trash')} active={view === 'trash'} count={stats?.trashedCount} collapsed={collapsed} onClick={() => void navigate('trash')} />
        </nav>
      </div>

      <div className="sidebar-footer">
        <NavItem icon={<Settings2 size={15} />} label={t('nav.settings')} active={view === 'settings'} collapsed={collapsed} onClick={() => void navigate('settings')} />
        <div className="privacy-badge" title={t('view.home.storage')}>
          <LockKeyhole size={12} />
          <span>{t('nav.localOnly')}</span>
        </div>
      </div>

      {!collapsed && <div className={`sidebar-resizer ${dragWidth ? 'is-dragging' : ''}`} onPointerDown={startResize} />}
      <WorkspaceCreateDialog open={createWorkspaceOpen} onClose={() => setCreateWorkspaceOpen(false)} />
    </aside>
  );
}

function NavItem({
  icon,
  label,
  active,
  count,
  collapsed,
  onClick
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  count?: number;
  collapsed: boolean;
  onClick: () => void;
}) {
  return (
    <button className={`nav-item ${active ? 'is-active' : ''}`} onClick={onClick} title={collapsed ? label : undefined}>
      {icon}
      <span className="nav-label">{label}</span>
      {count !== undefined && count > 0 && <span className="count">{count}</span>}
    </button>
  );
}
