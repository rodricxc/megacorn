export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export type PaymentStatus = 'unpaid' | 'reported' | 'confirmed';

export type RefundStatus = 'none' | 'pending' | 'completed';

export interface StageToggles {
  registrationsOpen: boolean;
  quotaEditsOpen: boolean;
  pixPaymentOpen: boolean;
  boardVisible: boolean;
  gamesVisible: boolean;
  poolClosed: boolean;
}

export interface PublicConfig {
  poolName: string;
  edition: string;
  quotaPrice: number; // em reais (ex: 30)
  totalQuotas: number; // padrão: 100
  maxQuotasPerPerson: number; // padrão: 3
  registrationDeadline: string; // data limite para registro (ex: "2026-12-18")
  paymentDeadline: string; // data limite para pagamento PIX (ex: "2026-12-22")
  betPlacementDate: string; // data de realizar a aposta na lotérica (ex: "2026-12-28")
  drawDate: string; // data do sorteio (ex: "2026-12-31")
  bannerMessage: string;
  rulesExtraNotes: string;
  flags: StageToggles;
}

export interface PaymentConfig {
  pixKey: string;
  merchantName: string;
  merchantCity: string;
  instructions: string;
}

export interface AdminConfig {
  appsScriptUrl: string;
  appsScriptSecret: string;
  moderatorEmails: string[];
  activeInviteCode: string;
}

export interface UserProfile {
  uid: string;
  email: string; // PII — somente o próprio usuário e moderadores
  displayName: string;
  cpf: string; // PII opcional (11 dígitos sem pontuação) — somente próprio usuário e moderadores
  approvalStatus: ApprovalStatus;
  requestedQuotas: number;
  paidQuotas: number; // cotas efetivamente pagas e confirmadas
  finalQuotas: number | null; // congelado quando poolClosed = true
  paymentStatus: PaymentStatus;
  paymentNote: string;
  paymentReportedAt: number | null;
  paymentConfirmedAt: number | null;
  paymentConfirmedBy: string | null;
  refundStatus: RefundStatus;
  refundQuotas: number;
  refundAmount: number;
  refundCompletedAt: number | null;
  refundCompletedBy: string | null;
  txid: string;
  inviteCodeUsed: string;
  isModerator: boolean;
  createdAt: number; // timestamp ms — critério de desempate por ordem de inscrição
  updatedAt: number;
}

/**
 * Entrada pública (para usuários autenticados) no placar de transparência.
 * NÃO contém e-mail nem CPF.
 */
export interface BoardEntry {
  uid: string;
  displayName: string;
  requestedQuotas: number;
  paidQuotas: number;
  finalQuotas: number | null;
  paymentStatus: PaymentStatus;
  refundStatus: RefundStatus;
  refundQuotas: number;
  createdAt: number;
}

export interface PoolStats {
  pendingApprovalCount: number; // contagem sem nomes
  approvedCount: number;
}

export interface LotteryGame {
  id: string;
  label: string; // ex: "Jogo #01 — Espiga de Ouro"
  numbers: number[]; // 6 a 20 dezenas únicas entre 1 e 60, ordenadas
  notes: string;
  createdAt: number;
  createdBy: string;
}

export interface DrawResult {
  numbers: number[]; // 6 dezenas sorteadas (1..60)
  updatedAt: number | null;
  updatedBy: string | null;
}

export interface AuditLogEntry {
  id: string;
  action: string;
  actorEmail: string;
  targetName: string;
  details: string;
  createdAt: number;
}

export interface EquityAllocationItem {
  uid: string;
  displayName: string;
  requestedQuotas: number;
  allocatedQuotas: number;
  excessQuotas: number;
  isWaitlisted: boolean;
  waitlistPosition: number | null; // 1-indexed se > totalQuotas pessoas
  createdAt: number;
}

export interface EquityCalculationResult {
  allocations: Map<string, EquityAllocationItem>;
  orderedList: EquityAllocationItem[];
  totalAllocated: number;
  totalRequested: number;
  remainingQuotas: number;
  waitlistCount: number;
}

export type EmailActionType =
  | 'test'
  | 'approval'
  | 'payment_confirmed'
  | 'payment_reminder'
  | 'refund_notice'
  | 'rejection';

export interface EmailSendPayload {
  action: EmailActionType;
  to: string;
  displayName: string;
  poolName: string;
  requestedQuotas?: number;
  amount?: number;
  txid?: string;
  refundAmount?: number;
  refundQuotas?: number;
  siteUrl?: string;
  customMessage?: string;
}
