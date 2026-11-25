import { AlertTriangle } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  details?: string[];
  confirmLabel: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning';
  requireTypedText?: string;
  busy?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  details,
  confirmLabel,
  cancelLabel = 'Cancelar',
  variant = 'danger',
  requireTypedText,
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = useId();
  const descId = useId();
  const inputId = useId();
  const [typedText, setTypedText] = useState('');
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelBtnRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusTimer = window.setTimeout(() => {
      if (requireTypedText) {
        inputRef.current?.focus();
      } else {
        cancelBtnRef.current?.focus();
      }
    }, 0);

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !busy) {
        e.preventDefault();
        onCancel();
        return;
      }
      if (e.key === 'Tab' && dialogRef.current) {
        const focusable = Array.from(
          dialogRef.current.querySelectorAll<HTMLElement>(
            'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])'
          )
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey) {
          if (
            document.activeElement === first ||
            !dialogRef.current.contains(document.activeElement)
          ) {
            e.preventDefault();
            last.focus();
          }
        } else if (
          document.activeElement === last ||
          !dialogRef.current.contains(document.activeElement)
        ) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, [open, busy, onCancel, requireTypedText]);

  if (!open) return null;

  const normalizedRequired = requireTypedText?.trim().toUpperCase() || '';
  const typedMatches =
    !normalizedRequired ||
    typedText.trim().toUpperCase() === normalizedRequired;

  async function handleConfirmSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!typedMatches || busy) return;
    await onConfirm();
    setTypedText('');
  }

  function handleClose() {
    if (busy) return;
    setTypedText('');
    onCancel();
  }

  return (
    <div
      className="confirm-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div
        ref={dialogRef}
        className="confirm-dialog card stack-md"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
      >
        <div className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
          <span
            className={`confirm-icon confirm-icon-${variant}`}
            aria-hidden="true"
          >
            <AlertTriangle size={20} aria-hidden="true" />
          </span>
          <div className="stack-xs" style={{ flex: 1 }}>
            <h2 id={titleId} style={{ fontSize: '1.12rem' }}>
              {title}
            </h2>
            <p
              id={descId}
              style={{ color: 'var(--ink-secondary)', fontSize: '0.92rem' }}
            >
              {description}
            </p>
          </div>
        </div>

        {details && details.length > 0 && (
          <ul className="confirm-details">
            {details.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        )}

        <form onSubmit={handleConfirmSubmit} className="stack-md">
          {requireTypedText && (
            <div className="field">
              <label htmlFor={inputId}>
                Digite <strong className="mono">{requireTypedText}</strong> para
                confirmar esta ação
              </label>
              <input
                ref={inputRef}
                id={inputId}
                type="text"
                autoComplete="off"
                className="input mono"
                placeholder={requireTypedText}
                value={typedText}
                onChange={(e) => setTypedText(e.target.value)}
                disabled={busy}
              />
            </div>
          )}

          <div className="confirm-actions">
            <button
              ref={cancelBtnRef}
              type="button"
              className="btn btn-secondary"
              onClick={handleClose}
              disabled={busy}
              id="confirm-dialog-cancel"
            >
              {cancelLabel}
            </button>
            <button
              type="submit"
              className={`btn ${variant === 'danger' ? 'btn-danger' : 'btn-gold'}`}
              disabled={!typedMatches || busy}
              id="confirm-dialog-confirm"
            >
              {busy ? 'Executando...' : confirmLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
