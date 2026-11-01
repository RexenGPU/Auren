import { useMemo } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Clock3,
  FileText,
  FolderOpen,
  LayoutTemplate,
  Plus,
  Sparkles,
  Star,
  Upload,
  Wand2
} from 'lucide-react';
import { useAppStore } from '../store/app';
import { formatBytes, greetingKey, timeAgo, useT } from '../lib/utils';
import { BUILTIN_TEMPLATES } from '../lib/templates';
import type { ActivityEntry, DocumentSummary } from '../../shared/types';

const ACTIVITY_LABEL: Record<ActivityEntry['type'], (detail: string) => string> = {
  created: (detail) => `Created ${detail}`,
  saved: (detail) => `Saved ${detail}`,
  imported: (detail) => `Imported ${detail}`,
  exported: (detail) => `Exported ${detail}`,
  restored: (detail) => `Restored ${detail}`,
  deleted: (detail) => `Deleted ${detail}`
};

export function HomeView() {
  const t = useT();
  const language = useAppStore((state) => state.settings?.language ?? 'en');
  const recentDocs = useAppStore((state) => state.recentDocs);
  const stats = useAppStore((state) => state.stats);
  const activity = useAppStore((state) => state.activity);
  const workspaces = useAppStore((state) => state.workspaces);
  const createDocument = useAppStore((state) => state.createDocument);
  const openDocument = useAppStore((state) => state.openDocument);
  const beginImport = useAppStore((state) => state.beginImport);
  const navigate = useAppStore((state) => state.navigate);
  const showLibrary = useAppStore((state) => state.showLibrary);
  const toggleFavorite = useAppStore((state) => state.toggleFavorite);

  const latest = recentDocs[0];
  const recent = recentDocs.slice(0, 4);
  const dateLabel = useMemo(() => new Intl.DateTimeFormat(language === 'fr' ? 'fr-FR' : 'en-US', {
    weekday: 'long', month: 'long', day: 'numeric'
  }).format(new Date()), [language]);

  const templates = BUILTIN_TEMPLATES.filter((template) => ['builtin-report', 'builtin-essay', 'builtin-resume', 'builtin-meeting'].includes(template.id));

  return (
    <div className="view-scroll home-scroll">
      <div className="home-wrap">
        <header className="home-header">
          <div>
            <div className="home-date">{dateLabel}</div>
            <h1>{t(greetingKey())}<span className="home-period">.</span></h1>
            <p>{t('view.home.subtitle')}</p>
          </div>
          <div className="home-header-actions">
            <button className="btn btn-ghost" onClick={() => void beginImport()}><Upload size={14} /> {t('view.home.import')}</button>
            <button className="btn btn-primary" onClick={() => void createDocument({})}><Plus size={15} /> {t('nav.newDocument')}</button>
          </div>
        </header>

        <section className="home-hero">
          {latest ? (
            <button className="continue-card" onClick={() => void openDocument(latest.id)}>
              <div className="continue-glow" style={{ background: latest.color }} />
              <div className="continue-top">
                <span className="continue-kicker"><Sparkles size={12} /> {t('view.home.continue')}</span>
                <span className="continue-open"><ArrowUpRight size={15} /></span>
              </div>
              <div className="continue-body">
                <h2>{latest.title || t('common.untitled')}</h2>
                <p>{latest.excerpt || t('view.home.continueEmpty')}</p>
              </div>
              <div className="continue-meta">
                <span><Clock3 size={12} /> {timeAgo(latest.openedAt, language)}</span>
                <span>{latest.wordCount.toLocaleString(language === 'fr' ? 'fr-FR' : 'en-US')} {t('common.words')}</span>
                <span>{latest.readTimeMinutes} {t('common.minutes')}</span>
              </div>
              <div className="continue-progress"><span style={{ width: `${Math.min(100, Math.max(6, (latest.wordCount % 2000) / 20))}%`, background: latest.color }} /></div>
            </button>
          ) : (
            <div className="continue-card continue-empty">
              <div className="continue-top"><span className="continue-kicker"><Sparkles size={12} /> {t('view.home.continue')}</span></div>
              <div className="continue-body">
                <h2 className="serif-title">{t('view.home.continueEmpty')}</h2>
                <p>{t('onboarding.readyBody')}</p>
              </div>
              <button className="btn btn-primary" onClick={() => void createDocument({})}>{t('view.home.startWriting')} <ArrowRight size={14} /></button>
            </div>
          )}

          <div className="quick-actions">
            <button className="quick-action" onClick={() => void createDocument({})}>
              <span className="quick-icon"><Plus size={17} /></span>
              <span><strong>{t('nav.newDocument')}</strong><em>Start with a blank page</em></span>
              <ArrowUpRight size={14} className="quick-arrow" />
            </button>
            <button className="quick-action" onClick={() => void beginImport()}>
              <span className="quick-icon"><Upload size={16} /></span>
              <span><strong>{t('view.home.import')}</strong><em>DOCX, ODT, RTF, PDF, Markdown</em></span>
              <ArrowUpRight size={14} className="quick-arrow" />
            </button>
            <button className="quick-action" onClick={() => void navigate('templates')}>
              <span className="quick-icon"><LayoutTemplate size={16} /></span>
              <span><strong>{t('nav.templates')}</strong><em>A thoughtful head start</em></span>
              <ArrowUpRight size={14} className="quick-arrow" />
            </button>
          </div>
        </section>

        <section className="stat-strip">
          <div className="stat-item"><span className="stat-icon"><FileText size={15} /></span><div><strong>{stats?.documentCount ?? 0}</strong><span>{t('view.home.stats.documents')}</span></div></div>
          <div className="stat-item"><span className="stat-icon"><BookOpen size={15} /></span><div><strong>{(stats?.wordCount ?? 0).toLocaleString(language === 'fr' ? 'fr-FR' : 'en-US')}</strong><span>{t('view.home.stats.words')}</span></div></div>
          <div className="stat-item"><span className="stat-icon"><Star size={15} /></span><div><strong>{stats?.favoriteCount ?? 0}</strong><span>{t('view.home.stats.favorites')}</span></div></div>
          <div className="stat-item"><span className="stat-icon"><Clock3 size={15} /></span><div><strong>{stats?.versionCount ?? 0}</strong><span>{t('view.home.stats.versions')}</span></div></div>
          <div className="stat-storage"><span>{formatBytes(stats?.bytes ?? 0)}</span><em>{t('view.home.storage')}</em></div>
        </section>

        <div className="home-columns">
          <section className="home-recent">
            <div className="section-heading">
              <div><h2>{t('view.home.recent')}</h2><p>Pick up where you left off.</p></div>
              <button className="btn-link" onClick={() => void showLibrary({ workspaceId: null, folder: null, search: '' })}>{t('view.home.viewAll')} <ArrowRight size={12} /></button>
            </div>
            {recent.length ? (
              <div className="home-doc-list">
                {recent.map((doc) => (
                  <HomeDocRow key={doc.id} doc={doc} onOpen={() => void openDocument(doc.id)} onFavorite={() => void toggleFavorite(doc.id)} />
                ))}
              </div>
            ) : (
              <div className="home-empty-inline">
                <FileText size={18} />
                <span>{t('view.docs.emptyHint')}</span>
                <button className="btn btn-sm btn-soft" onClick={() => void createDocument({})}>{t('common.create')}</button>
              </div>
            )}
          </section>

          <aside className="home-activity">
            <div className="section-heading"><div><h2>{t('view.home.activity')}</h2><p>This week in your library.</p></div></div>
            <div className="activity-list">
              {activity.slice(0, 6).map((entry) => (
                <button key={entry.id} className="activity-row" onClick={() => { if (entry.documentId) void openDocument(entry.documentId); }}>
                  <span className={`activity-dot type-${entry.type}`} />
                  <span className="activity-text">{ACTIVITY_LABEL[entry.type](entry.detail)}</span>
                  <span className="activity-time">{timeAgo(entry.createdAt, language)}</span>
                </button>
              ))}
              {!activity.length && <p className="activity-empty">{t('view.home.noActivity')}</p>}
            </div>
          </aside>
        </div>

        <section className="home-templates">
          <div className="section-heading">
            <div><h2>{t('view.home.templates')}</h2><p>Composed with care, ready to make yours.</p></div>
            <button className="btn-link" onClick={() => void navigate('templates')}>{t('view.home.viewAll')} <ArrowRight size={12} /></button>
          </div>
          <div className="mini-template-grid">
            {templates.map((template) => (
              <button key={template.id} className="mini-template" onClick={() => void createDocument({ title: template.title, html: template.html })}>
                <span className="mini-template-art" style={{ '--tpl-accent': template.accent } as React.CSSProperties}>
                  <span className="tpl-line tpl-kicker" />
                  <span className="tpl-line tpl-title" />
                  <span className="tpl-line w80" /><span className="tpl-line w95" /><span className="tpl-line w65" />
                  <span className="tpl-block" />
                  <span className="tpl-line w85" /><span className="tpl-line w45" />
                </span>
                <span className="mini-template-meta"><strong>{template.title}</strong><em>{template.category}</em></span>
              </button>
            ))}
          </div>
        </section>

        {workspaces.length > 0 && (
          <section className="home-workspaces">
            <div className="section-heading">
              <div><h2>{t('view.home.workspaces')}</h2><p>Projects with their own room.</p></div>
              <button className="btn-link" onClick={() => void navigate('workspaces')}>{t('view.home.viewAll')} <ArrowRight size={12} /></button>
            </div>
            <div className="workspace-strip">
              {workspaces.slice(0, 4).map((workspace) => {
                const count = recentDocs.filter((doc) => doc.workspaceId === workspace.id).length;
                return (
                  <button key={workspace.id} className="workspace-mini" onClick={() => void showLibrary({ workspaceId: workspace.id, folder: null, search: '' })}>
                    <span className="workspace-mini-icon" style={{ background: `color-mix(in srgb, ${workspace.color} 16%, transparent)`, color: workspace.color }}><FolderOpen size={16} /></span>
                    <span><strong>{workspace.name}</strong><em>{count} {count === 1 ? 'document' : 'documents'}</em></span>
                    <ArrowUpRight size={13} className="quick-arrow" />
                  </button>
                );
              })}
              <button className="workspace-mini" onClick={() => void navigate('workspaces')}>
                <span className="workspace-mini-icon" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}><Wand2 size={15} /></span>
                <span><strong>{t('view.workspaces.new')}</strong><em>Give a project a home</em></span>
                <ArrowUpRight size={13} className="quick-arrow" />
              </button>
            </div>
          </section>
        )}

        <footer className="home-footer">
          <span>AUREN · {t('app.tagline')}</span>
          <span>{t('nav.localOnly')}</span>
        </footer>
      </div>
    </div>
  );
}

function HomeDocRow({ doc, onOpen, onFavorite }: { doc: DocumentSummary; onOpen: () => void; onFavorite: () => void }) {
  const t = useT();
  const language = useAppStore((state) => state.settings?.language ?? 'en');
  return (
    <button className="home-doc-row" onClick={onOpen}>
      <span className="home-doc-mark" style={{ background: doc.color }} />
      <span className="home-doc-body">
        <strong>{doc.title || t('common.untitled')}</strong>
        <em>{doc.excerpt || '—'}</em>
      </span>
      <span className="home-doc-meta">{timeAgo(doc.updatedAt, language)}<br /><span>{doc.wordCount.toLocaleString(language === 'fr' ? 'fr-FR' : 'en-US')} {t('common.words')}</span></span>
      <span
        role="button"
        tabIndex={0}
        className={`home-star ${doc.favorite ? 'is-on' : ''}`}
        onClick={(event) => { event.stopPropagation(); onFavorite(); }}
        onKeyDown={(event) => { if (event.key === 'Enter') { event.stopPropagation(); onFavorite(); } }}
        aria-label={t('common.add')}
      >
        <Star size={14} fill={doc.favorite ? 'currentColor' : 'none'} />
      </span>
    </button>
  );
}
