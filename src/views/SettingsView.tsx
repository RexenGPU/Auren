import { useEffect, useState, type ReactNode } from 'react';
import {
  ArrowRight,
  Check,
  ChevronRight,
  CloudOff,
  Cpu,
  Database,
  Download,
  HardDrive,
  Info,
  KeyRound,
  Languages,
  LayoutTemplate,
  LockKeyhole,
  Monitor,
  MoonStar,
  Palette,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  SunMedium,
  Type,
  UserRound,
  Wand2,
  Zap
} from 'lucide-react';
import { useAppStore } from '../store/app';
import { formatBytes, formatDate, useT } from '../lib/utils';
import { Kbd, Spinner, Toggle } from '../components/ui';
import type { AurenSettings, ThemeId } from '../../shared/types';

type SettingsSection = 'appearance' | 'editor' | 'writing' | 'documents' | 'storage' | 'privacy' | 'ai' | 'shortcuts' | 'updates' | 'about';

const THEMES: Array<{ id: ThemeId; label: string; hint: string; bg: string; panel: string; text: string; accent: string }> = [
  { id: 'midnight', label: 'settings.midnight', hint: 'settings.midnightHint', bg: '#0c0c11', panel: '#171722', text: '#efedf6', accent: '#9b8afb' },
  { id: 'paper', label: 'settings.paper', hint: 'settings.paperHint', bg: '#f0ece3', panel: '#fffdf7', text: '#252219', accent: '#6d5bd0' },
  { id: 'oled', label: 'settings.oled', hint: 'settings.oledHint', bg: '#000000', panel: '#060608', text: '#f6f5f9', accent: '#b7a4ff' }
];

const FONTS = ['Newsreader', 'Inter', 'Georgia', 'Garamond', 'Cambria', 'Times New Roman', 'Calibri', 'Arial', 'JetBrains Mono'];

const PROVIDERS: Array<{ value: AurenSettings['aiProvider']; label: string; model: string; baseUrl: string }> = [
  { value: 'openai', label: 'OpenAI', model: 'gpt-4o-mini', baseUrl: '' },
  { value: 'anthropic', label: 'Anthropic', model: 'claude-3-5-sonnet-latest', baseUrl: '' },
  { value: 'gemini', label: 'Google Gemini', model: 'gemini-2.0-flash', baseUrl: '' },
  { value: 'custom', label: 'Custom (OpenAI-compatible)', model: '', baseUrl: 'http://localhost:11434/v1' }
];

export function SettingsView() {
  const t = useT();
  const settings = useAppStore((state) => state.settings);
  const appInfo = useAppStore((state) => state.appInfo);
  const updateSettings = useAppStore((state) => state.updateSettings);
  const toast = useAppStore((state) => state.toast);
  const stats = useAppStore((state) => state.stats);
  const refreshLibrary = useAppStore((state) => state.refreshLibrary);
  const [section, setSection] = useState<SettingsSection>('appearance');
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [changingRoot, setChangingRoot] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    if (!savedAt) return;
    const timer = window.setTimeout(() => setSavedAt(null), 2200);
    return () => window.clearTimeout(timer);
  }, [savedAt]);

  if (!settings) return null;

  const save = async (patch: Partial<AurenSettings>) => {
    setSaving(true);
    try {
      await updateSettings(patch);
      setSavedAt(Date.now());
    } finally {
      setSaving(false);
    }
  };

  const navigateSection = (next: SettingsSection) => setSection(next);

  const changeRoot = async () => {
    setChangingRoot(true);
    try {
      const result = await window.auren.settings.changeRoot();
      if (result.changed) {
        const info = await window.auren.app.info();
        useAppStore.setState({ appInfo: info });
        await refreshLibrary();
        toast(result.warnings[0] || t('settings.moved'), 'success');
      } else if (result.warnings.length) {
        toast(result.warnings[0], 'error');
      }
    } finally {
      setChangingRoot(false);
    }
  };

  const backup = async () => {
    setBackingUp(true);
    try {
      const result = await window.auren.settings.backup();
      if (!result.canceled) {
        await save({ lastBackupAt: Date.now() });
        toast(t('toast.backupDone'), 'success');
      }
    } catch (error) {
      toast(error instanceof Error ? error.message : String(error), 'error');
    } finally {
      setBackingUp(false);
    }
  };

  const installUpdate = async () => {
    setInstalling(true);
    try {
      const result = await window.auren.app.installUpdate();
      if (result.message) toast(result.message, result.launched ? 'success' : 'info');
    } finally {
      setInstalling(false);
    }
  };

  const navItems: Array<{ id: SettingsSection; label: string; icon: ReactNode }> = [
    { id: 'appearance', label: t('settings.appearance'), icon: <Palette size={15} /> },
    { id: 'editor', label: t('settings.editor'), icon: <Type size={15} /> },
    { id: 'writing', label: t('settings.writingSection'), icon: <Languages size={15} /> },
    { id: 'documents', label: t('settings.documents'), icon: <LayoutTemplate size={15} /> },
    { id: 'storage', label: t('settings.storage'), icon: <Database size={15} /> },
    { id: 'privacy', label: t('settings.privacy'), icon: <ShieldCheck size={15} /> },
    { id: 'ai', label: t('settings.ai'), icon: <Wand2 size={15} /> },
    { id: 'shortcuts', label: t('settings.shortcuts'), icon: <Zap size={15} /> },
    { id: 'updates', label: t('settings.updates'), icon: <Download size={15} /> },
    { id: 'about', label: t('settings.about'), icon: <Info size={15} /> }
  ];

  return (
    <div className="view-scroll settings-scroll">
      <div className="page-wrap settings-page">
        <header className="page-header settings-header">
          <div>
            <div className="breadcrumb"><button onClick={() => void useAppStore.getState().navigate('home')}>{t('nav.library')}</button><span>/</span><span>{t('nav.settings')}</span></div>
            <h1>{t('view.settings.title')}</h1>
            <p>{t('view.settings.subtitle')}</p>
          </div>
          <div className="settings-save-state">
            {saving ? <><Spinner size={13} /> {t('common.saving')}</> : savedAt ? <><Check size={13} /> {t('settings.saved')}</> : <span className="status-pill"><LockKeyhole size={11} /> {t('nav.localOnly')}</span>}
          </div>
        </header>

        <div className="settings-layout">
          <nav className="settings-nav">
            {navItems.map((item) => (
              <button key={item.id} className={section === item.id ? 'is-active' : ''} onClick={() => navigateSection(item.id)}>
                {item.icon}<span>{item.label}</span><ChevronRight size={13} className="settings-chevron" />
              </button>
            ))}
          </nav>

          <div className="settings-content">
            {section === 'appearance' && (
              <SettingsPanel title={t('settings.appearance')} description={t('settings.themeHint')}>
                <div className="theme-card-grid">
                  {THEMES.map((theme) => (
                    <button key={theme.id} className={`theme-card ${settings.theme === theme.id ? 'is-active' : ''}`} onClick={() => void save({ theme: theme.id })}>
                      <span className="theme-card-art" style={{ background: theme.bg }}>
                        <span className="theme-card-window" style={{ background: theme.panel }}>
                          <span className="theme-card-side" style={{ background: theme.bg }} />
                          <span className="theme-card-main">
                            <span style={{ background: theme.text, opacity: 0.85 }} />
                            <span style={{ background: theme.text, opacity: 0.36 }} />
                            <span style={{ background: theme.accent }} />
                            <span style={{ background: theme.text, opacity: 0.26 }} />
                          </span>
                        </span>
                        <span className="theme-card-glow" style={{ background: theme.accent }} />
                      </span>
                      <span className="theme-card-meta">
                        <strong>{theme.id === 'midnight' ? <MoonStar size={13} /> : theme.id === 'paper' ? <SunMedium size={13} /> : <span className="oled-dot" />}{t(theme.label)}</strong>
                        <em>{t(theme.hint)}</em>
                      </span>
                      {settings.theme === theme.id && <span className="theme-card-check"><Check size={12} /></span>}
                    </button>
                  ))}
                </div>

                <div className="settings-group">
                  <SettingRow title={t('settings.language')} hint={t('settings.languageHint')}>
                    <select className="input compact" value={settings.language} onChange={(event) => void save({ language: event.target.value as AurenSettings['language'] })}>
                      <option value="en">English</option>
                      <option value="fr">Français</option>
                    </select>
                  </SettingRow>
                  <SettingRow title={t('settings.uiScale')} hint="Scale menus, panels, and controls.">
                    <div className="range-row">
                      <input type="range" min="0.9" max="1.15" step="0.05" value={settings.uiScale} onChange={(event) => void save({ uiScale: Number(event.target.value) })} />
                      <span>{Math.round(settings.uiScale * 100)}%</span>
                    </div>
                  </SettingRow>
                  <SettingRow title={t('settings.reducedMotion')} hint={t('settings.reducedMotionHint')}>
                    <Toggle checked={settings.reducedMotion} onChange={(value) => void save({ reducedMotion: value })} label={t('settings.reducedMotion')} />
                  </SettingRow>
                  <SettingRow title={t('settings.showLaunch')} hint={t('settings.showLaunchHint')}>
                    <Toggle checked={settings.showLaunchScreen} onChange={(value) => void save({ showLaunchScreen: value })} label={t('settings.showLaunch')} />
                  </SettingRow>
                </div>
              </SettingsPanel>
            )}

            {section === 'editor' && (
              <SettingsPanel title={t('settings.editor')} description="Typography, the writing surface, and how AUREN saves your work.">
                <div className="settings-group">
                  <SettingRow title={t('settings.defaultFont')} hint="Used for new documents and DOCX exports.">
                    <select className="input compact wide" value={settings.defaultFont} onChange={(event) => void save({ defaultFont: event.target.value })}>
                      {FONTS.map((font) => <option key={font} value={font}>{font}</option>)}
                    </select>
                  </SettingRow>
                  <SettingRow title={t('settings.defaultFontSize')} hint="Measured in points, like a printed page.">
                    <div className="inline-unit">
                      <input className="input compact number" type="number" min={8} max={36} value={settings.defaultFontSize} onChange={(event) => void save({ defaultFontSize: Number(event.target.value) || 12 })} />
                      <span>pt</span>
                    </div>
                  </SettingRow>
                  <SettingRow title={t('settings.toolbarDensity')} hint="Compact fits more tools on smaller screens.">
                    <select className="input compact" value={settings.toolbarDensity} onChange={(event) => void save({ toolbarDensity: event.target.value as 'comfortable' | 'compact' })}>
                      <option value="comfortable">{t('settings.comfortable')}</option>
                      <option value="compact">{t('settings.compact')}</option>
                    </select>
                  </SettingRow>
                  <SettingRow title={t('settings.pageGuides')} hint="Show the subtle boundaries between pages while editing.">
                    <Toggle checked={settings.pageGuides} onChange={(value) => void save({ pageGuides: value })} label={t('settings.pageGuides')} />
                  </SettingRow>
                </div>

                <div className="settings-group">
                  <SettingRow title={t('settings.autosave')} hint="AUREN also writes a recovery draft while you type.">
                    <Toggle checked={settings.autosave} onChange={(value) => void save({ autosave: value })} label={t('settings.autosave')} />
                  </SettingRow>
                  <SettingRow title={t('settings.autosaveDelay')} hint={t('settings.autosaveDelayHint')}>
                    <select className="input compact" value={settings.autosaveDelay} onChange={(event) => void save({ autosaveDelay: Number(event.target.value) })} disabled={!settings.autosave}>
                      <option value={500}>0.5 seconds</option>
                      <option value={800}>0.8 seconds</option>
                      <option value={1200}>1.2 seconds</option>
                      <option value={2000}>2 seconds</option>
                      <option value={3000}>3 seconds</option>
                    </select>
                  </SettingRow>
                  <SettingRow title={t('settings.showWordCount')} hint="Word count and reading time in the editor status bar.">
                    <Toggle checked={settings.showWordCount} onChange={(value) => void save({ showWordCount: value })} label={t('settings.showWordCount')} />
                  </SettingRow>
                  <SettingRow title={t('settings.showReadingTime')} hint="Estimated at 230 words per minute.">
                    <Toggle checked={settings.showReadingTime} onChange={(value) => void save({ showReadingTime: value })} label={t('settings.showReadingTime')} />
                  </SettingRow>
                </div>
              </SettingsPanel>
            )}

            {section === 'writing' && (
              <SettingsPanel title={t('settings.writingSection')} description="Local spellcheck and small writing aids. No text is sent anywhere.">
                <div className="settings-group">
                  <SettingRow title={t('settings.spellcheck')} hint="Uses bundled English and French dictionaries on this device.">
                    <Toggle checked={settings.editorSpellcheck} onChange={(value) => void save({ editorSpellcheck: value })} label={t('settings.spellcheck')} />
                  </SettingRow>
                  <SettingRow title={t('settings.spellLanguages')} hint="Words are accepted if they are correct in any selected language.">
                    <div className="check-row">
                      <label className="checkbox"><input type="checkbox" checked={settings.spellLanguages.includes('en')} onChange={(event) => {
                        const next = event.target.checked ? [...settings.spellLanguages, 'en'] : settings.spellLanguages.filter((lang) => lang !== 'en');
                        void save({ spellLanguages: next.length ? next : ['en'] });
                      }} /> English</label>
                      <label className="checkbox"><input type="checkbox" checked={settings.spellLanguages.includes('fr')} onChange={(event) => {
                        const next = event.target.checked ? [...settings.spellLanguages, 'fr'] : settings.spellLanguages.filter((lang) => lang !== 'fr');
                        void save({ spellLanguages: next.length ? next : ['en'] });
                      }} /> Français</label>
                    </div>
                  </SettingRow>
                  <SettingRow title={t('settings.grammar')} hint={t('settings.grammarHint')}>
                    <Toggle checked={settings.grammarHints} onChange={(value) => void save({ grammarHints: value })} label={t('settings.grammar')} />
                  </SettingRow>
                </div>
                <div className="info-card">
                  <Languages size={17} />
                  <div><strong>Checked locally</strong><p>Spellcheck runs inside AUREN with bundled Hunspell dictionaries. Your writing is never sent to a server or downloaded from one.</p></div>
                </div>
              </SettingsPanel>
            )}

            {section === 'documents' && (
              <SettingsPanel title={t('settings.documents')} description="Defaults for new documents and the way your library behaves.">
                <div className="settings-group">
                  <SettingRow title={t('settings.defaultPage')} hint="Used when you create a blank document.">
                    <select className="input compact" value={settings.defaultPageSize} onChange={(event) => void save({ defaultPageSize: event.target.value as AurenSettings['defaultPageSize'] })}>
                      <option value="A4">A4 (210 × 297 mm)</option>
                      <option value="A3">A3 (297 × 420 mm)</option>
                      <option value="Letter">US Letter (8.5 × 11 in)</option>
                      <option value="Legal">US Legal (8.5 × 14 in)</option>
                    </select>
                  </SettingRow>
                  <SettingRow title={t('settings.defaultExport')} hint="The format highlighted when you export.">
                    <select className="input compact" value={settings.defaultExportFormat} onChange={(event) => void save({ defaultExportFormat: event.target.value as AurenSettings['defaultExportFormat'] })}>
                      <option value="docx">Microsoft Word (.docx)</option>
                      <option value="pdf">PDF (.pdf)</option>
                      <option value="odt">OpenDocument (.odt)</option>
                      <option value="html">Web page (.html)</option>
                      <option value="md">Markdown (.md)</option>
                      <option value="rtf">Rich Text (.rtf)</option>
                      <option value="txt">Plain text (.txt)</option>
                    </select>
                  </SettingRow>
                </div>
                <div className="info-card">
                  <LayoutTemplate size={17} />
                  <div><strong>Real pages, real files</strong><p>Page size and margins are stored with each document. AUREN exports the same page geometry to DOCX, ODT, and PDF.</p></div>
                </div>
              </SettingsPanel>
            )}

            {section === 'storage' && (
              <SettingsPanel title={t('settings.storage')} description={t('settings.dataLocationHint')}>
                <div className="storage-path-card">
                  <div className="storage-path-icon"><HardDrive size={18} /></div>
                  <div className="storage-path-main">
                    <span>{t('settings.dataLocation')}</span>
                    <code>{appInfo?.dataRoot || settings.dataRoot}</code>
                  </div>
                  <button className="btn btn-soft btn-sm" onClick={() => void changeRoot()} disabled={changingRoot}>
                    {changingRoot ? <Spinner size={13} /> : <ArrowRight size={13} />} {t('settings.changeLocation')}
                  </button>
                </div>
                <div className="settings-group">
                  <SettingRow title={t('settings.backup')} hint={t('settings.backupHint')}>
                    <button className="btn btn-soft btn-sm" onClick={() => void backup()} disabled={backingUp}>
                      {backingUp ? <Spinner size={13} /> : <Download size={13} />} {t('settings.backup')}
                    </button>
                  </SettingRow>
                  <SettingRow title={t('settings.lastBackup')} hint="Backups are plain ZIP archives you can store anywhere.">
                    <span className="setting-value">{settings.lastBackupAt ? formatDate(settings.lastBackupAt, settings.language, 'long') : t('settings.never')}</span>
                  </SettingRow>
                  <SettingRow title="Library size" hint={`${stats?.documentCount ?? 0} documents · ${stats?.versionCount ?? 0} versions`}>
                    <span className="setting-value">{formatBytes(stats?.bytes ?? 0)}</span>
                  </SettingRow>
                  <SettingRow
                    title={t('settings.encryption')}
                    hint={appInfo && !appInfo.encryptionAvailable ? t('settings.encryptionUnavailable') : t('settings.encryptionHint')}
                  >
                    <div className="setting-inline">
                      <span className={`status-pill ${settings.encryptedStorage ? 'success' : ''}`}>
                        {settings.encryptedStorage ? t('settings.encryptionOn') : t('settings.encryptionOff')}
                      </span>
                      <Toggle
                        checked={settings.encryptedStorage}
                        disabled={Boolean(appInfo && !appInfo.encryptionAvailable) || saving}
                        onChange={(value) => void save({ encryptedStorage: value })}
                        label={t('settings.encryption')}
                      />
                    </div>
                  </SettingRow>
                </div>
                <div className="info-card">
                  <Database size={17} />
                  <div><strong>Plain files, durable metadata</strong><p>Each document is an atomic JSON file. A small SQLite index makes search and sorting fast without locking you in. If the index is ever damaged, AUREN rebuilds it from the files.</p></div>
                </div>
              </SettingsPanel>
            )}

            {section === 'privacy' && (
              <SettingsPanel title={t('settings.privacy')} description={t('settings.privacyTitle')}>
                <div className="privacy-hero">
                  <div className="privacy-hero-icon"><ShieldCheck size={26} /></div>
                  <div>
                    <h3>{t('settings.privacyTitle')}</h3>
                    <p>{t('settings.privacyBody')}</p>
                  </div>
                </div>
                <div className="privacy-grid">
                  <div className="privacy-card"><CloudOff size={18} /><strong>No cloud</strong><span>Documents stay in your chosen folder.</span></div>
                  <div className="privacy-card"><Cpu size={18} /><strong>No telemetry</strong><span>No analytics, crash uploads, or usage pings.</span></div>
                  <div className="privacy-card"><UserRound size={18} /><strong>No account</strong><span>Nothing to sign in to. Nothing to cancel.</span></div>
                  <div className="privacy-card"><KeyRound size={18} /><strong>Your AI key</strong><span>{settings.aiEnabled ? 'AI is enabled and only acts when you ask.' : 'AI is disabled. AUREN never sends anything.'}</span></div>
                </div>
                <div className="settings-group">
                  <SettingRow title="External services" hint="The only optional network features are the AI assistant you configure and links you choose to open.">
                    <span className={`status-pill ${settings.aiEnabled ? 'accent' : 'success'}`}>{settings.aiEnabled ? 'AI enabled' : 'Fully offline'}</span>
                  </SettingRow>
                  <SettingRow title="Welcome screen" hint={t('settings.showLaunchHint')}>
                    <button className="btn btn-soft btn-sm" onClick={() => void save({ onboardingComplete: false })}><RotateCcw size={13} /> {t('settings.resetOnboarding')}</button>
                  </SettingRow>
                </div>
              </SettingsPanel>
            )}

            {section === 'ai' && <AISettings save={save} />}

            {section === 'shortcuts' && (
              <SettingsPanel title={t('settings.shortcuts')} description={t('settings.shortcutsHint')}>
                <div className="shortcut-table">
                  {[
                    [t('help.command'), ['Ctrl', 'K']],
                    [t('help.save'), ['Ctrl', 'S']],
                    [t('palette.saveVersion'), ['Ctrl', 'Shift', 'S']],
                    [t('help.new'), ['Ctrl', 'N']],
                    [t('help.find'), ['Ctrl', 'F']],
                    [t('help.import'), ['Ctrl', 'Shift', 'O']],
                    [t('help.focus'), ['F8']],
                    [t('help.zen'), ['F11']],
                    [t('palette.sidebar'), ['Ctrl', '\\']],
                    [t('palette.inspector'), ['Ctrl', 'Shift', 'I']],
                    [t('help.settings'), ['Ctrl', ',']],
                    [t('help.close'), ['Esc']]
                  ].map(([label, keys]) => (
                    <div className="shortcut-table-row" key={label as string}>
                      <span>{label as string}</span>
                      <span className="shortcut-keys">{(keys as string[]).map((key) => <Kbd key={key}>{key}</Kbd>)}</span>
                    </div>
                  ))}
                </div>
              </SettingsPanel>
            )}

            {section === 'updates' && (
              <SettingsPanel title={t('settings.updates')} description={t('settings.updateTitle')}>
                <div className="info-card">
                  <Download size={17} />
                  <div><strong>Manual by design</strong><p>{t('settings.updateBody')}</p></div>
                </div>
                <div className="settings-group">
                  <SettingRow title="Update channel" hint="AUREN does not contact an update server.">
                    <span className="status-pill">Manual</span>
                  </SettingRow>
                  <SettingRow title="Install a newer version" hint="Choose an official AUREN setup file. The app will close while it installs.">
                    <button className="btn btn-soft btn-sm" onClick={() => void installUpdate()} disabled={installing}>
                      {installing ? <Spinner size={13} /> : <Download size={13} />} {t('settings.installUpdate')}
                    </button>
                  </SettingRow>
                </div>
              </SettingsPanel>
            )}

            {section === 'about' && (
              <SettingsPanel title={t('settings.about')} description={t('app.tagline')}>
                <div className="about-hero">
                  <div className="about-mark">◆</div>
                  <div>
                    <h2>AUREN</h2>
                    <p>{t('settings.aboutBody')}</p>
                  </div>
                </div>
                <div className="about-grid">
                  <div><span>{t('settings.version')}</span><strong>{appInfo?.version || '1.0.0'}</strong></div>
                  <div><span>{t('settings.runtime')}</span><strong>Electron {appInfo?.electron} · Chromium {appInfo?.chrome}</strong></div>
                  <div><span>{t('settings.platform')}</span><strong>{appInfo?.platform}</strong></div>
                  <div><span>{t('settings.dataPath')}</span><strong className="path-value">{appInfo?.dataRoot}</strong></div>
                </div>
                <div className="settings-group">
                  <SettingRow title={t('settings.showLaunch')} hint={t('settings.showLaunchHint')}>
                    <Toggle checked={settings.showLaunchScreen} onChange={(value) => void save({ showLaunchScreen: value })} label={t('settings.showLaunch')} />
                  </SettingRow>
                  <SettingRow title="Privacy" hint="No account, no cloud, no telemetry.">
                    <span className="status-pill success"><ShieldCheck size={11} /> Local</span>
                  </SettingRow>
                </div>
                <p className="about-credit">AUREN · Create without limits. Built with Electron, React, and TipTap. Fonts: Inter, Newsreader, JetBrains Mono.</p>
              </SettingsPanel>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingsPanel({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section className="settings-panel">
      <header className="settings-panel-head"><h2>{title}</h2><p>{description}</p></header>
      {children}
    </section>
  );
}

function SettingRow({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <div className="setting-row">
      <div className="setting-row-text"><strong>{title}</strong>{hint && <span>{hint}</span>}</div>
      <div className="setting-row-control">{children}</div>
    </div>
  );
}

function AISettings({ save }: { save: (patch: Partial<AurenSettings>) => Promise<void> }) {
  const t = useT();
  const settings = useAppStore((state) => state.settings);
  const toast = useAppStore((state) => state.toast);
  const [key, setKey] = useState('');
  const [status, setStatus] = useState<{ configured: boolean; encryptionAvailable: boolean } | null>(null);
  const [testing, setTesting] = useState(false);
  const [testMessage, setTestMessage] = useState<{ ok: boolean; message: string } | null>(null);
  const [model, setModel] = useState(settings?.aiModel || '');
  const [baseUrl, setBaseUrl] = useState(settings?.aiBaseUrl || '');
  const [prompt, setPrompt] = useState(settings?.aiSystemPrompt || '');

  const provider = settings?.aiProvider || 'openai';

  useEffect(() => {
    let alive = true;
    void window.auren.settings.secrets(provider).then((result) => {
      if (alive) setStatus({ configured: result.configured, encryptionAvailable: result.encryptionAvailable });
    }).catch(() => { if (alive) setStatus(null); });
    return () => { alive = false; };
  }, [provider, settings?.aiEnabled]);

  useEffect(() => {
    setModel(settings?.aiModel || '');
    setBaseUrl(settings?.aiBaseUrl || '');
    setPrompt(settings?.aiSystemPrompt || '');
  }, [settings?.aiModel, settings?.aiBaseUrl, settings?.aiSystemPrompt]);

  if (!settings) return null;

  const changeProvider = async (value: AurenSettings['aiProvider']) => {
    const info = PROVIDERS.find((item) => item.value === value);
    const patch: Partial<AurenSettings> = { aiProvider: value, aiModel: info?.model || '', aiBaseUrl: info?.baseUrl || '' };
    setModel(patch.aiModel || '');
    setBaseUrl(patch.aiBaseUrl || '');
    await save(patch);
  };

  const saveKey = async () => {
    if (!key.trim()) return;
    const result = await window.auren.settings.setSecret(provider, key.trim());
    setStatus({ configured: result.configured, encryptionAvailable: result.encryptionAvailable });
    setKey('');
    toast('API key saved securely.', 'success');
  };

  const removeKey = async () => {
    const result = await window.auren.settings.clearSecret(provider);
    setStatus({ configured: result.configured, encryptionAvailable: result.encryptionAvailable });
    setTestMessage(null);
    toast('API key removed.', 'success');
  };

  const testConnection = async () => {
    setTesting(true);
    setTestMessage(null);
    try {
      const result = await window.auren.settings.testAI(provider, model, baseUrl, key.trim() || undefined);
      setTestMessage(result);
    } catch (error) {
      setTestMessage({ ok: false, message: error instanceof Error ? error.message : String(error) });
    } finally {
      setTesting(false);
    }
  };

  const saveEndpoint = async () => {
    await save({ aiModel: model.trim(), aiBaseUrl: baseUrl.trim() });
  };

  return (
    <section className="settings-panel">
      <header className="settings-panel-head"><h2>{t('settings.ai')}</h2><p>{t('settings.aiEnableHint')}</p></header>
      <div className={`ai-status-card ${settings.aiEnabled ? 'is-on' : ''}`}>
        <div className="ai-status-icon"><Wand2 size={20} /></div>
        <div>
          <strong>{settings.aiEnabled ? 'AI assistant is enabled' : 'AI assistant is off'}</strong>
          <p>{settings.aiEnabled ? 'AUREN will only contact your provider when you explicitly send a request. Document context requires your consent.' : 'The editor, imports, exports, and every other feature work normally without AI.'}</p>
        </div>
        <Toggle checked={settings.aiEnabled} onChange={(value) => void save({ aiEnabled: value })} label={t('settings.aiEnable')} />
      </div>

      <div className="settings-group">
        <SettingRow title={t('settings.aiProvider')} hint="Use your own account with the provider.">
          <select className="input compact wide" value={provider} onChange={(event) => void changeProvider(event.target.value as AurenSettings['aiProvider'])}>
            {PROVIDERS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </SettingRow>
        <SettingRow title={t('settings.aiModel')} hint="The exact model identifier sent to the provider.">
          <input className="input compact wide" value={model} onChange={(event) => setModel(event.target.value)} onBlur={() => void saveEndpoint()} placeholder="gpt-4o-mini" />
        </SettingRow>
        <SettingRow title={t('settings.aiBaseUrl')} hint={provider === 'custom' ? 'Required for custom OpenAI-compatible endpoints, such as a local model server.' : 'Optional. Leave empty for the provider default.'}>
          <input className="input compact wide" value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} onBlur={() => void saveEndpoint()} placeholder={provider === 'custom' ? 'http://localhost:11434/v1' : 'Default endpoint'} />
        </SettingRow>
        <SettingRow title={t('settings.aiKey')} hint={status?.configured ? t('settings.aiKeySet') : t('settings.aiKeyHint')}>
          <div className="key-row">
            <input className="input compact" type="password" value={key} onChange={(event) => setKey(event.target.value)} placeholder={status?.configured ? '••••••••••••' : 'sk-…'} autoComplete="off" />
            <button className="btn btn-soft btn-sm" onClick={() => void saveKey()} disabled={!key.trim()}>Save key</button>
            {status?.configured && <button className="btn btn-ghost btn-sm" onClick={() => void removeKey()}>{t('settings.aiRemoveKey')}</button>}
          </div>
        </SettingRow>
        <SettingRow title="Connection" hint={status?.encryptionAvailable ? 'Your key is encrypted with Windows DPAPI.' : 'Windows secure storage is unavailable on this device; the key cannot be saved safely.'}>
          <div className="ai-test-row">
            <span className={`status-pill ${status?.configured ? 'success' : ''}`}>{status?.configured ? 'Key configured' : 'No key'}</span>
            <button className="btn btn-soft btn-sm" onClick={() => void testConnection()} disabled={testing || !settings.aiEnabled}>
              {testing ? <Spinner size={13} /> : <Zap size={13} />} {t('settings.aiTest')}
            </button>
          </div>
        </SettingRow>
        {testMessage && <div className={`inline-note ${testMessage.ok ? 'is-success' : 'is-error'}`}>{testMessage.ok ? t('settings.aiReady') : t('settings.aiFailed', { message: testMessage.message })}</div>}
        <SettingRow title={t('settings.aiPrompt')} hint={t('settings.aiPromptHint')}>
          <textarea className="textarea compact-textarea" value={prompt} onChange={(event) => setPrompt(event.target.value)} onBlur={() => void save({ aiSystemPrompt: prompt })} placeholder="Write with clarity and restraint. Preserve the author's voice." />
        </SettingRow>
        <SettingRow title={t('settings.aiConsent')} hint={t('settings.aiConsentHint')}>
          <Toggle checked={settings.aiConsentRemember} onChange={(value) => void save({ aiConsentRemember: value })} label={t('settings.aiConsent')} />
        </SettingRow>
      </div>
      <div className="info-card">
        <Info size={17} />
        <div><strong>You are in control</strong><p>The assistant is optional and disabled by default. AUREN has no proxy server: requests go from this computer directly to the provider you choose, using your key. The provider's own privacy terms apply to text you explicitly send.</p></div>
      </div>
    </section>
  );
}
