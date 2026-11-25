import { Check, Copy, Eye, EyeOff, Lock } from 'lucide-react';
import { useState } from 'react';
import { formatCpf, isValidCpf, maskCpf, sanitizeCpf } from '../lib/cpf';

interface CpfFieldProps {
  value: string;
  onChange: (digits: string) => void;
  id?: string;
  label?: string;
}

export function CpfField({
  value,
  onChange,
  id = 'cpf-input',
  label = 'CPF (opcional — caso queira seu CPF no bilhete)',
}: CpfFieldProps) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  const digits = sanitizeCpf(value);
  const hasValue = digits.length > 0;
  const valid = !hasValue || isValidCpf(digits);
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  async function handleCopy() {
    if (!digits) return;
    try {
      await navigator.clipboard.writeText(formatCpf(digits));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore
    }
  }

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="row" style={{ gap: 8 }}>
        <input
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          className="input mono"
          style={{ flex: 1 }}
          placeholder="000.000.000-00 (opcional)"
          value={
            revealed || digits.length < 11
              ? formatCpf(digits)
              : maskCpf(digits)
          }
          onFocus={() => setRevealed(true)}
          onChange={(e) => onChange(sanitizeCpf(e.target.value))}
          aria-invalid={!valid}
          aria-describedby={valid ? hintId : `${errorId} ${hintId}`}
        />

        {digits.length === 11 && (
          <>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setRevealed((r) => !r)}
              aria-label={revealed ? 'Ocultar CPF' : 'Revelar CPF'}
              aria-pressed={revealed}
            >
              {revealed ? (
                <EyeOff size={15} aria-hidden="true" />
              ) : (
                <Eye size={15} aria-hidden="true" />
              )}
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleCopy}
              aria-label={copied ? 'CPF copiado' : 'Copiar CPF'}
            >
              {copied ? (
                <Check size={15} aria-hidden="true" />
              ) : (
                <Copy size={15} aria-hidden="true" />
              )}
            </button>
          </>
        )}
      </div>

      <span className="sr-only" role="status" aria-live="polite">
        {copied ? 'CPF copiado para a área de transferência.' : ''}
      </span>

      {!valid && (
        <span
          id={errorId}
          role="alert"
          style={{ color: 'var(--danger-ink)', fontSize: '0.8rem', fontWeight: 600 }}
        >
          CPF inválido. Confira os 11 dígitos ou deixe em branco (campo opcional).
        </span>
      )}

      <span
        id={hintId}
        className="field-hint"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
      >
        <Lock size={12} aria-hidden="true" />
        Dado privado (PII): visível apenas para você e para os moderadores — nunca aparece no placar. Todas as informações serão deletadas em até 30 dias após o sorteio.
      </span>
    </div>
  );
}
