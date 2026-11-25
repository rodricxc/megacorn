import { describe, expect, it } from 'vitest';
import type { PublicConfig, UserProfile } from '../types';
import { calculateAdminOverviewMetrics } from './adminMetrics';
import { calculateEquityAllocation, calculateRefundsOnClose } from './equity';

const BASE_CONFIG: PublicConfig = {
  poolName: 'MegaCorn',
  edition: '2027',
  quotaPrice: 40.32,
  totalQuotas: 10,
  maxQuotasPerPerson: 3,
  registrationDeadline: '2027-12-10',
  paymentDeadline: '2027-12-16',
  betPlacementDate: '2027-12-20',
  drawDate: '2027-12-31',
  currentPhase: 'consolidating_payments',
  bannerMessage: '',
  rulesExtraNotes: '',
  quotaPriceRationale: '',
  organizerContact: '',
  flags: {
    registrationsOpen: true,
    quotaEditsOpen: true,
    pixPaymentOpen: true,
    boardVisible: true,
    gamesVisible: true,
    poolClosed: false,
  },
};

function makeUser(overrides: Partial<UserProfile>): UserProfile {
  return {
    uid: 'u1',
    email: 'u1@example.com',
    displayName: 'Participante 1',
    cpf: '',
    requestedQuotas: 1,
    paidQuotas: 0,
    finalQuotas: null,
    approvalStatus: 'approved',
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
    txid: 'MC1234',
    inviteCodeUsed: 'MEGACORN2027',
    isModerator: false,
    createdAt: 1000,
    updatedAt: 1000,
    ...overrides,
  };
}

describe('calculateAdminOverviewMetrics', () => {
  it('calculates financial totals, remaining quotas, and operational counts accurately', () => {
    const users: UserProfile[] = [
      makeUser({
        uid: 'u1',
        displayName: 'Ana',
        requestedQuotas: 3,
        paidQuotas: 3,
        approvalStatus: 'approved',
        paymentStatus: 'confirmed',
        assignedTicketNumbers: '#01, #02, #03',
        receiptDelivered: true,
        cpf: '12345678909',
        createdAt: 1,
      }),
      makeUser({
        uid: 'u2',
        displayName: 'Bruno',
        requestedQuotas: 2,
        paidQuotas: 0,
        approvalStatus: 'approved',
        paymentStatus: 'reported',
        createdAt: 2,
      }),
      makeUser({
        uid: 'u3',
        displayName: 'Carla',
        requestedQuotas: 2,
        paidQuotas: 0,
        approvalStatus: 'approved',
        paymentStatus: 'unpaid',
        createdAt: 3,
      }),
      makeUser({
        uid: 'u4',
        displayName: 'Diego',
        requestedQuotas: 2,
        paidQuotas: 2,
        approvalStatus: 'pending',
        paymentStatus: 'confirmed',
        createdAt: 4,
      }),
      makeUser({
        uid: 'u5',
        displayName: 'Eva',
        requestedQuotas: 1,
        paidQuotas: 0,
        approvalStatus: 'rejected',
        paymentStatus: 'unpaid',
        refundStatus: 'pending',
        refundQuotas: 1,
        refundAmount: 40.32,
        createdAt: 5,
      }),
    ];

    const approved = users.filter((u) => u.approvalStatus === 'approved');
    const liveEquity = calculateEquityAllocation(approved, BASE_CONFIG.totalQuotas);
    const paidApproved = users.filter(
      (u) =>
        u.approvalStatus === 'approved' &&
        u.paymentStatus === 'confirmed' &&
        u.paidQuotas > 0
    );
    const closePreview = calculateRefundsOnClose(
      paidApproved,
      BASE_CONFIG.totalQuotas,
      BASE_CONFIG.quotaPrice
    );

    const metrics = calculateAdminOverviewMetrics({
      allUsers: users,
      publicConfig: BASE_CONFIG,
      liveEquity,
      closePreview,
    });

    expect(metrics.expectedMaxAmount).toBe(403.2);
    expect(metrics.expectedFromApprovedAmount).toBe(282.24); // 7 quotas reserved by approved
    expect(metrics.grossCollectedAmount).toBe(201.6); // 3 (Ana) + 2 (Diego pending) = 5 paid quotas
    expect(metrics.netConfirmedAmount).toBe(120.96); // 3 effective confirmed approved quotas
    expect(metrics.pendingApprovalPaidAmount).toBe(80.64); // 2 paid quotas from Diego (pending approval)
    expect(metrics.reportedPixAmount).toBe(80.64); // 2 quotas reported by Bruno
    expect(metrics.unpaidActiveAmount).toBe(80.64); // 2 quotas unpaid by Carla
    expect(metrics.remainingToReserveQuotas).toBe(3); // 10 - 7
    expect(metrics.remainingToConfirmQuotas).toBe(7); // 10 - 3
    expect(metrics.reservedPercent).toBe(70);
    expect(metrics.confirmedPercent).toBe(30);
    expect(metrics.refundPendingUsersCount).toBe(1);
    expect(metrics.refundPendingAmount).toBe(40.32);
    expect(metrics.ticketAssignedUsersCount).toBe(1);
    expect(metrics.receiptDeliveredUsersCount).toBe(1);
    expect(metrics.receiptPendingUsersCount).toBe(0);
    expect(metrics.cpfStoredUsersCount).toBe(1);
    expect(metrics.quotaDistribution).toEqual([
      { quotas: 1, count: 0 },
      { quotas: 2, count: 2 },
      { quotas: 3, count: 1 },
    ]);
  });

  it('caps net confirmed amount at totalQuotas and surfaces projected refunds when overfunded', () => {
    const users: UserProfile[] = [
      makeUser({ uid: 'u1', requestedQuotas: 3, paidQuotas: 3, paymentStatus: 'confirmed', createdAt: 1 }),
      makeUser({ uid: 'u2', requestedQuotas: 3, paidQuotas: 3, paymentStatus: 'confirmed', createdAt: 2 }),
      makeUser({ uid: 'u3', requestedQuotas: 3, paidQuotas: 3, paymentStatus: 'confirmed', createdAt: 3 }),
      makeUser({ uid: 'u4', requestedQuotas: 3, paidQuotas: 3, paymentStatus: 'confirmed', createdAt: 4 }),
    ];

    const liveEquity = calculateEquityAllocation(users, BASE_CONFIG.totalQuotas);
    const closePreview = calculateRefundsOnClose(
      users,
      BASE_CONFIG.totalQuotas,
      BASE_CONFIG.quotaPrice
    );

    const metrics = calculateAdminOverviewMetrics({
      allUsers: users,
      publicConfig: BASE_CONFIG,
      liveEquity,
      closePreview,
    });

    expect(metrics.grossPaidQuotas).toBe(12);
    expect(metrics.grossCollectedAmount).toBe(483.84);
    expect(metrics.confirmedEffectiveQuotas).toBe(10);
    expect(metrics.netConfirmedAmount).toBe(403.2);
    expect(metrics.remainingToReserveQuotas).toBe(0);
    expect(metrics.remainingToConfirmQuotas).toBe(0);
    expect(metrics.projectedCloseRefundAmount).toBe(80.64);
    expect(metrics.projectedRefundUsersCount).toBe(2);
  });
});
