import {
  isSignInWithEmailLink,
  onAuthStateChanged,
  sendSignInLinkToEmail,
  signInWithEmailLink,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  orderBy,
  query,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { sanitizeCpf } from '../lib/cpf';
import { calculateRefundsOnClose } from '../lib/equity';
import { canManageTickets } from '../lib/phases';
import { generateParticipantTxid } from '../lib/pix';
import {
  buildMagicLinkReturnUrl,
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
  type DataService,
  type SignInLinkCompletionResult,
} from './dataService';
import { firebaseAuth, firebaseDb } from './firebase';

function requireFirebase() {
  if (!firebaseAuth || !firebaseDb) {
    throw new Error('Firebase não inicializado.');
  }
  return { auth: firebaseAuth, db: firebaseDb };
}

function normalizeUserProfile(raw: UserProfile): UserProfile {
  return {
    ...raw,
    assignedTicketNumbers: raw.assignedTicketNumbers ?? '',
    receiptDelivered: Boolean(raw.receiptDelivered),
    receiptDeliveredAt: raw.receiptDeliveredAt ?? null,
    receiptDeliveredBy: raw.receiptDeliveredBy ?? null,
  };
}

function normalizeBoardEntry(raw: BoardEntry): BoardEntry {
  return {
    ...raw,
    assignedTicketNumbers: raw.assignedTicketNumbers ?? '',
    receiptDelivered: Boolean(raw.receiptDelivered),
  };
}

function toBoardEntry(user: UserProfile): BoardEntry {
  return {
    uid: user.uid,
    displayName: user.displayName,
    requestedQuotas: user.requestedQuotas,
    paidQuotas: user.paidQuotas,
    finalQuotas: user.finalQuotas,
    paymentStatus: user.paymentStatus,
    refundStatus: user.refundStatus,
    refundQuotas: user.refundQuotas,
    assignedTicketNumbers: user.assignedTicketNumbers ?? '',
    receiptDelivered: Boolean(user.receiptDelivered),
    createdAt: user.createdAt,
  };
}

export function createFirebaseDataService(): DataService {
  const { auth, db } = requireFirebase();

  async function logAudit(
    action: string,
    actorEmail: string,
    targetName: string,
    details: string
  ) {
    await addDoc(collection(db, 'auditLog'), {
      action,
      actorEmail,
      targetName,
      details,
      createdAt: Date.now(),
    });
  }

  return {
    isDemoMode: false,

    onAuthChange(cb) {
      return onAuthStateChanged(auth, (fbUser) => {
        if (fbUser && fbUser.email) {
          setSessionCookieHint(fbUser.email);
          cb({ uid: fbUser.uid, email: fbUser.email });
        } else {
          cb(null);
        }
      });
    },

    async sendMagicLink(email: string, redirectPath = '/minha-cota') {
      const clean = email.trim().toLowerCase();
      const actionCodeSettings = {
        url: buildMagicLinkReturnUrl(redirectPath),
        handleCodeInApp: true,
      };
      await sendSignInLinkToEmail(auth, clean, actionCodeSettings);
      rememberSignInEmail(clean);
    },

    async checkMagicLinkReturn(): Promise<SignInLinkCompletionResult> {
      const href = window.location.href;
      if (!isSignInWithEmailLink(auth, href)) {
        return { status: 'none' };
      }

      const remembered = getRememberedSignInEmail();
      if (!remembered) {
        return {
          status: 'needs_email',
          message:
            'Você abriu o link em outro dispositivo ou navegador. Confirme seu e-mail para concluir o acesso.',
        };
      }

      return this.completeMagicLinkWithEmail(remembered);
    },

    async completeMagicLinkWithEmail(
      email: string
    ): Promise<SignInLinkCompletionResult> {
      const clean = email.trim().toLowerCase();
      try {
        await signInWithEmailLink(auth, clean, window.location.href);
        clearRememberedSignInEmail();
        setSessionCookieHint(clean);

        // Remove query params sensíveis do Magic Link da barra de endereço
        window.history.replaceState(
          {},
          document.title,
          `${window.location.pathname}${window.location.hash}`
        );

        return { status: 'completed' };
      } catch (err) {
        const code =
          typeof err === 'object' && err !== null && 'code' in err
            ? String((err as { code: unknown }).code)
            : 'unknown';
        let message =
          'Não foi possível validar o Magic Link. Solicite um novo link.';
        if (
          code === 'auth/invalid-action-code' ||
          code === 'auth/expired-action-code'
        ) {
          message =
            'Este link de acesso expirou ou já foi utilizado (alguns provedores de e-mail pré-carregam links automaticamente). Solicite um novo link abaixo.';
        } else if (code === 'auth/invalid-email') {
          message = 'O e-mail informado não corresponde ao link recebido.';
        }
        return { status: 'error', message, errorCode: code };
      }
    },

    async signOut() {
      await firebaseSignOut(auth);
      clearAllSessionArtifacts();
    },

    async getPublicConfig(): Promise<PublicConfig> {
      const snap = await getDoc(doc(db, 'config', 'public'));
      if (!snap.exists()) return { ...DEFAULT_PUBLIC_CONFIG };
      const data = snap.data() as Partial<PublicConfig>;
      return {
        ...DEFAULT_PUBLIC_CONFIG,
        ...data,
        flags: {
          ...DEFAULT_PUBLIC_CONFIG.flags,
          ...(data.flags || {}),
        },
      };
    },

    async getPaymentConfig(): Promise<PaymentConfig | null> {
      try {
        const snap = await getDoc(doc(db, 'config', 'payment'));
        if (!snap.exists()) return { ...DEFAULT_PAYMENT_CONFIG };
        return {
          ...DEFAULT_PAYMENT_CONFIG,
          ...(snap.data() as Partial<PaymentConfig>),
        };
      } catch {
        return null;
      }
    },

    async getAdminConfig(): Promise<AdminConfig | null> {
      try {
        const snap = await getDoc(doc(db, 'config', 'admin'));
        if (!snap.exists()) return { ...DEFAULT_ADMIN_CONFIG };
        return {
          ...DEFAULT_ADMIN_CONFIG,
          ...(snap.data() as Partial<AdminConfig>),
        };
      } catch {
        return null;
      }
    },

    async getUserProfile(uid: string): Promise<UserProfile | null> {
      const snap = await getDoc(doc(db, 'users', uid));
      if (!snap.exists()) return null;
      return normalizeUserProfile(snap.data() as UserProfile);
    },

    async getAllUsers(): Promise<UserProfile[]> {
      const snap = await getDocs(
        query(collection(db, 'users'), orderBy('createdAt', 'asc'))
      );
      return snap.docs.map((d) => normalizeUserProfile(d.data() as UserProfile));
    },

    async getBoardEntries(): Promise<BoardEntry[]> {
      try {
        const snap = await getDocs(
          query(collection(db, 'board'), orderBy('createdAt', 'asc'))
        );
        return snap.docs.map((d) => normalizeBoardEntry(d.data() as BoardEntry));
      } catch {
        return [];
      }
    },

    async getPoolStats(): Promise<PoolStats> {
      try {
        const snap = await getDoc(doc(db, 'stats', 'summary'));
        if (!snap.exists()) {
          return { pendingApprovalCount: 0, approvedCount: 0 };
        }
        const data = snap.data() as Partial<PoolStats>;
        return {
          pendingApprovalCount: data.pendingApprovalCount ?? 0,
          approvedCount: data.approvedCount ?? 0,
        };
      } catch {
        return { pendingApprovalCount: 0, approvedCount: 0 };
      }
    },

    async getGames(): Promise<LotteryGame[]> {
      try {
        const snap = await getDocs(
          query(collection(db, 'games'), orderBy('createdAt', 'asc'))
        );
        return snap.docs.map((d) => ({
          ...(d.data() as Omit<LotteryGame, 'id'>),
          id: d.id,
        }));
      } catch {
        return [];
      }
    },

    async getDrawResult(): Promise<DrawResult> {
      try {
        const snap = await getDoc(doc(db, 'drawResult', 'current'));
        if (!snap.exists()) {
          return { numbers: [], updatedAt: null, updatedBy: null };
        }
        return snap.data() as DrawResult;
      } catch {
        return { numbers: [], updatedAt: null, updatedBy: null };
      }
    },

    async getAuditLogs(): Promise<AuditLogEntry[]> {
      try {
        const snap = await getDocs(
          query(collection(db, 'auditLog'), orderBy('createdAt', 'desc'))
        );
        return snap.docs.map((d) => ({
          ...(d.data() as Omit<AuditLogEntry, 'id'>),
          id: d.id,
        }));
      } catch {
        return [];
      }
    },

    async validateInviteCode(code: string): Promise<boolean> {
      const normalized = code.trim().toUpperCase();
      if (!normalized) return false;
      try {
        const snap = await getDoc(doc(db, 'inviteCodes', normalized));
        return snap.exists() && snap.data()?.active === true;
      } catch {
        return false;
      }
    },

    async registerParticipant(input): Promise<UserProfile> {
      const pub = await this.getPublicConfig();
      if (!pub.flags.registrationsOpen) {
        throw new Error('Novas inscrições estão desabilitadas no momento.');
      }

      const normalizedCode = input.inviteCode.trim().toUpperCase();
      const valid = await this.validateInviteCode(normalizedCode);
      if (!valid) {
        throw new Error('Código de convite inválido.');
      }

      const clampedQuotas = Math.max(
        1,
        Math.min(pub.maxQuotasPerPerson, Math.floor(input.requestedQuotas))
      );
      const now = Date.now();
      const profile: UserProfile = {
        uid: input.uid,
        email: input.email.trim().toLowerCase(),
        displayName: input.displayName.trim(),
        cpf: sanitizeCpf(input.cpf),
        approvalStatus: 'pending',
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
        assignedTicketNumbers: '',
        receiptDelivered: false,
        receiptDeliveredAt: null,
        receiptDeliveredBy: null,
        txid: generateParticipantTxid(pub.edition, input.uid),
        inviteCodeUsed: normalizedCode,
        isModerator: false,
        createdAt: now,
        updatedAt: now,
      };

      const batch = writeBatch(db);
      batch.set(doc(db, 'users', input.uid), profile);
      batch.set(
        doc(db, 'stats', 'summary'),
        { pendingApprovalCount: increment(1) },
        { merge: true }
      );
      await batch.commit();
      return profile;
    },

    async updateOwnProfile(uid, updates): Promise<UserProfile> {
      const current = await this.getUserProfile(uid);
      if (!current) throw new Error('Perfil não encontrado.');
      const pub = await this.getPublicConfig();

      const next: UserProfile = { ...current, updatedAt: Date.now() };
      if (typeof updates.displayName === 'string' && updates.displayName.trim()) {
        next.displayName = updates.displayName.trim();
      }
      if (typeof updates.cpf === 'string') {
        next.cpf = sanitizeCpf(updates.cpf);
      }
      if (
        typeof updates.requestedQuotas === 'number' &&
        updates.requestedQuotas !== current.requestedQuotas
      ) {
        if (!pub.flags.quotaEditsOpen) {
          throw new Error('Alteração de cotas está desabilitada.');
        }
        if (current.paymentStatus !== 'unpaid') {
          throw new Error(
            'Após informar ou confirmar o PIX, peça a um moderador para alterar suas cotas.'
          );
        }
        next.requestedQuotas = Math.max(
          1,
          Math.min(pub.maxQuotasPerPerson, Math.floor(updates.requestedQuotas))
        );
      }

      const batch = writeBatch(db);
      batch.set(doc(db, 'users', uid), next);
      if (next.approvalStatus === 'approved') {
        batch.set(doc(db, 'board', uid), toBoardEntry(next));
      }
      await batch.commit();
      return next;
    },

    async reportOwnPixPayment(uid, note): Promise<UserProfile> {
      const pub = await this.getPublicConfig();
      if (!pub.flags.pixPaymentOpen) {
        throw new Error('Aviso de pagamento PIX está desabilitado no momento.');
      }
      const current = await this.getUserProfile(uid);
      if (!current) throw new Error('Perfil não encontrado.');

      const now = Date.now();
      const next: UserProfile = {
        ...current,
        paymentStatus: 'reported',
        paymentNote: note.trim(),
        paymentReportedAt: now,
        updatedAt: now,
      };

      const batch = writeBatch(db);
      batch.set(doc(db, 'users', uid), next);
      if (next.approvalStatus === 'approved') {
        batch.set(doc(db, 'board', uid), toBoardEntry(next));
      }
      await batch.commit();
      return next;
    },

    async approveParticipant(uid, actorEmail) {
      const user = await this.getUserProfile(uid);
      if (!user) return;
      const wasPending = user.approvalStatus === 'pending';
      const next: UserProfile = {
        ...user,
        approvalStatus: 'approved',
        updatedAt: Date.now(),
      };

      const batch = writeBatch(db);
      batch.set(doc(db, 'users', uid), next);
      batch.set(doc(db, 'board', uid), toBoardEntry(next));
      batch.set(
        doc(db, 'stats', 'summary'),
        {
          approvedCount: increment(1),
          ...(wasPending ? { pendingApprovalCount: increment(-1) } : {}),
        },
        { merge: true }
      );
      await batch.commit();
      await logAudit(
        'Participante aprovado',
        actorEmail,
        next.displayName,
        `Cadastro aprovado (${next.requestedQuotas} cota(s)).`
      );
    },

    async rejectParticipant(uid, actorEmail, reason = '') {
      const user = await this.getUserProfile(uid);
      if (!user) return;
      const pub = await this.getPublicConfig();
      const wasPending = user.approvalStatus === 'pending';
      const wasApproved = user.approvalStatus === 'approved';

      const refundQuotas = user.paidQuotas > 0 ? user.paidQuotas : 0;
      const refundAmount = Number((refundQuotas * pub.quotaPrice).toFixed(2));
      const next: UserProfile = {
        ...user,
        approvalStatus: 'rejected',
        finalQuotas: refundQuotas > 0 ? 0 : user.finalQuotas,
        refundQuotas,
        refundAmount,
        refundStatus: refundQuotas > 0 ? 'pending' : user.refundStatus,
        updatedAt: Date.now(),
      };

      const batch = writeBatch(db);
      batch.set(doc(db, 'users', uid), next);
      if (wasApproved) {
        batch.delete(doc(db, 'board', uid));
      }
      batch.set(
        doc(db, 'stats', 'summary'),
        {
          ...(wasPending ? { pendingApprovalCount: increment(-1) } : {}),
          ...(wasApproved ? { approvedCount: increment(-1) } : {}),
        },
        { merge: true }
      );
      await batch.commit();
      await logAudit(
        'Participante recusado',
        actorEmail,
        next.displayName,
        `${reason || 'Inscrição recusada'}${refundAmount > 0 ? ` | Estorno pendente: R$ ${refundAmount.toFixed(2)}` : ''}`
      );
    },

    async cancelParticipant(uid, actorEmail, reason = '') {
      const user = await this.getUserProfile(uid);
      if (!user) return;
      const pub = await this.getPublicConfig();
      const wasPending = user.approvalStatus === 'pending';
      const wasApproved = user.approvalStatus === 'approved';

      const refundQuotas = user.paidQuotas > 0 ? user.paidQuotas : 0;
      const refundAmount = Number((refundQuotas * pub.quotaPrice).toFixed(2));
      const next: UserProfile = {
        ...user,
        approvalStatus: 'cancelled',
        finalQuotas: refundQuotas > 0 ? 0 : user.finalQuotas,
        refundQuotas,
        refundAmount,
        refundStatus: refundQuotas > 0 ? 'pending' : user.refundStatus,
        updatedAt: Date.now(),
      };

      const batch = writeBatch(db);
      batch.set(doc(db, 'users', uid), next);
      if (wasApproved) {
        batch.delete(doc(db, 'board', uid));
      }
      batch.set(
        doc(db, 'stats', 'summary'),
        {
          ...(wasPending ? { pendingApprovalCount: increment(-1) } : {}),
          ...(wasApproved ? { approvedCount: increment(-1) } : {}),
        },
        { merge: true }
      );
      await batch.commit();
      await logAudit(
        'Participação cancelada',
        actorEmail,
        next.displayName,
        `${reason || 'Cancelado pelo moderador'}${refundAmount > 0 ? ` | Estorno pendente: R$ ${refundAmount.toFixed(2)}` : ''}`
      );
    },

    async confirmPixPayment(uid, paidQuotas, actorEmail) {
      const user = await this.getUserProfile(uid);
      if (!user) return;
      const pub = await this.getPublicConfig();
      const safePaid = Math.max(1, Math.floor(paidQuotas));
      const needsImmediateRefund =
        user.approvalStatus === 'rejected' ||
        user.approvalStatus === 'cancelled';

      const next: UserProfile = {
        ...user,
        paymentStatus: 'confirmed',
        paidQuotas: safePaid,
        paymentConfirmedAt: Date.now(),
        paymentConfirmedBy: actorEmail,
        ...(needsImmediateRefund
          ? {
              refundQuotas: safePaid,
              refundAmount: Number((safePaid * pub.quotaPrice).toFixed(2)),
              refundStatus: 'pending' as const,
            }
          : {}),
        updatedAt: Date.now(),
      };

      const batch = writeBatch(db);
      batch.set(doc(db, 'users', uid), next);
      if (next.approvalStatus === 'approved') {
        batch.set(doc(db, 'board', uid), toBoardEntry(next));
      }
      await batch.commit();
      await logAudit(
        'PIX confirmado',
        actorEmail,
        next.displayName,
        `Confirmado pagamento de ${safePaid} cota(s) (R$ ${(safePaid * pub.quotaPrice).toFixed(2)}) — TXID ${next.txid}.`
      );
    },

    async markRefundCompleted(uid, actorEmail) {
      const user = await this.getUserProfile(uid);
      if (!user) return;
      const next: UserProfile = {
        ...user,
        refundStatus: 'completed',
        refundCompletedAt: Date.now(),
        refundCompletedBy: actorEmail,
        updatedAt: Date.now(),
      };

      const batch = writeBatch(db);
      batch.set(doc(db, 'users', uid), next);
      if (next.approvalStatus === 'approved') {
        batch.set(doc(db, 'board', uid), toBoardEntry(next));
      }
      await batch.commit();
      await logAudit(
        'Estorno concluído',
        actorEmail,
        next.displayName,
        `Devolução de ${next.refundQuotas} cota(s) (R$ ${next.refundAmount.toFixed(2)}) confirmada.`
      );
    },

    async cancelRefund(uid, actorEmail) {
      const user = await this.getUserProfile(uid);
      if (!user || user.refundStatus === 'none') return;
      const prevStatus = user.refundStatus;
      const prevQuotas = user.refundQuotas;
      const prevAmount = user.refundAmount;
      const next: UserProfile = {
        ...user,
        refundStatus: 'none',
        refundQuotas: 0,
        refundAmount: 0,
        refundCompletedAt: null,
        refundCompletedBy: null,
        updatedAt: Date.now(),
      };

      const batch = writeBatch(db);
      batch.set(doc(db, 'users', uid), next);
      if (next.approvalStatus === 'approved') {
        batch.set(doc(db, 'board', uid), toBoardEntry(next));
      }
      await batch.commit();
      await logAudit(
        'Estorno cancelado',
        actorEmail,
        next.displayName,
        `Estorno (${prevStatus === 'completed' ? 'concluído' : 'pendente'}) de ${prevQuotas} cota(s) (R$ ${prevAmount.toFixed(2)}) cancelado pelo moderador.`
      );
    },

    async updateParticipantQuotasAsAdmin(uid, requestedQuotas, actorEmail) {
      const user = await this.getUserProfile(uid);
      if (!user) return;
      const pub = await this.getPublicConfig();
      const oldVal = user.requestedQuotas;
      const next: UserProfile = {
        ...user,
        requestedQuotas: Math.max(
          1,
          Math.min(pub.maxQuotasPerPerson, Math.floor(requestedQuotas))
        ),
        updatedAt: Date.now(),
      };

      const batch = writeBatch(db);
      batch.set(doc(db, 'users', uid), next);
      if (next.approvalStatus === 'approved') {
        batch.set(doc(db, 'board', uid), toBoardEntry(next));
      }
      await batch.commit();
      await logAudit(
        'Cotas ajustadas',
        actorEmail,
        next.displayName,
        `Alterado de ${oldVal} para ${next.requestedQuotas} cota(s).`
      );
    },

    async updateParticipantTicketInfo(uid, input, actorEmail) {
      const pub = await this.getPublicConfig();
      if (!canManageTickets(pub.currentPhase)) {
        throw new Error(
          'Só é possível assinalar cotas do bilhete e marcar entrega em mãos após avançar a timeline para "Aposta feita".'
        );
      }
      const user = await this.getUserProfile(uid);
      if (!user) return;
      const details: string[] = [];
      const next: UserProfile = { ...user, updatedAt: Date.now() };

      if (typeof input.assignedTicketNumbers === 'string') {
        next.assignedTicketNumbers = input.assignedTicketNumbers.trim();
        details.push(
          `Cota(s) bilhete: ${next.assignedTicketNumbers || 'removido'}`
        );
      }
      if (typeof input.receiptDelivered === 'boolean') {
        next.receiptDelivered = input.receiptDelivered;
        next.receiptDeliveredAt = input.receiptDelivered ? Date.now() : null;
        next.receiptDeliveredBy = input.receiptDelivered ? actorEmail : null;
        details.push(
          input.receiptDelivered
            ? 'Comprovante entregue em mãos'
            : 'Entrega em mãos desmarcada'
        );
      }

      const batch = writeBatch(db);
      batch.set(doc(db, 'users', uid), next);
      if (next.approvalStatus === 'approved') {
        batch.set(doc(db, 'board', uid), toBoardEntry(next));
      }
      await batch.commit();
      await logAudit(
        'Bilhete / Entrega atualizado',
        actorEmail,
        next.displayName,
        details.join(' | ') || 'Atualizado'
      );
    },

    async toggleModeratorRole(uid, isModerator, actorEmail) {
      const user = await this.getUserProfile(uid);
      if (!user) return;
      await updateDoc(doc(db, 'users', uid), {
        isModerator,
        updatedAt: Date.now(),
      });
      await logAudit(
        isModerator ? 'Moderador promovido' : 'Moderador removido',
        actorEmail,
        user.displayName,
        `Permissão de moderador: ${isModerator ? 'ativa' : 'inativa'}.`
      );
    },

    async updatePublicConfig(config, actorEmail) {
      await setDoc(doc(db, 'config', 'public'), config);
      await logAudit(
        'Configurações/Etapas atualizadas',
        actorEmail,
        config.poolName,
        `Inscrições: ${config.flags.registrationsOpen ? 'ON' : 'OFF'} | Edição: ${config.flags.quotaEditsOpen ? 'ON' : 'OFF'} | PIX: ${config.flags.pixPaymentOpen ? 'ON' : 'OFF'} | Placar: ${config.flags.boardVisible ? 'ON' : 'OFF'} | Jogos: ${config.flags.gamesVisible ? 'ON' : 'OFF'}.`
      );
    },

    async updatePaymentConfig(config, actorEmail) {
      await setDoc(doc(db, 'config', 'payment'), config);
      await logAudit(
        'Dados de PIX atualizados',
        actorEmail,
        config.merchantName,
        `Configuração de conta PIX atualizada (${config.merchantCity}).`
      );
    },

    async updateAdminConfig(config, actorEmail) {
      const prev = await this.getAdminConfig();
      const prevCode = prev?.activeInviteCode?.trim().toUpperCase() || '';
      const nextCode = config.activeInviteCode.trim().toUpperCase();

      const batch = writeBatch(db);
      batch.set(doc(db, 'config', 'admin'), {
        ...config,
        activeInviteCode: nextCode,
      });
      if (prevCode && prevCode !== nextCode) {
        batch.set(
          doc(db, 'inviteCodes', prevCode),
          { active: false, updatedAt: Date.now() },
          { merge: true }
        );
      }
      if (nextCode) {
        batch.set(doc(db, 'inviteCodes', nextCode), {
          active: true,
          updatedAt: Date.now(),
        });
      }
      await batch.commit();
      await logAudit(
        'Integrações/Convite atualizados',
        actorEmail,
        'Admin Config',
        `Código de convite (${nextCode || '—'}) e configurações do Apps Script atualizados.`
      );
    },

    async closePoolAndComputeRefunds(actorEmail) {
      const [pub, allUsers] = await Promise.all([
        this.getPublicConfig(),
        this.getAllUsers(),
      ]);

      const paidApproved = allUsers.filter(
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
        pub.totalQuotas,
        pub.quotaPrice
      );

      const batch = writeBatch(db);
      for (const u of allUsers) {
        const next: UserProfile = { ...u, updatedAt: Date.now() };
        if (
          u.approvalStatus === 'approved' &&
          u.paymentStatus === 'confirmed' &&
          u.paidQuotas > 0
        ) {
          const alloc = equity.allocations.get(u.uid);
          const finalQ = alloc?.allocatedQuotas ?? 0;
          const refQ = Math.max(0, u.paidQuotas - finalQ);
          next.finalQuotas = finalQ;
          next.refundQuotas = refQ;
          next.refundAmount = Number((refQ * pub.quotaPrice).toFixed(2));
          if (refQ > 0 && next.refundStatus !== 'completed') {
            next.refundStatus = 'pending';
          } else if (refQ === 0) {
            next.refundStatus = 'none';
          }
          batch.set(doc(db, 'users', u.uid), next);
          batch.set(doc(db, 'board', u.uid), toBoardEntry(next));
        } else if (u.approvalStatus === 'approved') {
          next.finalQuotas = 0;
          batch.set(doc(db, 'users', u.uid), next);
          batch.set(doc(db, 'board', u.uid), toBoardEntry(next));
        }
      }

      const closedPub: PublicConfig = {
        ...pub,
        flags: {
          ...pub.flags,
          poolClosed: true,
          registrationsOpen: false,
          quotaEditsOpen: false,
        },
      };
      batch.set(doc(db, 'config', 'public'), closedPub);
      await batch.commit();

      await logAudit(
        'Bolão fechado (Rateio congelado)',
        actorEmail,
        pub.poolName,
        `${equity.totalAllocated} cotas finais alocadas | ${refunds.length} estorno(s) pendente(s) totalizando R$ ${totalRefundAmount.toFixed(2)}.`
      );

      return {
        totalAllocated: equity.totalAllocated,
        refundCount: refunds.length,
        totalRefundAmount,
      };
    },

    async reopenPool(actorEmail) {
      const [pub, allUsers] = await Promise.all([
        this.getPublicConfig(),
        this.getAllUsers(),
      ]);
      const batch = writeBatch(db);
      for (const u of allUsers) {
        if (u.approvalStatus === 'approved') {
          const next: UserProfile = {
            ...u,
            finalQuotas: null,
            ...(u.refundStatus === 'pending'
              ? { refundStatus: 'none' as const, refundQuotas: 0, refundAmount: 0 }
              : {}),
            updatedAt: Date.now(),
          };
          batch.set(doc(db, 'users', u.uid), next);
          batch.set(doc(db, 'board', u.uid), toBoardEntry(next));
        }
      }
      batch.set(doc(db, 'config', 'public'), {
        ...pub,
        flags: { ...pub.flags, poolClosed: false },
      });
      await batch.commit();
      await logAudit(
        'Bolão reaberto',
        actorEmail,
        pub.poolName,
        'Rateio final descongelado pelos moderadores.'
      );
    },

    async purgeAllCpfs(actorEmail) {
      const allUsers = await this.getAllUsers();
      const batch = writeBatch(db);
      let count = 0;
      for (const u of allUsers) {
        if (u.cpf) {
          batch.update(doc(db, 'users', u.uid), {
            cpf: '',
            updatedAt: Date.now(),
          });
          count++;
        }
      }
      if (count > 0) {
        await batch.commit();
      }
      await logAudit(
        'Limpeza LGPD de CPFs',
        actorEmail,
        'Base de participantes',
        `${count} CPF(s) removidos permanentemente.`
      );
      return count;
    },

    async resetPoolDatabaseKeepingAdmins(actorEmail) {
      const [pub, allUsers, boardSnap, gamesSnap] = await Promise.all([
        this.getPublicConfig(),
        this.getAllUsers(),
        getDocs(collection(db, 'board')),
        getDocs(collection(db, 'games')),
      ]);

      const admins = allUsers.filter((u) => u.isModerator);
      if (admins.length === 0) {
        throw new Error(
          'Nenhum moderador encontrado — restauração cancelada para não perder o acesso administrativo.'
        );
      }

      const adminUids = new Set(admins.map((a) => a.uid));
      const nonAdmins = allUsers.filter((u) => !u.isModerator);
      const now = Date.now();

      type BatchOp = (batch: ReturnType<typeof writeBatch>) => void;
      const ops: BatchOp[] = [];

      // Preserva os moderadores com cadastro aprovado e estado financeiro limpo
      for (const admin of admins) {
        const resetAdmin: UserProfile = {
          ...admin,
          cpf: '',
          requestedQuotas: 1,
          approvalStatus: 'approved',
          paymentStatus: 'unpaid',
          paymentReportedAt: null,
          paymentConfirmedAt: null,
          paymentConfirmedBy: null,
          paymentNote: '',
          paidQuotas: 0,
          finalQuotas: null,
          refundStatus: 'none',
          refundQuotas: 0,
          refundAmount: 0,
          refundCompletedAt: null,
          refundCompletedBy: null,
          assignedTicketNumbers: '',
          receiptDelivered: false,
          receiptDeliveredAt: null,
          receiptDeliveredBy: null,
          isModerator: true,
          updatedAt: now,
        };
        ops.push((b) => b.set(doc(db, 'users', admin.uid), resetAdmin));
        ops.push((b) =>
          b.set(doc(db, 'board', admin.uid), toBoardEntry(resetAdmin))
        );
      }

      // Remove participantes não-moderadores e quaisquer entradas órfãs do placar
      for (const u of nonAdmins) {
        ops.push((b) => b.delete(doc(db, 'users', u.uid)));
      }
      for (const d of boardSnap.docs) {
        if (!adminUids.has(d.id)) {
          ops.push((b) => b.delete(d.ref));
        }
      }

      // Remove todos os volantes cadastrados
      for (const g of gamesSnap.docs) {
        ops.push((b) => b.delete(g.ref));
      }

      // Limpa resultado do sorteio, contadores e reabre fase inicial mantendo configurações
      ops.push((b) =>
        b.set(doc(db, 'drawResult', 'current'), {
          numbers: [],
          updatedAt: now,
          updatedBy: actorEmail,
        })
      );
      ops.push((b) =>
        b.set(doc(db, 'stats', 'summary'), {
          approvedCount: admins.length,
          pendingApprovalCount: 0,
        })
      );
      ops.push((b) =>
        b.set(doc(db, 'config', 'public'), {
          ...pub,
          currentPhase: 'registration',
          flags: {
            registrationsOpen: true,
            quotaEditsOpen: true,
            pixPaymentOpen: true,
            boardVisible: true,
            gamesVisible: true,
            poolClosed: false,
          },
        })
      );

      const CHUNK_SIZE = 400;
      for (let i = 0; i < ops.length; i += CHUNK_SIZE) {
        const batch = writeBatch(db);
        for (const op of ops.slice(i, i + CHUNK_SIZE)) {
          op(batch);
        }
        await batch.commit();
      }

      await logAudit(
        'Base de dados restaurada',
        actorEmail,
        pub.poolName,
        `${nonAdmins.length} participante(s) e ${gamesSnap.docs.length} volante(s) removidos; ${admins.length} moderador(es) e configurações preservados.`
      );

      return {
        removedParticipants: nonAdmins.length,
        removedGames: gamesSnap.docs.length,
        preservedAdmins: admins.length,
      };
    },

    async addGame(game, actorEmail) {
      const sorted = [...game.numbers].sort((a, b) => a - b);
      const data = {
        label: game.label.trim(),
        numbers: sorted,
        notes: game.notes.trim(),
        createdAt: Date.now(),
        createdBy: actorEmail,
      };
      const ref = await addDoc(collection(db, 'games'), data);
      await logAudit(
        'Jogo adicionado',
        actorEmail,
        data.label,
        `${sorted.length} dezenas: ${sorted.map((n) => String(n).padStart(2, '0')).join('-')}`
      );
      return { ...data, id: ref.id };
    },

    async deleteGame(gameId, actorEmail) {
      await deleteDoc(doc(db, 'games', gameId));
      await logAudit(
        'Jogo removido',
        actorEmail,
        gameId,
        'Volante excluído da lista oficial.'
      );
    },

    async saveDrawResult(numbers, actorEmail) {
      const sorted = [...numbers].sort((a, b) => a - b);
      const result: DrawResult = {
        numbers: sorted,
        updatedAt: Date.now(),
        updatedBy: actorEmail,
      };
      await setDoc(doc(db, 'drawResult', 'current'), result);
      await logAudit(
        'Resultado do sorteio salvo',
        actorEmail,
        'Mega da Virada',
        sorted.length > 0
          ? `Dezenas sorteadas: ${sorted.map((n) => String(n).padStart(2, '0')).join(' - ')}`
          : 'Dezenas sorteadas limpas.'
      );
      return result;
    },

    async recordAuditEvent(action, actorEmail, targetName, details) {
      await logAudit(action, actorEmail, targetName, details);
    },
  };
}
