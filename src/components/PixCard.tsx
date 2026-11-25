import { Check, CheckCircle2, Copy, QrCode, Send } from 'lucide-react';
import QRCode from 'qrcode';
import { useEffect, useMemo, useState } from 'react';
import { formatCurrencyBr } from '../lib/appsScript';
import { generatePixPayload } from '../lib/pix';
import type { PaymentConfig, UserProfile } from '../types';

interface PixCardProps {
  profile: UserProfile;
  paymentConfig: PaymentConfig;
  quotaPrice: number;
  poolName: string;
  pixPaymentOpen: boolean;
  onReportPaid: (note: string) => Promise<void>;
}

export function PixCard({
  profile,
  paymentConfig,
  quotaPrice,
  poolName,
  pixPaymentOpen,
  onReportPaid,
}: PixCardProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [note, setNote] = useState(profile.paymentNote || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amount = Number((profile.requestedQuotas * quotaPrice).toFixed(2));

  const pixPayload = useMemo(() => {
    if (!paymentConfig.pixKey.trim()) return '';
    try {
      return generatePixPayload({
        pixKey: paymentConfig.pixKey,
        merchantName: paymentConfig.merchantName,
        merchantCity: paymentConfig.merchantCity,
        amount,
        txid: profile.txid,
        description: `${poolName} ${profile.requestedQuotas}c`,
      });
    } catch {
      return '';
    }
  }, [paymentConfig, amount, profile.txid, poolName, profile.requestedQuotas]);

  useEffect(() => {
    let active = true;
    if (!pixPayload) {
      setQrDataUrl('');
      return;
    }
    QRCode.toDataURL(pixPayload, {
      width: 220,
      margin: 1,
      color: { dark: '#143328', light: '#FFFFFF' },
    })
      .then((url) => {
        if (active) setQrDataUrl(url);
      })
      .catch(() => {
        if (active) setQrDataUrl('');
      });
    return () => {
      active = false;
    };
  }, [pixPayload]);

  async function handleCopy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      setError('Não foi possível copiar automaticamente. Selecione e copie o código.');
    }
  }

  async function handleSubmitReport(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await onReportPaid(note);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Erro ao registrar aviso de PIX.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (!pixPaymentOpen && profile.paymentStatus === 'unpaid') {
    return (
      <div className="alert alert-warning">
        <QrCode size={18} style={{ flexShrink: 0, marginTop: 2 }} />
        <div>
          <strong>Pagamentos via PIX pausados pelos administradores.</strong>
          <p style={{ marginTop: 4 }}>
            Assim que a etapa de PIX for liberada novamente, seu QR Code e código
            Copia e Cola aparecerão aqui.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="card stack-md" id="pix-payment-card">
      <div className="row-between">
        <div>
          <h2>Pagamento via PIX</h2>
          <p style={{ color: 'var(--ink-secondary)', fontSize: '0.92rem' }}>
            {paymentConfig.instructions}
          </p>
        </div>
        {profile.paymentStatus === 'confirmed' && (
          <span className="badge badge-success">
            <CheckCircle2 size={14} />
            PIX Confirmado ({profile.paidQuotas} cota{profile.paidQuotas > 1 ? 's' : ''})
          </span>
        )}
        {profile.paymentStatus === 'reported' && (
          <span className="badge badge-warning">
            Aviso enviado • Aguardando conferência
          </span>
        )}
        {profile.paymentStatus === 'unpaid' && (
          <span className="badge badge-neutral">Aguardando PIX</span>
        )}
      </div>

      {profile.approvalStatus === 'pending' && (
        <div className="alert alert-info">
          <div>
            <strong>Você já pode pagar mesmo aguardando aprovação!</strong> Caso sua
            inscrição não seja aprovada por algum motivo, o sistema registrará
            automaticamente o estorno integral para devolução do PIX.
          </div>
        </div>
      )}

      {!pixPayload ? (
        <div className="alert alert-warning">
          A chave PIX ainda não foi configurada pelos organizadores.
        </div>
      ) : (
        <div className="pix-layout">
          <div className="pix-qr-box">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt={`QR Code PIX do ${poolName} no valor de ${formatCurrencyBr(amount)} para ${paymentConfig.merchantName}`}
              />
            ) : (
              <div
                role="status"
                style={{ padding: 32, color: 'var(--ink-muted)' }}
              >
                Gerando QR Code...
              </div>
            )}
            <span className="mono" style={{ fontSize: '0.78rem', fontWeight: 700 }}>
              {formatCurrencyBr(amount)}
            </span>
          </div>

          <div className="stack-sm">
            <div className="card-cream">
              <div className="stat-label">
                Valor exato ({profile.requestedQuotas} cota
                {profile.requestedQuotas > 1 ? 's' : ''})
              </div>
              <div className="stat-value" style={{ fontSize: '1.5rem' }}>
                {formatCurrencyBr(amount)}
              </div>
            </div>

            <div className="field">
              <label htmlFor="pix-copia-cola-box">
                PIX Copia e Cola (valor já preenchido)
              </label>
              <div
                id="pix-copia-cola-box"
                className="pix-code-box"
                aria-label="Código PIX Copia e Cola"
              >
                {pixPayload}
              </div>
              <div className="row">
                <button
                  type="button"
                  className="btn btn-gold"
                  onClick={() => handleCopy(pixPayload)}
                  id="btn-copy-pix-code"
                >
                  {copied ? (
                    <Check size={16} aria-hidden="true" />
                  ) : (
                    <Copy size={16} aria-hidden="true" />
                  )}
                  {copied ? 'Código PIX copiado!' : 'Copiar PIX Copia e Cola'}
                </button>
                <span className="sr-only" role="status" aria-live="polite">
                  {copied
                    ? 'Código PIX Copia e Cola copiado para a área de transferência.'
                    : ''}
                </span>
                <span className="field-hint">
                  Recebedor: <strong>{paymentConfig.merchantName}</strong> ({paymentConfig.merchantCity})
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {profile.paymentStatus === 'unpaid' && pixPaymentOpen && (
        <form
          onSubmit={handleSubmitReport}
          className="card-mint stack-sm"
          style={{ marginTop: 6 }}
        >
          <div>
            <h3>Já realizou o pagamento?</h3>
            <p className="field-hint" style={{ color: 'var(--ink-secondary)' }}>
              Não é necessário enviar foto do comprovante — conferimos o
              recebimento direto no extrato. Após clicar abaixo, a quantidade de
              cotas fica travada para evitar diferença de valor.
            </p>
          </div>
          <div className="field">
            <label htmlFor="pix-note-input">
              Observação / titular da conta pagadora (opcional)
            </label>
            <input
              id="pix-note-input"
              type="text"
              className="input"
              placeholder="Ex.: Pago pela conta de Maria Silva às 15h30"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={140}
              aria-describedby="pix-note-hint"
            />
            <span id="pix-note-hint" className="field-hint">
              Se o PIX foi feito a partir de uma conta bancária em nome de outra
              pessoa (ou conta PJ), informe o <strong>nome do titular da conta</strong>{' '}
              acima para facilitar a identificação no extrato.
            </span>
          </div>
          {error && (
            <div className="alert alert-danger" role="alert">
              {error}
            </div>
          )}
          <div>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
              id="btn-report-pix-paid"
            >
              <Send size={15} aria-hidden="true" />
              {submitting ? 'Registrando...' : 'Já fiz o PIX'}
            </button>
          </div>
        </form>
      )}

      {profile.paymentStatus === 'reported' && (
        <div className="alert alert-warning" role="status" aria-live="polite">
          <div>
            <strong>Aviso de PIX registrado!</strong> Os organizadores vão
            conferir o recebimento no extrato e confirmar sua participação em
            breve.
            {profile.paymentNote && (
              <div style={{ marginTop: 4 }}>
                Sua observação: <em>“{profile.paymentNote}”</em>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
