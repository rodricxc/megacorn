import { describe, expect, it } from 'vitest';
import {
  computeCrc16,
  generateParticipantTxid,
  generatePixPayload,
  sanitizeTxid,
} from './pix';

describe('PIX BR Code generator', () => {
  it('generates a valid EMVCo static PIX payload with matching CRC16', () => {
    const payload = generatePixPayload({
      pixKey: 'megacorn@example.com',
      merchantName: 'Organização MegaCorn',
      merchantCity: 'São Paulo',
      amount: 90,
      txid: 'MEGACORN26ABC123',
      description: 'MegaCorn 3 cotas',
    });

    expect(payload.startsWith('000201')).toBe(true);
    expect(payload).toContain('br.gov.bcb.pix');
    expect(payload).toContain('5303986');
    expect(payload).toContain('540590.00');
    expect(payload).toContain('5802BR');
    expect(payload).toContain('MEGACORN26ABC123');

    const bodyWithoutCrc = payload.slice(0, -4);
    const crc = payload.slice(-4);
    expect(computeCrc16(bodyWithoutCrc)).toBe(crc);
  });

  it('sanitizes txid to alphanumeric max 25 chars', () => {
    expect(sanitizeTxid('mega-corn 2026 çã! #123')).toBe('MEGACORN2026CA123');
    expect(generateParticipantTxid('2026', 'usr_98a7b6c5').length).toBeLessThanOrEqual(25);
  });
});
