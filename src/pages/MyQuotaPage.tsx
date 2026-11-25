import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  KeyRound,
  MessageCircle,
  Save,
  Sparkles,
  Undo2,
} from 'lucide-react';
import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { CpfField } from '../components/CpfField';
import { PixCard } from '../components/PixCard';
import { useApp } from '../context/useApp';
import { formatCurrencyBr } from '../lib/appsScript';
import { isValidCpf, sanitizeCpf } from '../lib/cpf';
import { getRememberedInviteCode } from '../lib/session';
import { dataService } from '../services';

export function MyQuotaPage() {
  const {
    authLoading,
    dataLoading,
    authUser,
    profile,
    publicConfig,
    paymentConfig,
    boardEquity,
    refreshAll,
  } = useApp();

  // Form de primeiro cadastro (pré-preenche código vindo da URL ou do login)
  const [prevProfile, setPrevProfile] = useState(profile);
  const [inviteCode, setInviteCode] = useState(getRememberedInviteCode());
  const [displayName, setDisplayName] = useState(profile?.displayName || '');
  const [requestedQuotas, setRequestedQuotas] = useState(
    profile?.requestedQuotas || 1
  );
  const [cpf, setCpf] = useState(profile?.cpf || '');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'danger';
    text: string;
  } | null>(null);

  if (profile !== prevProfile) {
    setPrevProfile(profile);
    if (profile) {
      setDisplayName(profile.displayName);
      setRequestedQuotas(profile.requestedQuotas);
      setCpf(profile.cpf || '');
    }
  }

  if (!authLoading && !authUser) {
    return <Navigate to="/" replace />;
  }

  if (authLoading || dataLoading) {
    return (
      <div className="container">
        <div className="card" role="status" aria-busy="true">
          Carregando sua participação no MegaCorn...
        </div>
      </div>
    );
  }

  const quotaOptions = Array.from(
    { length: Math.max(1, publicConfig.maxQuotasPerPerson) },
    (_, i) => i + 1
  );

  function handleQuotaRadioKeyDown(
    e: React.KeyboardEvent<HTMLDivElement>,
    idPrefix: string
  ) {
    const idx = Math.max(0, quotaOptions.indexOf(requestedQuotas));
    let nextIdx: number | null = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      nextIdx = (idx + 1) % quotaOptions.length;
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      nextIdx = (idx - 1 + quotaOptions.length) % quotaOptions.length;
    } else if (e.key === 'Home') {
      nextIdx = 0;
    } else if (e.key === 'End') {
      nextIdx = quotaOptions.length - 1;
    }
    if (nextIdx !== null) {
      e.preventDefault();
      const nextVal = quotaOptions[nextIdx];
      setRequestedQuotas(nextVal);
      document.getElementById(`${idPrefix}-${nextVal}`)?.focus();
    }
  }

  // Fluxo 1: Usuário autenticado ainda sem cadastro no bolão -> Código de convite
  if (!profile) {
    const registrationsOpen = publicConfig.flags.registrationsOpen;

    async function handleRegister(e: React.FormEvent) {
      e.preventDefault();
      if (!authUser) return;
      setFeedback(null);

      if (!registrationsOpen) {
        setFeedback({
          type: 'danger',
          text: 'Novas inscrições (submissões) estão desativadas no momento.',
        });
        return;
      }

      if (!displayName.trim()) {
        setFeedback({ type: 'danger', text: 'Informe seu nome de exibição.' });
        return;
      }
      const cleanCpf = sanitizeCpf(cpf);
      if (cleanCpf && !isValidCpf(cleanCpf)) {
        setFeedback({
          type: 'danger',
          text: 'CPF inválido. Corrija os 11 dígitos ou deixe o campo em branco.',
        });
        return;
      }

      setSaving(true);
      try {
        await dataService.registerParticipant({
          uid: authUser.uid,
          email: authUser.email,
          displayName,
          cpf: cleanCpf,
          requestedQuotas,
          inviteCode,
        });
        await refreshAll();
        setFeedback({
          type: 'success',
          text: 'Cadastro enviado! Você já pode ver seu PIX e acompanhar sua aprovação.',
        });
      } catch (err) {
        await refreshAll();
        setFeedback({
          type: 'danger',
          text:
            err instanceof Error
              ? err.message
              : 'Erro ao concluir sua inscrição.',
        });
      } finally {
        setSaving(false);
      }
    }

    return (
      <div className="container" style={{ maxWidth: 680 }}>
        <div className="card stack-md" id="onboarding-registration-card">
          <div>
            <span className="badge badge-unicorn">
              <KeyRound size={13} aria-hidden="true" />
              Primeiro acesso • {authUser?.email}
            </span>
            <h1 style={{ marginTop: 8 }}>Complete sua entrada no {publicConfig.poolName}</h1>
            <p style={{ color: 'var(--ink-secondary)', marginTop: 4 }}>
              Informe o código de convite compartilhado pelo time e escolha
              quantas cotas você gostaria de reservar.
            </p>
          </div>

          {!registrationsOpen && (
            <div
              className="alert alert-warning"
              role="status"
              aria-live="polite"
              id="registration-closed-alert"
            >
              <AlertTriangle size={18} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <strong>Novas inscrições estão fechadas no momento.</strong>
                <p style={{ marginTop: 4 }}>
                  Os administradores desativaram novas inscrições (submissões),
                  então o envio do cadastro está bloqueado. Fale com a
                  organização do bolão se precisar de ajuda.
                </p>
              </div>
            </div>
          )}

          <form onSubmit={handleRegister} className="stack-md">
            <div className="field">
              <label htmlFor="invite-code-input">Código de convite do time</label>
              <input
                id="invite-code-input"
                type="text"
                required
                disabled={!registrationsOpen || saving}
                className="input mono"
                placeholder="Ex.: MEGACORN2027"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              />
            </div>

            <div className="field">
              <label htmlFor="reg-display-name">
                Seu nome de exibição (como aparecerá no placar após aprovação)
              </label>
              <input
                id="reg-display-name"
                type="text"
                required
                disabled={!registrationsOpen || saving}
                className="input"
                placeholder="Ex.: Ana Paula S."
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={60}
              />
            </div>

            <div className="field">
              <span id="reg-quotas-label" style={{ fontSize: '0.85rem', fontWeight: 700 }}>
                Quantas cotas deseja reservar? ({formatCurrencyBr(publicConfig.quotaPrice)} cada)
              </span>
              <div
                className="quota-pills"
                role="radiogroup"
                aria-labelledby="reg-quotas-label"
                onKeyDown={(e) => {
                  if (!registrationsOpen || saving) return;
                  handleQuotaRadioKeyDown(e, 'reg-quota-pill');
                }}
              >
                {quotaOptions.map((n) => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    disabled={!registrationsOpen || saving}
                    aria-checked={requestedQuotas === n}
                    aria-label={`${n} cota${n > 1 ? 's' : ''}, total ${formatCurrencyBr(n * publicConfig.quotaPrice)}`}
                    tabIndex={requestedQuotas === n ? 0 : -1}
                    className={`quota-pill${requestedQuotas === n ? ' selected' : ''}`}
                    onClick={() => setRequestedQuotas(n)}
                    id={`reg-quota-pill-${n}`}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <span className="field-hint">
                Total previsto:{' '}
                <strong>
                  {formatCurrencyBr(requestedQuotas * publicConfig.quotaPrice)}
                </strong>{' '}
                • Lembre-se: a 1ª cota tem prioridade máxima pela regra de
                equidade.
              </span>
            </div>

            <CpfField
              value={cpf}
              onChange={setCpf}
              id="reg-cpf-input"
              disabled={!registrationsOpen || saving}
            />

            {feedback && (
              <div
                className={`alert alert-${feedback.type}`}
                role={feedback.type === 'danger' ? 'alert' : 'status'}
                aria-live={feedback.type === 'danger' ? 'assertive' : 'polite'}
              >
                {feedback.text}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary btn-mobile-full"
              disabled={saving || !registrationsOpen}
              id="btn-submit-registration"
            >
              <Sparkles size={16} aria-hidden="true" />
              {!registrationsOpen
                ? 'Inscrições fechadas'
                : saving
                  ? 'Validando convite...'
                  : 'Confirmar minha reserva'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Fluxo 2: Usuário já inscrito
  const myAlloc = boardEquity.allocations.get(profile.uid);
  const canEditQuotas =
    publicConfig.flags.quotaEditsOpen &&
    !publicConfig.flags.poolClosed &&
    profile.paymentStatus === 'unpaid' &&
    profile.approvalStatus !== 'rejected' &&
    profile.approvalStatus !== 'cancelled';

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setFeedback(null);

    const cleanCpf = sanitizeCpf(cpf);
    if (cleanCpf && !isValidCpf(cleanCpf)) {
      setFeedback({
        type: 'danger',
        text: 'CPF inválido. Corrija os 11 dígitos ou deixe em branco.',
      });
      return;
    }

    setSaving(true);
    try {
      await dataService.updateOwnProfile(profile.uid, {
        displayName,
        cpf: cleanCpf,
        ...(canEditQuotas ? { requestedQuotas } : {}),
      });
      await refreshAll();
      setFeedback({ type: 'success', text: 'Seus dados foram atualizados!' });
    } catch (err) {
      setFeedback({
        type: 'danger',
        text: err instanceof Error ? err.message : 'Erro ao salvar perfil.',
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleReportPix(note: string) {
    if (!profile) return;
    await dataService.reportOwnPixPayment(profile.uid, note);
    await refreshAll();
  }

  return (
    <div className="container stack-lg">
      {/* Cabeçalho e resumo de status */}
      <section className="card stack-md">
        <div className="row-between">
          <div>
            <h1>Olá, {profile.displayName}!</h1>
            <p style={{ color: 'var(--ink-secondary)', fontSize: '0.92rem' }}>
              Conectado como <strong>{profile.email}</strong>
            </p>
          </div>
          <div className="row" style={{ gap: 8 }}>
            {profile.approvalStatus === 'approved' && (
              <span className="badge badge-success">
                <CheckCircle2 size={14} aria-hidden="true" />
                Participante Aprovado
              </span>
            )}
            {profile.approvalStatus === 'pending' && (
              <span className="badge badge-warning">
                <Clock size={14} aria-hidden="true" />
                Aguardando Aprovação
              </span>
            )}
            {profile.approvalStatus === 'rejected' && (
              <span className="badge badge-danger">Inscrição Recusada</span>
            )}
            {profile.approvalStatus === 'cancelled' && (
              <span className="badge badge-danger">Participação Cancelada</span>
            )}
          </div>
        </div>

        {/* Alertas de status especiais */}
        {profile.approvalStatus === 'pending' && (
          <div className="alert alert-info">
            <Clock size={18} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <strong>Seu cadastro está aguardando aprovação dos moderadores.</strong>
              <p style={{ marginTop: 4 }}>
                Por privacidade, seu nome ainda não aparece no placar (apenas na
                contagem geral). Você <strong>já pode fazer o PIX abaixo</strong>{' '}
                para adiantar sua participação.
              </p>
            </div>
          </div>
        )}

        {profile.refundStatus === 'pending' && (
          <div className="alert alert-warning">
            <Undo2 size={18} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <strong>
                Estorno pendente: {formatCurrencyBr(profile.refundAmount)} (
                {profile.refundQuotas} cota{profile.refundQuotas > 1 ? 's' : ''})
              </strong>
              <p style={{ marginTop: 4 }}>
                Os organizadores já têm seu estorno listado no painel e farão a
                devolução via PIX.
              </p>
            </div>
          </div>
        )}

        {profile.refundStatus === 'completed' && (
          <div className="alert alert-success">
            <CheckCircle2 size={18} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <strong>
                Estorno concluído: {formatCurrencyBr(profile.refundAmount)} (
                {profile.refundQuotas} cota{profile.refundQuotas > 1 ? 's' : ''}).
              </strong>
            </div>
          </div>
        )}

        {myAlloc?.isWaitlisted && (
          <div className="alert alert-warning">
            <AlertTriangle size={18} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <strong>
                Você está na Fila de Espera (posição #{myAlloc.waitlistPosition}).
              </strong>
              <p style={{ marginTop: 4 }}>
                O bolão atingiu {publicConfig.totalQuotas} participantes únicos.
                Se alguma vaga abrir por desistência ou não pagamento, você sobe
                automaticamente.
              </p>
            </div>
          </div>
        )}

        <div className="grid-4">
          <div className="stat-tile">
            <div className="stat-label">Cotas pedidas</div>
            <div className="stat-value">{profile.requestedQuotas}</div>
            <div className="stat-sub">
              {formatCurrencyBr(profile.requestedQuotas * publicConfig.quotaPrice)}
            </div>
          </div>

          <div className="stat-tile">
            <div className="stat-label">
              {publicConfig.flags.poolClosed
                ? 'Cotas finais'
                : 'Cotas Estimadas (estado atual)'}
            </div>
            <div className="stat-value">
              {publicConfig.flags.poolClosed
                ? (profile.finalQuotas ?? 0)
                : profile.approvalStatus === 'approved'
                  ? (myAlloc?.allocatedQuotas ?? 0)
                  : 'Após aprovação'}
            </div>
            <div className="stat-sub">
              {myAlloc && myAlloc.excessQuotas > 0 && !publicConfig.flags.poolClosed
                ? `${myAlloc.excessQuotas} cota(s) excedente(s) hoje`
                : 'Regra de equidade ativa'}
            </div>
          </div>

          <div className="stat-tile">
            <div className="stat-label">Status do PIX</div>
            <div className="stat-value" style={{ fontSize: '1.3rem' }}>
              {profile.paymentStatus === 'confirmed'
                ? 'Confirmado'
                : profile.paymentStatus === 'reported'
                  ? 'Em conferência'
                  : 'Pendente'}
            </div>
            <div className="stat-sub">
              {profile.paidQuotas > 0
                ? `${profile.paidQuotas} cota(s) paga(s)`
                : 'Aguardando confirmação'}
            </div>
          </div>

          <div className="stat-tile">
            <div className="stat-label">Bilhete / Comprovante</div>
            <div className="stat-value" style={{ fontSize: '1.2rem' }}>
              {profile.assignedTicketNumbers || 'Após aposta'}
            </div>
            <div className="stat-sub">
              {profile.receiptDelivered
                ? 'Entregue em mãos ✓'
                : profile.assignedTicketNumbers
                  ? 'Aguardando entrega em mãos'
                  : profile.cpf
                    ? 'CPF informado (PII)'
                    : 'CPF opcional'}
            </div>
          </div>
        </div>

        {(profile.assignedTicketNumbers || profile.receiptDelivered) && (
          <div
            className={`alert ${profile.receiptDelivered ? 'alert-success' : 'alert-info'}`}
          >
            <CheckCircle2 size={18} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <strong>
                {profile.assignedTicketNumbers
                  ? `Nº da(s) sua(s) cota(s) no bilhete da lotérica: ${profile.assignedTicketNumbers}`
                  : 'Comprovante da lotérica'}
              </strong>
              <p style={{ marginTop: 4 }}>
                {profile.receiptDelivered
                  ? 'Comprovante físico marcado como entregue em mãos pela organização.'
                  : 'Seus jogos foram registrados na lotérica! Procure a organização para retirar seu comprovante físico em mãos.'}
              </p>
            </div>
          </div>
        )}
      </section>

      {/* Card PIX — liberado inclusive para pendentes de aprovação! */}
      {paymentConfig &&
        profile.approvalStatus !== 'rejected' &&
        profile.approvalStatus !== 'cancelled' && (
          <PixCard
            profile={profile}
            paymentConfig={paymentConfig}
            quotaPrice={publicConfig.quotaPrice}
            poolName={publicConfig.poolName}
            pixPaymentOpen={publicConfig.flags.pixPaymentOpen}
            onReportPaid={handleReportPix}
          />
        )}

      {/* Edição do perfil, cotas e CPF opcional */}
      <section className="card stack-md">
        <div>
          <h2>Meus dados, cotas e CPF opcional</h2>
          <p style={{ color: 'var(--ink-secondary)', fontSize: '0.9rem' }}>
            Atualize seu nome de exibição ou inclua/remova seu CPF opcional para
            constar no bilhete.
          </p>
        </div>

        <form onSubmit={handleSaveProfile} className="stack-md">
          <div className="grid-2">
            <div className="field">
              <label htmlFor="profile-display-name">Nome de exibição</label>
              <input
                id="profile-display-name"
                type="text"
                required
                className="input"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={60}
              />
            </div>

            <CpfField
              value={cpf}
              onChange={setCpf}
              id="profile-cpf-input"
            />
          </div>

          <div className="field">
            <span id="edit-quotas-label" style={{ fontSize: '0.85rem', fontWeight: 700 }}>
              Quantidade de cotas desejadas
            </span>
            {canEditQuotas ? (
              <>
                <div
                  className="quota-pills"
                  role="radiogroup"
                  aria-labelledby="edit-quotas-label"
                  onKeyDown={(e) => handleQuotaRadioKeyDown(e, 'edit-quota-pill')}
                >
                  {quotaOptions.map((n) => (
                    <button
                      key={n}
                      type="button"
                      role="radio"
                      aria-checked={requestedQuotas === n}
                      aria-label={`${n} cota${n > 1 ? 's' : ''}, novo total ${formatCurrencyBr(n * publicConfig.quotaPrice)}`}
                      tabIndex={requestedQuotas === n ? 0 : -1}
                      className={`quota-pill${requestedQuotas === n ? ' selected' : ''}`}
                      onClick={() => setRequestedQuotas(n)}
                      id={`edit-quota-pill-${n}`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <span className="field-hint">
                  Novo total PIX:{' '}
                  <strong>
                    {formatCurrencyBr(requestedQuotas * publicConfig.quotaPrice)}
                  </strong>
                  . Salve para recalcular seu QR Code.
                </span>
              </>
            ) : (
              <div className="card-cream" style={{ fontSize: '0.9rem' }}>
                <strong>{profile.requestedQuotas} cota(s)</strong> —{' '}
                {profile.paymentStatus !== 'unpaid'
                  ? 'Travado após o aviso/confirmação de PIX. Fale com um moderador se precisar alterar.'
                  : 'Alteração de cotas pausada pelos administradores.'}
              </div>
            )}
          </div>

          {feedback && (
            <div
              className={`alert alert-${feedback.type}`}
              role={feedback.type === 'danger' ? 'alert' : 'status'}
              aria-live={feedback.type === 'danger' ? 'assertive' : 'polite'}
            >
              {feedback.text}
            </div>
          )}

          <div>
            <button
              type="submit"
              className="btn btn-primary btn-mobile-full"
              disabled={saving}
              id="btn-save-profile"
            >
              <Save size={15} aria-hidden="true" />
              {saving ? 'Salvando...' : 'Salvar alterações'}
            </button>
          </div>
        </form>
      </section>

      {publicConfig.organizerContact && (
        <section className="card-cream stack-xs" id="my-quota-contact-card">
          <div className="row" style={{ gap: 8 }}>
            <MessageCircle size={17} color="var(--luck-600)" aria-hidden="true" />
            <h2 style={{ fontSize: '1.08rem' }}>
              Precisa de ajuda ou quer ajustar após o PIX?
            </h2>
          </div>
          <p style={{ color: 'var(--ink-secondary)', fontSize: '0.9rem' }}>
            {publicConfig.organizerContact}
          </p>
        </section>
      )}
    </div>
  );
}
