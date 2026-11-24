/**
 * Utilitários de validação, formatação e mascaramento de CPF (PII opcional).
 */

export function sanitizeCpf(value: string): string {
  return value.replace(/\D/g, '').slice(0, 11);
}

export function isValidCpf(value: string): boolean {
  const digits = sanitizeCpf(value);
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;

  let sum1 = 0;
  for (let i = 0; i < 9; i++) {
    sum1 += Number(digits[i]) * (10 - i);
  }
  const check1 = ((sum1 * 10) % 11) % 10;
  if (check1 !== Number(digits[9])) return false;

  let sum2 = 0;
  for (let i = 0; i < 10; i++) {
    sum2 += Number(digits[i]) * (11 - i);
  }
  const check2 = ((sum2 * 10) % 11) % 10;
  return check2 === Number(digits[10]);
}

export function formatCpf(value: string): string {
  const d = sanitizeCpf(value);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9, 11)}`;
}

export function maskCpf(value: string): string {
  const d = sanitizeCpf(value);
  if (d.length !== 11) return 'Não informado';
  return `•••.${d.slice(3, 6)}.${d.slice(6, 9)}-••`;
}
