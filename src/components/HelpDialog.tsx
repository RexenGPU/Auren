import { useAppStore } from '../store/app';
import { useT } from '../lib/utils';
import { Kbd, Modal } from './ui';

export function HelpDialog() {
  const t = useT();
  const open = useAppStore((state) => state.helpOpen);
  const setFlag = useAppStore((state) => state.setFlag);
  const rows: Array<[string, string[]]> = [
    [t('help.command'), ['Ctrl', 'K']],
    [t('help.save'), ['Ctrl', 'S']],
    [t('help.new'), ['Ctrl', 'N']],
    [t('help.find'), ['Ctrl', 'F']],
    [t('help.import'), ['Ctrl', 'Shift', 'O']],
    [t('help.focus'), ['F8']],
    [t('help.zen'), ['F11']],
    [t('help.settings'), ['Ctrl', ',']],
    [t('help.close'), ['Esc']]
  ];
  return (
    <Modal open={open} title={t('help.title')} onClose={() => setFlag('helpOpen', false)} width={460}>
      <div className="shortcut-list">
        {rows.map(([label, keys]) => (
          <div className="shortcut-row" key={label}>
            <span>{label}</span>
            <span className="shortcut-keys">{keys.map((key) => <Kbd key={key}>{key}</Kbd>)}</span>
          </div>
        ))}
      </div>
      <p className="field-hint" style={{ margin: 0 }}>{t('settings.shortcutsHint')}</p>
    </Modal>
  );
}
