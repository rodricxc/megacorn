import { beforeEach, describe, expect, it } from 'vitest';
import { createDemoDataService } from './demoAdapter';

function installMemoryStorage() {
  const store = new Map<string, string>();
  const storage: Storage = {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
  };
  Object.defineProperty(globalThis, 'window', {
    value: { localStorage: storage },
    configurable: true,
    writable: true,
  });
  Object.defineProperty(globalThis, 'localStorage', {
    value: storage,
    configurable: true,
    writable: true,
  });
}

describe('Admin refund cancellation and database reset keeping admins', () => {
  beforeEach(() => {
    installMemoryStorage();
  });

  it('cancels both pending and completed refunds and records audit entries', async () => {
    const svc = createDemoDataService();
    const users = await svc.getAllUsers();
    const member = users.find((u) => !u.isModerator && u.paidQuotas > 0)!;

    // Cancelar participação paga gera estorno pendente
    await svc.cancelParticipant(member.uid, 'organizador@megacorn.demo');
    let updated = await svc.getUserProfile(member.uid);
    expect(updated?.refundStatus).toBe('pending');
    expect(updated?.refundQuotas).toBeGreaterThan(0);

    // Concluir o estorno e em seguida cancelar o estorno concluído
    await svc.markRefundCompleted(member.uid, 'organizador@megacorn.demo');
    updated = await svc.getUserProfile(member.uid);
    expect(updated?.refundStatus).toBe('completed');
    expect(updated?.refundCompletedAt).not.toBeNull();

    await svc.cancelRefund(member.uid, 'organizador@megacorn.demo');
    updated = await svc.getUserProfile(member.uid);
    expect(updated?.refundStatus).toBe('none');
    expect(updated?.refundQuotas).toBe(0);
    expect(updated?.refundAmount).toBe(0);
    expect(updated?.refundCompletedAt).toBeNull();
    expect(updated?.refundCompletedBy).toBeNull();

    const logs = await svc.getAuditLogs();
    expect(logs[0]?.action).toBe('Estorno cancelado');
  });

  it('resets participants, games, draw result, and pool flags while preserving admins and configs', async () => {
    const svc = createDemoDataService();
    const customPayment = {
      pixKey: 'pix.real@time.com.br',
      merchantName: 'Rodrigo Admin',
      merchantCity: 'SAO PAULO',
      instructions: 'Instrucao real',
    };
    await svc.updatePaymentConfig(customPayment, 'organizador@megacorn.demo');
    await svc.saveDrawResult([4, 10, 17, 23, 34, 59], 'organizador@megacorn.demo');
    await svc.closePoolAndComputeRefunds('organizador@megacorn.demo');

    const beforeUsers = await svc.getAllUsers();
    const beforeGames = await svc.getGames();
    const adminCount = beforeUsers.filter((u) => u.isModerator).length;
    expect(beforeUsers.length).toBeGreaterThan(adminCount);
    expect(beforeGames.length).toBeGreaterThan(0);

    const summary = await svc.resetPoolDatabaseKeepingAdmins(
      'organizador@megacorn.demo'
    );
    expect(summary.preservedAdmins).toBe(adminCount);
    expect(summary.removedParticipants).toBe(beforeUsers.length - adminCount);
    expect(summary.removedGames).toBe(beforeGames.length);

    const afterUsers = await svc.getAllUsers();
    expect(afterUsers).toHaveLength(adminCount);
    expect(afterUsers.every((u) => u.isModerator)).toBe(true);
    expect(afterUsers.every((u) => u.approvalStatus === 'approved')).toBe(true);
    expect(afterUsers.every((u) => u.paymentStatus === 'unpaid')).toBe(true);
    expect(afterUsers.every((u) => u.refundStatus === 'none')).toBe(true);
    expect(afterUsers.every((u) => u.paidQuotas === 0)).toBe(true);
    expect(afterUsers.every((u) => u.cpf === '')).toBe(true);

    const afterGames = await svc.getGames();
    expect(afterGames).toHaveLength(0);

    const afterDraw = await svc.getDrawResult();
    expect(afterDraw.numbers).toEqual([]);

    const afterPub = await svc.getPublicConfig();
    expect(afterPub.currentPhase).toBe('registration');
    expect(afterPub.flags.poolClosed).toBe(false);
    expect(afterPub.flags.registrationsOpen).toBe(true);

    const afterPay = await svc.getPaymentConfig();
    expect(afterPay).toEqual(customPayment);

    const logs = await svc.getAuditLogs();
    expect(logs[0]?.action).toBe('Base de dados restaurada');
  });
});
