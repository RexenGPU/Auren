import {
  app,
  BrowserWindow,
  dialog,
  Menu,
  nativeTheme,
  shell,
  type MenuItemConstructorOptions
} from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { once } from 'node:events';
import { Library } from './library';
import { SettingsStore } from './settings';
import { SpellService } from './spell';
import { AIService } from './ai';
import { registerIpc } from './ipc';

const APP_NAME = 'Auren';
const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);
const isTest = process.env.AUREN_TEST_MODE === '1';

app.setName(APP_NAME);

if (process.env.AUREN_USER_DATA) {
  try { app.setPath('userData', path.resolve(process.env.AUREN_USER_DATA)); } catch { /* ignore */ }
}
if (isTest) {
  app.commandLine.appendSwitch('disable-gpu');
  app.disableHardwareAcceleration();
}

let mainWindow: BrowserWindow | null = null;
let settings: SettingsStore;
let library: Library;
let spell: SpellService;
let ai: AIService;
let quitting = false;

function logLine(message: string) {
  try {
    const dir = path.join(app.getPath('userData'), 'logs');
    fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(path.join(dir, 'main.log'), `[${new Date().toISOString()}] ${message}\n`);
  } catch { /* logging must never break startup */ }
}

function libraryRoot(): string {
  if (process.env.AUREN_DATA_DIR) return path.resolve(process.env.AUREN_DATA_DIR);
  const configured = settings.get().dataRoot;
  return configured ? path.resolve(configured) : path.join(app.getPath('userData'), 'library');
}

function initialBackground(): string {
  const theme = settings?.get().theme;
  if (theme === 'paper') return '#f4f1ea';
  if (theme === 'oled') return '#000000';
  return '#101018';
}

interface WindowState { x?: number; y?: number; width: number; height: number; maximized?: boolean }

function stateFile(): string {
  return path.join(app.getPath('userData'), 'window-state.json');
}

function readWindowState(): WindowState {
  try {
    const state = JSON.parse(fs.readFileSync(stateFile(), 'utf8')) as WindowState;
    return {
      x: Number.isFinite(state.x) ? state.x : undefined,
      y: Number.isFinite(state.y) ? state.y : undefined,
      width: Math.max(1040, Number(state.width) || 1440),
      height: Math.max(680, Number(state.height) || 900),
      maximized: Boolean(state.maximized)
    };
  } catch {
    return { width: 1440, height: 900 };
  }
}

function saveWindowState(win: BrowserWindow) {
  try {
    const bounds = win.getNormalBounds();
    fs.writeFileSync(stateFile(), JSON.stringify({ ...bounds, maximized: win.isMaximized() }), 'utf8');
  } catch { /* ignore */ }
}

function sendCommand(command: string) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('menu:command', command);
}

function buildMenu() {
  const template: MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        { label: 'New document', accelerator: 'CommandOrControl+N', click: () => sendCommand('new') },
        { label: 'Open', accelerator: 'CommandOrControl+O', click: () => sendCommand('open') },
        { label: 'Save', accelerator: 'CommandOrControl+S', click: () => sendCommand('save') },
        { label: 'Save as version', accelerator: 'CommandOrControl+Shift+S', click: () => sendCommand('version') },
        { type: 'separator' },
        { label: 'Import…', accelerator: 'CommandOrControl+Shift+O', click: () => sendCommand('import') },
        { label: 'Export PDF…', click: () => sendCommand('export-pdf') },
        { label: 'Export DOCX…', click: () => sendCommand('export-docx') },
        { type: 'separator' },
        { label: 'Settings', accelerator: 'CommandOrControl+,', click: () => sendCommand('settings') },
        { label: 'Close window', role: 'close' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' }, { role: 'redo' }, { type: 'separator' },
        { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' },
        { type: 'separator' },
        { label: 'Find & replace', accelerator: 'CommandOrControl+F', click: () => sendCommand('find') },
        { label: 'Command palette', accelerator: 'CommandOrControl+K', click: () => sendCommand('palette') }
      ]
    },
    {
      label: 'View',
      submenu: [
        { label: 'Focus mode', accelerator: 'F8', click: () => sendCommand('focus') },
        { label: 'Zen mode', accelerator: 'F11', click: () => sendCommand('zen') },
        { label: 'Toggle sidebar', accelerator: 'CommandOrControl+\\', click: () => sendCommand('sidebar') },
        { label: 'Toggle inspector', accelerator: 'CommandOrControl+Shift+I', click: () => sendCommand('inspector') },
        { type: 'separator' },
        { label: 'Actual size', role: 'resetZoom' },
        { label: 'Zoom in', role: 'zoomIn' },
        { label: 'Zoom out', role: 'zoomOut' },
        ...(isDev ? [{ type: 'separator' as const }, { label: 'Developer tools', role: 'toggleDevTools' as const }] : [])
      ]
    },
    {
      label: 'Help',
      submenu: [
        { label: 'AUREN help', click: () => sendCommand('help') },
        { label: 'Open library folder', click: () => { void shell.openPath(libraryRoot()); } },
        {
          label: 'About AUREN',
          click: () => {
            const options = {
              type: 'info' as const,
              title: 'About AUREN',
              message: `AUREN ${app.getVersion()}`,
              detail: 'Create without limits.\n\nA local-first word processor. Your documents stay on this computer.',
              buttons: ['Close']
            };
            void (mainWindow ? dialog.showMessageBox(mainWindow, options) : dialog.showMessageBox(options));
          }
        }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createWindow() {
  const state = readWindowState();
  const win = new BrowserWindow({
    x: state.x,
    y: state.y,
    width: state.width,
    height: state.height,
    minWidth: 960,
    minHeight: 620,
    show: false,
    frame: false,
    backgroundColor: initialBackground(),
    title: 'AUREN',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: false,
      webSecurity: true,
      devTools: true
    }
  });
  mainWindow = win;

  if (state.maximized) win.maximize();

  win.once('ready-to-show', () => {
    win.show();
    if (isTest) win.webContents.openDevTools({ mode: 'detach' });
  });

  const emitMaximize = () => win.webContents.send('window:maximized', win.isMaximized());
  win.on('maximize', emitMaximize);
  win.on('unmaximize', emitMaximize);
  win.on('resize', () => saveWindowState(win));
  win.on('move', () => saveWindowState(win));

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    const allowed = isDev ? url.startsWith(process.env.VITE_DEV_SERVER_URL as string) : url.startsWith('file:');
    if (!allowed) event.preventDefault();
  });
  win.webContents.session.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));

  let closeApproved = false;
  win.on('closed', () => {
    mainWindow = null;
  });
  win.on('close', (event) => {
    if (closeApproved || isTest) return;
    event.preventDefault();
    if (win.webContents.isCrashed()) { closeApproved = true; win.close(); return; }
    const timeout = new Promise<void>((resolve) => setTimeout(resolve, 1800));
    const done = once(app, 'auren:flush-done').then(() => undefined);
    win.webContents.send('app:flush');
    void Promise.race([done, timeout]).finally(() => {
      closeApproved = true;
      if (!win.isDestroyed()) win.close();
    });
  });

  if (isDev) {
    void win.loadURL(process.env.VITE_DEV_SERVER_URL as string);
  } else {
    void win.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  win.webContents.on('render-process-gone', (_event, details) => {
    logLine(`Renderer gone: ${JSON.stringify(details)}`);
    if (!quitting && details.reason !== 'clean-exit') {
      void dialog.showMessageBox(win, {
        type: 'error',
        title: 'AUREN needs to reload',
        message: 'The editor stopped unexpectedly.',
        detail: 'AUREN will reload the window. Saved documents are safe.',
        buttons: ['Reload']
      }).then(() => win.reload());
    }
  });
  win.webContents.on('did-fail-load', (_event, code, description) => {
    if (code === -3) return;
    logLine(`Failed to load renderer: ${code} ${description}`);
    void dialog.showMessageBox(win, {
      type: 'error',
      title: 'AUREN could not start',
      message: 'The interface failed to load.',
      detail: `${description} (${code})\n\nTry restarting AUREN.`,
      buttons: ['Close']
    }).then(() => app.quit());
  });
}

async function bootstrap() {
  settings = new SettingsStore();
  nativeTheme.themeSource = settings.get().theme === 'paper' ? 'light' : 'dark';
  let encrypted = settings.get().encryptedStorage;
  if (encrypted && !settings.encryptionAvailable()) {
    encrypted = false;
    settings.update({ encryptedStorage: false });
    logLine('Library encryption disabled: Windows secure storage is unavailable.');
  }
  library = new Library(libraryRoot(), {
    key: settings.libraryKey(encrypted),
    encrypted
  });
  spell = new SpellService();
  ai = new AIService(
    () => {
      const s = settings.get();
      return {
        provider: s.aiProvider,
        model: s.aiModel,
        baseUrl: s.aiBaseUrl,
        systemPrompt: s.aiSystemPrompt
      };
    },
    (provider) => settings.getSecret(provider)
  );
  registerIpc({
    getLibrary: () => library,
    setLibrary: (next) => { library = next; },
    getDataRoot: () => library.root,
    getWindow: () => mainWindow,
    settings,
    spell,
    ai
  });
  buildMenu();
  createWindow();
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  app.whenReady().then(async () => {
    try {
      await bootstrap();
    } catch (error) {
      logLine(`Startup failure: ${error instanceof Error ? error.stack || error.message : String(error)}`);
      await dialog.showMessageBox({
        type: 'error',
        title: 'AUREN could not start',
        message: 'AUREN could not open its library.',
        detail: error instanceof Error ? error.message : String(error),
        buttons: ['Quit']
      });
      app.quit();
    }

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });

  app.on('before-quit', () => {
    quitting = true;
    if (mainWindow && !mainWindow.isDestroyed()) saveWindowState(mainWindow);
    try { library?.close(); } catch { /* ignore */ }
  });
}

process.on('uncaughtException', (error) => {
  logLine(`Uncaught: ${error.stack || error.message}`);
});
process.on('unhandledRejection', (reason) => {
  logLine(`Unhandled rejection: ${reason instanceof Error ? reason.stack || reason.message : String(reason)}`);
});
