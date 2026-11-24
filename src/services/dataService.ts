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

export interface AuthUser {
  uid: string;
  email: string;
}

export interface SignInLinkCompletionResult {
  status: 'none' | 'completed' | 'needs_email' | 'error';
  message?: string;
  errorCode?: string;
}

export interface DataService {
  readonly isDemoMode: boolean;

  // Auth & Magic Link
  onAuthChange(cb: (user: AuthUser | null) => void): () => void;
  sendMagicLink(email: string, redirectPath?: string): Promise<void>;
  checkMagicLinkReturn(): Promise<SignInLinkCompletionResult>;
  completeMagicLinkWithEmail(email: string): Promise<SignInLinkCompletionResult>;
  signOut(): Promise<void>;

  // Demo-only helpers (no-op em Firebase real)
  demoQuickSignIn?(email: string): Promise<void>;
  demoResetData?(): Promise<void>;

  // Leitura de dados
  getPublicConfig(): Promise<PublicConfig>;
  getPaymentConfig(): Promise<PaymentConfig | null>;
  getAdminConfig(): Promise<AdminConfig | null>;
  getUserProfile(uid: string): Promise<UserProfile | null>;
  getAllUsers(): Promise<UserProfile[]>;
  getBoardEntries(): Promise<BoardEntry[]>;
  getPoolStats(): Promise<PoolStats>;
  getGames(): Promise<LotteryGame[]>;
  getDrawResult(): Promise<DrawResult>;
  getAuditLogs(): Promise<AuditLogEntry[]>;

  // Fluxo do participante
  validateInviteCode(code: string): Promise<boolean>;
  registerParticipant(input: {
    uid: string;
    email: string;
    displayName: string;
    cpf: string;
    requestedQuotas: number;
    inviteCode: string;
  }): Promise<UserProfile>;
  updateOwnProfile(
    uid: string,
    updates: {
      displayName?: string;
      cpf?: string;
      requestedQuotas?: number;
    }
  ): Promise<UserProfile>;
  reportOwnPixPayment(uid: string, note: string): Promise<UserProfile>;

  // Ações de moderadores
  approveParticipant(uid: string, actorEmail: string): Promise<void>;
  rejectParticipant(uid: string, actorEmail: string, reason?: string): Promise<void>;
  cancelParticipant(uid: string, actorEmail: string, reason?: string): Promise<void>;
  confirmPixPayment(
    uid: string,
    paidQuotas: number,
    actorEmail: string
  ): Promise<void>;
  markRefundCompleted(uid: string, actorEmail: string): Promise<void>;
  updateParticipantQuotasAsAdmin(
    uid: string,
    requestedQuotas: number,
    actorEmail: string
  ): Promise<void>;
  toggleModeratorRole(
    uid: string,
    isModerator: boolean,
    actorEmail: string
  ): Promise<void>;
  updatePublicConfig(config: PublicConfig, actorEmail: string): Promise<void>;
  updatePaymentConfig(config: PaymentConfig, actorEmail: string): Promise<void>;
  updateAdminConfig(config: AdminConfig, actorEmail: string): Promise<void>;
  closePoolAndComputeRefunds(actorEmail: string): Promise<{
    totalAllocated: number;
    refundCount: number;
    totalRefundAmount: number;
  }>;
  reopenPool(actorEmail: string): Promise<void>;
  purgeAllCpfs(actorEmail: string): Promise<number>;

  // Jogos e sorteio
  addGame(
    game: { label: string; numbers: number[]; notes: string },
    actorEmail: string
  ): Promise<LotteryGame>;
  deleteGame(gameId: string, actorEmail: string): Promise<void>;
  saveDrawResult(numbers: number[], actorEmail: string): Promise<DrawResult>;

  // Auditoria manual (ex: disparo de e-mails)
  recordAuditEvent(
    action: string,
    actorEmail: string,
    targetName: string,
    details: string
  ): Promise<void>;
}

export const DEFAULT_PUBLIC_CONFIG: PublicConfig = {
  poolName: 'MegaCorn',
  edition: '2026',
  quotaPrice: 35,
  totalQuotas: 100,
  maxQuotasPerPerson: 5,
  registrationDeadline: '2026-12-18',
  paymentDeadline: '2026-12-22',
  drawDate: '2026-12-31',
  bannerMessage:
    'Inscrições e PIX abertos! Garanta sua espiga da sorte antes do fechamento.',
  rulesExtraNotes:
    'Os volantes oficiais serão registrados em lotérica credenciada da Caixa e publicados na aba Jogos antes do sorteio.',
  flags: {
    registrationsOpen: true,
    quotaEditsOpen: true,
    pixPaymentOpen: true,
    boardVisible: true,
    gamesVisible: true,
    poolClosed: false,
  },
};

export const DEFAULT_PAYMENT_CONFIG: PaymentConfig = {
  pixKey: 'bolao.megacorn@exemplo.com.br',
  merchantName: 'Organizacao MegaCorn',
  merchantCity: 'SAO PAULO',
  instructions:
    'Faça o PIX usando o QR Code ou Copia e Cola abaixo (valor exato e identificador txid já preenchidos). Depois, clique em "Já fiz o PIX".',
};

export const DEFAULT_ADMIN_CONFIG: AdminConfig = {
  appsScriptUrl: '',
  appsScriptSecret: '',
  moderatorEmails: ['organizador@megacorn.demo'],
  activeInviteCode: 'MEGACORN2026',
};
