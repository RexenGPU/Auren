import { useEffect, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useAppStore } from './store/app';
import { runCommand, isTextInput } from './lib/commands';
import { useT } from './lib/utils';
import { TitleBar, BrandMark } from './components/TitleBar';
import { Sidebar } from './components/Sidebar';
import { Onboarding } from './components/Onboarding';
import { Toasts } from './components/Toasts';
import { CommandPalette } from './components/CommandPalette';
import { HelpDialog } from './components/HelpDialog';
import { ImportDialog } from './components/ImportDialog';
import { RecoveryPrompt } from './components/RecoveryPrompt';
import { HomeView } from './views/HomeView';
import { LibraryView } from './views/LibraryView';
import { WorkspacesView } from './views/WorkspacesView';
import { TemplatesView } from './views/TemplatesView';
import { SettingsView } from './views/SettingsView';
import { EditorView } from './views/EditorView';
import { cx } from './lib/utils';

function LaunchSplash() {
  return (
    <div className="launch-splash" aria-hidden="true">
      <div className="launch-splash-glow" />
      <div className="launch-splash-mark"><BrandMark size={58} /></div>
      <div className="launch-splash-name">AUREN</div>
      <div className="launch-splash-tagline">Create without limits.</div>
      <div className="launch-splash-line"><span /></div>
    </div>
  );
}

function BootScreen({ error }: { error: string | null }) {
  const t = useT();
  if (error) {
    return (
      <div className="boot-screen">
        <div className="boot-error">
          <div className="brand-mark"><BrandMark size={34} /></div>
          <h1>AUREN could not start</h1>
          <p>The desktop shell started, but the library or settings could not be opened.</p>
          <pre>{error}</pre>
          <button className="btn btn-primary" onClick={() => window.location.reload()}>{t('common.retry')}</button>
        </div>
      </div>
    );
  }
  return (
    <div className="boot-screen">
      <div>
        <div className="brand-mark"><BrandMark size={34} /></div>
        <div>Opening your library…</div>
      </div>
    </div>
  );
}

export default function App() {
  const booted = useAppStore((state) => state.booted);
  const bootError = useAppStore((state) => state.bootError);
  const settings = useAppStore((state) => state.settings);
  const view = useAppStore((state) => state.view);
  const zenMode = useAppStore((state) => state.zenMode);
  const focusMode = useAppStore((state) => state.focusMode);
  const initialize = useAppStore((state) => state.initialize);
  const [splash, setSplash] = useState(false);
  const splashShown = useRef(false);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  useEffect(() => {
    if (!booted || splashShown.current) return;
    splashShown.current = true;
    if (settings?.onboardingComplete && settings.showLaunchScreen) {
      setSplash(true);
      const timer = window.setTimeout(() => setSplash(false), 1050);
      return () => window.clearTimeout(timer);
    }
  }, [booted, settings?.onboardingComplete, settings?.showLaunchScreen]);

  useEffect(() => window.auren.events.onMenuCommand((command) => {
    void runCommand(command);
  }), []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const mod = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();
      const state = useAppStore.getState();
      if (mod && key === 'k') {
        event.preventDefault();
        state.setFlag('paletteOpen', !state.paletteOpen);
        return;
      }
      if (mod && key === 's' && event.shiftKey) {
        event.preventDefault();
        void runCommand('version');
        return;
      }
      if (mod && key === 's') {
        event.preventDefault();
        void runCommand('save');
        return;
      }
      if (mod && key === 'n') {
        event.preventDefault();
        void runCommand('new');
        return;
      }
      if (mod && key === 'o') {
        event.preventDefault();
        void runCommand('import');
        return;
      }
      if (mod && key === 'f') {
        if (state.view === 'editor' && state.editorBridge) {
          event.preventDefault();
          state.editorBridge.openFind();
        }
        return;
      }
      if (mod && key === 'i' && event.shiftKey) {
        if (state.view === 'editor') {
          event.preventDefault();
          state.showPanel(state.inspectorOpen ? null : 'inspector');
        }
        return;
      }
      if (mod && event.key === ',') {
        event.preventDefault();
        void runCommand('settings');
        return;
      }
      if (mod && event.key === '\\') {
        event.preventDefault();
        state.toggleSidebar();
        return;
      }
      if (event.key === 'F8') {
        if (state.view === 'editor') {
          event.preventDefault();
          state.setFlag('focusMode');
          if (!state.focusMode) state.showPanel(null);
        }
        return;
      }
      if (event.key === 'F11') {
        if (state.view === 'editor') {
          event.preventDefault();
          state.setFlag('zenMode');
        }
        return;
      }
      if (event.key === 'Escape') {
        if (state.paletteOpen || state.helpOpen) return;
        if (state.zenMode) {
          event.preventDefault();
          state.setFlag('zenMode', false);
          return;
        }
        if (state.focusMode) {
          event.preventDefault();
          state.setFlag('focusMode', false);
          return;
        }
      }
      if (isTextInput(event.target) && !mod) return;
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => window.auren.app.onFlushRequest(() => {
    void (async () => {
      try {
        const state = useAppStore.getState();
        if (state.activeDoc) await Promise.race([
          state.saveCurrent({ silent: true }),
          new Promise((resolve) => window.setTimeout(resolve, 1400))
        ]);
      } finally {
        window.auren.app.flushDone();
      }
    })();
  }), []);

  useEffect(() => {
    if (!settings) return;
    const names: Record<string, string> = {
      home: 'AUREN',
      documents: 'Documents',
      recent: 'Recent',
      favorites: 'Favorites',
      workspaces: 'Workspaces',
      templates: 'Templates',
      trash: 'Trash',
      settings: 'Settings',
      editor: 'Editor'
    };
    document.title = `${names[view] || 'AUREN'} · AUREN`;
  }, [view, settings]);

  if (!booted) return <BootScreen error={null} />;
  if (bootError) return <BootScreen error={bootError} />;

  const onboarding = settings && !settings.onboardingComplete;
  if (onboarding) {
    return (
      <>
        <Onboarding />
        <ImportDialog />
        <Toasts />
      </>
    );
  }

  return (
    <div className={cx('app-shell', zenMode && 'is-zen', focusMode && 'is-focus', splash && 'has-splash')}>
      <TitleBar />
      <div className="app-body">
        {!zenMode && <Sidebar />}
        <main className="main-shell">
          {view === 'home' && <HomeView />}
          {(view === 'documents' || view === 'recent' || view === 'favorites' || view === 'trash') && <LibraryView />}
          {view === 'workspaces' && <WorkspacesView />}
          {view === 'templates' && <TemplatesView />}
          {view === 'settings' && <SettingsView />}
          {view === 'editor' && <EditorView />}
        </main>
      </div>
      <CommandPalette />
      <HelpDialog />
      <ImportDialog />
      <RecoveryPrompt />
      <Toasts />
      {splash && <LaunchSplash />}
    </div>
  );
}
