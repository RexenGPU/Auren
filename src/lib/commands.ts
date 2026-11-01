import { useAppStore } from '../store/app';

export async function runCommand(command: string): Promise<void> {
  const state = useAppStore.getState();
  const bridge = state.editorBridge;
  switch (command) {
    case 'new':
      await state.createDocument({});
      break;
    case 'open':
    case 'import':
      await state.beginImport();
      break;
    case 'save':
      await state.saveCurrent({ activity: true });
      state.toast('Document saved.', 'success');
      break;
    case 'version':
    case 'save-version':
      await bridge?.saveVersion();
      break;
    case 'settings':
      await state.navigate('settings');
      break;
    case 'find':
      bridge?.openFind();
      break;
    case 'palette':
      state.setFlag('paletteOpen', true);
      break;
    case 'focus':
      if (state.view === 'editor') {
        state.setFlag('focusMode');
        if (!state.focusMode) state.showPanel(null);
      }
      break;
    case 'zen':
      if (state.view === 'editor') state.setFlag('zenMode');
      break;
    case 'sidebar':
      state.toggleSidebar();
      break;
    case 'inspector':
      if (state.view === 'editor') state.showPanel(state.inspectorOpen ? null : 'inspector');
      break;
    case 'outline':
      if (state.view === 'editor') state.showPanel(state.outlineOpen ? null : 'outline');
      break;
    case 'timeline':
      if (state.view === 'editor') state.showPanel(state.timelineOpen ? null : 'timeline');
      break;
    case 'ai':
      if (state.view === 'editor') state.showPanel(state.aiOpen ? null : 'ai');
      break;
    case 'export-pdf':
      await bridge?.exportAs('pdf');
      break;
    case 'export-docx':
      await bridge?.exportAs('docx');
      break;
    case 'page-setup':
      bridge?.openPageSetup();
      break;
    case 'template':
      bridge?.saveAsTemplate();
      break;
    case 'help':
      state.setFlag('helpOpen', true);
      break;
    case 'home':
      await state.navigate('home');
      break;
    case 'documents':
      await state.showLibrary({ workspaceId: null, folder: null, search: '' });
      break;
    case 'templates':
      await state.navigate('templates');
      break;
    case 'workspaces':
      await state.navigate('workspaces');
      break;
    case 'theme-midnight':
      await state.updateSettings({ theme: 'midnight' });
      break;
    case 'theme-paper':
      await state.updateSettings({ theme: 'paper' });
      break;
    case 'theme-oled':
      await state.updateSettings({ theme: 'oled' });
      break;
    case 'backup': {
      const result = await window.auren.settings.backup();
      if (!result.canceled) state.toast('Backup created.', 'success');
      break;
    }
    case 'welcome':
      await state.updateSettings({ onboardingComplete: false });
      break;
    default:
      break;
  }
}

export function isTextInput(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select';
}
