import { AlertTriangle, CheckCircle2, Mail, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { consumePostLoginRedirect, getRememberedSignInEmail } from '../lib/session';
import { dataService } from '../services';

/**
 * Gerencia todas as estratégias de retorno de Magic Link:
 * 1. Mesmo navegador -> login automático via cookie/localStorage + redirect limpo.
 * 2. Outro dispositivo / navegador interno -> solicita confirmação do e-mail.
 * 3. Link expirado ou já utilizado -> exibe erro amigável + botão de reenvio com cooldown.
 */
export function MagicLinkHandler() {
  const navigate = useNavigate();
  const [state, setState] = useState<
    'idle' | 'checking' | 'needs_email' | 'error' | 'completed'
  >('idle');
  const [message, setMessage] = useState('');
  const [emailInput, setEmailInput] = useState(getRememberedSignInEmail() || '');
  const [submitting, setSubmitting] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resentInfo, setResentInfo] = useState('');

  useEffect(() => {
    let active = true;
    setState('checking');
    dataService.checkMagicLinkReturn().then((res) => {
      if (!active) return;
      if (res.status === 'none') {
        setState('idle');
      } else if (res.status === 'completed') {
        setState('completed');
        const dest = consumePostLoginRedirect();
        navigate(dest, { replace: true });
      } else if (res.status === 'needs_email') {
        setState('needs_email');
        setMessage(res.message || 'Confirme seu e-mail para concluir o acesso.');
      } else {
        setState('error');
        setMessage(res.message || 'Não foi possível validar seu link de acesso.');
      }
    });
    return () => {
      active = false;
    };
  }, [navigate]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  async function handleConfirmEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!emailInput.trim()) return;
    setSubmitting(true);
    setResentInfo('');
    const res = await dataService.completeMagicLinkWithEmail(emailInput);
    setSubmitting(false);
    if (res.status === 'completed') {
      setState('completed');
      const dest = consumePostLoginRedirect();
      navigate(dest, { replace: true });
    } else {
      setState('error');
      setMessage(res.message || 'E-mail não confere ou link expirado.');
    }
  }

  async function handleResend() {
    if (!emailInput.trim() || resendCooldown > 0) return;
    setSubmitting(true);
    setResentInfo('');
    try {
      await dataService.sendMagicLink(emailInput, '/minha-cota');
      setResendCooldown(60);
      setResentInfo(
        `Novo link enviado para ${emailInput.trim()}! Verifique sua caixa de entrada e spam.`
      );
    } catch (err) {
      setResentInfo(
        err instanceof Error ? err.message : 'Erro ao reenviar o link.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (state === 'idle' || state === 'completed') return null;

  if (state === 'checking') {
    return (
      <div className="container" style={{ marginTop: 18 }}>
        <div className="alert alert-info" role="status" aria-live="polite">
          <CheckCircle2 size={18} aria-hidden="true" />
          <span>Validando seu Magic Link do MegaCorn...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ marginTop: 18 }}>
      <div
        className="card stack-sm"
        id="magic-link-return-card"
        role={state === 'error' ? 'alert' : 'region'}
        aria-label="Retorno do login por Magic Link"
      >
        <div className="row" style={{ gap: 10 }}>
          {state === 'needs_email' ? (
            <Mail size={20} color="var(--unicorn-500)" aria-hidden="true" />
          ) : (
            <AlertTriangle size={20} color="var(--danger-ink)" aria-hidden="true" />
          )}
          <h2>
            {state === 'needs_email'
              ? 'Confirme seu e-mail para concluir o login'
              : 'Link de acesso expirado ou já utilizado'}
          </h2>
        </div>
        <p style={{ color: 'var(--ink-secondary)', fontSize: '0.92rem' }}>
          {message}
        </p>

        <form onSubmit={handleConfirmEmail} className="row" style={{ alignItems: 'flex-end' }}>
          <div className="field" style={{ flex: 1, minWidth: 240 }}>
            <label htmlFor="magic-return-email">Seu e-mail pessoal</label>
            <input
              id="magic-return-email"
              type="email"
              required
              autoComplete="email"
              className="input"
              placeholder="voce@gmail.com"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
            />
          </div>

          {state === 'needs_email' ? (
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
              id="btn-confirm-magic-email"
            >
              {submitting ? 'Entrando...' : 'Concluir login'}
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-gold"
              disabled={submitting || resendCooldown > 0}
              onClick={handleResend}
              id="btn-resend-magic-link"
            >
              <RefreshCw size={15} aria-hidden="true" />
              {resendCooldown > 0
                ? `Aguarde ${resendCooldown}s`
                : 'Enviar novo Magic Link'}
            </button>
          )}
        </form>

        {resentInfo && (
          <div className="alert alert-success" role="status" aria-live="polite">
            {resentInfo}
          </div>
        )}
      </div>
    </div>
  );
}
