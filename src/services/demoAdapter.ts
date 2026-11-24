import { sanitizeCpf } from '../lib/cpf';
import { calculateRefundsOnClose } from '../lib/equity';
import { generateParticipantTxid } from '../lib/pix';
import {
  clearAllSessionArtifacts,
  clearRememberedSignInEmail,
  getRememberedSignInEmail,
  rememberSignInEmail,
  setSessionCookieHint,
} from '../lib/session';
import type {
  AdminConfig,
  AuditLogEntry,
  BoardEntry,
  DrawResult,
  LotteryGame,
  PaymentConfig,
  PoolStats,
  PublicConfig,
  UserProfile,
} from '../types';
import {
  DEFAULT_ADMIN_CONFIG,
  DEFAULT_PAYMENT_CONFIG,
  DEFAULT_PUBLIC_CONFIG,
  type AuthUser,
  type DataService,
  type SignInLinkCompletionResult,
} from './dataService';

const STORAGE_KEY = 'megacorn_demo_state_v1';
const AUTH_KEY = 'megacorn_demo_auth_v1';

interface DemoState {
  publicConfig: PublicConfig;
  paymentConfig: PaymentConfig;
  adminConfig: AdminConfig;
  users: Record<string, UserProfile>;
  games: LotteryGame[];
  drawResult: DrawResult;
  auditLogs: AuditLogEntry[];
}

function createSeedState(): DemoState {
  const now = Date.now();
  const day = 86_400_000;

  const seedUsers: UserProfile[] = [
    {
      uid: 'demo_mod_1',
      email: 'organizador@megacorn.demo',
      displayName: 'Marina Silva (Org)',
      cpf: '',
      approvalStatus: 'approved',
      requestedQuotas: 3,
      paidQuotas: 3,
      finalQuotas: null,
      paymentStatus: 'confirmed',
      paymentNote: 'PIX inicial da organização',
      paymentReportedAt: now - 5 * day,
      paymentConfirmedAt: now - 5 * day,
      paymentConfirmedBy: 'organizador@megacorn.demo',
      refundStatus: 'none',
      refundQuotas: 0,
      refundAmount: 0,
      refundCompletedAt: null,
      refundCompletedBy: null,
      txid: 'MEGACORN26MOD001',
      inviteCodeUsed: 'MEGACORN2026',
      isModerator: true,
      createdAt: now - 6 * day,
      updatedAt: now - 5 * day,
    },
    {
      uid: 'demo_usr_2',
      email: 'lucas.pereira@pessoal.demo',
      displayName: 'Lucas Pereira',
      cpf: '52998224725',
      approvalStatus: 'approved',
      requestedQuotas: 4,
      paidQuotas: 4,
      finalQuotas: null,
      paymentStatus: 'confirmed',
      paymentNote: 'Pago via Nubank',
      paymentReportedAt: now - 4 * day,
      paymentConfirmedAt: now - 4 * day,
      paymentConfirmedBy: 'organizador@megacorn.demo',
      refundStatus: 'none',
      refundQuotas: 0,
      refundAmount: 0,
      refundCompletedAt: null,
      refundCompletedBy: null,
      txid: 'MEGACORN26USR002',
      inviteCodeUsed: 'MEGACORN2026',
      isModerator: false,
      createdAt: now - 5 * day,
      updatedAt: now - 4 * day,
    },
    {
      uid: 'demo_usr_3',
      email: 'camila.rocha@pessoal.demo',
      displayName: 'Camila Rocha',
      cpf: '',
      approvalStatus: 'approved',
      requestedQuotas: 2,
      paidQuotas: 2,
      finalQuotas: null,
      paymentStatus: 'confirmed',
      paymentNote: '',
      paymentReportedAt: now - 3 * day,
      paymentConfirmedAt: now - 3 * day,
      paymentConfirmedBy: 'organizador@megacorn.demo',
      refundStatus: 'none',
      refundQuotas: 0,
      refundAmount: 0,
      refundCompletedAt: null,
      refundCompletedBy: null,
      txid: 'MEGACORN26USR003',
      inviteCodeUsed: 'MEGACORN2026',
      isModerator: false,
      createdAt: now - 4 * day,
      updatedAt: now - 3 * day,
    },
    {
      uid: 'demo_usr_4',
      email: 'rafael.costa@pessoal.demo',
      displayName: 'Rafael Costa',
      cpf: '',
      approvalStatus: 'approved',
      requestedQuotas: 3,
      paidQuotas: 0,
      finalQuotas: null,
      paymentStatus: 'reported',
      paymentNote: 'Enviei PIX às 14:22 pelo Itaú',
      paymentReportedAt: now - day,
      paymentConfirmedAt: null,
      paymentConfirmedBy: null,
      refundStatus: 'none',
      refundQuotas: 0,
      refundAmount: 0,
      refundCompletedAt: null,
      refundCompletedBy: null,
      txid: 'MEGACORN26USR004',
      inviteCodeUsed: 'MEGACORN2026',
      isModerator: false,
      createdAt: now - 3 * day,
      updatedAt: now - day,
    },
    {
      uid: 'demo_usr_5',
      email: 'bia.almeida@pessoal.demo',
      displayName: 'Beatriz Almeida',
      cpf: '',
      approvalStatus: 'approved',
      requestedQuotas: 1,
      paidQuotas: 0,
      finalQuotas: null,
      paymentStatus: 'unpaid',
      paymentNote: '',
      paymentReportedAt: null,
      paymentConfirmedAt: null,
      paymentConfirmedBy: null,
      refundStatus: 'none',
      refundQuotas: 0,
      refundAmount: 0,
      refundCompletedAt: null,
      refundCompletedBy: null,
      txid: 'MEGACORN26USR005',
      inviteCodeUsed: 'MEGACORN2026',
      isModerator: false,
      createdAt: now - 2 * day,
      updatedAt: now - 2 * day,
    },
    {
      uid: 'demo_usr_6',
      email: 'thiago.mendes@pessoal.demo',
      displayName: 'Thiago Mendes',
      cpf: '',
      approvalStatus: 'pending',
      requestedQuotas: 2,
      paidQuotas: 0,
      finalQuotas: null,
      paymentStatus: 'reported',
      paymentNote: 'Já paguei adiantado enquanto aguardo aprovação!',
      paymentReportedAt: now - 3_600_000 * 4,
      paymentConfirmedAt: null,
      paymentConfirmedBy: null,
      refundStatus: 'none',
      refundQuotas: 0,
      refundAmount: 0,
      refundCompletedAt: null,
      refundCompletedBy: null,
      txid: 'MEGACORN26USR006',
      inviteCodeUsed: 'MEGACORN2026',
      isModerator: false,
      createdAt: now - 3_600_000 * 5,
      updatedAt: now - 3_600_000 * 4,
    },
    {
      uid: 'demo_usr_7',
      email: 'julia.nunes@pessoal.demo',
      displayName: 'Júlia Nunes',
      cpf: '',
      approvalStatus: 'pending',
      requestedQuotas: 1,
      paidQuotas: 0,
      finalQuotas: null,
      paymentStatus: 'unpaid',
      paymentNote: '',
      paymentReportedAt: null,
      paymentConfirmedAt: null,
      paymentConfirmedBy: null,
      refundStatus: 'none',
      refundQuotas: 0,
      refundAmount: 0,
      refundCompletedAt: null,
      refundCompletedBy: null,
      txid: 'MEGACORN26USR007',
      inviteCodeUsed: 'MEGACORN2026',
      isModerator: false,
      createdAt: now - 3_600_000 * 2,
      updatedAt: now - 3_600_000 * 2,
    },
  ];

  const usersRecord: Record<string, UserProfile> = {};
  for (const u of seedUsers) {
    usersRecord[u.uid] = u;
  }

  return {
    publicConfig: { ...DEFAULT_PUBLIC_CONFIG },
    paymentConfig: { ...DEFAULT_PAYMENT_CONFIG },
    adminConfig: { ...DEFAULT_ADMIN_CONFIG },
    users: usersRecord,
    games: [
      {
        id: 'game_1',
        label: 'Volante #01 — Espiga Dourada (10 dezenas)',
        numbers: [4, 10, 17, 23, 29, 34, 41, 48, 53, 59],
        notes: 'Aposta principal do MegaCorn — 210 combinações simples',
        createdAt: now - 2 * day,
        createdBy: 'organizador@megacorn.demo',
      },
      {
        id: 'game_2',
        label: 'Volante #02 — Chifre da Sorte (8 dezenas)',
        numbers: [2, 8, 15, 22, 31, 39, 46, 58],
        notes: 'Bolão secundário — 28 combinações simples',
        createdAt: now - day,
        createdBy: 'organizador@megacorn.demo',
      },
      {
        id: 'game_3',
        label: 'Volante #03 — Trevo de Quatro Folhas (7 dezenas)',
        numbers: [5, 12, 19, 27, 36, 44, 55],
        notes: 'Surpresinha do time — 7 combinações simples',
        createdAt: now - 3_600_000 * 6,
        createdBy: 'organizador@megacorn.demo',
      },
    ],
    drawResult: {
      numbers: [],
      updatedAt: null,
      updatedBy: null,
    },
    auditLogs: [
      {
        id: 'log_1',
        action: 'Bolão criado',
        actorEmail: 'organizador@megacorn.demo',
        targetName: 'MegaCorn 2026',
        details: 'Configuração inicial com 100 cotas a R$ 35,00 (máx. 5/pessoa).',
        createdAt: now - 6 * day,
      },
      {
        id: 'log_2',
        action: 'PIX confirmado',
        actorEmail: 'organizador@megacorn.demo',
        targetName: 'Lucas Pereira',
        details: 'Confirmadas 4 cotas (R$ 140,00) — TXID MEGACORN26USR002.',
        createdAt: now - 4 * day,
      },
    ],
  };
}

function loadState(): DemoState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw) as DemoState;
    }
  } catch {
    // ignore
  }
  const seed = createSeedState();
  saveState(seed);
  return seed;
}

function saveState(state: DemoState): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

function loadDemoAuth(): AuthUser | null {
  try {
    const raw = window.localStorage.getItem(AUTH_KEY);
    if (raw) return JSON.parse(raw) as AuthUser;
  } catch {
    // ignore
  }
  return null;
}

function saveDemoAuth(user: AuthUser | null): void {
  try {
    if (user) {
      window.localStorage.setItem(AUTH_KEY, JSON.stringify(user));
      setSessionCookieHint(user.email);
    } else {
      window.localStorage.removeItem(AUTH_KEY);
    }
  } catch {
    // ignore
  }
}

function makeUidFromEmail(email: string, state: DemoState): string {
  const normalized = email.trim().toLowerCase();
  const existing = Object.values(state.users).find(
    (u) => u.email.toLowerCase() === normalized
  );
  if (existing) return existing.uid;
  const slug = normalized.replace(/[^a-z0-9]/g, '').slice(0, 14);
  return `demo_${slug}_${Math.abs(hashString(normalized)) % 10000}`;
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return h;
}

export function createDemoDataService(): DataService {
  const listeners = new Set<(user: AuthUser | null) => void>();

  function notifyAuth(user: AuthUser | null) {
    for (const cb of listeners) {
      cb(user);
    }
  }

  function appendLog(
    state: DemoState,
    action: string,
    actorEmail: string,
    targetName: string,
    details: string
  ) {
    state.auditLogs.unshift({
      id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      action,
      actorEmail,
      targetName,
      details,
      createdAt: Date.now(),
    });
  }

  return {
    isDemoMode: true,

    onAuthChange(cb) {
      listeners.add(cb);
      cb(loadDemoAuth());
      return () => {
        listeners.delete(cb);
      };
    },

    async sendMagicLink(email: string): Promise<void> {
      const clean = email.trim().toLowerCase();
      rememberSignInEmail(clean);
      // Em modo demo, o usuário pode completar com 1 clique no banner de simulação
    },

    async checkMagicLinkReturn(): Promise<SignInLinkCompletionResult> {
      const params = new URLSearchParams(window.location.search);
      if (params.get('demoMagicLink') !== '1') {
        return { status: 'none' };
      }
      const remembered = getRememberedSignInEmail();
      if (!remembered) {
        return {
          status: 'needs_email',
          message: 'Confirme o e-mail usado para concluir o Magic Link.',
        };
      }
      return this.completeMagicLinkWithEmail(remembered);
    },

    async completeMagicLinkWithEmail(
      email: string
    ): Promise<SignInLinkCompletionResult> {
      const state = loadState();
      const clean = email.trim().toLowerCase();
      const uid = makeUidFromEmail(clean, state);
      const authUser: AuthUser = { uid, email: clean };
      saveDemoAuth(authUser);
      clearRememberedSignInEmail();

      // Limpa query string se houver
      if (window.location.search) {
        window.history.replaceState(
          {},
          document.title,
          `${window.location.pathname}${window.location.hash}`
        );
      }

      notifyAuth(authUser);
      return { status: 'completed' };
    },

    async demoQuickSignIn(email: string): Promise<void> {
      await this.completeMagicLinkWithEmail(email);
    },

    async demoResetData(): Promise<void> {
      const seed = createSeedState();
      saveState(seed);
    },

    async signOut(): Promise<void> {
      saveDemoAuth(null);
      clearAllSessionArtifacts();
      notifyAuth(null);
    },

    async getPublicConfig() {
      return loadState().publicConfig;
    },

    async getPaymentConfig() {
      return loadState().paymentConfig;
    },

    async getAdminConfig() {
      return loadState().adminConfig;
    },

    async getUserProfile(uid: string) {
      const state = loadState();
      return state.users[uid] ?? null;
    },

    async getAllUsers() {
      const state = loadState();
      return Object.values(state.users).sort((a, b) => a.createdAt - b.createdAt);
    },

    async getBoardEntries(): Promise<BoardEntry[]> {
      const state = loadState();
      return Object.values(state.users)
        .filter((u) => u.approvalStatus === 'approved')
        .sort((a, b) => a.createdAt - b.createdAt)
        .map((u) => ({
          uid: u.uid,
          displayName: u.displayName,
          requestedQuotas: u.requestedQuotas,
          paidQuotas: u.paidQuotas,
          finalQuotas: u.finalQuotas,
          paymentStatus: u.paymentStatus,
          refundStatus: u.refundStatus,
          refundQuotas: u.refundQuotas,
          createdAt: u.createdAt,
        }));
    },

    async getPoolStats(): Promise<PoolStats> {
      const users = Object.values(loadState().users);
      return {
        pendingApprovalCount: users.filter((u) => u.approvalStatus === 'pending')
          .length,
        approvedCount: users.filter((u) => u.approvalStatus === 'approved').length,
      };
    },

    async getGames() {
      return loadState().games;
    },

    async getDrawResult() {
      return loadState().drawResult;
    },

    async getAuditLogs() {
      return loadState().auditLogs;
    },

    async validateInviteCode(code: string) {
      const state = loadState();
      return (
        code.trim().toUpperCase() ===
        state.adminConfig.activeInviteCode.trim().toUpperCase()
      );
    },

    async registerParticipant(input) {
      const state = loadState();
      if (!state.publicConfig.flags.registrationsOpen) {
        throw new Error('Novas inscrições estão desabilitadas no momento.');
      }
      const valid = await this.validateInviteCode(input.inviteCode);
      if (!valid) {
        throw new Error('Código de convite inválido.');
      }

      const maxPerPerson = state.publicConfig.maxQuotasPerPerson;
      const clampedQuotas = Math.max(
        1,
        Math.min(maxPerPerson, Math.floor(input.requestedQuotas))
      );
      const isMod = state.adminConfig.moderatorEmails
        .map((e) => e.toLowerCase())
        .includes(input.email.toLowerCase());

      const now = Date.now();
      const profile: UserProfile = {
        uid: input.uid,
        email: input.email.trim().toLowerCase(),
        displayName: input.displayName.trim(),
        cpf: sanitizeCpf(input.cpf),
        approvalStatus: isMod ? 'approved' : 'pending',
        requestedQuotas: clampedQuotas,
        paidQuotas: 0,
        finalQuotas: null,
        paymentStatus: 'unpaid',
        paymentNote: '',
        paymentReportedAt: null,
        paymentConfirmedAt: null,
        paymentConfirmedBy: null,
        refundStatus: 'none',
        refundQuotas: 0,
        refundAmount: 0,
        refundCompletedAt: null,
        refundCompletedBy: null,
        txid: generateParticipantTxid(state.publicConfig.edition, input.uid),
        inviteCodeUsed: input.inviteCode.trim().toUpperCase(),
        isModerator: isMod,
        createdAt: now,
        updatedAt: now,
      };

      state.users[input.uid] = profile;
      saveState(state);
      return profile;
    },

    async updateOwnProfile(uid, updates) {
      const state = loadState();
      const user = state.users[uid];
      if (!user) throw new Error('Perfil não encontrado.');

      if (typeof updates.displayName === 'string' && updates.displayName.trim()) {
        user.displayName = updates.displayName.trim();
      }
      if (typeof updates.cpf === 'string') {
        user.cpf = sanitizeCpf(updates.cpf);
      }
      if (
        typeof updates.requestedQuotas === 'number' &&
        updates.requestedQuotas !== user.requestedQuotas
      ) {
        if (!state.publicConfig.flags.quotaEditsOpen) {
          throw new Error('Alteração de cotas está desabilitada pelos administradores.');
        }
        if (user.paymentStatus !== 'unpaid') {
          throw new Error(
            'Após informar ou confirmar o PIX, peça a um moderador para alterar suas cotas.'
          );
        }
        user.requestedQuotas = Math.max(
          1,
          Math.min(
            state.publicConfig.maxQuotasPerPerson,
            Math.floor(updates.requestedQuotas)
          )
        );
      }
      user.updatedAt = Date.now();
      saveState(state);
      return user;
    },

    async reportOwnPixPayment(uid, note) {
      const state = loadState();
      if (!state.publicConfig.flags.pixPaymentOpen) {
        throw new Error('O envio de aviso de PIX está desabilitado no momento.');
      }
      const user = state.users[uid];
      if (!user) throw new Error('Perfil não encontrado.');
      user.paymentStatus = 'reported';
      user.paymentNote = note.trim();
      user.paymentReportedAt = Date.now();
      user.updatedAt = Date.now();
      saveState(state);
      return user;
    },

    async approveParticipant(uid, actorEmail) {
      const state = loadState();
      const user = state.users[uid];
      if (!user) return;
      user.approvalStatus = 'approved';
      user.updatedAt = Date.now();
      appendLog(
        state,
        'Participante aprovado',
        actorEmail,
        user.displayName,
        `Cadastro aprovado (${user.requestedQuotas} cota(s)).`
      );
      saveState(state);
    },

    async rejectParticipant(uid, actorEmail, reason = '') {
      const state = loadState();
      const user = state.users[uid];
      if (!user) return;
      user.approvalStatus = 'rejected';
      if (user.paidQuotas > 0) {
        user.finalQuotas = 0;
        user.refundQuotas = user.paidQuotas;
        user.refundAmount = Number(
          (user.paidQuotas * state.publicConfig.quotaPrice).toFixed(2)
        );
        user.refundStatus = 'pending';
      }
      user.updatedAt = Date.now();
      appendLog(
        state,
        'Participante recusado',
        actorEmail,
        user.displayName,
        reason
          ? `Motivo: ${reason}${user.refundAmount > 0 ? ` | Estorno pendente: R$ ${user.refundAmount.toFixed(2)}` : ''}`
          : user.refundAmount > 0
            ? `Estorno integral pendente: R$ ${user.refundAmount.toFixed(2)}`
            : 'Inscrição recusada.'
      );
      saveState(state);
    },

    async cancelParticipant(uid, actorEmail, reason = '') {
      const state = loadState();
      const user = state.users[uid];
      if (!user) return;
      user.approvalStatus = 'cancelled';
      if (user.paidQuotas > 0) {
        user.finalQuotas = 0;
        user.refundQuotas = user.paidQuotas;
        user.refundAmount = Number(
          (user.paidQuotas * state.publicConfig.quotaPrice).toFixed(2)
        );
        user.refundStatus = 'pending';
      }
      user.updatedAt = Date.now();
      appendLog(
        state,
        'Participação cancelada',
        actorEmail,
        user.displayName,
        `${reason || 'Cancelado pelo moderador'}${user.refundAmount > 0 ? ` | Estorno pendente: R$ ${user.refundAmount.toFixed(2)}` : ''}`
      );
      saveState(state);
    },

    async confirmPixPayment(uid, paidQuotas, actorEmail) {
      const state = loadState();
      const user = state.users[uid];
      if (!user) return;
      const safePaid = Math.max(1, Math.floor(paidQuotas));
      user.paymentStatus = 'confirmed';
      user.paidQuotas = safePaid;
      user.paymentConfirmedAt = Date.now();
      user.paymentConfirmedBy = actorEmail;
      if (
        user.approvalStatus === 'rejected' ||
        user.approvalStatus === 'cancelled'
      ) {
        user.refundQuotas = safePaid;
        user.refundAmount = Number(
          (safePaid * state.publicConfig.quotaPrice).toFixed(2)
        );
        user.refundStatus = 'pending';
      }
      user.updatedAt = Date.now();
      appendLog(
        state,
        'PIX confirmado',
        actorEmail,
        user.displayName,
        `Confirmado pagamento de ${safePaid} cota(s) (R$ ${(safePaid * state.publicConfig.quotaPrice).toFixed(2)}) — TXID ${user.txid}.`
      );
      saveState(state);
    },

    async markRefundCompleted(uid, actorEmail) {
      const state = loadState();
      const user = state.users[uid];
      if (!user) return;
      user.refundStatus = 'completed';
      user.refundCompletedAt = Date.now();
      user.refundCompletedBy = actorEmail;
      user.updatedAt = Date.now();
      appendLog(
        state,
        'Estorno concluído',
        actorEmail,
        user.displayName,
        `Devolução confirmada de ${user.refundQuotas} cota(s) (R$ ${user.refundAmount.toFixed(2)}).`
      );
      saveState(state);
    },

    async updateParticipantQuotasAsAdmin(uid, requestedQuotas, actorEmail) {
      const state = loadState();
      const user = state.users[uid];
      if (!user) return;
      const oldVal = user.requestedQuotas;
      user.requestedQuotas = Math.max(
        1,
        Math.min(state.publicConfig.maxQuotasPerPerson, Math.floor(requestedQuotas))
      );
      user.updatedAt = Date.now();
      appendLog(
        state,
        'Cotas ajustadas',
        actorEmail,
        user.displayName,
        `Alterado de ${oldVal} para ${user.requestedQuotas} cota(s).`
      );
      saveState(state);
    },

    async toggleModeratorRole(uid, isModerator, actorEmail) {
      const state = loadState();
      const user = state.users[uid];
      if (!user) return;
      user.isModerator = isModerator;
      user.updatedAt = Date.now();
      appendLog(
        state,
        isModerator ? 'Moderador promovido' : 'Moderador removido',
        actorEmail,
        user.displayName,
        `Permissão de moderador definida como ${isModerator ? 'ativa' : 'inativa'}.`
      );
      saveState(state);
    },

    async updatePublicConfig(config, actorEmail) {
      const state = loadState();
      state.publicConfig = config;
      appendLog(
        state,
        'Configurações/Etapas atualizadas',
        actorEmail,
        config.poolName,
        `Inscrições: ${config.flags.registrationsOpen ? 'ON' : 'OFF'} | Edição: ${config.flags.quotaEditsOpen ? 'ON' : 'OFF'} | PIX: ${config.flags.pixPaymentOpen ? 'ON' : 'OFF'} | Placar: ${config.flags.boardVisible ? 'ON' : 'OFF'} | Jogos: ${config.flags.gamesVisible ? 'ON' : 'OFF'}.`
      );
      saveState(state);
    },

    async updatePaymentConfig(config, actorEmail) {
      const state = loadState();
      state.paymentConfig = config;
      appendLog(
        state,
        'Dados de PIX atualizados',
        actorEmail,
        config.merchantName,
        `Recebedor atualizado (${config.merchantCity}).`
      );
      saveState(state);
    },

    async updateAdminConfig(config, actorEmail) {
      const state = loadState();
      state.adminConfig = config;
      appendLog(
        state,
        'Integrações/Convite atualizados',
        actorEmail,
        'Admin Config',
        `Código de convite e configurações de e-mail atualizados.`
      );
      saveState(state);
    },

    async closePoolAndComputeRefunds(actorEmail) {
      const state = loadState();
      const paidApproved = Object.values(state.users).filter(
        (u) =>
          u.approvalStatus === 'approved' &&
          u.paymentStatus === 'confirmed' &&
          u.paidQuotas > 0
      );

      const { equity, refunds, totalRefundAmount } = calculateRefundsOnClose(
        paidApproved.map((u) => ({
          uid: u.uid,
          displayName: u.displayName,
          paidQuotas: u.paidQuotas,
          createdAt: u.createdAt,
        })),
        state.publicConfig.totalQuotas,
        state.publicConfig.quotaPrice
      );

      for (const u of Object.values(state.users)) {
        if (
          u.approvalStatus === 'approved' &&
          u.paymentStatus === 'confirmed' &&
          u.paidQuotas > 0
        ) {
          const alloc = equity.allocations.get(u.uid);
          const finalQ = alloc?.allocatedQuotas ?? 0;
          const refQ = Math.max(0, u.paidQuotas - finalQ);
          u.finalQuotas = finalQ;
          u.refundQuotas = refQ;
          u.refundAmount = Number(
            (refQ * state.publicConfig.quotaPrice).toFixed(2)
          );
          if (refQ > 0 && u.refundStatus !== 'completed') {
            u.refundStatus = 'pending';
          } else if (refQ === 0) {
            u.refundStatus = 'none';
          }
        } else if (u.approvalStatus === 'approved') {
          u.finalQuotas = 0;
        }
        u.updatedAt = Date.now();
      }

      state.publicConfig.flags.poolClosed = true;
      state.publicConfig.flags.registrationsOpen = false;
      state.publicConfig.flags.quotaEditsOpen = false;

      appendLog(
        state,
        'Bolão fechado (Rateio congelado)',
        actorEmail,
        state.publicConfig.poolName,
        `${equity.totalAllocated} cotas finais alocadas | ${refunds.length} estorno(s) pendente(s) totalizando R$ ${totalRefundAmount.toFixed(2)}.`
      );
      saveState(state);

      return {
        totalAllocated: equity.totalAllocated,
        refundCount: refunds.length,
        totalRefundAmount,
      };
    },

    async reopenPool(actorEmail) {
      const state = loadState();
      state.publicConfig.flags.poolClosed = false;
      for (const u of Object.values(state.users)) {
        if (u.approvalStatus === 'approved') {
          u.finalQuotas = null;
          if (u.refundStatus === 'pending') {
            u.refundStatus = 'none';
            u.refundQuotas = 0;
            u.refundAmount = 0;
          }
        }
      }
      appendLog(
        state,
        'Bolão reaberto',
        actorEmail,
        state.publicConfig.poolName,
        'Rateio final descongelado pelos moderadores.'
      );
      saveState(state);
    },

    async purgeAllCpfs(actorEmail) {
      const state = loadState();
      let count = 0;
      for (const u of Object.values(state.users)) {
        if (u.cpf) {
          u.cpf = '';
          u.updatedAt = Date.now();
          count++;
        }
      }
      appendLog(
        state,
        'Limpeza LGPD de CPFs',
        actorEmail,
        'Base de participantes',
        `${count} CPF(s) removidos permanentemente.`
      );
      saveState(state);
      return count;
    },

    async addGame(game, actorEmail) {
      const state = loadState();
      const entry: LotteryGame = {
        id: `game_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        label: game.label.trim(),
        numbers: [...game.numbers].sort((a, b) => a - b),
        notes: game.notes.trim(),
        createdAt: Date.now(),
        createdBy: actorEmail,
      };
      state.games.push(entry);
      appendLog(
        state,
        'Jogo adicionado',
        actorEmail,
        entry.label,
        `${entry.numbers.length} dezenas: ${entry.numbers.map((n) => String(n).padStart(2, '0')).join('-')}`
      );
      saveState(state);
      return entry;
    },

    async deleteGame(gameId, actorEmail) {
      const state = loadState();
      const target = state.games.find((g) => g.id === gameId);
      state.games = state.games.filter((g) => g.id !== gameId);
      appendLog(
        state,
        'Jogo removido',
        actorEmail,
        target?.label || gameId,
        'Volante excluído da lista oficial.'
      );
      saveState(state);
    },

    async saveDrawResult(numbers, actorEmail) {
      const state = loadState();
      const sorted = [...numbers].sort((a, b) => a - b);
      state.drawResult = {
        numbers: sorted,
        updatedAt: Date.now(),
        updatedBy: actorEmail,
      };
      appendLog(
        state,
        'Resultado do sorteio salvo',
        actorEmail,
        'Mega da Virada',
        sorted.length > 0
          ? `Dezenas sorteadas: ${sorted.map((n) => String(n).padStart(2, '0')).join(' - ')}`
          : 'Dezenas sorteadas limpas.'
      );
      saveState(state);
      return state.drawResult;
    },

    async recordAuditEvent(action, actorEmail, targetName, details) {
      const state = loadState();
      appendLog(state, action, actorEmail, targetName, details);
      saveState(state);
    },
  };
}
