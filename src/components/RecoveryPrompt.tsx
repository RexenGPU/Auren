import { useState } from 'react';
import { History, RotateCcw, Trash2 } from 'lucide-react';
import { useAppStore } from '../store/app';
import { useT } from '../lib/utils';
import { Modal } from './ui';

export function RecoveryPrompt() {
  const t = useT();
  const recovery = useAppStore((state) => state.recovery);
  const recoverDraft = useAppStore((state) => state.recoverDraft);
  const discardDraft = useAppStore((state) => state.discardDraft);
  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState(false);
  const candidate = recovery[0];
  if (!candidate || dismissed) return null;

  const when = new Date(candidate.savedAt).toLocaleString();
  return (
    <Modal
      open
      title={t('recovery.title')}
      description={t('recovery.body')}
      onClose={() => setDismissed(true)}
      width={480}
      footer={(<>
        <button className="btn btn-ghost" data-secondary onClick={() => setDismissed(true)}>{t('common.back')}</button>
        <button
          className="btn btn-ghost"
          onClick={async () => { setBusy(true); await discardDraft(candidate); setBusy(false); }}
          disabled={busy}
        >
          {t('recovery.discard')}
        </button>
        <button
          className="btn btn-primary"
          onClick={async () => { setBusy(true); await recoverDraft(candidate); setBusy(false); }}
          disabled={busy}
        >
          <RotateCcw size={14} /> {t('recovery.recover')}
        </button>
      </>)}
    >
      <div className="recovery-card">
        <div className="recovery-icon"><History size={18} /></div>
        <div>
          <strong>{candidate.meta.title}</strong>
          <p>{t('recovery.savedAt', { time: when })}</p>
        </div>
      </div>
      {candidate.meta.trashedAt && (
        <div className="inline-note">
          <Trash2 size={14} /> This document is currently in Trash.
        </div>
      )}
    </Modal>
  );
}
