import type { EquityCalculationResult, UserProfile } from '../types';
import { formatCpf, maskCpf } from './cpf';

function escapeCsvCell(value: string | number | null | undefined): string {
  const str = value == null ? '' : String(value);
  if (/[",\n;]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportParticipantsCsv(
  users: UserProfile[],
  equity: EquityCalculationResult,
  quotaPrice: number,
  includeFullCpf: boolean
): void {
  const headers = [
    'Nome',
    'Email',
    includeFullCpf ? 'CPF (Completo - PII)' : 'CPF (Mascarado)',
    'Status Aprovacao',
    'Cotas Pedidas',
    'Cotas Alocadas (Equidade)',
    'Cotas Pagas',
    'Cotas Finais',
    'Fila de Espera',
    'Status PIX',
    'TXID',
    'Valor Pedido (R$)',
    'Status Estorno',
    'Cotas Estorno',
    'Valor Estorno (R$)',
    'Numero Cota Bilhete',
    'Comprovante Entregue em Maos',
    'Inscrito em',
  ];

  const rows = users
    .slice()
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((u) => {
      const alloc = equity.allocations.get(u.uid);
      const cpfOut = u.cpf
        ? includeFullCpf
          ? formatCpf(u.cpf)
          : maskCpf(u.cpf)
        : '';
      return [
        u.displayName,
        u.email,
        cpfOut,
        u.approvalStatus,
        u.requestedQuotas,
        alloc?.allocatedQuotas ?? 0,
        u.paidQuotas,
        u.finalQuotas ?? '',
        alloc?.waitlistPosition ?? '',
        u.paymentStatus,
        u.txid,
        (u.requestedQuotas * quotaPrice).toFixed(2),
        u.refundStatus,
        u.refundQuotas,
        u.refundAmount.toFixed(2),
        u.assignedTicketNumbers || '',
        u.receiptDelivered ? 'Sim' : 'Nao',
        new Date(u.createdAt).toLocaleString('pt-BR'),
      ].map(escapeCsvCell);
    });

  // BOM UTF-8 para abrir corretamente no Excel em português
  const csvContent =
    '\uFEFF' + [headers.map(escapeCsvCell).join(';'), ...rows.map((r) => r.join(';'))].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const suffix = includeFullCpf ? 'com-cpf-sensivel' : 'mascarado';
  link.href = url;
  link.download = `megacorn-participantes-${suffix}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
