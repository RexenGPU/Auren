import { useEffect, useState } from 'react';
import { Clock3, History, RotateCcw, Save, Eye, Activity, FileClock } from 'lucide-react';
import type { AurenDocument, VersionMeta } from '../../shared/types';
import { useAppStore } from '../store/app';
import { useT, formatDate, timeAgo } from '../lib/utils';
import { ConfirmDialog, Modal, PromptDialog } from '../components/ui';

export function TimelinePanel({ doc, onRestored }: { doc: AurenDocument; onRestored: () => void }) {
  const t = useT();
  const language = useAppStore((state) => state.settings?.language || 'en');
  const activity = useAppStore((state) => state.activity);
  const saveVersion = useAppStore((state) => state.saveVersion);
  const restoreVersion = useAppStore((state) => state.restoreVersion);
  const toast = useAppStore((state) => state.toast);
  const [versions, setVersions] = useState<VersionMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [labelOpen, setLabelOpen] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState<VersionMeta | null>(null);
  const [preview, setPreview] = useState<{ meta: VersionMeta; html: string } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const list = await window.auren.library.versions(doc.meta.id);
      setVersions(list);
    } catch (error) {
      toast(error instanceof Error ? error.message : String(error), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.meta.id]);

  const create = async (label: string) => {
    await saveVersion(label || t('editor.versions'));
    await load();
  };

  const restore = async () => {
    if (!restoreTarget) return;
    await restoreVersion(restoreTarget.id);
    setRestoreTarget(null);
    await load();
    onRestored();
  };

  const showPreview = async (meta: VersionMeta) => {
    try {
      const version = await window.auren.library.version(doc.meta.id, meta.id);
      setPreview({ meta, html: version.html });
    } catch (error) {
      toast(error instanceof Error ? error.message : String(error), 'error');
    }
  };

  const docActivity = activity.filter((entry) => entry.documentId === doc.meta.id).slice(0, 12);

  return (
    <div className="panel-body timeline-panel">
      <div className="timeline-actions">
        <button className="btn btn-soft btn-sm" onClick={() => setLabelOpen(true)}><Save size={12} /> {t('editor.saveVersion')}</button>
        <button className="btn btn-ghost btn-sm" onClick={() => void load()}><RotateCcw size={12} /> {t('common.refresh') || 'Refresh'}</button>
      </div>

      <section className="timeline-section">
        <div className="inspector-heading"><History size={13} /> {t('editor.versions')}</div>
        {loading ? (
          <div className="panel-loading">{t('common.loading') || 'Loading…'}</div>
        ) : versions.length === 0 ? (
          <div className="panel-empty compact">
            <FileClock size={20} />
            <p>{t('editor.historyEmpty')}</p>
          </div>
        ) : (
          <div className="version-list">
            {versions.map((version) => (
              <article className="version-item" key={version.id}>
                <div className="version-line" />
                <div className="version-dot" />
                <div className="version-body">
                  <div className="version-top">
                    <strong>{version.label || t('editor.versions')}</strong>
                    <span>{formatDate(version.createdAt, language, 'time')}</span>
                  </div>
                  <div className="version-meta">
                    <span>{version.wordCount.toLocaleString()} {t('common.words')}</span>
                    <span>·</span>
                    <span>{version.reason === 'manual' ? t('editor.saveVersion') : version.reason === 'restore' ? t('editor.restored') : version.reason === 'import' ? t('nav.import') : t('settings.autosave')}</span>
                  </div>
                  <div className="version-actions">
                    <button className="btn-link" onClick={() => void showPreview(version)}><Eye size={11} /> {t('editor.preview')}</button>
                    <button className="btn-link" onClick={() => setRestoreTarget(version)}><RotateCcw size={11} /> {t('editor.restoreTitle').replace('?', '')}</button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="timeline-section">
        <div className="inspector-heading"><Activity size={13} /> {t('editor.activity')}</div>
        {docActivity.length === 0 ? (
          <div className="field-hint">{t('view.home.noActivity')}</div>
        ) : (
          <div className="activity-list">
            {docActivity.map((entry) => (
              <div className="activity-row" key={entry.id}>
                <span className={`activity-dot type-${entry.type}`} />
                <div>
                  <strong>{entry.detail}</strong>
                  <span><Clock3 size={10} /> {timeAgo(entry.createdAt, language)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <PromptDialog
        open={labelOpen}
        title={t('editor.saveVersion')}
        description={t('editor.versionLabel')}
        initialValue={t('editor.versions')}
        confirmLabel={t('common.save')}
        onClose={() => setLabelOpen(false)}
        onConfirm={(value) => void create(value)}
      />

      <ConfirmDialog
        open={Boolean(restoreTarget)}
        title={t('editor.restoreTitle')}
        description={t('editor.restoreBody')}
        confirmLabel={t('editor.restoreTitle').replace('?', '')}
        onClose={() => setRestoreTarget(null)}
        onConfirm={() => void restore()}
      />

      <Modal
        open={Boolean(preview)}
        title={preview?.meta.label || t('editor.preview')}
        description={preview ? `${formatDate(preview.meta.createdAt, language, 'long')} · ${preview.meta.wordCount.toLocaleString()} ${t('common.words')}` : undefined}
        onClose={() => setPreview(null)}
        width={760}
        footer={(
          <>
            <button className="btn btn-ghost" data-secondary onClick={() => setPreview(null)}>{t('common.close')}</button>
            <button className="btn btn-primary" onClick={() => { if (preview) setRestoreTarget(preview.meta); setPreview(null); }}><RotateCcw size={13} /> {t('editor.restoreTitle').replace('?', '')}</button>
          </>
        )}
      >
        <div className="version-preview" dangerouslySetInnerHTML={{ __html: preview?.html || '' }} />
      </Modal>
    </div>
  );
}
