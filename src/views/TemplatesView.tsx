import { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, LayoutTemplate, Plus, Search, Sparkles, Trash2, X } from 'lucide-react';
import { useAppStore } from '../store/app';
import { useT } from '../lib/utils';
import { BUILTIN_TEMPLATES, type BuiltinTemplate } from '../lib/templates';
import type { TemplateFull, TemplateRecord } from '../../shared/api';
import { ConfirmDialog, EmptyState } from '../components/ui';

export function TemplatesView() {
  const t = useT();
  const navigate = useAppStore((state) => state.navigate);
  const createDocument = useAppStore((state) => state.createDocument);
  const toast = useAppStore((state) => state.toast);
  const [userTemplates, setUserTemplates] = useState<TemplateRecord[]>([]);
  const [fullTemplates, setFullTemplates] = useState<Record<string, TemplateFull>>({});
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<TemplateRecord | null>(null);

  const loadTemplates = async () => {
    try {
      const records = await window.auren.library.listTemplates();
      setUserTemplates(records);
      const fulls = await Promise.all(records.map(async (record) => {
        try { return await window.auren.library.getTemplate(record.id); } catch { return null; }
      }));
      const map: Record<string, TemplateFull> = {};
      fulls.forEach((full) => { if (full) map[full.id] = full; });
      setFullTemplates(map);
    } catch (error) {
      toast(error instanceof Error ? error.message : String(error), 'error');
    }
  };

  useEffect(() => { void loadTemplates(); }, []);

  const categories = useMemo(() => {
    const all = [...BUILTIN_TEMPLATES.map((template) => template.category), ...userTemplates.map((template) => template.category)];
    return ['all', ...Array.from(new Set(all))];
  }, [userTemplates]);

  const matches = (title: string, cat: string, description: string) => {
    const categoryOk = category === 'all' || cat === category;
    const query = search.trim().toLowerCase();
    return categoryOk && (!query || title.toLowerCase().includes(query) || description.toLowerCase().includes(query));
  };

  const useBuiltin = async (template: BuiltinTemplate) => {
    await createDocument({ title: template.title, html: template.html });
  };

  const useSaved = async (record: TemplateRecord) => {
    try {
      const full = fullTemplates[record.id] || await window.auren.library.getTemplate(record.id);
      await createDocument({ title: full.title, html: full.html, content: full.content, pageSettings: full.pageSettings });
    } catch (error) {
      toast(error instanceof Error ? error.message : String(error), 'error');
    }
  };

  const deleteTemplate = async () => {
    if (!deleteTarget) return;
    try {
      await window.auren.library.deleteTemplate(deleteTarget.id);
      setUserTemplates((items) => items.filter((item) => item.id !== deleteTarget.id));
      toast(t('view.templates.deleted'), 'success');
    } catch (error) {
      toast(error instanceof Error ? error.message : String(error), 'error');
    }
  };

  const builtinFiltered = BUILTIN_TEMPLATES.filter((template) => matches(template.title, template.category, template.description));
  const userFiltered = userTemplates.filter((template) => matches(template.title, template.category, template.description));

  return (
    <div className="view-scroll">
      <div className="page-wrap">
        <header className="page-header">
          <div>
            <div className="breadcrumb"><button onClick={() => void navigate('home')}>{t('nav.library')}</button><span>/</span><span>{t('nav.templates')}</span></div>
            <h1>{t('view.templates.title')}</h1>
            <p>{t('view.templates.subtitle')}</p>
          </div>
          <div className="page-header-actions">
            <button className="btn btn-ghost" onClick={() => void navigate('documents')}><LayoutTemplate size={14} /> {t('nav.documents')}</button>
          </div>
        </header>

        <div className="template-toolbar">
          <div className="category-tabs">
            {categories.map((cat) => (
              <button key={cat} className={category === cat ? 'is-active' : ''} onClick={() => setCategory(cat)}>
                {cat === 'all' ? t('view.templates.all') : cat}
              </button>
            ))}
          </div>
          <div className="search-field template-search">
            <Search size={14} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('common.search')} />
            {search && <button className="icon-button" onClick={() => setSearch('')}><X size={12} /></button>}
          </div>
        </div>

        {builtinFiltered.length > 0 && (
          <section className="template-section">
            <div className="section-heading">
              <div><h2><Sparkles size={14} /> {t('view.templates.builtin')}</h2><p>Designed by AUREN, ready to edit.</p></div>
            </div>
            <div className="template-grid">
              {builtinFiltered.map((template) => (
                <article key={template.id} className="template-card" style={{ '--tpl-color': template.accent } as React.CSSProperties}>
                  <div className="template-preview">
                    <div className="template-preview-page" dangerouslySetInnerHTML={{ __html: template.html }} />
                    <div className="template-overlay">
                      <button className="btn btn-primary" onClick={() => void useBuiltin(template)}>{t('view.templates.use')} <ArrowUpRight size={13} /></button>
                    </div>
                  </div>
                  <div className="template-card-meta">
                    <div><strong>{template.title}</strong><span>{template.category}</span></div>
                    <p>{template.description}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        <section className="template-section">
          <div className="section-heading">
            <div><h2>{t('view.templates.mine')}</h2><p>Saved from your own documents.</p></div>
          </div>
          {userFiltered.length ? (
            <div className="template-grid">
              {userFiltered.map((template) => (
                <article key={template.id} className="template-card user-template" style={{ '--tpl-color': '#8B8A9B' } as React.CSSProperties}>
                  <div className="template-preview">
                    {fullTemplates[template.id]
                      ? <div className="template-preview-page" dangerouslySetInnerHTML={{ __html: fullTemplates[template.id].html }} />
                      : <div className="template-preview-empty"><LayoutTemplate size={24} /></div>}
                    <div className="template-overlay">
                      <button className="btn btn-primary" onClick={() => void useSaved(template)}>{t('view.templates.use')} <ArrowUpRight size={13} /></button>
                      <button className="btn btn-ghost" style={{ background: 'rgba(10,10,15,.6)' }} onClick={() => setDeleteTarget(template)}><Trash2 size={13} /></button>
                    </div>
                  </div>
                  <div className="template-card-meta">
                    <div><strong>{template.title}</strong><span>{template.category}</span></div>
                    <p>{template.description || 'Your saved template.'}</p>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<LayoutTemplate size={21} />}
              title={t('view.templates.mine')}
              body={t('view.templates.empty')}
              action={<button className="btn btn-soft" onClick={() => void navigate('documents')}><Plus size={13} /> {t('nav.documents')}</button>}
            />
          )}
        </section>
      </div>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title={t('view.templates.deleteTitle')}
        description={t('view.templates.deleteBody', { title: deleteTarget?.title || '' })}
        confirmLabel={t('common.remove')}
        destructive
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void deleteTemplate()}
      />
    </div>
  );
}
