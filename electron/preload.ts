import { contextBridge, ipcRenderer, webUtils } from 'electron';
import type { AurenApi } from '../shared/api';

const api: AurenApi = {
  app: {
    info: () => ipcRenderer.invoke('app:info'),
    minimize: () => ipcRenderer.send('window:minimize'),
    toggleMaximize: () => ipcRenderer.send('window:toggle-maximize'),
    close: () => ipcRenderer.send('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:is-maximized'),
    onMaximizeChange: (cb) => {
      const listener = (_e: unknown, value: boolean) => cb(value);
      ipcRenderer.on('window:maximized', listener);
      return () => ipcRenderer.removeListener('window:maximized', listener);
    },
    openExternal: (url) => ipcRenderer.invoke('app:open-external', url),
    showItemInFolder: (path) => ipcRenderer.send('app:show-item', path),
    openPath: (path) => ipcRenderer.invoke('app:open-path', path),
    onFlushRequest: (cb) => {
      const listener = () => cb();
      ipcRenderer.on('app:flush', listener);
      return () => ipcRenderer.removeListener('app:flush', listener);
    },
    flushDone: () => ipcRenderer.send('app:flush-done'),
    installUpdate: () => ipcRenderer.invoke('app:install-update')
  },
  library: {
    list: (filter) => ipcRenderer.invoke('library:list', filter),
    get: (id) => ipcRenderer.invoke('library:get', id),
    create: (payload) => ipcRenderer.invoke('library:create', payload),
    save: (id, payload) => ipcRenderer.invoke('library:save', id, payload),
    rename: (id, title) => ipcRenderer.invoke('library:rename', id, title),
    duplicate: (id) => ipcRenderer.invoke('library:duplicate', id),
    trash: (id) => ipcRenderer.invoke('library:trash', id),
    restore: (id) => ipcRenderer.invoke('library:restore', id),
    purge: (id) => ipcRenderer.invoke('library:purge', id),
    emptyTrash: () => ipcRenderer.invoke('library:empty-trash'),
    updateMeta: (id, patch) => ipcRenderer.invoke('library:update-meta', id, patch),
    search: (query) => ipcRenderer.invoke('library:search', query),
    versions: (id) => ipcRenderer.invoke('library:versions', id),
    version: (id, versionId) => ipcRenderer.invoke('library:version', id, versionId),
    createVersion: (id, label) => ipcRenderer.invoke('library:create-version', id, label),
    restoreVersion: (id, versionId) => ipcRenderer.invoke('library:restore-version', id, versionId),
    drafts: () => ipcRenderer.invoke('library:drafts'),
    recovery: () => ipcRenderer.invoke('library:recovery'),
    draft: (id) => ipcRenderer.invoke('library:draft', id),
    saveDraft: (id, payload) => ipcRenderer.invoke('library:save-draft', id, payload),
    clearDraft: (id) => ipcRenderer.invoke('library:clear-draft', id),
    workspaces: () => ipcRenderer.invoke('library:workspaces'),
    createWorkspace: (name, color, description) => ipcRenderer.invoke('library:create-workspace', name, color, description),
    updateWorkspace: (id, patch) => ipcRenderer.invoke('library:update-workspace', id, patch),
    deleteWorkspace: (id) => ipcRenderer.invoke('library:delete-workspace', id),
    folders: () => ipcRenderer.invoke('library:folders'),
    stats: () => ipcRenderer.invoke('library:stats'),
    activity: (limit) => ipcRenderer.invoke('library:activity', limit),
    listTemplates: () => ipcRenderer.invoke('library:list-templates'),
    saveTemplate: (payload) => ipcRenderer.invoke('library:save-template', payload),
    getTemplate: (id) => ipcRenderer.invoke('library:get-template', id),
    deleteTemplate: (id) => ipcRenderer.invoke('library:delete-template', id)
  },
  files: {
    pickImport: () => ipcRenderer.invoke('files:pick-import'),
    importPreview: (filePath) => ipcRenderer.invoke('files:import-preview', filePath),
    exportDocument: (id, format, options) => ipcRenderer.invoke('files:export', id, format, options),
    pathForFile: (file) => webUtils.getPathForFile(file),
    pickFolder: (title) => ipcRenderer.invoke('files:pick-folder', title)
  },
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    update: (patch) => ipcRenderer.invoke('settings:update', patch),
    secrets: (provider) => ipcRenderer.invoke('settings:secrets', provider),
    setSecret: (provider, key) => ipcRenderer.invoke('settings:set-secret', provider, key),
    clearSecret: (provider) => ipcRenderer.invoke('settings:clear-secret', provider),
    testAI: (provider, model, baseUrl, key) => ipcRenderer.invoke('settings:test-ai', provider, model, baseUrl, key),
    changeRoot: () => ipcRenderer.invoke('settings:change-root'),
    backup: () => ipcRenderer.invoke('settings:backup')
  },
  ai: {
    chat: (payload) => ipcRenderer.invoke('ai:chat', payload),
    cancel: (requestId) => ipcRenderer.invoke('ai:cancel', requestId),
    onChunk: (cb) => {
      const listener = (_e: unknown, payload: { requestId: string; chunk: string }) => cb(payload);
      ipcRenderer.on('ai:chunk', listener);
      return () => ipcRenderer.removeListener('ai:chunk', listener);
    }
  },
  spell: {
    check: (words, languages) => ipcRenderer.invoke('spell:check', words, languages),
    suggest: (word, languages) => ipcRenderer.invoke('spell:suggest', word, languages)
  },
  clipboard: {
    writeText: (text) => ipcRenderer.invoke('clipboard:write', text)
  },
  events: {
    onMenuCommand: (cb) => {
      const listener = (_e: unknown, command: string) => cb(command);
      ipcRenderer.on('menu:command', listener);
      return () => ipcRenderer.removeListener('menu:command', listener);
    }
  }
};

contextBridge.exposeInMainWorld('auren', api);
