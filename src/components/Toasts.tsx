import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { useAppStore } from '../store/app';

export function Toasts() {
  const toasts = useAppStore((state) => state.toasts);
  const dismiss = useAppStore((state) => state.dismissToast);
  return (
    <div className="toast-layer" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast ${toast.kind}`}>
          <span className="toast-icon">
            {toast.kind === 'success' ? <CheckCircle2 size={15} /> : toast.kind === 'error' ? <AlertCircle size={15} /> : <Info size={15} />}
          </span>
          <span className="toast-message">{toast.message}</span>
          <button className="icon-button" onClick={() => dismiss(toast.id)} aria-label="Dismiss"><X size={13} /></button>
        </div>
      ))}
    </div>
  );
}
