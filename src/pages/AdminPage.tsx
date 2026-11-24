import {
  Check,
  CheckCircle2,
  ClipboardList,
  Clover,
  Copy,
  Download,
  Eye,
  EyeOff,
  Lock,
  Mail,
  Plus,
  RefreshCw,
  Save,
  Send,
  Settings,
  ShieldCheck,
  Sliders,
  Trash2,
  Undo2,
  Users,
  XCircle,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import {
  buildWhatsappReminderText,
  formatCurrencyBr,
  sendEmailViaAppsScript,
} from '../lib/appsScript';
import { formatCpf, maskCpf } from '../lib/cpf';
import { exportParticipantsCsv } from '../lib/csv';
import { calculateEquityAllocation, calculateRefundsOnClose } from '../lib/equity';
import {
  calculateGameOdds,
  formatOneIn,
  parseLotteryNumbers,
} from '../lib/lottery';
import { dataService } from '../services';
import type {
  AdminConfig,
  EmailActionType,
  PaymentConfig,
  PublicConfig,
  StageToggles,
  UserProfile,
} from '../types';

type AdminTab = 'participants' | 'stages' | 'games' | 'settings' | 'audit';

export function AdminPage() {
  const {
    authLoading,
    dataLoading,
    authUser,
    profile,
    publicConfig,
    paymentConfig,
    adminConfig,
    allUsers,
    games,
    drawResult,
    auditLogs,
    isDemoMode,
    refreshAll,
  } = useApp();

  const [activeTab, setActiveTab] = useState<AdminTab>('participants');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'pending_approval' | 'reported_pix' | 'unpaid' | 'confirmed' | 'refund_pending'
  >('all');
  const [revealedCpfs, setRevealedCpfs] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<{
    type: 'success' | 'danger' | 'info';
    text: string;
  } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [autoSendEmail, setAutoSendEmail] = useState(false);

  // Forms editáveis
  const [pubForm, setPubForm] = useState<PublicConfig>(publicConfig);
  const [payForm, setPayForm] = useState<PaymentConfig>(
    paymentConfig || {
      pixKey: '',
      merchantName: '',
      merchantCity: '',
      instructions: '',
    }
  );
  const [admForm, setAdmForm] = useState<AdminConfig>(
    adminConfig || {
      appsScriptUrl: '',
      appsScriptSecret: '',
      moderatorEmails: [],
      activeInviteCode: '',
    }
  );

  // Jogos & Resultado
  const [newGameLabel, setNewGameLabel] = useState('');
  const [newGameNumbers, setNewGameNumbers] = useState('');
  const [newGameNotes, setNewGameNotes] = useState('');
  const [drawInput, setDrawInput] = useState('');
  const [batchProgress, setBatchProgress] = useState<string | null>(null);

  useEffect(() => {
    setPubForm(publicConfig);
  }, [publicConfig]);

  useEffect(() => {
    if (paymentConfig) setPayForm(paymentConfig);
  }, [paymentConfig]);

  useEffect(() => {
    if (adminConfig) setAdmForm(adminConfig);
  }, [adminConfig]);

  useEffect(() => {
    setDrawInput(
      drawResult.numbers.map((n) => String(n).padStart(2, '0')).join(' ')
    );
  }, [drawResult.numbers]);

  const approvedUsers = useMemo(
    () => allUsers.filter((u) => u.approvalStatus === 'approved'),
    [allUsers]
  );

  const liveEquity = useMemo(
    () =>
      calculateEquityAllocation(
        approvedUsers.map((u) => ({
          uid: u.uid,
          displayName: u.displayName,
          requestedQuotas: u.requestedQuotas,
          createdAt: u.createdAt,
        })),
        publicConfig.totalQuotas
      ),
    [approvedUsers, publicConfig.totalQuotas]
  );

  const closePreview = useMemo(() => {
    const paidApproved = allUsers.filter(
      (u) =>
        u.approvalStatus === 'approved' &&
        u.paymentStatus === 'confirmed' &&
        u.paidQuotas > 0
    );
    return calculateRefundsOnClose(
      paidApproved.map((u) => ({
        uid: u.uid,
        displayName: u.displayName,
        paidQuotas: u.paidQuotas,
        createdAt: u.createdAt,
      })),
      publicConfig.totalQuotas,
      publicConfig.quotaPrice
    );
  }, [allUsers, publicConfig.totalQuotas, publicConfig.quotaPrice]);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allUsers.filter((u) => {
      if (statusFilter === 'pending_approval' && u.approvalStatus !== 'pending') {
        return false;
      }
      if (statusFilter === 'reported_pix' && u.paymentStatus !== 'reported') {
        return false;
      }
      if (
        statusFilter === 'unpaid' &&
        (u.paymentStatus !== 'unpaid' ||
          u.approvalStatus === 'rejected' ||
          u.approvalStatus === 'cancelled')
      ) {
        return false;
      }
      if (statusFilter === 'confirmed' && u.paymentStatus !== 'confirmed') {
        return false;
      }
      if (statusFilter === 'refund_pending' && u.refundStatus !== 'pending') {
        return false;
      }
      if (!q) return true;
      return (
        u.displayName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.txid.toLowerCase().includes(q)
      );
    });
  }, [allUsers, search, statusFilter]);

  const parsedNewGame = useMemo(
    () => parseLotteryNumbers(newGameNumbers),
    [newGameNumbers]
  );

  const newGameOddsPreview = useMemo(() => {
    if (parsedNewGame.length < 6 || parsedNewGame.length > 20) return null;
    return calculateGameOdds(parsedNewGame.length);
  }, [parsedNewGame]);

  if (!authLoading && !authUser) {
    return <Navigate to="/" replace />;
  }

  if (authLoading || dataLoading) {
    return (
      <div className="container">
        <div className="card">Carregando painel dos moderadores...</div>
      </div>
    );
  }

  if (!profile?.isModerator) {
    return (
      <div className="container">
        <div className="card stack-sm">
          <h1>Acesso restrito a moderadores</h1>
          <p style={{ color: 'var(--ink-secondary)' }}>
            Apenas organizadores cadastrados como moderadores podem acessar o
            painel administrativo do {publicConfig.poolName}.
          </p>
        </div>
      </div>
    );
  }

  const actorEmail = authUser!.email;
  const siteUrl = `${window.location.origin}${window.location.pathname}`;

  function showToast(type: 'success' | 'danger' | 'info', text: string) {
    setToast({ type, text });
  }

  async function dispatchEmail(user: UserProfile, action: EmailActionType) {
    const res = await sendEmailViaAppsScript(
      admForm.appsScriptUrl,
      admForm.appsScriptSecret,
      {
        action,
        to: user.email,
        displayName: user.displayName,
        poolName: `${publicConfig.poolName} ${publicConfig.edition}`,
        requestedQuotas: user.requestedQuotas,
        amount: user.requestedQuotas * publicConfig.quotaPrice,
        txid: user.txid,
        refundQuotas: user.refundQuotas,
        refundAmount: user.refundAmount,
        siteUrl,
      },
      isDemoMode
    );
    if (res.ok) {
      await dataService.recordAuditEvent(
        `E-mail (${action})`,
        actorEmail,
        user.displayName,
        res.message
      );
      await refreshAll();
      showToast('success', res.message);
    } else {
      showToast('danger', res.message);
    }
  }

  async function handleApprove(user: UserProfile) {
    setBusyId(user.uid);
    try {
      await dataService.approveParticipant(user.uid, actorEmail);
      await refreshAll();
      showToast('success', `${user.displayName} aprovado(a)!`);
      if (autoSendEmail) {
        await dispatchEmail(user, 'approval');
      }
    } finally {
      setBusyId(null);
    }
  }

  async function handleReject(user: UserProfile) {
    setBusyId(user.uid);
    try {
      await dataService.rejectParticipant(user.uid, actorEmail);
      await refreshAll();
      showToast(
        'info',
        user.paidQuotas > 0
          ? `${user.displayName} recusado(a) — estorno pendente criado automaticamente.`
          : `${user.displayName} recusado(a).`
      );
      if (autoSendEmail) {
        await dispatchEmail(user, 'rejection');
      }
    } finally {
      setBusyId(null);
    }
  }

  async function handleCancel(user: UserProfile) {
    setBusyId(user.uid);
    try {
      await dataService.cancelParticipant(user.uid, actorEmail);
      await refreshAll();
      showToast(
        'info',
        user.paidQuotas > 0
          ? `${user.displayName} cancelado(a) — estorno pendente registrado.`
          : `Participação de ${user.displayName} cancelada.`
      );
    } finally {
      setBusyId(null);
    }
  }

  async function handleConfirmPix(user: UserProfile) {
    setBusyId(user.uid);
    try {
      await dataService.confirmPixPayment(
        user.uid,
        user.requestedQuotas,
        actorEmail
      );
      await refreshAll();
      showToast(
        'success',
        `PIX confirmado para ${user.displayName} (${user.requestedQuotas} cota(s)).`
      );
      if (autoSendEmail) {
        await dispatchEmail(user, 'payment_confirmed');
      }
    } finally {
      setBusyId(null);
    }
  }

  async function handleMarkRefunded(user: UserProfile) {
    setBusyId(user.uid);
    try {
      await dataService.markRefundCompleted(user.uid, actorEmail);
      await refreshAll();
      showToast('success', `Estorno de ${user.displayName} marcado como concluído.`);
      if (autoSendEmail) {
        await dispatchEmail(user, 'refund_notice');
      }
    } finally {
      setBusyId(null);
    }
  }

  async function handleBatchReminderEmails() {
    const targets = allUsers.filter(
      (u) =>
        (u.approvalStatus === 'approved' || u.approvalStatus === 'pending') &&
        u.paymentStatus === 'unpaid'
    );
    if (targets.length === 0) {
      showToast('info', 'Nenhum participante com PIX pendente no momento.');
      return;
    }

    let okCount = 0;
    let failCount = 0;
    for (let i = 0; i < targets.length; i++) {
      const target = targets[i];
      setBatchProgress(`Enviando ${i + 1}/${targets.length} (${target.displayName})...`);
      const res = await sendEmailViaAppsScript(
        admForm.appsScriptUrl,
        admForm.appsScriptSecret,
        {
          action: 'payment_reminder',
          to: target.email,
          displayName: target.displayName,
          poolName: `${publicConfig.poolName} ${publicConfig.edition}`,
          requestedQuotas: target.requestedQuotas,
          amount: target.requestedQuotas * publicConfig.quotaPrice,
          txid: target.txid,
          siteUrl,
        },
        isDemoMode
      );
      if (res.ok) okCount++;
      else failCount++;
    }
    setBatchProgress(null);
    await dataService.recordAuditEvent(
      'Cobrança em lote',
      actorEmail,
      `${targets.length} participante(s)`,
      `Sucesso: ${okCount} | Falhas: ${failCount}.`
    );
    await refreshAll();
    showToast(
      failCount === 0 ? 'success' : 'danger',
      `Envio em lote concluído: ${okCount} enviado(s), ${failCount} falha(s).`
    );
  }

  async function handleCopyWhatsappList() {
    const targets = allUsers.filter(
      (u) =>
        (u.approvalStatus === 'approved' || u.approvalStatus === 'pending') &&
        u.paymentStatus === 'unpaid'
    );
    const text = buildWhatsappReminderText(publicConfig, targets);
    await navigator.clipboard.writeText(text);
    showToast(
      'success',
      `Mensagem de cobrança (${targets.length} pendente(s)) copiada para WhatsApp/Slack!`
    );
  }

  async function handleToggleStage(key: keyof StageToggles, value: boolean) {
    const next: PublicConfig = {
      ...pubForm,
      flags: { ...pubForm.flags, [key]: value },
    };
    setPubForm(next);
    await dataService.updatePublicConfig(next, actorEmail);
    await refreshAll();
    showToast('success', 'Etapa atualizada com sucesso!');
  }

  async function handleSaveBanner(e: React.FormEvent) {
    e.preventDefault();
    await dataService.updatePublicConfig(pubForm, actorEmail);
    await refreshAll();
    showToast('success', 'Banner e configurações de etapa salvos!');
  }

  async function handleClosePool() {
    setBusyId('close_pool');
    try {
      const res = await dataService.closePoolAndComputeRefunds(actorEmail);
      await refreshAll();
      showToast(
        'success',
        `Bolão fechado! ${res.totalAllocated} cotas finais alocadas e ${res.refundCount} estorno(s) calculado(s) (${formatCurrencyBr(res.totalRefundAmount)}).`
      );
    } finally {
      setBusyId(null);
    }
  }

  async function handleReopenPool() {
    setBusyId('reopen_pool');
    try {
      await dataService.reopenPool(actorEmail);
      await refreshAll();
      showToast('info', 'Bolão reaberto — rateio final descongelado.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleAddGame(e: React.FormEvent) {
    e.preventDefault();
    if (parsedNewGame.length < 6 || parsedNewGame.length > 20) {
      showToast('danger', 'Informe entre 6 e 20 dezenas válidas (de 01 a 60).');
      return;
    }
    const label =
      newGameLabel.trim() || `Volante #${String(games.length + 1).padStart(2, '0')}`;
    await dataService.addGame(
      { label, numbers: parsedNewGame, notes: newGameNotes },
      actorEmail
    );
    setNewGameLabel('');
    setNewGameNumbers('');
    setNewGameNotes('');
    await refreshAll();
    showToast('success', `Volante "${label}" adicionado!`);
  }

  async function handleSaveDraw(e: React.FormEvent) {
    e.preventDefault();
    const nums = parseLotteryNumbers(drawInput);
    if (nums.length !== 0 && nums.length !== 6) {
      showToast(
        'danger',
        'Informe exatamente 6 dezenas sorteadas (ou deixe vazio para limpar).'
      );
      return;
    }
    await dataService.saveDrawResult(nums, actorEmail);
    await refreshAll();
    showToast('success', 'Resultado oficial salvo!');
  }

  async function handleSaveAllSettings(e: React.FormEvent) {
    e.preventDefault();
    setBusyId('save_settings');
    try {
      await Promise.all([
        dataService.updatePublicConfig(pubForm, actorEmail),
        dataService.updatePaymentConfig(payForm, actorEmail),
        dataService.updateAdminConfig(admForm, actorEmail),
      ]);
      await refreshAll();
      showToast('success', 'Todas as configurações foram salvas!');
    } finally {
      setBusyId(null);
    }
  }

  async function handleTestAppsScript() {
    setBusyId('test_email');
    try {
      const res = await sendEmailViaAppsScript(
        admForm.appsScriptUrl,
        admForm.appsScriptSecret,
        {
          action: 'test',
          to: actorEmail,
          displayName: profile?.displayName || 'Moderador',
          poolName: `${publicConfig.poolName} ${publicConfig.edition}`,
          siteUrl,
        },
        isDemoMode
      );
      showToast(res.ok ? 'success' : 'danger', res.message);
    } finally {
      setBusyId(null);
    }
  }

  async function handlePurgeCpfs() {
    const count = await dataService.purgeAllCpfs(actorEmail);
    await refreshAll();
    showToast('info', `Limpeza LGPD concluída: ${count} CPF(s) removidos.`);
  }

  const pendingApprovals = allUsers.filter((u) => u.approvalStatus === 'pending').length;
  const reportedPixCount = allUsers.filter((u) => u.paymentStatus === 'reported').length;
  const refundPendingCount = allUsers.filter((u) => u.refundStatus === 'pending').length;
  const cpfStoredCount = allUsers.filter((u) => Boolean(u.cpf)).length;

  return (
    <div className="container stack-lg">
      <section className="card stack-md">
        <div className="row-between">
          <div>
            <span className="badge badge-unicorn">
              <ShieldCheck size={13} />
              Painel dos Moderadores
            </span>
            <h1 style={{ marginTop: 6 }}>Administração — {publicConfig.poolName}</h1>
          </div>
          {isDemoMode && dataService.demoResetData && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={async () => {
                await dataService.demoResetData?.();
                await refreshAll();
                showToast('info', 'Dados de demonstração restaurados.');
              }}
            >
              <RefreshCw size={14} />
              Resetar Demo
            </button>
          )}
        </div>

        <div className="grid-4">
          <div className="stat-tile">
            <div className="stat-label">Pendentes aprovação</div>
            <div className="stat-value">{pendingApprovals}</div>
          </div>
          <div className="stat-tile">
            <div className="stat-label">Avisaram PIX</div>
            <div className="stat-value">{reportedPixCount}</div>
          </div>
          <div className="stat-tile">
            <div className="stat-label">Estornos pendentes</div>
            <div className="stat-value">{refundPendingCount}</div>
          </div>
          <div className="stat-tile">
            <div className="stat-label">CPFs armazenados (PII)</div>
            <div className="stat-value">{cpfStoredCount}</div>
          </div>
        </div>

        <div className="tabs" role="tablist">
          <button
            type="button"
            className={`tab-btn${activeTab === 'participants' ? ' active' : ''}`}
            onClick={() => setActiveTab('participants')}
            id="admin-tab-participants"
          >
            <Users size={15} />
            Participantes &amp; PIX ({allUsers.length})
          </button>
          <button
            type="button"
            className={`tab-btn${activeTab === 'stages' ? ' active' : ''}`}
            onClick={() => setActiveTab('stages')}
            id="admin-tab-stages"
          >
            <Sliders size={15} />
            Etapas &amp; Fechamento
          </button>
          <button
            type="button"
            className={`tab-btn${activeTab === 'games' ? ' active' : ''}`}
            onClick={() => setActiveTab('games')}
            id="admin-tab-games"
          >
            <Clover size={15} />
            Jogos &amp; Sorteio ({games.length})
          </button>
          <button
            type="button"
            className={`tab-btn${activeTab === 'settings' ? ' active' : ''}`}
            onClick={() => setActiveTab('settings')}
            id="admin-tab-settings"
          >
            <Settings size={15} />
            Configurações &amp; E-mail
          </button>
          <button
            type="button"
            className={`tab-btn${activeTab === 'audit' ? ' active' : ''}`}
            onClick={() => setActiveTab('audit')}
            id="admin-tab-audit"
          >
            <ClipboardList size={15} />
            Auditoria ({auditLogs.length})
          </button>
        </div>

        {toast && <div className={`alert alert-${toast.type}`}>{toast.text}</div>}
      </section>

      {/* ABA 1: PARTICIPANTES & PIX */}
      {activeTab === 'participants' && (
        <section className="card stack-md">
          <div className="row-between">
            <div className="row" style={{ flex: 1, minWidth: 260 }}>
              <input
                type="search"
                className="input"
                style={{ maxWidth: 320 }}
                placeholder="Buscar por nome, e-mail ou TXID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                id="admin-search-input"
              />
              <select
                className="select"
                style={{ maxWidth: 220 }}
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as typeof statusFilter)
                }
                id="admin-filter-select"
              >
                <option value="all">Todos ({allUsers.length})</option>
                <option value="pending_approval">
                  Pendentes aprovação ({pendingApprovals})
                </option>
                <option value="reported_pix">
                  Avisaram PIX ({reportedPixCount})
                </option>
                <option value="unpaid">PIX pendente</option>
                <option value="confirmed">PIX confirmado</option>
                <option value="refund_pending">
                  Estorno pendente ({refundPendingCount})
                </option>
              </select>
            </div>

            <div className="row" style={{ gap: 8 }}>
              <label
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: '0.84rem',
                  fontWeight: 600,
                }}
              >
                <input
                  type="checkbox"
                  checked={autoSendEmail}
                  onChange={(e) => setAutoSendEmail(e.target.checked)}
                />
                Disparar e-mail automático ao aprovar/confirmar
              </label>
            </div>
          </div>

          <div className="row" style={{ gap: 8 }}>
            <button
              type="button"
              className="btn btn-unicorn btn-sm"
              onClick={handleBatchReminderEmails}
              disabled={Boolean(batchProgress)}
              id="btn-batch-reminder-emails"
            >
              <Mail size={14} />
              {batchProgress || 'Enviar cobrança por e-mail (pendentes)'}
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleCopyWhatsappList}
              id="btn-copy-whatsapp-reminder"
            >
              <Copy size={14} />
              Copiar lembrete p/ WhatsApp
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() =>
                exportParticipantsCsv(
                  allUsers,
                  liveEquity,
                  publicConfig.quotaPrice,
                  false
                )
              }
              id="btn-export-csv-masked"
            >
              <Download size={14} />
              CSV (CPF mascarado)
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() =>
                exportParticipantsCsv(
                  allUsers,
                  liveEquity,
                  publicConfig.quotaPrice,
                  true
                )
              }
              id="btn-export-csv-full-cpf"
            >
              <Download size={14} />
              CSV p/ bilhete (CPF completo)
            </button>
            {cpfStoredCount > 0 && (
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={handlePurgeCpfs}
                id="btn-purge-cpfs"
              >
                <Trash2 size={14} />
                Limpar CPFs (LGPD)
              </button>
            )}
          </div>

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Participante / E-mail</th>
                  <th>CPF (PII)</th>
                  <th>Aprovação</th>
                  <th>Cotas &amp; TXID</th>
                  <th>PIX / Estorno</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => {
                  const alloc = liveEquity.allocations.get(u.uid);
                  const cpfVisible = Boolean(revealedCpfs[u.uid]);
                  return (
                    <tr key={u.uid}>
                      <td>
                        <div>
                          <strong>{u.displayName}</strong>{' '}
                          {u.isModerator && (
                            <span className="badge badge-unicorn">Mod</span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--ink-muted)' }}>
                          {u.email}
                        </div>
                      </td>
                      <td>
                        {u.cpf ? (
                          <div className="row" style={{ gap: 4 }}>
                            <span className="mono" style={{ fontSize: '0.8rem' }}>
                              {cpfVisible ? formatCpf(u.cpf) : maskCpf(u.cpf)}
                            </span>
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              style={{ padding: 4 }}
                              onClick={() =>
                                setRevealedCpfs((prev) => ({
                                  ...prev,
                                  [u.uid]: !prev[u.uid],
                                }))
                              }
                              title={cpfVisible ? 'Ocultar CPF' : 'Revelar CPF'}
                            >
                              {cpfVisible ? <EyeOff size={13} /> : <Eye size={13} />}
                            </button>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--ink-muted)', fontSize: '0.8rem' }}>
                            —
                          </span>
                        )}
                      </td>
                      <td>
                        {u.approvalStatus === 'approved' && (
                          <span className="badge badge-success">Aprovado</span>
                        )}
                        {u.approvalStatus === 'pending' && (
                          <span className="badge badge-warning">Pendente</span>
                        )}
                        {u.approvalStatus === 'rejected' && (
                          <span className="badge badge-danger">Recusado</span>
                        )}
                        {u.approvalStatus === 'cancelled' && (
                          <span className="badge badge-danger">Cancelado</span>
                        )}
                      </td>
                      <td>
                        <div style={{ fontSize: '0.84rem' }}>
                          Pedidas: <strong>{u.requestedQuotas}</strong> (
                          {formatCurrencyBr(
                            u.requestedQuotas * publicConfig.quotaPrice
                          )}
                          )
                        </div>
                        {u.approvalStatus === 'approved' && alloc && (
                          <div style={{ fontSize: '0.78rem', color: 'var(--ink-secondary)' }}>
                            Equidade: <strong>{alloc.allocatedQuotas}</strong>
                            {alloc.isWaitlisted &&
                              ` (Fila #${alloc.waitlistPosition})`}
                          </div>
                        )}
                        <div className="mono" style={{ fontSize: '0.75rem', color: 'var(--ink-muted)' }}>
                          {u.txid}
                        </div>
                      </td>
                      <td>
                        <div>
                          {u.paymentStatus === 'confirmed' && (
                            <span className="badge badge-success">
                              Pago ({u.paidQuotas}c)
                            </span>
                          )}
                          {u.paymentStatus === 'reported' && (
                            <span className="badge badge-warning">
                              Avisou PIX
                            </span>
                          )}
                          {u.paymentStatus === 'unpaid' && (
                            <span className="badge badge-neutral">Pendente</span>
                          )}
                        </div>
                        {u.paymentNote && (
                          <div style={{ fontSize: '0.76rem', color: 'var(--ink-secondary)', marginTop: 3 }}>
                            “{u.paymentNote}”
                          </div>
                        )}
                        {u.refundStatus === 'pending' && (
                          <div style={{ marginTop: 4 }}>
                            <span className="badge badge-danger">
                              Estornar {formatCurrencyBr(u.refundAmount)} (
                              {u.refundQuotas}c)
                            </span>
                          </div>
                        )}
                        {u.refundStatus === 'completed' && (
                          <div style={{ marginTop: 4 }}>
                            <span className="badge badge-success">
                              Estornado ({formatCurrencyBr(u.refundAmount)})
                            </span>
                          </div>
                        )}
                      </td>
                      <td>
                        <div className="row" style={{ gap: 5 }}>
                          {u.approvalStatus === 'pending' && (
                            <>
                              <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                disabled={busyId === u.uid}
                                onClick={() => handleApprove(u)}
                              >
                                <Check size={13} />
                                Aprovar
                              </button>
                              <button
                                type="button"
                                className="btn btn-danger btn-sm"
                                disabled={busyId === u.uid}
                                onClick={() => handleReject(u)}
                              >
                                <XCircle size={13} />
                                Recusar
                              </button>
                            </>
                          )}

                          {u.paymentStatus !== 'confirmed' &&
                            u.approvalStatus !== 'rejected' &&
                            u.approvalStatus !== 'cancelled' && (
                              <button
                                type="button"
                                className="btn btn-gold btn-sm"
                                disabled={busyId === u.uid}
                                onClick={() => handleConfirmPix(u)}
                              >
                                <CheckCircle2 size={13} />
                                Confirmar PIX
                              </button>
                            )}

                          {u.refundStatus === 'pending' && (
                            <button
                              type="button"
                              className="btn btn-unicorn btn-sm"
                              disabled={busyId === u.uid}
                              onClick={() => handleMarkRefunded(u)}
                            >
                              <Undo2 size={13} />
                              Marcar Estornado
                            </button>
                          )}

                          {u.approvalStatus === 'approved' &&
                            u.uid !== profile.uid && (
                              <button
                                type="button"
                                className="btn btn-danger btn-sm"
                                disabled={busyId === u.uid}
                                onClick={() => handleCancel(u)}
                                title="Cancelar participação"
                              >
                                Cancelar
                              </button>
                            )}

                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() =>
                              dispatchEmail(
                                u,
                                u.refundStatus === 'pending'
                                  ? 'refund_notice'
                                  : u.paymentStatus === 'confirmed'
                                    ? 'payment_confirmed'
                                    : 'payment_reminder'
                              )
                            }
                            title="Enviar e-mail via Apps Script"
                          >
                            <Send size={13} />
                          </button>

                          {u.approvalStatus === 'approved' &&
                            u.uid !== profile.uid && (
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                onClick={async () => {
                                  await dataService.toggleModeratorRole(
                                    u.uid,
                                    !u.isModerator,
                                    actorEmail
                                  );
                                  await refreshAll();
                                  showToast(
                                    'info',
                                    `${u.displayName} ${!u.isModerator ? 'agora é moderador(a)' : 'não é mais moderador(a)'}.`
                                  );
                                }}
                                title="Alternar permissão de moderador"
                              >
                                <ShieldCheck size={13} />
                              </button>
                            )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ABA 2: ETAPAS & FECHAMENTO */}
      {activeTab === 'stages' && (
        <div className="grid-2">
          <section className="card stack-md">
            <div>
              <h2>Habilitar / Desabilitar Etapas e Submissões</h2>
              <p style={{ color: 'var(--ink-secondary)', fontSize: '0.9rem' }}>
                Cada chave controla imediatamente a interface e as permissões no
                Firestore.
              </p>
            </div>

            <div className="stack-sm">
              {(
                [
                  [
                    'registrationsOpen',
                    'Novas inscrições (submissões)',
                    'Permite que colegas com código de convite enviem novos cadastros.',
                  ],
                  [
                    'quotaEditsOpen',
                    'Edição de cotas pelos participantes',
                    'Permite alterar a quantidade de cotas antes do aviso/confirmação de PIX.',
                  ],
                  [
                    'pixPaymentOpen',
                    'Pagamento PIX e botão "Já fiz o PIX"',
                    'Exibe o QR Code / Copia e Cola e libera o aviso de pagamento.',
                  ],
                  [
                    'boardVisible',
                    'Visibilidade do Placar de Transparência',
                    'Mostra ou oculta a aba Placar para os participantes.',
                  ],
                  [
                    'gamesVisible',
                    'Visibilidade de Jogos & Probabilidades',
                    'Mostra ou oculta os volantes, probabilidades e conferidor.',
                  ],
                ] as Array<[keyof StageToggles, string, string]>
              ).map(([key, title, desc]) => (
                <div key={key} className="toggle-row">
                  <div>
                    <strong>{title}</strong>
                    <div style={{ fontSize: '0.82rem', color: 'var(--ink-muted)' }}>
                      {desc}
                    </div>
                  </div>
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={pubForm.flags[key]}
                      onChange={(e) => handleToggleStage(key, e.target.checked)}
                      id={`toggle-stage-${key}`}
                    />
                    <span className="switch-slider" />
                  </label>
                </div>
              ))}
            </div>

            <form onSubmit={handleSaveBanner} className="stack-sm">
              <div className="field">
                <label htmlFor="admin-banner-msg">
                  Mensagem do banner no topo do site
                </label>
                <input
                  id="admin-banner-msg"
                  type="text"
                  className="input"
                  value={pubForm.bannerMessage}
                  onChange={(e) =>
                    setPubForm({ ...pubForm, bannerMessage: e.target.value })
                  }
                />
              </div>
              <button type="submit" className="btn btn-secondary btn-sm">
                <Save size={14} />
                Atualizar mensagem do banner
              </button>
            </form>
          </section>

          <section className="card stack-md">
            <div>
              <h2>Fechamento do Bolão &amp; Cálculo de Estornos</h2>
              <p style={{ color: 'var(--ink-secondary)', fontSize: '0.9rem' }}>
                Ao fechar o bolão, o algoritmo de equidade congela as cotas finais
                entre os <strong>aprovados com PIX confirmado</strong> e gera
                automaticamente a lista de estornos.
              </p>
            </div>

            <div className="grid-2" style={{ gap: 10 }}>
              <div className="card-mint">
                <div className="stat-label">Cotas finais previstas</div>
                <div className="stat-value">
                  {closePreview.equity.totalAllocated}/{publicConfig.totalQuotas}
                </div>
              </div>
              <div className="card-gold">
                <div className="stat-label">Estornos previstos</div>
                <div className="stat-value">
                  {formatCurrencyBr(closePreview.totalRefundAmount)}
                </div>
                <div className="stat-sub">
                  {closePreview.refunds.length} participante(s)
                </div>
              </div>
            </div>

            {closePreview.refunds.length > 0 && (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Participante</th>
                      <th>Pagou</th>
                      <th>Final</th>
                      <th>Estorno</th>
                    </tr>
                  </thead>
                  <tbody>
                    {closePreview.refunds.map((r) => (
                      <tr key={r.uid}>
                        <td>{r.displayName}</td>
                        <td className="mono">{r.paidQuotas}</td>
                        <td className="mono">{r.finalQuotas}</td>
                        <td className="mono" style={{ fontWeight: 700 }}>
                          {formatCurrencyBr(r.refundAmount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="row">
              {!publicConfig.flags.poolClosed ? (
                <button
                  type="button"
                  className="btn btn-unicorn"
                  disabled={busyId === 'close_pool'}
                  onClick={handleClosePool}
                  id="btn-close-pool"
                >
                  <Lock size={15} />
                  {busyId === 'close_pool'
                    ? 'Fechando bolão...'
                    : 'Fechar Bolão e Gerar Estornos'}
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={busyId === 'reopen_pool'}
                  onClick={handleReopenPool}
                  id="btn-reopen-pool"
                >
                  <RefreshCw size={15} />
                  Reabrir Bolão (descongelar rateio)
                </button>
              )}
            </div>
          </section>
        </div>
      )}

      {/* ABA 3: JOGOS & SORTEIO */}
      {activeTab === 'games' && (
        <div className="grid-2">
          <section className="card stack-md">
            <h2>Cadastrar Novo Volante (6 a 20 dezenas)</h2>
            <form onSubmit={handleAddGame} className="stack-sm">
              <div className="field">
                <label htmlFor="admin-game-label">Nome / Etiqueta do volante</label>
                <input
                  id="admin-game-label"
                  type="text"
                  className="input"
                  placeholder="Ex.: Volante #04 — Unicórnio Dourado"
                  value={newGameLabel}
                  onChange={(e) => setNewGameLabel(e.target.value)}
                />
              </div>

              <div className="field">
                <label htmlFor="admin-game-numbers">
                  Dezenas (01 a 60, separadas por espaço ou vírgula)
                </label>
                <input
                  id="admin-game-numbers"
                  type="text"
                  required
                  className="input mono"
                  placeholder="04 12 19 27 38 45 59"
                  value={newGameNumbers}
                  onChange={(e) => setNewGameNumbers(e.target.value)}
                />
                <span className="field-hint">
                  Reconhecidas: <strong>{parsedNewGame.length}</strong> dezena(s)
                  válida(s)
                </span>
              </div>

              {newGameOddsPreview && (
                <div className="card-mint" style={{ fontSize: '0.84rem' }}>
                  <strong>
                    Prévia das probabilidades ({newGameOddsPreview.numberCount}{' '}
                    dezenas ={' '}
                    {newGameOddsPreview.equivalentSimpleBets.toLocaleString(
                      'pt-BR'
                    )}{' '}
                    combinações):
                  </strong>
                  <div style={{ marginTop: 4 }}>
                    Sena: <strong>{formatOneIn(newGameOddsPreview.senaOneIn)}</strong> •
                    Quina: <strong>{formatOneIn(newGameOddsPreview.quinaOneIn)}</strong> •
                    Quadra: <strong>{formatOneIn(newGameOddsPreview.quadraOneIn)}</strong>
                  </div>
                </div>
              )}

              <div className="field">
                <label htmlFor="admin-game-notes">Observação opcional</label>
                <input
                  id="admin-game-notes"
                  type="text"
                  className="input"
                  placeholder="Ex.: Registrado na Lotérica Central"
                  value={newGameNotes}
                  onChange={(e) => setNewGameNotes(e.target.value)}
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                id="btn-add-game"
              >
                <Plus size={15} />
                Adicionar Volante
              </button>
            </form>
          </section>

          <section className="stack-md">
            <div className="card stack-sm">
              <h2>Publicar Dezenas Sorteadas (Oficial)</h2>
              <form onSubmit={handleSaveDraw} className="stack-sm">
                <div className="field">
                  <label htmlFor="admin-draw-input">
                    6 dezenas oficiais do sorteio
                  </label>
                  <input
                    id="admin-draw-input"
                    type="text"
                    className="input mono"
                    placeholder="Ex.: 04 10 17 23 34 59"
                    value={drawInput}
                    onChange={(e) => setDrawInput(e.target.value)}
                  />
                </div>
                <button
                  type="submit"
                  className="btn btn-gold"
                  id="btn-save-draw"
                >
                  <Save size={15} />
                  Salvar Resultado Oficial
                </button>
              </form>
            </div>

            <div className="card stack-sm">
              <h3>Volantes cadastrados ({games.length})</h3>
              {games.length === 0 ? (
                <p style={{ color: 'var(--ink-muted)' }}>Nenhum jogo ainda.</p>
              ) : (
                games.map((g) => (
                  <div key={g.id} className="card-cream row-between">
                    <div>
                      <strong>{g.label}</strong>
                      <div className="mono" style={{ fontSize: '0.82rem', marginTop: 2 }}>
                        {g.numbers.map((n) => String(n).padStart(2, '0')).join(' - ')}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={async () => {
                        await dataService.deleteGame(g.id, actorEmail);
                        await refreshAll();
                        showToast('info', 'Volante removido.');
                      }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      )}

      {/* ABA 4: CONFIGURAÇÕES & APPS SCRIPT */}
      {activeTab === 'settings' && (
        <form onSubmit={handleSaveAllSettings} className="stack-md">
          <div className="grid-2">
            <section className="card stack-sm">
              <h2>Parâmetros do Bolão</h2>
              <div className="grid-2" style={{ gap: 12 }}>
                <div className="field">
                  <label>Nome do bolão</label>
                  <input
                    type="text"
                    className="input"
                    value={pubForm.poolName}
                    onChange={(e) =>
                      setPubForm({ ...pubForm, poolName: e.target.value })
                    }
                  />
                </div>
                <div className="field">
                  <label>Edição / Ano</label>
                  <input
                    type="text"
                    className="input"
                    value={pubForm.edition}
                    onChange={(e) =>
                      setPubForm({ ...pubForm, edition: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="grid-3" style={{ gap: 10 }}>
                <div className="field">
                  <label>Valor cota (R$)</label>
                  <input
                    type="number"
                    min={1}
                    step="0.01"
                    className="input mono"
                    value={pubForm.quotaPrice}
                    onChange={(e) =>
                      setPubForm({
                        ...pubForm,
                        quotaPrice: Number(e.target.value),
                      })
                    }
                  />
                </div>
                <div className="field">
                  <label>Total cotas</label>
                  <input
                    type="number"
                    min={1}
                    className="input mono"
                    value={pubForm.totalQuotas}
                    onChange={(e) =>
                      setPubForm({
                        ...pubForm,
                        totalQuotas: Number(e.target.value),
                      })
                    }
                  />
                </div>
                <div className="field">
                  <label>Máx./pessoa</label>
                  <input
                    type="number"
                    min={1}
                    className="input mono"
                    value={pubForm.maxQuotasPerPerson}
                    onChange={(e) =>
                      setPubForm({
                        ...pubForm,
                        maxQuotasPerPerson: Number(e.target.value),
                      })
                    }
                  />
                </div>
              </div>

              <div className="grid-3" style={{ gap: 10 }}>
                <div className="field">
                  <label>Prazo inscrição</label>
                  <input
                    type="date"
                    className="input"
                    value={pubForm.registrationDeadline}
                    onChange={(e) =>
                      setPubForm({
                        ...pubForm,
                        registrationDeadline: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="field">
                  <label>Prazo PIX</label>
                  <input
                    type="date"
                    className="input"
                    value={pubForm.paymentDeadline}
                    onChange={(e) =>
                      setPubForm({
                        ...pubForm,
                        paymentDeadline: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="field">
                  <label>Data sorteio</label>
                  <input
                    type="date"
                    className="input"
                    value={pubForm.drawDate}
                    onChange={(e) =>
                      setPubForm({ ...pubForm, drawDate: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="field">
                <label>Nota extra na Página de Regras</label>
                <textarea
                  className="textarea"
                  value={pubForm.rulesExtraNotes}
                  onChange={(e) =>
                    setPubForm({ ...pubForm, rulesExtraNotes: e.target.value })
                  }
                />
              </div>
            </section>

            <section className="stack-md">
              <div className="card stack-sm">
                <h2>Conta PIX &amp; Código de Convite</h2>
                <div className="field">
                  <label>Código de convite ativo do time</label>
                  <input
                    type="text"
                    className="input mono"
                    value={admForm.activeInviteCode}
                    onChange={(e) =>
                      setAdmForm({
                        ...admForm,
                        activeInviteCode: e.target.value.toUpperCase(),
                      })
                    }
                  />
                </div>
                <div className="field">
                  <label>Chave PIX do organizador</label>
                  <input
                    type="text"
                    className="input mono"
                    value={payForm.pixKey}
                    onChange={(e) =>
                      setPayForm({ ...payForm, pixKey: e.target.value })
                    }
                  />
                </div>
                <div className="grid-2" style={{ gap: 10 }}>
                  <div className="field">
                    <label>Nome do recebedor (até 25 chars)</label>
                    <input
                      type="text"
                      className="input"
                      maxLength={25}
                      value={payForm.merchantName}
                      onChange={(e) =>
                        setPayForm({ ...payForm, merchantName: e.target.value })
                      }
                    />
                  </div>
                  <div className="field">
                    <label>Cidade (até 15 chars)</label>
                    <input
                      type="text"
                      className="input"
                      maxLength={15}
                      value={payForm.merchantCity}
                      onChange={(e) =>
                        setPayForm({ ...payForm, merchantCity: e.target.value })
                      }
                    />
                  </div>
                </div>
                <div className="field">
                  <label>Instruções exibidas acima do QR Code</label>
                  <textarea
                    className="textarea"
                    value={payForm.instructions}
                    onChange={(e) =>
                      setPayForm({ ...payForm, instructions: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="card stack-sm" id="apps-script-config-card">
                <h2>Integração Google Apps Script (Seu Gmail)</h2>
                <p style={{ fontSize: '0.84rem', color: 'var(--ink-secondary)' }}>
                  Cole a URL publicada do Web App (<code>apps-script/Code.gs</code>)
                  e o segredo <code>MEGACORN_SECRET</code> para disparar e-mails
                  direto pela UI do painel.
                </p>
                <div className="field">
                  <label htmlFor="admin-gas-url">URL do Web App (/exec)</label>
                  <input
                    id="admin-gas-url"
                    type="url"
                    className="input mono"
                    placeholder="https://script.google.com/macros/s/.../exec"
                    value={admForm.appsScriptUrl}
                    onChange={(e) =>
                      setAdmForm({ ...admForm, appsScriptUrl: e.target.value })
                    }
                  />
                </div>
                <div className="field">
                  <label htmlFor="admin-gas-secret">Segredo (MEGACORN_SECRET)</label>
                  <input
                    id="admin-gas-secret"
                    type="password"
                    className="input mono"
                    placeholder="Seu token secreto salvo nas Script Properties"
                    value={admForm.appsScriptSecret}
                    onChange={(e) =>
                      setAdmForm({
                        ...admForm,
                        appsScriptSecret: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="row">
                  <button
                    type="button"
                    className="btn btn-unicorn btn-sm"
                    disabled={busyId === 'test_email'}
                    onClick={handleTestAppsScript}
                    id="btn-test-apps-script"
                  >
                    <Mail size={14} />
                    {busyId === 'test_email'
                      ? 'Testando envio...'
                      : `Testar e-mail para ${actorEmail}`}
                  </button>
                </div>
              </div>
            </section>
          </div>

          <div>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={busyId === 'save_settings'}
              id="btn-save-all-settings"
            >
              <Save size={16} />
              {busyId === 'save_settings'
                ? 'Salvando...'
                : 'Salvar todas as configurações'}
            </button>
          </div>
        </form>
      )}

      {/* ABA 5: AUDITORIA */}
      {activeTab === 'audit' && (
        <section className="card stack-md">
          <h2>Histórico de Auditoria dos Moderadores</h2>
          {auditLogs.length === 0 ? (
            <p style={{ color: 'var(--ink-muted)' }}>Nenhum evento registrado.</p>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Data/Hora</th>
                    <th>Ação</th>
                    <th>Moderador</th>
                    <th>Alvo</th>
                    <th>Detalhes</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map((log) => (
                    <tr key={log.id}>
                      <td className="mono" style={{ fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                        {new Date(log.createdAt).toLocaleString('pt-BR')}
                      </td>
                      <td>
                        <strong>{log.action}</strong>
                      </td>
                      <td style={{ fontSize: '0.82rem' }}>{log.actorEmail}</td>
                      <td>{log.targetName}</td>
                      <td style={{ fontSize: '0.84rem', color: 'var(--ink-secondary)' }}>
                        {log.details}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
