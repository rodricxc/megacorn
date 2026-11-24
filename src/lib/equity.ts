import type {
  EquityAllocationItem,
  EquityCalculationResult,
} from '../types';

export interface EquityParticipantInput {
  uid: string;
  displayName: string;
  requestedQuotas: number;
  createdAt: number;
}

/**
 * Calcula a alocação justa por equidade em camadas (round-robin):
 * - Camada 1: 1ª cota de cada participante (por ordem de inscrição `createdAt`).
 *   Se houver mais participantes únicos que `totalQuotas`, excedentes entram na fila de espera.
 * - Camada 2..N: cotas extras distribuídas rodada a rodada, desempatando por `createdAt`.
 */
export function calculateEquityAllocation(
  participants: EquityParticipantInput[],
  totalQuotas: number
): EquityCalculationResult {
  const safeTotal = Math.max(0, Math.floor(totalQuotas));

  const sorted = [...participants]
    .filter((p) => p.requestedQuotas > 0)
    .sort((a, b) => {
      if (a.createdAt !== b.createdAt) return a.createdAt - b.createdAt;
      return a.uid.localeCompare(b.uid);
    });

  const allocatedMap = new Map<string, number>();
  for (const p of sorted) {
    allocatedMap.set(p.uid, 0);
  }

  let remaining = safeTotal;
  const maxRequested = sorted.reduce(
    (max, p) => Math.max(max, Math.floor(p.requestedQuotas)),
    0
  );

  for (let layer = 1; layer <= maxRequested && remaining > 0; layer++) {
    for (const p of sorted) {
      if (remaining <= 0) break;
      if (Math.floor(p.requestedQuotas) >= layer) {
        allocatedMap.set(p.uid, (allocatedMap.get(p.uid) ?? 0) + 1);
        remaining -= 1;
      }
    }
  }

  const allocations = new Map<string, EquityAllocationItem>();
  const orderedList: EquityAllocationItem[] = [];
  let waitlistCounter = 0;
  let totalAllocated = 0;
  let totalRequested = 0;

  for (const p of sorted) {
    const req = Math.floor(p.requestedQuotas);
    const alloc = allocatedMap.get(p.uid) ?? 0;
    const isWaitlisted = alloc === 0;
    if (isWaitlisted) waitlistCounter += 1;

    totalAllocated += alloc;
    totalRequested += req;

    const item: EquityAllocationItem = {
      uid: p.uid,
      displayName: p.displayName,
      requestedQuotas: req,
      allocatedQuotas: alloc,
      excessQuotas: Math.max(0, req - alloc),
      isWaitlisted,
      waitlistPosition: isWaitlisted ? waitlistCounter : null,
      createdAt: p.createdAt,
    };

    allocations.set(p.uid, item);
    orderedList.push(item);
  }

  return {
    allocations,
    orderedList,
    totalAllocated,
    totalRequested,
    remainingQuotas: Math.max(0, safeTotal - totalAllocated),
    waitlistCount: waitlistCounter,
  };
}

export interface RefundPreviewItem {
  uid: string;
  displayName: string;
  paidQuotas: number;
  finalQuotas: number;
  refundQuotas: number;
  refundAmount: number;
}

/**
 * Calcula estornos ao fechar o bolão com base em quem efetivamente pagou e foi aprovado.
 */
export function calculateRefundsOnClose(
  paidApprovedParticipants: Array<{
    uid: string;
    displayName: string;
    paidQuotas: number;
    createdAt: number;
  }>,
  totalQuotas: number,
  quotaPrice: number
): {
  equity: EquityCalculationResult;
  refunds: RefundPreviewItem[];
  totalRefundAmount: number;
} {
  const equity = calculateEquityAllocation(
    paidApprovedParticipants.map((p) => ({
      uid: p.uid,
      displayName: p.displayName,
      requestedQuotas: p.paidQuotas,
      createdAt: p.createdAt,
    })),
    totalQuotas
  );

  const refunds: RefundPreviewItem[] = [];
  let totalRefundAmount = 0;

  for (const p of paidApprovedParticipants) {
    const alloc = equity.allocations.get(p.uid);
    const finalQuotas = alloc?.allocatedQuotas ?? 0;
    const refundQuotas = Math.max(0, p.paidQuotas - finalQuotas);
    if (refundQuotas > 0) {
      const refundAmount = Number((refundQuotas * quotaPrice).toFixed(2));
      totalRefundAmount = Number((totalRefundAmount + refundAmount).toFixed(2));
      refunds.push({
        uid: p.uid,
        displayName: p.displayName,
        paidQuotas: p.paidQuotas,
        finalQuotas,
        refundQuotas,
        refundAmount,
      });
    }
  }

  return { equity, refunds, totalRefundAmount };
}
