import { useEffect, useState } from 'react';
import type { PageSettings, PageSizeName } from '../../shared/types';
import { PAGE_SIZES, pageDimensionsMm } from '../../shared/types';
import { useT } from '../lib/utils';
import { Modal } from '../components/ui';

export function PageSetupDialog({
  open,
  pageSettings,
  onClose,
  onApply
}: {
  open: boolean;
  pageSettings: PageSettings;
  onClose: () => void;
  onApply: (patch: Partial<PageSettings>) => Promise<void> | void;
}) {
  const t = useT();
  const [draft, setDraft] = useState<PageSettings>(pageSettings);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setDraft(pageSettings);
  }, [open, pageSettings]);

  const set = (patch: Partial<PageSettings>) => setDraft((current) => ({ ...current, ...patch }));

  const chooseSize = (size: PageSizeName) => {
    if (size === 'Custom') {
      set({ size });
      return;
    }
    const dims = PAGE_SIZES[size];
    set({ size, widthMm: dims.width, heightMm: dims.height });
  };

  const dims = pageDimensionsMm(draft);

  const apply = async () => {
    setBusy(true);
    try {
      await onApply({
        size: draft.size,
        widthMm: draft.widthMm,
        heightMm: draft.heightMm,
        orientation: draft.orientation,
        marginTop: draft.marginTop,
        marginRight: draft.marginRight,
        marginBottom: draft.marginBottom,
        marginLeft: draft.marginLeft,
        columns: draft.columns,
        headerEnabled: draft.headerEnabled,
        footerEnabled: draft.footerEnabled,
        header: draft.header,
        footer: draft.footer,
        pageNumbering: draft.pageNumbering
      });
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      title={t('editor.pageSettings')}
      description={`${Math.round(dims.width)} × ${Math.round(dims.height)} mm`}
      onClose={onClose}
      width={620}
      footer={(
        <>
          <button className="btn btn-ghost" data-secondary onClick={onClose}>{t('common.cancel')}</button>
          <button className="btn btn-primary" onClick={() => void apply()} disabled={busy}>{t('editor.applyPage')}</button>
        </>
      )}
    >
      <div className="page-setup">
        <div className="page-setup-row">
          <div className="field">
            <label>{t('editor.pageSize')}</label>
            <select className="input" value={draft.size} onChange={(event) => chooseSize(event.target.value as PageSizeName)}>
              <option value="A4">A4 · 210 × 297 mm</option>
              <option value="A3">A3 · 297 × 420 mm</option>
              <option value="Letter">Letter · 8.5 × 11 in</option>
              <option value="Legal">Legal · 8.5 × 14 in</option>
              <option value="Custom">{t('editor.custom')}</option>
            </select>
          </div>
          <div className="field">
            <label>{t('editor.orientation')}</label>
            <div className="segmented page-orientation">
              <button className={draft.orientation === 'portrait' ? 'is-active' : ''} onClick={() => set({ orientation: 'portrait' })}>{t('editor.portrait')}</button>
              <button className={draft.orientation === 'landscape' ? 'is-active' : ''} onClick={() => set({ orientation: 'landscape' })}>{t('editor.landscape')}</button>
            </div>
          </div>
        </div>

        {draft.size === 'Custom' && (
          <div className="field-row">
            <div className="field">
              <label>{t('editor.width')} (mm)</label>
              <input className="input" type="number" min={50} max={2000} value={draft.widthMm} onChange={(event) => set({ widthMm: Number(event.target.value) })} />
            </div>
            <div className="field">
              <label>{t('editor.height')} (mm)</label>
              <input className="input" type="number" min={50} max={2000} value={draft.heightMm} onChange={(event) => set({ heightMm: Number(event.target.value) })} />
            </div>
          </div>
        )}

        <div className="page-setup-section">
          <div className="page-setup-title">{t('editor.margins')}</div>
          <div className="page-margins">
            {([
              ['marginTop', 'editor.top'],
              ['marginRight', 'editor.right'],
              ['marginBottom', 'editor.bottom'],
              ['marginLeft', 'editor.left']
            ] as const).map(([key, label]) => (
              <div className="field" key={key}>
                <label>{t(label)} (mm)</label>
                <input className="input" type="number" min={0} max={90} step={0.5} value={draft[key]} onChange={(event) => set({ [key]: Number(event.target.value) } as Partial<PageSettings>)} />
              </div>
            ))}
          </div>
        </div>

        <div className="page-setup-row">
          <div className="field">
            <label>{t('editor.columns')}</label>
            <div className="segmented">
              {[1, 2, 3].map((column) => (
                <button key={column} className={draft.columns === column ? 'is-active' : ''} onClick={() => set({ columns: column })}>{column}</button>
              ))}
            </div>
          </div>
          <label className="checkbox page-numbers-check">
            <input type="checkbox" checked={draft.pageNumbering} onChange={(event) => set({ pageNumbering: event.target.checked })} />
            {t('editor.pageNumbers')}
          </label>
        </div>

        <div className="page-setup-section">
          <div className="page-setup-heading-row">
            <div className="page-setup-title">{t('editor.header')}</div>
            <label className="checkbox">
              <input type="checkbox" checked={draft.headerEnabled} onChange={(event) => set({ headerEnabled: event.target.checked })} />
              {t('editor.header')}
            </label>
          </div>
          <input className="input" value={draft.header} disabled={!draft.headerEnabled} placeholder="{{title}}" onChange={(event) => set({ header: event.target.value })} />
          <span className="field-hint">{t('editor.headerHint')}</span>
        </div>

        <div className="page-setup-section">
          <div className="page-setup-heading-row">
            <div className="page-setup-title">{t('editor.footer')}</div>
            <label className="checkbox">
              <input type="checkbox" checked={draft.footerEnabled} onChange={(event) => set({ footerEnabled: event.target.checked })} />
              {t('editor.footer')}
            </label>
          </div>
          <input className="input" value={draft.footer} disabled={!draft.footerEnabled} placeholder="{{page}} / {{total}}" onChange={(event) => set({ footer: event.target.value })} />
          <span className="field-hint">{t('editor.footerHint')}</span>
        </div>
      </div>
    </Modal>
  );
}
