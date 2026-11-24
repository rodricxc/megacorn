import { describe, expect, it } from 'vitest';
import { calculateEquityAllocation, calculateRefundsOnClose } from './equity';

describe('calculateEquityAllocation', () => {
  it('prioritizes 1st quota for everyone before granting extra quotas', () => {
    const result = calculateEquityAllocation(
      [
        { uid: 'a', displayName: 'Ana', requestedQuotas: 3, createdAt: 100 },
        { uid: 'b', displayName: 'Bruno', requestedQuotas: 1, createdAt: 200 },
        { uid: 'c', displayName: 'Carla', requestedQuotas: 2, createdAt: 300 },
      ],
      4
    );

    // Total 4 cotas: Camada 1 dá 1 para Ana, Bruno, Carla (3 cotas).
    // Camada 2 dá a 4ª cota para Ana (inscrita antes de Carla).
    expect(result.allocations.get('a')?.allocatedQuotas).toBe(2);
    expect(result.allocations.get('a')?.excessQuotas).toBe(1);
    expect(result.allocations.get('b')?.allocatedQuotas).toBe(1);
    expect(result.allocations.get('c')?.allocatedQuotas).toBe(1);
    expect(result.allocations.get('c')?.excessQuotas).toBe(1);
    expect(result.totalAllocated).toBe(4);
    expect(result.remainingQuotas).toBe(0);
  });

  it('places participants beyond totalQuotas into waitlist ordered by createdAt', () => {
    const participants = Array.from({ length: 103 }, (_, i) => ({
      uid: `u${i + 1}`,
      displayName: `Pessoa ${i + 1}`,
      requestedQuotas: 2,
      createdAt: 1000 + i,
    }));

    const result = calculateEquityAllocation(participants, 100);
    expect(result.totalAllocated).toBe(100);
    expect(result.waitlistCount).toBe(3);
    expect(result.allocations.get('u100')?.allocatedQuotas).toBe(1);
    expect(result.allocations.get('u101')?.isWaitlisted).toBe(true);
    expect(result.allocations.get('u101')?.waitlistPosition).toBe(1);
    expect(result.allocations.get('u103')?.waitlistPosition).toBe(3);
  });

  it('calculates exact refunds when pool closes with oversubscribed extra quotas', () => {
    const closePreview = calculateRefundsOnClose(
      [
        { uid: 'a', displayName: 'Ana', paidQuotas: 3, createdAt: 10 },
        { uid: 'b', displayName: 'Bruno', paidQuotas: 2, createdAt: 20 },
        { uid: 'c', displayName: 'Carla', paidQuotas: 1, createdAt: 30 },
      ],
      4,
      30
    );

    // 4 cotas: Ana=2 (estorno 1 = R$30), Bruno=1 (estorno 1 = R$30), Carla=1 (estorno 0)
    expect(closePreview.refunds).toHaveLength(2);
    expect(closePreview.totalRefundAmount).toBe(60);
    expect(closePreview.refunds.find((r) => r.uid === 'a')?.refundAmount).toBe(30);
    expect(closePreview.refunds.find((r) => r.uid === 'b')?.refundAmount).toBe(30);
  });
});
