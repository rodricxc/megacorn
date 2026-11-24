import { describe, expect, it } from 'vitest';
import { canManageTickets, getPhaseIndex, POOL_PHASES } from './phases';

describe('Pool evolution phases and ticket gate', () => {
  it('defines all 8 ordered evolution stages ending with retired', () => {
    expect(POOL_PHASES.map((p) => p.id)).toEqual([
      'registration',
      'registration_closed',
      'consolidating_payments',
      'bet_placed',
      'delivering_tickets',
      'draw',
      'claiming_prize',
      'retired',
    ]);
    expect(getPhaseIndex('bet_placed')).toBe(3);
  });

  it('blocks ticket delivery/assignment before bet_placed and allows from bet_placed onward', () => {
    expect(canManageTickets('registration')).toBe(false);
    expect(canManageTickets('registration_closed')).toBe(false);
    expect(canManageTickets('consolidating_payments')).toBe(false);
    expect(canManageTickets('bet_placed')).toBe(true);
    expect(canManageTickets('delivering_tickets')).toBe(true);
    expect(canManageTickets('draw')).toBe(true);
    expect(canManageTickets('claiming_prize')).toBe(true);
    expect(canManageTickets('retired')).toBe(true);
  });
});
