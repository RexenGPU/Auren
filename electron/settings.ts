import { app, safeStorage } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type { AurenSettings, ThemeId } from '../shared/types';

const SETTINGS_FILE = 'settings.json';
const SECRETS_FILE = 'secrets.bin';

export const DEFAULT_SETTINGS: AurenSettings = {
  theme: 'midnight',
  language: 'en',
  showLaunchScreen: true,
  reducedMotion: false,
  uiScale: 1,
  sidebarWidth: 248,
  rightPanelWidth: 336,
  sidebarCollapsed: false,
  defaultFont: 'Newsreader',
  defaultFontSize: 12,
  defaultPageSize: 'A4',
  editorSpellcheck: true,
  spellLanguages: ['en', 'fr'],
  grammarHints: true,
  autosave: true,
  autosaveDelay: 1200,
  showWordCount: true,
  showReadingTime: true,
  focusDim: true,
  toolbarDensity: 'comfortable',
  visibleToolbarGroups: ['history', 'style', 'format', 'align', 'lists', 'insert'],
  pageGuides: true,
  aiEnabled: false,
  aiProvider: 'openai',
  aiModel: 'gpt-4o-mini',
  aiBaseUrl: '',
  aiConsentRemember: false,
  aiSystemPrompt: '',
  onboardingComplete: false,
  defaultExportFormat: 'docx',
  updateChannel: 'manual',
  encryptedStorage: false,
  dataRoot: '',
  lastBackupAt: null,
  localeFormat: 'system'
};

function defaultDataRoot(): string {
  return path.join(app.getPath('userData'), 'library');
}

export class SettingsStore {
  private file: string;
  private secretsFile: string;
  private settings: AurenSettings;
  private secrets: Record<string, string> = {};

  constructor() {
    this.file = path.join(app.getPath('userData'), SETTINGS_FILE);
    this.secretsFile = path.join(app.getPath('userData'), SECRETS_FILE);
    this.settings = this.load();
    this.loadSecrets();
  }

  private load(): AurenSettings {
    try {
      const raw = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      return { ...DEFAULT_SETTINGS, ...raw, dataRoot: raw.dataRoot || defaultDataRoot() };
    } catch {
      return { ...DEFAULT_SETTINGS, dataRoot: defaultDataRoot() };
    }
  }

  get(): AurenSettings {
    return { ...this.settings };
  }

  update(patch: Partial<AurenSettings>): AurenSettings {
    const next = { ...this.settings, ...patch };
    if (patch.theme && !['midnight', 'paper', 'oled'].includes(patch.theme)) {
      next.theme = this.settings.theme as ThemeId;
    }
    this.settings = next;
    this.persist();
    return this.get();
  }

  setDataRoot(root: string): AurenSettings {
    this.settings.dataRoot = root;
    this.persist();
    return this.get();
  }

  private persist() {
    const tmp = `${this.file}.tmp`;
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(tmp, JSON.stringify(this.settings, null, 2), 'utf8');
    fs.renameSync(tmp, this.file);
  }

  private loadSecrets() {
    try {
      if (!fs.existsSync(this.secretsFile)) return;
      const blob = fs.readFileSync(this.secretsFile);
      if (!safeStorage.isEncryptionAvailable()) return;
      const plain = safeStorage.decryptString(blob);
      this.secrets = JSON.parse(plain);
    } catch {
      this.secrets = {};
    }
  }

  private persistSecrets() {
    if (!safeStorage.isEncryptionAvailable()) return;
    const enc = safeStorage.encryptString(JSON.stringify(this.secrets));
    const tmp = `${this.secretsFile}.tmp`;
    fs.writeFileSync(tmp, enc);
    fs.renameSync(tmp, this.secretsFile);
  }

  setSecret(name: string, value: string) {
    if (!value) delete this.secrets[name];
    else this.secrets[name] = value;
    this.persistSecrets();
  }

  getSecret(name: string): string {
    return this.secrets[name] || '';
  }

  hasSecret(name: string): boolean {
    return Boolean(this.secrets[name]);
  }

  encryptionAvailable(): boolean {
    return safeStorage.isEncryptionAvailable();
  }

  libraryKey(create = false): Buffer | null {
    const stored = this.secrets.libraryKey;
    if (stored) {
      const key = Buffer.from(stored, 'base64');
      if (key.length === 32) return key;
    }
    if (!create) return null;
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('Windows secure storage is unavailable, so AUREN cannot protect a library key on this device.');
    }
    const key = crypto.randomBytes(32);
    this.secrets.libraryKey = key.toString('base64');
    this.persistSecrets();
    return key;
  }

  hasLibraryKey(): boolean {
    return Boolean(this.secrets.libraryKey);
  }
}
