import { useEffect, useState } from 'react';
import { Maximize2, Minimize2, Minus, Search, X } from 'lucide-react';
import { useAppStore } from '../store/app';
import { useT } from '../lib/utils';
import { IconButton, Kbd } from './ui';
export function BrandMark({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 2.6 21.4 12 12 21.4 2.6 12 12 2.6Z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" />
      <path d="M12 7.1 16.9 12 12 16.9 7.1 12 12 7.1Z" fill="currentColor" opacity="0.9" />
      <path d="M12 9.6v4.8" stroke="var(--bg)" strokeWidth="1.1" strokeLinecap="round" opacity="0.65" />
    </svg>
  );
}

function WindowControls() {
  const t = useT();
  const [maximized, setMaximized] = useState(false);
  useEffect(() => {
    void window.auren.app.isMaximized().then(setMaximized);
    return window.auren.app.onMaximizeChange(setMaximized);
  }, []);
  return (
    <div className="window-controls">
      <button className="window-control" title={t('title.minimize')} aria-label={t('title.minimize')} onClick={() => window.auren.app.minimize()}>
        <Minus size={14} strokeWidth={1.7} />
      </button>
      <button className="window-control" title={maximized ? t('title.restore') : t('title.maximize')} aria-label={maximized ? t('title.restore') : t('title.maximize')} onClick={() => window.auren.app.toggleMaximize()}>
        {maximized ? <Minimize2 size={12.5} strokeWidth={1.7} /> : <Maximize2 size={12.5} strokeWidth={1.7} />}
      </button>
      <button className="window-control close" title={t('title.close')} aria-label={t('title.close')} onClick={() => window.auren.app.close()}>
        <X size={15} strokeWidth={1.6} />
      </button>
    </div>
  );
}

export function TitleBar() {
  const t = useT();
  const activeDoc = useAppStore((state) => state.activeDoc);
  const view = useAppStore((state) => state.view);
  const saveState = useAppStore((state) => state.saveState);
  const lastSavedAt = useAppStore((state) => state.lastSavedAt);
  const language = useAppStore((state) => state.settings?.language ?? 'en');
  const setFlag = useAppStore((state) => state.setFlag);

  const saveLabel = (() => {
    if (saveState === 'saving') return t('common.saving');
    if (saveState === 'dirty') return t('common.unsaved');
    if (saveState === 'error') return t('editor.statusError');
    if (lastSavedAt) {
      const time = new Intl.DateTimeFormat(language === 'fr' ? 'fr-FR' : 'en-US', { hour: '2-digit', minute: '2-digit' }).format(lastSavedAt);
      return t('editor.statusSaved', { time });
    }
    return t('common.saved');
  })();

  return (
    <header className="titlebar" onDoubleClick={(event) => {
      if ((event.target as HTMLElement).closest('button')) return;
      window.auren.app.toggleMaximize();
    }}>
      <div className="titlebar-brand">
        <span className="brand-mark"><BrandMark /></span>
        <span>AUREN</span>
      </div>
      <div className="titlebar-center">
        {view === 'editor' && activeDoc ? (
          <div className="titlebar-doc">
            <strong>{activeDoc.meta.title || t('editor.untitled')}</strong>
            <span className="dot" />
            <span>{activeDoc.meta.wordCount.toLocaleString(language === 'fr' ? 'fr-FR' : 'en-US')} {t('common.words')}</span>
          </div>
        ) : (
          <div className="titlebar-doc"><span>{t('app.tagline')}</span></div>
        )}
      </div>
      <div className="titlebar-actions">
        <button className="sidebar-search-btn" style={{ padding: '5px 9px', border: 0 }} onClick={() => setFlag('paletteOpen', true)}>
          <Search size={13} />
          <span style={{ fontSize: 11 }}>{t('nav.command')}</span>
          <Kbd>Ctrl K</Kbd>
        </button>
        {view === 'editor' && (
          <div className={`save-indicator is-${saveState}`} title={saveLabel}>
            <span className="save-dot" />
            <span>{saveState === 'dirty' ? t('common.unsaved') : saveState === 'saving' ? t('common.saving') : saveState === 'error' ? t('common.unsaved') : t('common.saved')}</span>
          </div>
        )}
      </div>
      <WindowControls />
    </header>
  );
}
