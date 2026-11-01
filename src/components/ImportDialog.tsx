import { useEffect, useState } from 'react';
import { AlertTriangle, FileInput } from 'lucide-react';
import { useAppStore } from '../store/app';
import { useT } from '../lib/utils';
import { Modal } from './ui';

export function ImportDialog() {
  const t = useT();
  const preview = useAppStore((state) => state.pendingImport);
  const clear = useAppStore((state) => state.clearPendingImport);
  const createFromPreview = useAppStore((state) => state.createFromPreview);
  const updateSettings = useAppStore((state) => state.updateSettings);
  const onboardingComplete = useAppStore((state) => state.settings?.onboardingComplete ?? true);
  const workspaces = useAppStore((state) => state.workspaces);
  const [title, setTitle] = useState('');
  const [workspaceId, setWorkspaceId] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (preview) {
      setTitle(preview.suggestedTitle || preview.fileName.replace(/\.[^.]+$/, ''));
      setWorkspaceId('');
    }
  }, [preview]);

  if (!preview) return null;
  const doImport = async () => {
    setBusy(true);
    const modified = { ...preview, suggestedTitle: title.trim() || preview.suggestedTitle };
    await createFromPreview(modified, workspaceId || null, null);
    if (!onboardingComplete) await updateSettings({ onboardingComplete: true });
    setBusy(false);
  };

  return (
    <Modal
      open
      title={`Import ${preview.sourceFormat} document`}
      description={preview.fileName}
      onClose={clear}
      width={760}
      footer={(<>
        <button className="btn btn-ghost" data-secondary onClick={clear}>{t('common.cancel')}</button>
        <button className="btn btn-primary" onClick={() => void doImport()} disabled={busy || !title.trim()}>
          <FileInput size={14} /> Import document
        </button>
      </>)}
    >
      <div className="field-row">
        <div className="field">
          <label>Document title</label>
          <input className="input" value={title} onChange={(event) => setTitle(event.target.value)} />
        </div>
        <div className="field">
          <label>Workspace</label>
          <select className="input" value={workspaceId} onChange={(event) => setWorkspaceId(event.target.value)}>
            <option value="">No workspace</option>
            {workspaces.map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.name}</option>)}
          </select>
        </div>
      </div>
      {preview.warnings.length > 0 && (
        <div className="warning-box">
          <div className="warning-title"><AlertTriangle size={14} /> Import notes</div>
          <ul>{preview.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul>
        </div>
      )}
      <div className="field">
        <span className="field-label">Preview</span>
        <div className="import-preview">
          <div className="import-preview-inner" dangerouslySetInnerHTML={{ __html: preview.html }} />
        </div>
      </div>
    </Modal>
  );
}
