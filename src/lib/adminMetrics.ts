import type {
  EquityCalculationResult,
  PublicConfig,
  UserProfile,
} from '../types';
import type { RefundPreviewItem } from './equity';

export interface AdminOverviewMetrics {
  // Financeiro (R$)
  expectedMaxAmount: number;
  expectedFromApprovedAmount: number;
  grossCollectedAmount: number;
  netConfirmedAmount: number;
  reportedPixAmount: number;
  unpaidActiveAmount: number;
  pendingApprovalPaidAmount: number;
  refundPendingAmount: number;
  refundCompletedAmount: number;
  projectedCloseRefundAmount: number;

  // Cotas
  totalQuotas: number;
  quotaPrice: number;
  grossPaidQuotas: number;
  confirmedEffectiveQuotas: number;
  reservedApprovedQuotas: number;
  totalRequestedApprovedQuotas: number;
  totalRequestedPendingQuotas: number;
  reportedPixQuotas: number;
  unpaidActiveQuotas: number;
  remainingToReserveQuotas: number;
  remainingToConfirmQuotas: number;
  excessRequestedQuotas: number;
  waitlistCount: number;
  avgQuotasPerApproved: number;

  // Percentuais (0..100)
  reservedPercent: number;
  confirmedPercent: number;

  // Participantes e operação
  totalUsersCount: number;
  approvedUsersCount: number;
  pendingApprovalUsersCount: number;
  rejectedOrCancelledCount: number;
  confirmedUsersCount: number;
  reportedPixUsersCount: number;
  unpaidActiveUsersCount: number;
  refundPendingUsersCount: number;
  refundCompletedUsersCount: number;
  projectedRefundUsersCount: number;
  ticketAssignedUsersCount: number;
  receiptDeliveredUsersCount: number;
  receiptPendingUsersCount: number;
  cpfStoredUsersCount: number;
  quotaDistribution: Array<{ quotas: number; count: number }>;
}

function roundMoney(value: number): number {
  return Number(value.toFixed(2));
}

function toPercent(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((part / total) * 100));
}

export function calculateAdminOverviewMetrics(params: {
  allUsers: UserProfile[];
  publicConfig: PublicConfig;
  liveEquity: EquityCalculationResult;
  closePreview: {
    equity: EquityCalculationResult;
    refunds: RefundPreviewItem[];
    totalRefundAmount: number;
  };
}): AdminOverviewMetrics {
  const { allUsers, publicConfig, liveEquity, closePreview } = params;
  const totalQuotas = Math.max(0, publicConfig.totalQuotas);
  const quotaPrice = Math.max(0, publicConfig.quotaPrice);

  let approvedUsersCount = 0;
  let pendingApprovalUsersCount = 0;
  let rejectedOrCancelledCount = 0;

  let confirmedUsersCount = 0;
  let grossPaidQuotas = 0;
  let pendingApprovalPaidQuotas = 0;
  let closedFinalQuotas = 0;

  let reportedPixUsersCount = 0;
  let reportedPixQuotas = 0;

  let unpaidActiveUsersCount = 0;
  let unpaidActiveQuotas = 0;
  let totalRequestedPendingQuotas = 0;

  let refundPendingUsersCount = 0;
  let refundPendingAmount = 0;
  let refundCompletedUsersCount = 0;
  let refundCompletedAmount = 0;

  let ticketAssignedUsersCount = 0;
  let receiptDeliveredUsersCount = 0;
  let receiptPendingUsersCount = 0;
  let cpfStoredUsersCount = 0;

  const distMap = new Map<number, number>();

  for (const u of allUsers) {
    const isApproved = u.approvalStatus === 'approved';
    const isPending = u.approvalStatus === 'pending';
    const isActive = isApproved || isPending;

    if (isApproved) {
      approvedUsersCount += 1;
      const req = Math.max(0, Math.floor(u.requestedQuotas));
      if (req > 0) {
        distMap.set(req, (distMap.get(req) ?? 0) + 1);
      }
    } else if (isPending) {
      pendingApprovalUsersCount += 1;
      totalRequestedPendingQuotas += Math.max(0, Math.floor(u.requestedQuotas));
    } else {
      rejectedOrCancelledCount += 1;
    }

    if (u.cpf) {
      cpfStoredUsersCount += 1;
    }

    if (u.paymentStatus === 'confirmed' && u.paidQuotas > 0) {
      confirmedUsersCount += 1;
      grossPaidQuotas += u.paidQuotas;
      if (isPending) {
        pendingApprovalPaidQuotas += u.paidQuotas;
      }
      if (isApproved) {
        closedFinalQuotas += u.finalQuotas ?? 0;
        if (u.assignedTicketNumbers?.trim()) {
          ticketAssignedUsersCount += 1;
        }
        if (u.receiptDelivered) {
          receiptDeliveredUsersCount += 1;
        } else {
          receiptPendingUsersCount += 1;
        }
      }
    } else if (isActive && u.paymentStatus === 'reported') {
      reportedPixUsersCount += 1;
      reportedPixQuotas += u.requestedQuotas;
    } else if (isActive && u.paymentStatus === 'unpaid') {
      unpaidActiveUsersCount += 1;
      unpaidActiveQuotas += u.requestedQuotas;
    }

    if (u.refundStatus === 'pending') {
      refundPendingUsersCount += 1;
      refundPendingAmount = roundMoney(refundPendingAmount + (u.refundAmount || 0));
    } else if (u.refundStatus === 'completed') {
      refundCompletedUsersCount += 1;
      refundCompletedAmount = roundMoney(
        refundCompletedAmount + (u.refundAmount || 0)
      );
    }
  }

  const confirmedEffectiveQuotas = publicConfig.flags.poolClosed
    ? closedFinalQuotas
    : closePreview.equity.totalAllocated;

  const reservedApprovedQuotas = liveEquity.totalAllocated;
  const remainingToReserveQuotas = Math.max(0, totalQuotas - reservedApprovedQuotas);
  const remainingToConfirmQuotas = Math.max(0, totalQuotas - confirmedEffectiveQuotas);

  const expectedMaxAmount = roundMoney(totalQuotas * quotaPrice);
  const expectedFromApprovedAmount = roundMoney(reservedApprovedQuotas * quotaPrice);
  const grossCollectedAmount = roundMoney(grossPaidQuotas * quotaPrice);
  const netConfirmedAmount = roundMoney(confirmedEffectiveQuotas * quotaPrice);
  const reportedPixAmount = roundMoney(reportedPixQuotas * quotaPrice);
  const unpaidActiveAmount = roundMoney(unpaidActiveQuotas * quotaPrice);
  const pendingApprovalPaidAmount = roundMoney(pendingApprovalPaidQuotas * quotaPrice);

  const maxTier = Math.max(
    publicConfig.maxQuotasPerPerson,
    ...Array.from(distMap.keys(), (k) => k)
  );
  const quotaDistribution: Array<{ quotas: number; count: number }> = [];
  for (let q = 1; q <= maxTier; q++) {
    const count = distMap.get(q) ?? 0;
    if (q <= publicConfig.maxQuotasPerPerson || count > 0) {
      quotaDistribution.push({ quotas: q, count });
    }
  }

  return {
    expectedMaxAmount,
    expectedFromApprovedAmount,
    grossCollectedAmount,
    netConfirmedAmount,
    reportedPixAmount,
    unpaidActiveAmount,
    pendingApprovalPaidAmount,
    refundPendingAmount,
    refundCompletedAmount,
    projectedCloseRefundAmount: closePreview.totalRefundAmount,

    totalQuotas,
    quotaPrice,
    grossPaidQuotas,
    confirmedEffectiveQuotas,
    reservedApprovedQuotas,
    totalRequestedApprovedQuotas: liveEquity.totalRequested,
    totalRequestedPendingQuotas,
    reportedPixQuotas,
    unpaidActiveQuotas,
    remainingToReserveQuotas,
    remainingToConfirmQuotas,
    excessRequestedQuotas: Math.max(
      0,
      liveEquity.totalRequested - liveEquity.totalAllocated
    ),
    waitlistCount: liveEquity.waitlistCount,
    avgQuotasPerApproved:
      approvedUsersCount > 0
        ? Number((liveEquity.totalRequested / approvedUsersCount).toFixed(2))
        : 0,

    reservedPercent: toPercent(reservedApprovedQuotas, totalQuotas),
    confirmedPercent: toPercent(confirmedEffectiveQuotas, totalQuotas),

    totalUsersCount: allUsers.length,
    approvedUsersCount,
    pendingApprovalUsersCount,
    rejectedOrCancelledCount,
    confirmedUsersCount,
    reportedPixUsersCount,
    unpaidActiveUsersCount,
    refundPendingUsersCount,
    refundCompletedUsersCount,
    projectedRefundUsersCount: closePreview.refunds.length,
    ticketAssignedUsersCount,
    receiptDeliveredUsersCount,
    receiptPendingUsersCount,
    cpfStoredUsersCount,
    quotaDistribution,
  };
}

export interface PaidDiscrepancyInfo {
  hasDiscrepancy: boolean;
  differsFromRequested: boolean;
  differsFromEquity: boolean;
  summary: string;
}

/**
 * Detecta divergência entre as cotas marcadas como pagas (`paidQuotas`)
 * e a quantidade pedida (`requestedQuotas`) ou alocada pela equidade/final.
 */
export function getPaidQuotaDiscrepancy(params: {
  paymentStatus: UserProfile['paymentStatus'];
  approvalStatus: UserProfile['approvalStatus'];
  paidQuotas: number;
  requestedQuotas: number;
  equityQuotas: number | null;
  poolClosed: boolean;
}): PaidDiscrepancyInfo {
  const {
    paymentStatus,
    approvalStatus,
    paidQuotas,
    requestedQuotas,
    equityQuotas,
    poolClosed,
  } = params;

  if (paymentStatus !== 'confirmed') {
    return {
      hasDiscrepancy: false,
      differsFromRequested: false,
      differsFromEquity: false,
      summary: '',
    };
  }

  const differsFromRequested = paidQuotas !== requestedQuotas;
  const differsFromEquity =
    approvalStatus === 'approved' &&
    equityQuotas !== null &&
    paidQuotas !== equityQuotas;

  if (!differsFromRequested && !differsFromEquity) {
    return {
      hasDiscrepancy: false,
      differsFromRequested: false,
      differsFromEquity: false,
      summary: '',
    };
  }

  const equityLabel = poolClosed ? 'alocação final' : 'equidade atual';
  let summary = '';
  if (differsFromRequested && differsFromEquity) {
    summary = `Divergência: marcado como pago ${paidQuotas}c, mas constam ${requestedQuotas}c pedida(s) e ${equityQuotas}c na ${equityLabel}.`;
  } else if (differsFromRequested) {
    summary = `Divergência: marcado como pago ${paidQuotas}c, diferente das ${requestedQuotas}c pedida(s).`;
  } else {
    summary = `Divergência: marcado como pago ${paidQuotas}c, diferente de ${equityQuotas}c pela ${equityLabel}.`;
  }

  return {
    hasDiscrepancy: true,
    differsFromRequested,
    differsFromEquity,
    summary,
  };
}
