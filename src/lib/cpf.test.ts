import { describe, expect, it } from 'vitest';
import { formatCpf, isValidCpf, maskCpf } from './cpf';

describe('CPF helper', () => {
  it('validates real-format valid CPFs and rejects invalid ones', () => {
    expect(isValidCpf('52998224725')).toBe(true);
    expect(isValidCpf('529.982.247-25')).toBe(true);
    expect(isValidCpf('111.111.111-11')).toBe(false);
    expect(isValidCpf('529.982.247-26')).toBe(false);
    expect(isValidCpf('123')).toBe(false);
  });

  it('formats and masks CPF properly', () => {
    expect(formatCpf('52998224725')).toBe('529.982.247-25');
    expect(maskCpf('52998224725')).toBe('•••.982.247-••');
  });
});
