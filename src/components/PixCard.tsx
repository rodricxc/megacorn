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
  const [copied, setCopied] = useState<'pix' | 'txid' | null>(null);
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

  async function handleCopy(text: string, type: 'pix' | 'txid') {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(type);
      setTimeout(() => setCopied(null), 2200);
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
              <img src={qrDataUrl} alt="QR Code PIX MegaCorn" />
            ) : (
              <div style={{ padding: 32, color: 'var(--ink-muted)' }}>
                Gerando QR Code...
              </div>
            )}
            <span className="mono" style={{ fontSize: '0.78rem', fontWeight: 700 }}>
              {formatCurrencyBr(amount)}
            </span>
          </div>

          <div className="stack-sm">
            <div className="grid-2" style={{ gap: 10 }}>
              <div className="card-cream">
                <div className="stat-label">Valor exato ({profile.requestedQuotas} cota{profile.requestedQuotas > 1 ? 's' : ''})</div>
                <div className="stat-value" style={{ fontSize: '1.4rem' }}>
                  {formatCurrencyBr(amount)}
                </div>
              </div>
              <div className="card-cream">
                <div className="stat-label">Identificador no extrato (TXID)</div>
                <div className="row" style={{ marginTop: 6, gap: 6 }}>
                  <span className="mono" style={{ fontWeight: 700, fontSize: '0.92rem' }}>
                    {profile.txid}
                  </span>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleCopy(profile.txid, 'txid')}
                    id="btn-copy-txid"
                  >
                    {copied === 'txid' ? <Check size={13} /> : <Copy size={13} />}
                    {copied === 'txid' ? 'Copiado' : 'Copiar'}
                  </button>
                </div>
              </div>
            </div>

            <div className="field">
              <label>PIX Copia e Cola (valor e TXID já preenchidos)</label>
              <div className="pix-code-box">{pixPayload}</div>
              <div className="row">
                <button
                  type="button"
                  className="btn btn-gold"
                  onClick={() => handleCopy(pixPayload, 'pix')}
                  id="btn-copy-pix-code"
                >
                  {copied === 'pix' ? <Check size={16} /> : <Copy size={16} />}
                  {copied === 'pix' ? 'Código PIX copiado!' : 'Copiar PIX Copia e Cola'}
                </button>
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
              Não é necessário enviar foto do comprovante — conferimos pelo seu TXID{' '}
              <strong className="mono">{profile.txid}</strong> direto no extrato.
              Após clicar abaixo, a quantidade de cotas fica travada para evitar
              diferença de valor.
            </p>
          </div>
          <div className="field">
            <label htmlFor="pix-note-input">Observação opcional (ex.: nome do pagador ou horário)</label>
            <input
              id="pix-note-input"
              type="text"
              className="input"
              placeholder="Ex.: Pago às 15h30 pelo banco X"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={140}
            />
          </div>
          {error && <div className="alert alert-danger">{error}</div>}
          <div>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
              id="btn-report-pix-paid"
            >
              <Send size={15} />
              {submitting ? 'Registrando...' : 'Já fiz o PIX'}
            </button>
          </div>
        </form>
      )}

      {profile.paymentStatus === 'reported' && (
        <div className="alert alert-warning">
          <div>
            <strong>Aviso de PIX registrado!</strong> Os organizadores vão conferir o
            código <span className="mono">{profile.txid}</span> no extrato e confirmar
            sua participação em breve.
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
