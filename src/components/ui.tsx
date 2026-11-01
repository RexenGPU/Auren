import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X, Check, Loader2 } from 'lucide-react';
import { cx } from '../lib/utils';

export function IconButton({
  label,
  children,
  active,
  className,
  onClick,
  disabled
}: {
  label: string;
  children: ReactNode;
  active?: boolean;
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className={cx('icon-button', active && 'is-active', className)}
      aria-label={label}
      title={label}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

export function Modal({
  open,
  title,
  description,
  children,
  footer,
  onClose,
  width = 520,
  className,
  dismissable = true
}: {
  open: boolean;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  width?: number;
  className?: string;
  dismissable?: boolean;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && dismissable) {
        event.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    const timer = window.setTimeout(() => {
      const focusable = dialogRef.current?.querySelector<HTMLElement>('input, textarea, select, button:not([data-secondary])');
      focusable?.focus();
    }, 30);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.clearTimeout(timer);
    };
  }, [open, onClose, dismissable]);

  if (!open) return null;
  return createPortal(
    <div className="modal-layer" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && dismissable) onClose();
    }}>
      <div className={cx('modal', className)} role="dialog" aria-modal="true" aria-label={title} style={{ width }} ref={dialogRef}>
        <header className="modal-header">
          <div>
            <h2>{title}</h2>
            {description && <p>{description}</p>}
          </div>
          {dismissable && (
            <IconButton label="Close" onClick={onClose}>
              <X size={17} />
            </IconButton>
          )}
        </header>
        {children && <div className="modal-body">{children}</div>}
        {footer && <footer className="modal-footer">{footer}</footer>}
      </div>
    </div>,
    document.body
  );
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  onConfirm,
  onClose,
  destructive
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
  destructive?: boolean;
}) {
  return (
    <Modal
      open={open}
      title={title}
      description={description}
      onClose={onClose}
      width={440}
      footer={
        <>
          <button className="btn btn-ghost" data-secondary onClick={onClose}>Cancel</button>
          <button className={cx('btn', destructive ? 'btn-danger' : 'btn-primary')} onClick={() => { onConfirm(); onClose(); }}>
            {confirmLabel}
          </button>
        </>
      }
    />
  );
}

export function PromptDialog({
  open,
  title,
  description,
  initialValue = '',
  placeholder,
  confirmLabel = 'Save',
  onConfirm,
  onClose
}: {
  open: boolean;
  title: string;
  description?: string;
  initialValue?: string;
  placeholder?: string;
  confirmLabel?: string;
  onConfirm: (value: string) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(initialValue);
  useEffect(() => {
    if (open) setValue(initialValue);
  }, [open, initialValue]);
  return (
    <Modal
      open={open}
      title={title}
      description={description}
      onClose={onClose}
      width={430}
      footer={
        <>
          <button className="btn btn-ghost" data-secondary onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={!value.trim()} onClick={() => { onConfirm(value.trim()); onClose(); }}>
            {confirmLabel}
          </button>
        </>
      }
    >
      <input
        className="input"
        value={value}
        placeholder={placeholder}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && value.trim()) {
            onConfirm(value.trim());
            onClose();
          }
        }}
      />
    </Modal>
  );
}

export function Toggle({ checked, onChange, label, disabled = false }: { checked: boolean; onChange: (value: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={cx('toggle', checked && 'is-on', disabled && 'is-disabled')}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      <span />
    </button>
  );
}

export function Select<T extends string>({
  value,
  onChange,
  options,
  label,
  className
}: {
  value: T;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: string }>;
  label?: string;
  className?: string;
}) {
  return (
    <label className={cx('select-wrap', className)}>
      {label && <span className="sr-only">{label}</span>}
      <select value={value} aria-label={label} onChange={(event) => onChange(event.target.value as T)}>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="kbd">{children}</kbd>;
}

export function Spinner({ size = 16 }: { size?: number }) {
  return <Loader2 size={size} className="spin" />;
}

export function EmptyState({ icon, title, body, action }: { icon: ReactNode; title: string; body: string; action?: ReactNode }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{body}</p>
      {action}
    </div>
  );
}

export interface MenuItem {
  label: string;
  icon?: ReactNode;
  onClick?: () => void;
  danger?: boolean;
  disabled?: boolean;
  separator?: boolean;
  checked?: boolean;
  shortcut?: string;
}

export function ContextMenu({
  x,
  y,
  items,
  onClose,
  align = 'left'
}: {
  x: number;
  y: number;
  items: MenuItem[];
  onClose: () => void;
  align?: 'left' | 'right';
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDown = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) onClose();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const style: React.CSSProperties = {
    position: 'fixed',
    top: Math.min(y, window.innerHeight - Math.min(items.length * 34 + 16, 420)),
    left: align === 'left' ? Math.min(x, window.innerWidth - 240) : undefined,
    right: align === 'right' ? Math.max(10, window.innerWidth - x) : undefined
  };

  return createPortal(
    <div className="context-menu" style={style} ref={ref} role="menu">
      {items.map((item, index) => item.separator
        ? <div key={index} className="menu-sep" />
        : (
          <button
            key={index}
            type="button"
            className={cx('menu-item', item.danger && 'is-danger', item.disabled && 'is-disabled')}
            role="menuitem"
            disabled={item.disabled}
            onClick={() => { item.onClick?.(); onClose(); }}
          >
            <span className="menu-icon">{item.checked ? <Check size={14} /> : item.icon}</span>
            <span className="menu-label">{item.label}</span>
            {item.shortcut && <span className="menu-shortcut">{item.shortcut}</span>}
          </button>
        ))}
    </div>,
    document.body
  );
}

export function ColorPicker({ value, colors, onChange, allowClear = true }: { value?: string; colors: string[]; onChange: (color: string | null) => void; allowClear?: boolean }) {
  return (
    <div className="color-picker">
      {colors.map((color) => (
        <button
          key={color}
          type="button"
          className={cx('color-dot', value === color && 'is-selected')}
          style={{ background: color }}
          aria-label={color}
          onClick={() => onChange(color)}
        />
      ))}
      {allowClear && <button type="button" className="color-dot is-clear" onClick={() => onChange(null)} aria-label="Clear color" />}
    </div>
  );
}
