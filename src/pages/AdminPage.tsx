import {
  AlertTriangle,
  BarChart3,
  Calendar,
  Check,
  CheckCircle2,
  ClipboardList,
  Clover,
  Coins,
  Copy,
  Download,
  Eye,
  EyeOff,
  Link2,
  Lock,
  Mail,
  Minus,
  Plus,
  RefreshCw,
  Save,
  Send,
  Settings,
  ShieldCheck,
  Sliders,
  Ticket,
  Trash2,
  Undo2,
  Users,
  XCircle,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useApp } from '../context/useApp';
import { calculateAdminOverviewMetrics } from '../lib/adminMetrics';
import {
  buildWhatsappReminderText,
  formatCurrencyBr,
  formatDateBr,
  sendEmailViaAppsScript,
} from '../lib/appsScript';
import { formatCpf, maskCpf } from '../lib/cpf';
import { exportAuditLogsCsv, exportParticipantsCsv } from '../lib/csv';
import { calculateEquityAllocation, calculateRefundsOnClose } from '../lib/equity';
import {
  calculateGameOdds,
  calculatePoolCombinedOdds,
  formatOneIn,
  parseLotteryNumbers,
} from '../lib/lottery';
import {
  canManageTickets,
  getPhaseIndex,
  getPhaseMeta,
  POOL_PHASES,
} from '../lib/phases';
import { buildInviteShareUrl } from '../lib/session';
import { dataService } from '../services';
import type {
  AdminConfig,
  EmailActionType,
  LotteryGame,
  PaymentConfig,
  PoolPhase,
  PublicConfig,
  StageToggles,
  UserProfile,
} from '../types';

type AdminTab =
  | 'overview'
  | 'participants'
  | 'stages'
  | 'games'
  | 'settings'
  | 'audit';

interface PendingConfirm {
  title: string;
  description: string;
  details?: string[];
  confirmLabel: string;
  variant?: 'danger' | 'warning';
  requireTypedText?: string;
  onConfirm: () => Promise<void>;
}

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

  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<
    | 'all'
    | 'pending_approval'
    | 'reported_pix'
    | 'unpaid'
    | 'confirmed'
    | 'refund_pending'
    | 'receipt_pending'
  >('all');
  const [revealedCpfs, setRevealedCpfs] = useState<Record<string, boolean>>({});
  const [ticketDrafts, setTicketDrafts] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<{
    type: 'success' | 'danger' | 'info';
    text: string;
  } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [autoSendEmail, setAutoSendEmail] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

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

  // Auditoria (busca + paginação)
  const [auditSearch, setAuditSearch] = useState('');
  const [auditPageSize, setAuditPageSize] = useState<number>(100);
  const [auditPage, setAuditPage] = useState<number>(1);

  const [prevPublicConfig, setPrevPublicConfig] = useState(publicConfig);
  if (publicConfig !== prevPublicConfig) {
    setPrevPublicConfig(publicConfig);
    setPubForm(publicConfig);
  }

  const [prevPaymentConfig, setPrevPaymentConfig] = useState(paymentConfig);
  if (paymentConfig !== prevPaymentConfig) {
    setPrevPaymentConfig(paymentConfig);
    if (paymentConfig) setPayForm(paymentConfig);
  }

  const [prevAdminConfig, setPrevAdminConfig] = useState(adminConfig);
  if (adminConfig !== prevAdminConfig) {
    setPrevAdminConfig(adminConfig);
    if (adminConfig) setAdmForm(adminConfig);
  }

  const [prevDrawNumbers, setPrevDrawNumbers] = useState(drawResult.numbers);
  if (drawResult.numbers !== prevDrawNumbers) {
    setPrevDrawNumbers(drawResult.numbers);
    setDrawInput(
      drawResult.numbers.map((n) => String(n).padStart(2, '0')).join(' ')
    );
  }

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

  const overview = useMemo(
    () =>
      calculateAdminOverviewMetrics({
        allUsers,
        publicConfig,
        liveEquity,
        closePreview,
      }),
    [allUsers, publicConfig, liveEquity, closePreview]
  );

  const combinedOdds = useMemo(
    () => calculatePoolCombinedOdds(games.map((g) => g.numbers)),
    [games]
  );

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
      if (
        statusFilter === 'receipt_pending' &&
        (u.approvalStatus !== 'approved' ||
          u.paymentStatus !== 'confirmed' ||
          u.receiptDelivered)
      ) {
        return false;
      }
      if (!q) return true;
      return (
        u.displayName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.txid.toLowerCase().includes(q) ||
        (u.assignedTicketNumbers || '').toLowerCase().includes(q)
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

  const filteredAuditLogs = useMemo(() => {
    const q = auditSearch.trim().toLowerCase();
    if (!q) return auditLogs;
    return auditLogs.filter(
      (log) =>
        log.action.toLowerCase().includes(q) ||
        log.actorEmail.toLowerCase().includes(q) ||
        log.targetName.toLowerCase().includes(q) ||
        log.details.toLowerCase().includes(q)
    );
  }, [auditLogs, auditSearch]);

  if (!authLoading && !authUser) {
    return <Navigate to="/" replace />;
  }

  if (authLoading || dataLoading) {
    return (
      <div className="container">
        <div className="card" role="status" aria-busy="true">
          Carregando painel dos moderadores...
        </div>
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

  async function executeConfirm() {
    if (!pendingConfirm) return;
    setConfirmBusy(true);
    try {
      await pendingConfirm.onConfirm();
      setPendingConfirm(null);
    } catch (err) {
      showToast(
        'danger',
        err instanceof Error ? err.message : 'Erro ao executar a ação.'
      );
      setPendingConfirm(null);
    } finally {
      setConfirmBusy(false);
    }
  }

  function handleReject(user: UserProfile) {
    setPendingConfirm({
      title: `Recusar inscrição de ${user.displayName}?`,
      description:
        user.paidQuotas > 0
          ? `Este participante já tem ${user.paidQuotas} cota(s) paga(s). Ao recusar, será registrado um estorno integral pendente automaticamente.`
          : 'A inscrição será marcada como recusada e o participante perderá acesso ao placar e aos jogos.',
      details: [
        `Participante: ${user.displayName} (${user.email})`,
        `Cotas solicitadas: ${user.requestedQuotas}`,
        ...(user.paidQuotas > 0
          ? [
              `Estorno automático previsto: ${formatCurrencyBr(user.paidQuotas * publicConfig.quotaPrice)}`,
            ]
          : []),
      ],
      confirmLabel: 'Confirmar recusa',
      variant: 'danger',
      onConfirm: async () => {
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
      },
    });
  }

  function handleCancel(user: UserProfile) {
    setPendingConfirm({
      title: `Cancelar participação de ${user.displayName}?`,
      description:
        user.paidQuotas > 0
          ? `Este participante já possui ${user.paidQuotas} cota(s) paga(s). O cancelamento removerá o nome do placar e gerará um estorno integral pendente.`
          : 'O participante será removido do placar e terá a participação marcada como cancelada.',
      details: [
        `Participante: ${user.displayName} (${user.email})`,
        `Cotas pagas: ${user.paidQuotas} | Solicitadas: ${user.requestedQuotas}`,
        ...(user.paidQuotas > 0
          ? [
              `Estorno integral pendente: ${formatCurrencyBr(user.paidQuotas * publicConfig.quotaPrice)}`,
            ]
          : []),
      ],
      confirmLabel: 'Confirmar cancelamento',
      variant: 'danger',
      onConfirm: async () => {
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
      },
    });
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

  function handleCancelRefund(user: UserProfile) {
    const statusLabel =
      user.refundStatus === 'completed' ? 'concluído' : 'pendente';
    setPendingConfirm({
      title: `Cancelar estorno de ${user.displayName}?`,
      description: `O registro de estorno (${statusLabel}) será removido da ficha do participante e do placar.`,
      details: [
        `Participante: ${user.displayName}`,
        `Estorno atual: ${user.refundQuotas} cota(s) — ${formatCurrencyBr(user.refundAmount)} (${statusLabel})`,
        'Os dados de pagamento PIX permanecem preservados e o cancelamento será gravado na auditoria.',
      ],
      confirmLabel: 'Confirmar cancelamento do estorno',
      variant: 'warning',
      onConfirm: async () => {
        setBusyId(user.uid);
        try {
          await dataService.cancelRefund(user.uid, actorEmail);
          await refreshAll();
          showToast('info', `Estorno de ${user.displayName} cancelado.`);
        } finally {
          setBusyId(null);
        }
      },
    });
  }

  function handleToggleModerator(user: UserProfile) {
    const runToggle = async () => {
      setBusyId(user.uid);
      try {
        await dataService.toggleModeratorRole(
          user.uid,
          !user.isModerator,
          actorEmail
        );
        await refreshAll();
        showToast(
          'info',
          `${user.displayName} ${!user.isModerator ? 'agora é moderador(a)' : 'não é mais moderador(a)'}.`
        );
      } finally {
        setBusyId(null);
      }
    };

    if (user.isModerator) {
      setPendingConfirm({
        title: `Remover moderador ${user.displayName}?`,
        description:
          'Esta pessoa perderá acesso ao painel /admin e às ações de moderação imediatamente.',
        details: [
          `Moderador(a): ${user.displayName} (${user.email})`,
          'Lembre-se de trocar também o MEGACORN_SECRET no Apps Script se necessário.',
        ],
        confirmLabel: 'Remover moderador',
        variant: 'danger',
        onConfirm: runToggle,
      });
    } else {
      void runToggle();
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

  async function handleSetPhase(phase: PoolPhase) {
    const meta = getPhaseMeta(phase);
    const next: PublicConfig = {
      ...pubForm,
      currentPhase: phase,
    };
    setPubForm(next);
    setBusyId('set_phase');
    try {
      await dataService.updatePublicConfig(next, actorEmail);
      await dataService.recordAuditEvent(
        'Fase da timeline alterada',
        actorEmail,
        publicConfig.poolName,
        `Evolução marcada para: ${meta.label}`
      );
      await refreshAll();
      showToast('success', `Timeline atualizada para: ${meta.label}!`);
    } finally {
      setBusyId(null);
    }
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
    if (nums.length === 0 && drawResult.numbers.length > 0) {
      setPendingConfirm({
        title: 'Limpar dezenas sorteadas oficiais?',
        description:
          'O resultado oficial publicado será removido da aba Jogos & Chances até que novas dezenas sejam salvas.',
        details: [
          `Dezenas atuais: ${drawResult.numbers.map((n) => String(n).padStart(2, '0')).join(' - ')}`,
        ],
        confirmLabel: 'Limpar resultado',
        variant: 'danger',
        onConfirm: async () => {
          await dataService.saveDrawResult([], actorEmail);
          await refreshAll();
          showToast('info', 'Dezenas sorteadas limpas.');
        },
      });
      return;
    }
    await dataService.saveDrawResult(nums, actorEmail);
    await refreshAll();
    showToast('success', 'Resultado oficial salvo!');
  }

  function handleDeleteGame(game: LotteryGame) {
    const formatted = game.numbers
      .map((n) => String(n).padStart(2, '0'))
      .join(' - ');
    setPendingConfirm({
      title: `Excluir volante "${game.label}"?`,
      description:
        'Este volante será removido permanentemente da lista oficial de jogos e do cálculo de probabilidades.',
      details: [`Volante: ${game.label}`, `Dezenas: ${formatted}`],
      confirmLabel: 'Excluir volante',
      variant: 'danger',
      onConfirm: async () => {
        await dataService.deleteGame(game.id, actorEmail);
        await refreshAll();
        showToast('info', `Volante "${game.label}" removido.`);
      },
    });
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

  function handlePurgeCpfs() {
    setPendingConfirm({
      title: 'Apagar permanentemente todos os CPFs (LGPD)?',
      description: `Todos os ${cpfStoredCount} CPF(s) armazenados serão apagados de forma irreversível da base de participantes.`,
      details: [
        'Recomendado apenas após emitir os bilhetes na lotérica.',
        'Nomes, cotas, pagamentos e histórico de auditoria permanecem intactos.',
      ],
      confirmLabel: `Apagar ${cpfStoredCount} CPF(s)`,
      variant: 'danger',
      onConfirm: async () => {
        const count = await dataService.purgeAllCpfs(actorEmail);
        await refreshAll();
        showToast('info', `Limpeza LGPD concluída: ${count} CPF(s) removidos.`);
      },
    });
  }

  function handleResetDatabase() {
    const adminCount = allUsers.filter((u) => u.isModerator).length;
    const nonAdminCount = allUsers.length - adminCount;
    setPendingConfirm({
      title: 'Restaurar base de dados mantendo os admins?',
      description:
        'Esta ação apaga participantes de teste, volantes, resultado do sorteio e registros de PIX/estorno, mantendo sua conta de moderador e todas as configurações prontas.',
      details: [
        `Será APAGADO: ${nonAdminCount} participante(s) não-admin, ${games.length} volante(s), resultado do sorteio e status de PIX/estorno/bilhete.`,
        `Será PRESERVADO: ${adminCount} moderador(es) (acesso /admin garantido, com cota zerada/limpa), chave PIX, código de convite, datas, Apps Script e log de auditoria.`,
        'A timeline volta para "Fase de cadastro" com inscrições e PIX abertos.',
      ],
      confirmLabel: 'Restaurar base mantendo admins',
      variant: 'danger',
      requireTypedText: 'RESTAURAR',
      onConfirm: async () => {
        setBusyId('reset_db');
        try {
          const res =
            await dataService.resetPoolDatabaseKeepingAdmins(actorEmail);
          await refreshAll();
          showToast(
            'success',
            `Base restaurada! ${res.removedParticipants} participante(s) e ${res.removedGames} volante(s) removidos; ${res.preservedAdmins} admin(s) e configurações preservados.`
          );
        } finally {
          setBusyId(null);
        }
      },
    });
  }

  const pendingApprovals = allUsers.filter((u) => u.approvalStatus === 'pending').length;
  const reportedPixCount = allUsers.filter((u) => u.paymentStatus === 'reported').length;
  const refundPendingCount = allUsers.filter((u) => u.refundStatus === 'pending').length;
  const cpfStoredCount = allUsers.filter((u) => Boolean(u.cpf)).length;

  return (
    <div className="container container-wide stack-lg">
      <section className="card stack-md">
        <div className="row-between">
          <div>
            <span className="badge badge-unicorn">
              <ShieldCheck size={13} aria-hidden="true" />
              Painel dos Moderadores
            </span>
            <h1 style={{ marginTop: 6 }}>Administração — {publicConfig.poolName}</h1>
          </div>
          {isDemoMode && dataService.demoResetData && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() =>
                setPendingConfirm({
                  title: 'Resetar dados do Modo Demo?',
                  description:
                    'Todas as alterações feitas localmente no modo demonstração serão descartadas e substituídas pelos dados de exemplo.',
                  confirmLabel: 'Resetar Demo',
                  variant: 'warning',
                  onConfirm: async () => {
                    await dataService.demoResetData?.();
                    await refreshAll();
                    showToast('info', 'Dados de demonstração restaurados.');
                  },
                })
              }
            >
              <RefreshCw size={14} aria-hidden="true" />
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

        <div
          className="tabs"
          role="tablist"
          aria-label="Seções do painel administrativo"
          onKeyDown={(e) => {
            const tabs: AdminTab[] = [
              'overview',
              'participants',
              'stages',
              'games',
              'settings',
              'audit',
            ];
            const idx = tabs.indexOf(activeTab);
            let nextIdx: number | null = null;
            if (e.key === 'ArrowRight') nextIdx = (idx + 1) % tabs.length;
            else if (e.key === 'ArrowLeft')
              nextIdx = (idx - 1 + tabs.length) % tabs.length;
            else if (e.key === 'Home') nextIdx = 0;
            else if (e.key === 'End') nextIdx = tabs.length - 1;
            if (nextIdx !== null) {
              e.preventDefault();
              const nextTab = tabs[nextIdx];
              setActiveTab(nextTab);
              document.getElementById(`admin-tab-${nextTab}`)?.focus();
            }
          }}
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'overview'}
            aria-controls="admin-panel-overview"
            tabIndex={activeTab === 'overview' ? 0 : -1}
            className={`tab-btn${activeTab === 'overview' ? ' active' : ''}`}
            onClick={() => setActiveTab('overview')}
            id="admin-tab-overview"
          >
            <BarChart3 size={15} aria-hidden="true" />
            Resumo &amp; Andamento
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'participants'}
            aria-controls="admin-panel-participants"
            tabIndex={activeTab === 'participants' ? 0 : -1}
            className={`tab-btn${activeTab === 'participants' ? ' active' : ''}`}
            onClick={() => setActiveTab('participants')}
            id="admin-tab-participants"
          >
            <Users size={15} aria-hidden="true" />
            Participantes &amp; PIX ({allUsers.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'stages'}
            aria-controls="admin-panel-stages"
            tabIndex={activeTab === 'stages' ? 0 : -1}
            className={`tab-btn${activeTab === 'stages' ? ' active' : ''}`}
            onClick={() => setActiveTab('stages')}
            id="admin-tab-stages"
          >
            <Sliders size={15} aria-hidden="true" />
            Etapas &amp; Fechamento
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'games'}
            aria-controls="admin-panel-games"
            tabIndex={activeTab === 'games' ? 0 : -1}
            className={`tab-btn${activeTab === 'games' ? ' active' : ''}`}
            onClick={() => setActiveTab('games')}
            id="admin-tab-games"
          >
            <Clover size={15} aria-hidden="true" />
            Jogos &amp; Sorteio ({games.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'settings'}
            aria-controls="admin-panel-settings"
            tabIndex={activeTab === 'settings' ? 0 : -1}
            className={`tab-btn${activeTab === 'settings' ? ' active' : ''}`}
            onClick={() => setActiveTab('settings')}
            id="admin-tab-settings"
          >
            <Settings size={15} aria-hidden="true" />
            Configurações &amp; E-mail
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'audit'}
            aria-controls="admin-panel-audit"
            tabIndex={activeTab === 'audit' ? 0 : -1}
            className={`tab-btn${activeTab === 'audit' ? ' active' : ''}`}
            onClick={() => setActiveTab('audit')}
            id="admin-tab-audit"
          >
            <ClipboardList size={15} aria-hidden="true" />
            Auditoria ({auditLogs.length})
          </button>
        </div>

        {toast && (
          <div
            className={`alert alert-${toast.type}`}
            role={toast.type === 'danger' ? 'alert' : 'status'}
            aria-live={toast.type === 'danger' ? 'assertive' : 'polite'}
          >
            {toast.text}
          </div>
        )}
      </section>

      {/* ABA 0: RESUMO & ANDAMENTO */}
      {activeTab === 'overview' && (
        <section
          className="stack-lg"
          role="tabpanel"
          id="admin-panel-overview"
          aria-labelledby="admin-tab-overview"
        >
          {/* Panorama Financeiro */}
          <div className="card stack-md">
            <div className="row-between">
              <div className="row" style={{ gap: 8 }}>
                <Coins size={20} color="var(--luck-500)" aria-hidden="true" />
                <div>
                  <h2>Resumo Financeiro &amp; Andamento do Bolão</h2>
                  <p style={{ color: 'var(--ink-secondary)', fontSize: '0.9rem' }}>
                    Visão consolidada do caixa, cotas reservadas, valores confirmados e pendências operacionais.
                  </p>
                </div>
              </div>
              <span className="badge badge-unicorn">
                Fase: {getPhaseMeta(publicConfig.currentPhase).label}
              </span>
            </div>

            <div className="grid-4">
              <div className="card-mint stack-xs">
                <div className="stat-label">Total já arrecadado (PIX bruto)</div>
                <div className="stat-value">
                  {formatCurrencyBr(overview.grossCollectedAmount)}
                </div>
                <div className="stat-sub">
                  {overview.grossPaidQuotas} cota(s) paga(s) por{' '}
                  {overview.confirmedUsersCount} pessoa(s)
                  {overview.pendingApprovalPaidAmount > 0 && (
                    <>
                      {' '}• inclui{' '}
                      <strong>
                        {formatCurrencyBr(overview.pendingApprovalPaidAmount)}
                      </strong>{' '}
                      de pendentes
                    </>
                  )}
                </div>
              </div>

              <div className="card-gold stack-xs">
                <div className="stat-label">
                  {publicConfig.flags.poolClosed
                    ? 'Total confirmado final (apostas)'
                    : 'Total confirmado líquido (caixa)'}
                </div>
                <div className="stat-value">
                  {formatCurrencyBr(overview.netConfirmedAmount)}
                </div>
                <div className="stat-sub">
                  {overview.confirmedEffectiveQuotas}/{overview.totalQuotas} cota(s)
                  efetiva(s) ({overview.confirmedPercent}% da meta)
                </div>
              </div>

              <div className="stat-tile stack-xs">
                <div className="stat-label">Total esperado (bolão cheio)</div>
                <div className="stat-value">
                  {formatCurrencyBr(overview.expectedMaxAmount)}
                </div>
                <div className="stat-sub">
                  {overview.totalQuotas} cotas ×{' '}
                  {formatCurrencyBr(overview.quotaPrice)} • Reservas aprovadas hoje:{' '}
                  <strong>
                    {formatCurrencyBr(overview.expectedFromApprovedAmount)}
                  </strong>
                </div>
              </div>

              <div className="card-unicorn stack-xs">
                <div className="stat-label">A receber / em conferência</div>
                <div className="stat-value">
                  {formatCurrencyBr(
                    overview.reportedPixAmount + overview.unpaidActiveAmount
                  )}
                </div>
                <div className="stat-sub">
                  Avisaram PIX:{' '}
                  <strong>{formatCurrencyBr(overview.reportedPixAmount)}</strong> (
                  {overview.reportedPixQuotas}c) • Sem PIX:{' '}
                  <strong>{formatCurrencyBr(overview.unpaidActiveAmount)}</strong> (
                  {overview.unpaidActiveQuotas}c)
                </div>
              </div>
            </div>

            {/* Barras de progresso */}
            <div className="grid-2">
              <div className="card-cream stack-xs">
                <div
                  className="row-between"
                  style={{ fontSize: '0.84rem', fontWeight: 700 }}
                >
                  <span id="admin-overview-reserved-label">
                    Reservas aprovadas ({overview.reservedApprovedQuotas}/
                    {overview.totalQuotas} cotas)
                  </span>
                  <span>{overview.reservedPercent}%</span>
                </div>
                <div
                  className="progress-track"
                  role="progressbar"
                  aria-labelledby="admin-overview-reserved-label"
                  aria-valuenow={overview.reservedPercent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className="progress-fill"
                    style={{ width: `${overview.reservedPercent}%` }}
                  />
                </div>
                <span className="field-hint">
                  {overview.remainingToReserveQuotas > 0
                    ? `Faltam ${overview.remainingToReserveQuotas} cota(s) (${formatCurrencyBr(overview.remainingToReserveQuotas * overview.quotaPrice)}) para completar as ${overview.totalQuotas} reservas.`
                    : `Todas as ${overview.totalQuotas} cotas já estão cobertas por reservas aprovadas!`}
                </span>
              </div>

              <div className="card-cream stack-xs">
                <div
                  className="row-between"
                  style={{ fontSize: '0.84rem', fontWeight: 700 }}
                >
                  <span id="admin-overview-confirmed-label">
                    Arrecadação confirmada ({overview.confirmedEffectiveQuotas}/
                    {overview.totalQuotas} cotas)
                  </span>
                  <span>{overview.confirmedPercent}%</span>
                </div>
                <div
                  className="progress-track"
                  role="progressbar"
                  aria-labelledby="admin-overview-confirmed-label"
                  aria-valuenow={overview.confirmedPercent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className="progress-fill"
                    style={{ width: `${overview.confirmedPercent}%` }}
                  />
                </div>
                <span className="field-hint">
                  {overview.remainingToConfirmQuotas > 0
                    ? `Faltam ${overview.remainingToConfirmQuotas} cota(s) confirmada(s) (${formatCurrencyBr(overview.remainingToConfirmQuotas * overview.quotaPrice)}) para fechar 100% do caixa.`
                    : 'Meta de 100% do caixa confirmada via PIX!'}
                </span>
              </div>
            </div>

            {/* Métricas de Cotas */}
            <div className="grid-4">
              <div className="stat-tile">
                <div className="stat-label">Cotas restantes (p/ reservar)</div>
                <div className="stat-value">
                  {overview.remainingToReserveQuotas}
                </div>
                <div className="stat-sub">
                  Vagas ainda livres no teto de {overview.totalQuotas}
                </div>
              </div>

              <div className="stat-tile">
                <div className="stat-label">Cotas restantes (p/ pagar)</div>
                <div className="stat-value">
                  {overview.remainingToConfirmQuotas}
                </div>
                <div className="stat-sub">
                  Até completar {formatCurrencyBr(overview.expectedMaxAmount)} no caixa
                </div>
              </div>

              <div className="stat-tile">
                <div className="stat-label">Demanda total pedida</div>
                <div className="stat-value">
                  {overview.totalRequestedApprovedQuotas}
                </div>
                <div className="stat-sub">
                  Média de{' '}
                  {overview.avgQuotasPerApproved.toLocaleString('pt-BR')}{' '}
                  cota(s)/aprovado
                  {overview.totalRequestedPendingQuotas > 0 &&
                    ` (+${overview.totalRequestedPendingQuotas} em pendentes)`}
                </div>
              </div>

              <div className="stat-tile">
                <div className="stat-label">Excedentes &amp; Fila de espera</div>
                <div className="stat-value">{overview.excessRequestedQuotas}</div>
                <div className="stat-sub">
                  {overview.waitlistCount > 0
                    ? `${overview.waitlistCount} pessoa(s) na fila de espera`
                    : 'Ninguém na fila de espera'}
                </div>
              </div>
            </div>
          </div>

          {/* Funil Operacional + Distribuição, Jogos e Cronograma */}
          <div className="grid-2">
            <div className="card stack-md">
              <div className="row-between">
                <div className="row" style={{ gap: 8 }}>
                  <Users size={19} color="var(--unicorn-500)" aria-hidden="true" />
                  <h3>Andamento Operacional &amp; Pendências</h3>
                </div>
                <span className="badge badge-neutral">
                  {overview.approvedUsersCount} aprovados / {overview.totalUsersCount}{' '}
                  cadastros
                </span>
              </div>

              <div className="stack-xs" style={{ fontSize: '0.9rem' }}>
                <div className="toggle-row">
                  <div>
                    <strong>Aprovações pendentes</strong>
                    <div className="field-hint">
                      {overview.pendingApprovalUsersCount} cadastro(s) aguardando
                      revisão ({overview.totalRequestedPendingQuotas} cota(s))
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      setStatusFilter('pending_approval');
                      setActiveTab('participants');
                    }}
                  >
                    Ver ({overview.pendingApprovalUsersCount})
                  </button>
                </div>

                <div className="toggle-row">
                  <div>
                    <strong>Avisos de PIX para conferir</strong>
                    <div className="field-hint">
                      {overview.reportedPixUsersCount} participante(s) •{' '}
                      {formatCurrencyBr(overview.reportedPixAmount)} aguardando
                      conferência no extrato
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-gold btn-sm"
                    onClick={() => {
                      setStatusFilter('reported_pix');
                      setActiveTab('participants');
                    }}
                  >
                    Conferir ({overview.reportedPixUsersCount})
                  </button>
                </div>

                <div className="toggle-row">
                  <div>
                    <strong>Ativos ainda sem PIX</strong>
                    <div className="field-hint">
                      {overview.unpaidActiveUsersCount} participante(s) •{' '}
                      {formatCurrencyBr(overview.unpaidActiveAmount)} (
                      {overview.unpaidActiveQuotas} cota(s))
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      setStatusFilter('unpaid');
                      setActiveTab('participants');
                    }}
                  >
                    Filtrar ({overview.unpaidActiveUsersCount})
                  </button>
                </div>

                <div className="toggle-row">
                  <div>
                    <strong>Estornos (pendentes / previstos)</strong>
                    <div className="field-hint">
                      Pendentes: {overview.refundPendingUsersCount} (
                      {formatCurrencyBr(overview.refundPendingAmount)}) • Concluídos:{' '}
                      {overview.refundCompletedUsersCount} (
                      {formatCurrencyBr(overview.refundCompletedAmount)})
                      {!publicConfig.flags.poolClosed &&
                        overview.projectedRefundUsersCount > 0 && (
                          <>
                            {' '}• Previstos se fechar hoje:{' '}
                            <strong>
                              {overview.projectedRefundUsersCount} (
                              {formatCurrencyBr(overview.projectedCloseRefundAmount)})
                            </strong>
                          </>
                        )}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      setStatusFilter('refund_pending');
                      setActiveTab('participants');
                    }}
                  >
                    Ver ({overview.refundPendingUsersCount})
                  </button>
                </div>

                <div className="toggle-row">
                  <div>
                    <strong>Bilhetes &amp; Entrega em Mãos</strong>
                    <div className="field-hint">
                      {overview.ticketAssignedUsersCount} com nº de cota •{' '}
                      {overview.receiptDeliveredUsersCount} entregue(s) •{' '}
                      {overview.receiptPendingUsersCount} pendente(s) de entrega
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      setStatusFilter('receipt_pending');
                      setActiveTab('participants');
                    }}
                  >
                    Pendentes ({overview.receiptPendingUsersCount})
                  </button>
                </div>
              </div>
            </div>

            <div className="stack-md">
              {/* Distribuição de cotas por participante */}
              <div className="card stack-sm">
                <div className="row-between">
                  <div className="row" style={{ gap: 8 }}>
                    <Ticket size={18} color="var(--corn-600)" aria-hidden="true" />
                    <h3>Distribuição de Cotas (Aprovados)</h3>
                  </div>
                  <span className="field-hint">
                    Máx. {publicConfig.maxQuotasPerPerson} por pessoa
                  </span>
                </div>
                <div className="row" style={{ gap: 8 }}>
                  {overview.quotaDistribution.map((tier) => (
                    <div
                      key={tier.quotas}
                      className="card-cream"
                      style={{ flex: '1 1 110px', padding: '12px 14px' }}
                    >
                      <div className="stat-label">
                        {tier.quotas} cota{tier.quotas > 1 ? 's' : ''}
                      </div>
                      <div className="stat-value" style={{ fontSize: '1.35rem' }}>
                        {tier.count}
                      </div>
                      <div className="stat-sub">
                        {tier.count === 1 ? 'participante' : 'participantes'} (
                        {tier.quotas * tier.count}c)
                      </div>
                    </div>
                  ))}
                </div>
                <span className="field-hint">
                  Recusados ou cancelados: <strong>{overview.rejectedOrCancelledCount}</strong>{' '}
                  • CPFs opcionais informados (PII):{' '}
                  <strong>{overview.cpfStoredUsersCount}</strong>
                </span>
              </div>

              {/* Jogos & Probabilidades */}
              <div className="card stack-sm">
                <div className="row-between">
                  <div className="row" style={{ gap: 8 }}>
                    <Clover size={18} color="var(--luck-500)" aria-hidden="true" />
                    <h3>Volantes &amp; Probabilidades</h3>
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setActiveTab('games')}
                  >
                    Gerenciar jogos
                  </button>
                </div>
                <div className="grid-3">
                  <div className="card-cream" style={{ padding: '10px 12px' }}>
                    <div className="stat-label">Volantes</div>
                    <div className="stat-value" style={{ fontSize: '1.3rem' }}>
                      {games.length}
                    </div>
                  </div>
                  <div className="card-cream" style={{ padding: '10px 12px' }}>
                    <div className="stat-label">Jogos simples equiv.</div>
                    <div className="stat-value" style={{ fontSize: '1.3rem' }}>
                      {combinedOdds.totalEquivalentSimpleBets.toLocaleString('pt-BR')}
                    </div>
                  </div>
                  <div className="card-cream" style={{ padding: '10px 12px' }}>
                    <div className="stat-label">Chance Sena</div>
                    <div className="stat-value" style={{ fontSize: '1.08rem' }}>
                      {games.length > 0 ? formatOneIn(combinedOdds.senaOneIn) : '—'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Prazos e Status das Chaves */}
              <div className="card stack-sm">
                <div className="row-between">
                  <div className="row" style={{ gap: 8 }}>
                    <Calendar size={18} color="var(--unicorn-500)" aria-hidden="true" />
                    <h3>Etapas &amp; Prazos</h3>
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setActiveTab('stages')}
                  >
                    Controlar etapas
                  </button>
                </div>
                <div className="row" style={{ gap: 6 }}>
                  <span
                    className={`badge ${publicConfig.flags.registrationsOpen ? 'badge-success' : 'badge-neutral'}`}
                  >
                    Inscrições: {publicConfig.flags.registrationsOpen ? 'Abertas' : 'Pausadas'}
                  </span>
                  <span
                    className={`badge ${publicConfig.flags.pixPaymentOpen ? 'badge-success' : 'badge-neutral'}`}
                  >
                    PIX: {publicConfig.flags.pixPaymentOpen ? 'Liberado' : 'Pausado'}
                  </span>
                  <span
                    className={`badge ${publicConfig.flags.boardVisible ? 'badge-success' : 'badge-neutral'}`}
                  >
                    Placar: {publicConfig.flags.boardVisible ? 'Visível' : 'Oculto'}
                  </span>
                  <span
                    className={`badge ${publicConfig.flags.gamesVisible ? 'badge-success' : 'badge-neutral'}`}
                  >
                    Jogos: {publicConfig.flags.gamesVisible ? 'Visíveis' : 'Ocultos'}
                  </span>
                  {publicConfig.flags.poolClosed && (
                    <span className="badge badge-danger">Bolão Fechado</span>
                  )}
                </div>
                <div
                  className="grid-2"
                  style={{ fontSize: '0.84rem', gap: 8, color: 'var(--ink-secondary)' }}
                >
                  <div>
                    Inscrições até:{' '}
                    <strong>{formatDateBr(publicConfig.registrationDeadline)}</strong>
                  </div>
                  <div>
                    PIX até:{' '}
                    <strong>{formatDateBr(publicConfig.paymentDeadline)}</strong>
                  </div>
                  <div>
                    Aposta em:{' '}
                    <strong>{formatDateBr(publicConfig.betPlacementDate)}</strong>
                  </div>
                  <div>
                    Sorteio:{' '}
                    <strong>{formatDateBr(publicConfig.drawDate)}</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ABA 1: PARTICIPANTES & PIX */}
      {activeTab === 'participants' && (
        <section
          className="card stack-md"
          role="tabpanel"
          id="admin-panel-participants"
          aria-labelledby="admin-tab-participants"
        >
          <h2 className="sr-only">Participantes e Pagamentos PIX</h2>
          <div className="row-between">
            <div className="row" style={{ flex: 1, minWidth: 260 }}>
              <input
                type="search"
                className="input"
                style={{ maxWidth: 320 }}
                placeholder="Buscar por nome, e-mail, bilhete ou TXID..."
                aria-label="Buscar participantes por nome, e-mail, número do bilhete ou TXID"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                id="admin-search-input"
              />
              <select
                className="select"
                style={{ maxWidth: 220 }}
                aria-label="Filtrar participantes por status"
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
                <option value="receipt_pending">
                  Comprovante a entregar em mãos
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
              <Mail size={14} aria-hidden="true" />
              {batchProgress || 'Enviar cobrança por e-mail (pendentes)'}
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleCopyWhatsappList}
              id="btn-copy-whatsapp-reminder"
            >
              <Copy size={14} aria-hidden="true" />
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
              <Download size={14} aria-hidden="true" />
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
              <Download size={14} aria-hidden="true" />
              CSV p/ bilhete (CPF completo)
            </button>
            {cpfStoredCount > 0 && (
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={handlePurgeCpfs}
                id="btn-purge-cpfs"
              >
                <Trash2 size={14} aria-hidden="true" />
                Limpar CPFs (LGPD)
              </button>
            )}
          </div>

          <div className="table-wrap">
            <table className="data-table">
              <caption className="sr-only">
                Gestão administrativa de participantes, pagamentos PIX, estornos e bilhetes
              </caption>
              <thead>
                <tr>
                  <th scope="col">Participante / E-mail</th>
                  <th scope="col">CPF (PII)</th>
                  <th scope="col">Aprovação</th>
                  <th scope="col">Cotas &amp; TXID</th>
                  <th scope="col">PIX / Estorno</th>
                  <th scope="col">Bilhete / Entrega em Mãos</th>
                  <th scope="col">Ações</th>
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
                              aria-label={
                                cpfVisible
                                  ? `Ocultar CPF de ${u.displayName}`
                                  : `Revelar CPF de ${u.displayName}`
                              }
                              aria-pressed={cpfVisible}
                            >
                              {cpfVisible ? (
                                <EyeOff size={13} aria-hidden="true" />
                              ) : (
                                <Eye size={13} aria-hidden="true" />
                              )}
                            </button>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--ink-muted)', fontSize: '0.8rem' }}>
                            Não informado
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
                        <div className="row" style={{ gap: 6, fontSize: '0.84rem' }}>
                          <span>
                            Pedidas: <strong>{u.requestedQuotas}</strong> (
                            {formatCurrencyBr(
                              u.requestedQuotas * publicConfig.quotaPrice
                            )}
                            )
                          </span>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '2px 6px' }}
                            disabled={
                              busyId === u.uid || u.requestedQuotas <= 1
                            }
                            onClick={async () => {
                              setBusyId(u.uid);
                              try {
                                await dataService.updateParticipantQuotasAsAdmin(
                                  u.uid,
                                  u.requestedQuotas - 1,
                                  actorEmail
                                );
                                await refreshAll();
                                showToast(
                                  'info',
                                  `Cotas de ${u.displayName} ajustadas para ${u.requestedQuotas - 1}.`
                                );
                              } finally {
                                setBusyId(null);
                              }
                            }}
                            aria-label={`Reduzir 1 cota de ${u.displayName}`}
                          >
                            <Minus size={12} aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '2px 6px' }}
                            disabled={
                              busyId === u.uid ||
                              u.requestedQuotas >=
                                publicConfig.maxQuotasPerPerson
                            }
                            onClick={async () => {
                              setBusyId(u.uid);
                              try {
                                await dataService.updateParticipantQuotasAsAdmin(
                                  u.uid,
                                  u.requestedQuotas + 1,
                                  actorEmail
                                );
                                await refreshAll();
                                showToast(
                                  'info',
                                  `Cotas de ${u.displayName} ajustadas para ${u.requestedQuotas + 1}.`
                                );
                              } finally {
                                setBusyId(null);
                              }
                            }}
                            aria-label={`Adicionar 1 cota para ${u.displayName}`}
                          >
                            <Plus size={12} aria-hidden="true" />
                          </button>
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
                        {!canManageTickets(publicConfig.currentPhase) ? (
                          <div style={{ fontSize: '0.78rem', color: 'var(--ink-muted)', maxWidth: 165 }}>
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                fontWeight: 600,
                              }}
                            >
                              <Lock size={12} aria-hidden="true" />
                              Aguardando “Aposta feita”
                            </span>
                            <div style={{ marginTop: 2 }}>
                              Avance a timeline em <em>Etapas</em> para liberar.
                            </div>
                          </div>
                        ) : (
                          <div className="stack-xs" style={{ minWidth: 170 }}>
                            <div className="row" style={{ gap: 4 }}>
                              <input
                                type="text"
                                className="input mono"
                                style={{
                                  padding: '5px 8px',
                                  fontSize: '0.78rem',
                                  flex: 1,
                                  minWidth: 92,
                                }}
                                placeholder="Ex.: #14, #52"
                                value={
                                  ticketDrafts[u.uid] !== undefined
                                    ? ticketDrafts[u.uid]
                                    : u.assignedTicketNumbers || ''
                                }
                                onChange={(e) =>
                                  setTicketDrafts((prev) => ({
                                    ...prev,
                                    [u.uid]: e.target.value,
                                  }))
                                }
                                aria-label={`Número da cota do bilhete de ${u.displayName}`}
                              />
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                style={{ padding: '5px 8px' }}
                                disabled={busyId === u.uid}
                                onClick={() => {
                                  const val =
                                    ticketDrafts[u.uid] !== undefined
                                      ? ticketDrafts[u.uid]
                                      : u.assignedTicketNumbers || '';
                                  const saveTicket = async () => {
                                    setBusyId(u.uid);
                                    try {
                                      await dataService.updateParticipantTicketInfo(
                                        u.uid,
                                        { assignedTicketNumbers: val },
                                        actorEmail
                                      );
                                      await refreshAll();
                                      showToast(
                                        'success',
                                        val.trim()
                                          ? `Nº da cota do bilhete salvo para ${u.displayName}.`
                                          : `Nº da cota do bilhete removido para ${u.displayName}.`
                                      );
                                    } catch (err) {
                                      showToast(
                                        'danger',
                                        err instanceof Error
                                          ? err.message
                                          : 'Erro ao salvar nº do bilhete.'
                                      );
                                    } finally {
                                      setBusyId(null);
                                    }
                                  };
                                  if (!val.trim() && u.assignedTicketNumbers) {
                                    setPendingConfirm({
                                      title: `Remover nº do bilhete de ${u.displayName}?`,
                                      description: `O número salvo (${u.assignedTicketNumbers}) será apagado da ficha do participante e do placar.`,
                                      confirmLabel: 'Remover nº do bilhete',
                                      variant: 'danger',
                                      onConfirm: saveTicket,
                                    });
                                  } else {
                                    void saveTicket();
                                  }
                                }}
                                title="Salvar nº da cota no bilhete"
                                aria-label={`Salvar número da cota do bilhete de ${u.displayName}`}
                              >
                                <Save size={13} aria-hidden="true" />
                              </button>
                            </div>
                            <button
                              type="button"
                              className={`btn btn-sm ${u.receiptDelivered ? 'btn-primary' : 'btn-secondary'}`}
                              style={{ padding: '4px 9px', fontSize: '0.76rem' }}
                              disabled={busyId === u.uid}
                              aria-pressed={Boolean(u.receiptDelivered)}
                              aria-label={
                                u.receiptDelivered
                                  ? `Desmarcar entrega em mãos do bilhete de ${u.displayName}`
                                  : `Marcar entrega em mãos do bilhete de ${u.displayName}`
                              }
                              onClick={async () => {
                                setBusyId(u.uid);
                                try {
                                  await dataService.updateParticipantTicketInfo(
                                    u.uid,
                                    { receiptDelivered: !u.receiptDelivered },
                                    actorEmail
                                  );
                                  await refreshAll();
                                  showToast(
                                    'success',
                                    !u.receiptDelivered
                                      ? `Comprovante de ${u.displayName} marcado como entregue em mãos!`
                                      : `Entrega em mãos de ${u.displayName} desmarcada.`
                                  );
                                } catch (err) {
                                  showToast(
                                    'danger',
                                    err instanceof Error
                                      ? err.message
                                      : 'Erro ao atualizar entrega.'
                                  );
                                } finally {
                                  setBusyId(null);
                                }
                              }}
                            >
                              <CheckCircle2 size={12} aria-hidden="true" />
                              {u.receiptDelivered
                                ? 'Entregue em mãos ✓'
                                : 'Marcar entregue em mãos'}
                            </button>
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
                                <Check size={13} aria-hidden="true" />
                                Aprovar
                              </button>
                              <button
                                type="button"
                                className="btn btn-danger btn-sm"
                                disabled={busyId === u.uid}
                                onClick={() => handleReject(u)}
                              >
                                <XCircle size={13} aria-hidden="true" />
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
                                <CheckCircle2 size={13} aria-hidden="true" />
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
                              <Undo2 size={13} aria-hidden="true" />
                              Marcar Estornado
                            </button>
                          )}

                          {(u.refundStatus === 'pending' ||
                            u.refundStatus === 'completed') && (
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              disabled={busyId === u.uid}
                              onClick={() => handleCancelRefund(u)}
                              aria-label={`Cancelar estorno de ${u.displayName}`}
                            >
                              <XCircle size={13} aria-hidden="true" />
                              Cancelar Estorno
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

                          {(() => {
                            const emailAction: EmailActionType =
                              u.refundStatus === 'pending'
                                ? 'refund_notice'
                                : u.paymentStatus === 'confirmed'
                                  ? 'payment_confirmed'
                                  : 'payment_reminder';
                            const emailTooltip =
                              emailAction === 'refund_notice'
                                ? `Enviar e-mail: aviso de estorno pendente (${formatCurrencyBr(u.refundAmount)})`
                                : emailAction === 'payment_confirmed'
                                  ? `Enviar e-mail: confirmação de pagamento PIX (${u.paidQuotas} cota(s))`
                                  : `Enviar e-mail: lembrete de pagamento PIX (${formatCurrencyBr(u.requestedQuotas * publicConfig.quotaPrice)})`;
                            return (
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm has-tooltip"
                                onClick={() => dispatchEmail(u, emailAction)}
                                title={emailTooltip}
                                data-tooltip={emailTooltip}
                                aria-label={`${emailTooltip} para ${u.displayName}`}
                              >
                                <Send size={13} aria-hidden="true" />
                              </button>
                            );
                          })()}

                          {u.approvalStatus === 'approved' &&
                            u.uid !== profile.uid && (
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm has-tooltip"
                                disabled={busyId === u.uid}
                                onClick={() => handleToggleModerator(u)}
                                title={
                                  u.isModerator
                                    ? 'Remover permissão de moderador'
                                    : 'Promover a moderador'
                                }
                                data-tooltip={
                                  u.isModerator
                                    ? 'Remover permissão de moderador'
                                    : 'Promover a moderador'
                                }
                                aria-label={
                                  u.isModerator
                                    ? `Remover permissão de moderador de ${u.displayName}`
                                    : `Promover ${u.displayName} a moderador`
                                }
                                aria-pressed={u.isModerator}
                              >
                                <ShieldCheck size={13} aria-hidden="true" />
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
        <div
          className="stack-md"
          role="tabpanel"
          id="admin-panel-stages"
          aria-labelledby="admin-tab-stages"
        >
          <section className="card stack-md" id="admin-timeline-controller">
            <div className="row-between">
              <div>
                <h2>Controlador da Timeline (Evolução do Bolão)</h2>
                <p style={{ color: 'var(--ink-secondary)', fontSize: '0.9rem' }}>
                  Marque em qual fase o {publicConfig.poolName} está agora. A
                  atribuição de nº de cotas do bilhete e entrega em mãos só é
                  liberada a partir de <strong>Aposta feita</strong>.
                </p>
              </div>
              <span
                className={`badge ${canManageTickets(publicConfig.currentPhase) ? 'badge-success' : 'badge-warning'}`}
              >
                {canManageTickets(publicConfig.currentPhase)
                  ? 'Bilhetes / Entrega liberados'
                  : 'Bilhetes bloqueados até Aposta feita'}
              </span>
            </div>

            <div
              className="phase-selector-grid"
              role="group"
              aria-label="Selecionar fase atual da timeline"
            >
              {POOL_PHASES.map((phase, idx) => {
                const activeIdx = getPhaseIndex(publicConfig.currentPhase);
                const cls =
                  idx < activeIdx
                    ? 'past'
                    : idx === activeIdx
                      ? 'active'
                      : '';
                return (
                  <button
                    key={phase.id}
                    type="button"
                    className={`phase-btn ${cls}`}
                    disabled={busyId === 'set_phase'}
                    onClick={() => handleSetPhase(phase.id)}
                    aria-pressed={idx === activeIdx}
                    aria-label={`Etapa ${idx + 1} de ${POOL_PHASES.length}: ${phase.label}${idx === activeIdx ? ' (fase atual)' : idx < activeIdx ? ' (concluída)' : ''}`}
                    id={`btn-phase-${phase.id}`}
                  >
                    <span className="phase-btn-step" aria-hidden="true">
                      {idx < activeIdx
                        ? `✓ Etapa ${idx + 1}`
                        : idx === activeIdx
                          ? `● Agora (Etapa ${idx + 1})`
                          : `Etapa ${idx + 1}`}
                    </span>
                    <span className="phase-btn-title">{phase.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="row-between">
              <span className="field-hint">
                Fase atual:{' '}
                <strong>{getPhaseMeta(publicConfig.currentPhase).label}</strong>{' '}
                — {getPhaseMeta(publicConfig.currentPhase).description}
              </span>
              <div className="row" style={{ gap: 8 }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={
                    busyId === 'set_phase' ||
                    getPhaseIndex(publicConfig.currentPhase) <= 0
                  }
                  onClick={() => {
                    const prevIdx =
                      getPhaseIndex(publicConfig.currentPhase) - 1;
                    if (prevIdx >= 0) {
                      void handleSetPhase(POOL_PHASES[prevIdx].id);
                    }
                  }}
                  id="btn-phase-prev"
                >
                  Voltar fase
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={
                    busyId === 'set_phase' ||
                    getPhaseIndex(publicConfig.currentPhase) >=
                      POOL_PHASES.length - 1
                  }
                  onClick={() => {
                    const nextIdx =
                      getPhaseIndex(publicConfig.currentPhase) + 1;
                    if (nextIdx < POOL_PHASES.length) {
                      void handleSetPhase(POOL_PHASES[nextIdx].id);
                    }
                  }}
                  id="btn-phase-next"
                >
                  Avançar para próxima fase
                </button>
              </div>
            </div>
          </section>

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
                    <strong id={`stage-label-${key}`}>{title}</strong>
                    <div
                      id={`stage-desc-${key}`}
                      style={{ fontSize: '0.82rem', color: 'var(--ink-muted)' }}
                    >
                      {desc}
                    </div>
                  </div>
                  <label className="switch">
                    <input
                      type="checkbox"
                      role="switch"
                      checked={pubForm.flags[key]}
                      onChange={(e) => handleToggleStage(key, e.target.checked)}
                      aria-labelledby={`stage-label-${key}`}
                      aria-describedby={`stage-desc-${key}`}
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
                <Save size={14} aria-hidden="true" />
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
                  <caption className="sr-only">
                    Prévia de estornos previstos ao fechar o bolão
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Participante</th>
                      <th scope="col">Pagou</th>
                      <th scope="col">Final</th>
                      <th scope="col">Estorno</th>
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
                  <Lock size={15} aria-hidden="true" />
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
                  <RefreshCw size={15} aria-hidden="true" />
                  Reabrir Bolão (descongelar rateio)
                </button>
              )}
            </div>
          </section>
          </div>

          <section className="card danger-zone stack-sm">
            <div className="row" style={{ gap: 10 }}>
              <AlertTriangle size={20} color="var(--danger-ink)" aria-hidden="true" />
              <div>
                <h2>Restaurar Base de Dados (Mantendo Admins)</h2>
                <p style={{ color: 'var(--ink-secondary)', fontSize: '0.88rem' }}>
                  Útil após testes pré-lançamento ou ao iniciar uma nova edição:
                  apaga participantes não-admin, volantes, resultado do sorteio e
                  registros de PIX/estorno, mantendo os moderadores ativos e
                  todas as configurações (chave PIX, convite, Apps Script e datas).
                </p>
              </div>
            </div>
            <div>
              <button
                type="button"
                className="btn btn-danger"
                disabled={busyId === 'reset_db'}
                onClick={handleResetDatabase}
                id="btn-reset-database-keep-admins"
              >
                <Trash2 size={15} aria-hidden="true" />
                {busyId === 'reset_db'
                  ? 'Restaurando base...'
                  : 'Restaurar base de dados (sem perder admin)'}
              </button>
            </div>
          </section>
        </div>
      )}

      {/* ABA 3: JOGOS & SORTEIO */}
      {activeTab === 'games' && (
        <div
          className="grid-2"
          role="tabpanel"
          id="admin-panel-games"
          aria-labelledby="admin-tab-games"
        >
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
                  aria-describedby="admin-game-numbers-hint"
                />
                <span id="admin-game-numbers-hint" className="field-hint">
                  Reconhecidas: <strong>{parsedNewGame.length}</strong> dezena(s)
                  válida(s)
                </span>
              </div>

              {newGameOddsPreview && (
                <div
                  className="card-mint"
                  style={{ fontSize: '0.84rem' }}
                  role="status"
                  aria-live="polite"
                >
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
                <Plus size={15} aria-hidden="true" />
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
                  <Save size={15} aria-hidden="true" />
                  Salvar Resultado Oficial
                </button>
              </form>
            </div>

            <div className="card stack-sm">
              <h2 style={{ fontSize: '1.12rem' }}>
                Volantes cadastrados ({games.length})
              </h2>
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
                      aria-label={`Excluir volante ${g.label}`}
                      onClick={() => handleDeleteGame(g)}
                    >
                      <Trash2 size={13} aria-hidden="true" />
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
        <form
          onSubmit={handleSaveAllSettings}
          className="stack-md"
          role="tabpanel"
          id="admin-panel-settings"
          aria-labelledby="admin-tab-settings"
        >
          <div className="grid-2">
            <section className="card stack-sm">
              <h2>Parâmetros do Bolão</h2>
              <div className="grid-2" style={{ gap: 12 }}>
                <div className="field">
                  <label htmlFor="admin-pool-name">Nome do bolão</label>
                  <input
                    id="admin-pool-name"
                    type="text"
                    className="input"
                    value={pubForm.poolName}
                    onChange={(e) =>
                      setPubForm({ ...pubForm, poolName: e.target.value })
                    }
                  />
                </div>
                <div className="field">
                  <label htmlFor="admin-edition">Edição / Ano</label>
                  <input
                    id="admin-edition"
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
                  <label htmlFor="admin-quota-price">Valor cota (R$)</label>
                  <input
                    id="admin-quota-price"
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
                  <label htmlFor="admin-total-quotas">Total cotas</label>
                  <input
                    id="admin-total-quotas"
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
                  <label htmlFor="admin-max-quotas">Máx./pessoa</label>
                  <input
                    id="admin-max-quotas"
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

              <div className="grid-2" style={{ gap: 10 }}>
                <div className="field">
                  <label htmlFor="admin-reg-deadline">
                    Data limite para registro
                  </label>
                  <input
                    id="admin-reg-deadline"
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
                  <label htmlFor="admin-pay-deadline">
                    Data limite para pagamento PIX
                  </label>
                  <input
                    id="admin-pay-deadline"
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
                  <label htmlFor="admin-bet-date">
                    Data de realizar a aposta
                  </label>
                  <input
                    id="admin-bet-date"
                    type="date"
                    className="input"
                    value={pubForm.betPlacementDate}
                    onChange={(e) =>
                      setPubForm({
                        ...pubForm,
                        betPlacementDate: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="field">
                  <label htmlFor="admin-draw-date">Data do sorteio</label>
                  <input
                    id="admin-draw-date"
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
                <label htmlFor="admin-organizer-contact">
                  Dados de contato dos organizadores (exibido na tela inicial, Regras e Minhas Cotas)
                </label>
                <textarea
                  id="admin-organizer-contact"
                  className="textarea"
                  placeholder="Ex.: Fale com Marina ou Rodrigo no Slack #bolao-megacorn ou WhatsApp (11) 9xxxx-xxxx"
                  value={pubForm.organizerContact}
                  onChange={(e) =>
                    setPubForm({
                      ...pubForm,
                      organizerContact: e.target.value,
                    })
                  }
                />
              </div>

              <div className="field">
                <label htmlFor="admin-price-rationale">
                  Por que esse valor por cota? (exibido na Página de Regras)
                </label>
                <textarea
                  id="admin-price-rationale"
                  className="textarea"
                  placeholder="Ex.: Esse valor foi escolhido para ser possível realizar 8 jogos de 9 números e ter somente um comprovante por cota."
                  value={pubForm.quotaPriceRationale}
                  onChange={(e) =>
                    setPubForm({
                      ...pubForm,
                      quotaPriceRationale: e.target.value,
                    })
                  }
                />
              </div>

              <div className="field">
                <label htmlFor="admin-rules-extra">
                  Nota extra na Página de Regras
                </label>
                <textarea
                  id="admin-rules-extra"
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
                  <label htmlFor="admin-invite-code">
                    Código de convite ativo do time (exigido no cadastro de e-mail)
                  </label>
                  <div className="row" style={{ gap: 8 }}>
                    <input
                      id="admin-invite-code"
                      type="text"
                      className="input mono"
                      style={{ flex: 1 }}
                      value={admForm.activeInviteCode}
                      onChange={(e) =>
                        setAdmForm({
                          ...admForm,
                          activeInviteCode: e.target.value.toUpperCase(),
                        })
                      }
                    />
                    <button
                      type="button"
                      className="btn btn-unicorn btn-sm"
                      onClick={async () => {
                        const shareUrl = buildInviteShareUrl(
                          admForm.activeInviteCode
                        );
                        await navigator.clipboard.writeText(shareUrl);
                        showToast(
                          'success',
                          `Link de convite copiado: ${shareUrl}`
                        );
                      }}
                      id="btn-copy-invite-link"
                    >
                      <Link2 size={14} aria-hidden="true" />
                      Copiar link (?convite=)
                    </button>
                  </div>
                  <span className="field-hint">
                    Ao alterar e salvar, o código anterior é desativado
                    automaticamente no Firestore. Quem abrir{' '}
                    <code className="mono">
                      ?convite={admForm.activeInviteCode || 'CODIGO'}
                    </code>{' '}
                    já chega com o código preenchido!
                  </span>
                </div>
                <div className="field">
                  <label htmlFor="admin-pix-key">Chave PIX do organizador</label>
                  <input
                    id="admin-pix-key"
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
                    <label htmlFor="admin-merchant-name">
                      Nome do recebedor (até 25 chars)
                    </label>
                    <input
                      id="admin-merchant-name"
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
                    <label htmlFor="admin-merchant-city">
                      Cidade (até 15 chars)
                    </label>
                    <input
                      id="admin-merchant-city"
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
                  <label htmlFor="admin-pix-instructions">
                    Instruções exibidas acima do QR Code
                  </label>
                  <textarea
                    id="admin-pix-instructions"
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
                    <Mail size={14} aria-hidden="true" />
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
              <Save size={16} aria-hidden="true" />
              {busyId === 'save_settings'
                ? 'Salvando...'
                : 'Salvar todas as configurações'}
            </button>
          </div>
        </form>
      )}

      {/* ABA 5: AUDITORIA */}
      {activeTab === 'audit' && (() => {
        const totalAudit = filteredAuditLogs.length;
        const totalPages = Math.max(1, Math.ceil(totalAudit / auditPageSize));
        const safePage = Math.min(auditPage, totalPages);
        const startIndex = (safePage - 1) * auditPageSize;
        const paginatedAuditLogs = filteredAuditLogs.slice(
          startIndex,
          startIndex + auditPageSize
        );
        const rangeStart = totalAudit === 0 ? 0 : startIndex + 1;
        const rangeEnd = Math.min(startIndex + auditPageSize, totalAudit);

        return (
          <section
            className="card stack-md"
            role="tabpanel"
            id="admin-panel-audit"
            aria-labelledby="admin-tab-audit"
          >
            <div className="row-between">
              <div>
                <h2>Histórico de Auditoria</h2>
                <p style={{ color: 'var(--ink-secondary)', fontSize: '0.88rem', marginTop: 2 }}>
                  Registra ações de moderadores e de participantes (cadastros,
                  edições de perfil/cotas e avisos de PIX — sem gravar CPF).
                </p>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={filteredAuditLogs.length === 0}
                onClick={() => {
                  exportAuditLogsCsv(filteredAuditLogs);
                  showToast(
                    'success',
                    `CSV de auditoria exportado (${filteredAuditLogs.length} registro(s)).`
                  );
                }}
                id="btn-export-audit-csv"
              >
                <Download size={14} aria-hidden="true" />
                Exportar Auditoria CSV ({filteredAuditLogs.length})
              </button>
            </div>

            <div className="row-between" style={{ gap: 10 }}>
              <div className="row" style={{ flex: 1, minWidth: 260 }}>
                <input
                  type="search"
                  className="input"
                  style={{ maxWidth: 360 }}
                  placeholder="Filtrar por ação, e-mail, alvo ou detalhe..."
                  aria-label="Filtrar histórico de auditoria por ação, e-mail, alvo ou detalhe"
                  value={auditSearch}
                  onChange={(e) => {
                    setAuditSearch(e.target.value);
                    setAuditPage(1);
                  }}
                  id="audit-search-input"
                />
                <select
                  className="select"
                  style={{ maxWidth: 190 }}
                  aria-label="Quantidade de registros de auditoria por página"
                  value={auditPageSize}
                  onChange={(e) => {
                    setAuditPageSize(Number(e.target.value));
                    setAuditPage(1);
                  }}
                  id="audit-page-size-select"
                >
                  <option value={25}>25 por página</option>
                  <option value={50}>50 por página</option>
                  <option value={100}>100 por página</option>
                </select>
              </div>

              {totalAudit > 0 && (
                <div className="row" style={{ gap: 8 }}>
                  <span className="field-hint">
                    Exibindo <strong>{rangeStart}–{rangeEnd}</strong> de{' '}
                    <strong>{totalAudit}</strong>
                  </span>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={safePage <= 1}
                    onClick={() => setAuditPage((p) => Math.max(1, p - 1))}
                    aria-label="Página anterior da auditoria"
                    id="audit-prev-page"
                  >
                    Anterior
                  </button>
                  <span
                    className="mono"
                    style={{ fontSize: '0.82rem', color: 'var(--ink-secondary)' }}
                  >
                    {safePage}/{totalPages}
                  </span>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={safePage >= totalPages}
                    onClick={() =>
                      setAuditPage((p) => Math.min(totalPages, p + 1))
                    }
                    aria-label="Próxima página da auditoria"
                    id="audit-next-page"
                  >
                    Próxima
                  </button>
                </div>
              )}
            </div>

            {totalAudit === 0 ? (
              <p style={{ color: 'var(--ink-muted)' }}>
                {auditLogs.length === 0
                  ? 'Nenhum evento registrado.'
                  : 'Nenhum registro encontrado com esse filtro.'}
              </p>
            ) : (
              <>
                <div className="table-wrap">
                  <table className="data-table">
                    <caption className="sr-only">
                      Histórico completo de ações realizadas por moderadores e participantes no bolão
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">Data/Hora</th>
                        <th scope="col">Ação</th>
                        <th scope="col">Autor (E-mail)</th>
                        <th scope="col">Alvo</th>
                        <th scope="col">Detalhes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedAuditLogs.map((log) => (
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

                {totalPages > 1 && (
                  <div className="row-between">
                    <span className="field-hint">
                      Página <strong>{safePage}</strong> de{' '}
                      <strong>{totalPages}</strong> ({rangeStart}–{rangeEnd} de{' '}
                      {totalAudit} registros)
                    </span>
                    <div className="row" style={{ gap: 8 }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        disabled={safePage <= 1}
                        onClick={() => setAuditPage((p) => Math.max(1, p - 1))}
                      >
                        Anterior
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        disabled={safePage >= totalPages}
                        onClick={() =>
                          setAuditPage((p) => Math.min(totalPages, p + 1))
                        }
                      >
                        Próxima
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </section>
        );
      })()}

      <ConfirmDialog
        open={Boolean(pendingConfirm)}
        title={pendingConfirm?.title || ''}
        description={pendingConfirm?.description || ''}
        details={pendingConfirm?.details}
        confirmLabel={pendingConfirm?.confirmLabel || 'Confirmar'}
        variant={pendingConfirm?.variant || 'danger'}
        requireTypedText={pendingConfirm?.requireTypedText}
        busy={confirmBusy}
        onConfirm={executeConfirm}
        onCancel={() => {
          if (!confirmBusy) setPendingConfirm(null);
        }}
      />
    </div>
  );
}
