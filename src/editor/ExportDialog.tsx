import { useEffect, useState } from 'react';
import type { ExportFormat, ExportOptions, ExportPdfOptions, PageSettings } from '../../shared/types';
import { useT } from '../lib/utils';
import { Modal } from '../components/ui';
import { FileArchive, FileCode2, FileDown, FileText, FileType2, Globe2, NotebookText } from 'lucide-react';

const FORMATS: Array<{ id: ExportFormat; label: string; hint: string; icon: React.ReactNode }> = [
  { id: 'docx', label: 'DOCX', hint: 'exportDialog.docx', icon: <FileText size={17} /> },
  { id: 'pdf', label: 'PDF', hint: 'exportDialog.pdf', icon: <FileDown size={17} /> },
  { id: 'odt', label: 'ODT', hint: 'exportDialog.odt', icon: <FileArchive size={17} /> },
  { id: 'html', label: 'HTML', hint: 'exportDialog.html', icon: <Globe2 size={17} /> },
  { id: 'md', label: 'Markdown', hint: 'exportDialog.md', icon: <FileCode2 size={17} /> },
  { id: 'rtf', label: 'RTF', hint: 'exportDialog.rtf', icon: <FileType2 size={17} /> },
  { id: 'txt', label: 'TXT', hint: 'exportDialog.txt', icon: <NotebookText size={17} /> },
  { id: 'auren', label: 'AUREN', hint: 'exportDialog.auren', icon: <FileArchive size={17} /> }
];

export function ExportDialog({
  open,
  defaultFormat,
  pageSettings,
  busy,
  onClose,
  onExport
}: {
  open: boolean;
  defaultFormat: ExportFormat;
  pageSettings: PageSettings;
  busy: boolean;
  onClose: () => void;
  onExport: (format: ExportFormat, options?: ExportOptions) => Promise<void>;
}) {
  const t = useT();
  const [format, setFormat] = useState<ExportFormat>(defaultFormat);
  const [range, setRange] = useState<'all' | 'custom'>('all');
  const [fromPage, setFromPage] = useState(1);
  const [toPage, setToPage] = useState(1);
  const [includeBackground, setIncludeBackground] = useState(true);
  const [includeHeaderFooter, setIncludeHeaderFooter] = useState(true);
  const [includePageNumbers, setIncludePageNumbers] = useState(true);
  const [quality, setQuality] = useState<'standard' | 'high'>('high');
  const [margins, setMargins] = useState({ top: pageSettings.marginTop, right: pageSettings.marginRight, bottom: pageSettings.marginBottom, left: pageSettings.marginLeft });

  useEffect(() => {
    if (!open) return;
    setFormat(defaultFormat);
    setMargins({ top: pageSettings.marginTop, right: pageSettings.marginRight, bottom: pageSettings.marginBottom, left: pageSettings.marginLeft });
  }, [open, defaultFormat, pageSettings]);

  const pdfOptions: ExportPdfOptions = {
    range,
    fromPage,
    toPage,
    includeBackground,
    includeHeaderFooter,
    includePageNumbers,
    quality,
    margins
  };

  return (
    <Modal
      open={open}
      title={t('exportDialog.title')}
      description={t('exportDialog.subtitle')}
      onClose={onClose}
      width={680}
      dismissable={!busy}
      footer={(
        <>
          <span className="export-note">{t('exportDialog.note')}</span>
          <button className="btn btn-ghost" data-secondary onClick={onClose} disabled={busy}>{t('common.cancel')}</button>
          <button className="btn btn-primary" disabled={busy} onClick={() => void onExport(format, format === 'pdf' ? { pdf: pdfOptions } : undefined)}>
            <FileDown size={14} /> {busy ? t('exportDialog.exporting') : t('exportDialog.button')}
          </button>
        </>
      )}
    >
      <div className="export-format-grid">
        {FORMATS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`export-format ${format === item.id ? 'is-active' : ''}`}
            onClick={() => setFormat(item.id)}
          >
            <span className="export-format-icon">{item.icon}</span>
            <span className="export-format-text">
              <strong>{item.label}</strong>
              <span>{t(item.hint)}</span>
            </span>
          </button>
        ))}
      </div>

      {format === 'pdf' && (
        <div className="pdf-options">
          <div className="pdf-options-title">{t('exportDialog.pdfOptions')}</div>
          <div className="field-row">
            <div className="field">
              <label>{t('exportDialog.range')}</label>
              <div className="segmented">
                <button className={range === 'all' ? 'is-active' : ''} onClick={() => setRange('all')}>{t('exportDialog.allPages')}</button>
                <button className={range === 'custom' ? 'is-active' : ''} onClick={() => setRange('custom')}>{t('exportDialog.pageRange')}</button>
              </div>
            </div>
            <div className="field">
              <label>{t('exportDialog.quality')}</label>
              <select className="input" value={quality} onChange={(event) => setQuality(event.target.value as 'standard' | 'high')}>
                <option value="high">{t('exportDialog.high')}</option>
                <option value="standard">{t('exportDialog.standard')}</option>
              </select>
            </div>
          </div>
          {range === 'custom' && (
            <div className="field-row pdf-range">
              <div className="field">
                <label>{t('exportDialog.from')}</label>
                <input className="input" type="number" min={1} value={fromPage} onChange={(event) => setFromPage(Math.max(1, Number(event.target.value)))} />
              </div>
              <div className="field">
                <label>{t('exportDialog.to')}</label>
                <input className="input" type="number" min={1} value={toPage} onChange={(event) => setToPage(Math.max(1, Number(event.target.value)))} />
              </div>
            </div>
          )}
          <div className="pdf-checks">
            <label className="checkbox"><input type="checkbox" checked={includeBackground} onChange={(event) => setIncludeBackground(event.target.checked)} /> {t('exportDialog.background')}</label>
            <label className="checkbox"><input type="checkbox" checked={includeHeaderFooter} onChange={(event) => setIncludeHeaderFooter(event.target.checked)} /> {t('exportDialog.headerFooter')}</label>
            <label className="checkbox"><input type="checkbox" checked={includePageNumbers} onChange={(event) => setIncludePageNumbers(event.target.checked)} /> {t('exportDialog.pageNumbers')}</label>
          </div>
          <div className="pdf-margins">
            <div className="pdf-margins-head">
              <span>{t('exportDialog.margins')}</span>
              <button type="button" className="btn-link" onClick={() => setMargins({ top: pageSettings.marginTop, right: pageSettings.marginRight, bottom: pageSettings.marginBottom, left: pageSettings.marginLeft })}>{t('exportDialog.resetMargins')}</button>
            </div>
            <div className="page-margins">
              {(['top', 'right', 'bottom', 'left'] as const).map((side) => (
                <label className="pdf-margin-field" key={side}>
                  <span>{t(`editor.${side}`)}</span>
                  <input className="input" type="number" min={0} max={100} step={0.5} value={margins[side]} onChange={(event) => setMargins((current) => ({ ...current, [side]: Number(event.target.value) }))} />
                </label>
              ))}
            </div>
          </div>
          <div className="field-hint">{t('exportDialog.pdfNote')}</div>
        </div>
      )}
    </Modal>
  );
}
