import type { PoolPhase, PublicConfig } from '../types';

export interface PoolPhaseMeta {
  id: PoolPhase;
  shortLabel: string;
  label: string;
  description: string;
  dateField?: keyof Pick<
    PublicConfig,
    'registrationDeadline' | 'paymentDeadline' | 'betPlacementDate' | 'drawDate'
  >;
  datePrefix?: string;
}

export const POOL_PHASES: PoolPhaseMeta[] = [
  {
    id: 'registration',
    shortLabel: 'Cadastro',
    label: 'Fase de cadastro',
    description: 'Inscrições abertas para o time reservar cotas.',
    dateField: 'registrationDeadline',
    datePrefix: 'Até',
  },
  {
    id: 'registration_closed',
    shortLabel: 'Cadastro fechado',
    label: 'Cadastro fechado',
    description: 'Novas inscrições encerradas; revisando a lista.',
  },
  {
    id: 'consolidating_payments',
    shortLabel: 'Pagamentos',
    label: 'Consolidando pagamentos',
    description: 'Conferindo PIX, fechando equidade e eventuais estornos.',
    dateField: 'paymentDeadline',
    datePrefix: 'PIX até',
  },
  {
    id: 'bet_placed',
    shortLabel: 'Aposta feita',
    label: 'Aposta feita',
    description: 'Volantes registrados na lotérica! Cotas dos bilhetes liberadas.',
    dateField: 'betPlacementDate',
    datePrefix: 'Data',
  },
  {
    id: 'delivering_tickets',
    shortLabel: 'Entregando bilhetes',
    label: 'Bilhetes sendo entregues',
    description: 'Comprovantes físicos sendo entregues em mãos ao time.',
  },
  {
    id: 'draw',
    shortLabel: 'Sorteio',
    label: 'Sorteio',
    description: 'Hora da virada! Conferindo as dezenas sorteadas.',
    dateField: 'drawDate',
    datePrefix: 'Dia',
  },
  {
    id: 'claiming_prize',
    shortLabel: 'Resgatar prêmio',
    label: 'Resgatar prêmio',
    description: 'Organizando o resgate e o rateio proporcional por cota.',
  },
  {
    id: 'retired',
    shortLabel: 'Aposentar!',
    label: 'Aposentar',
    description: 'Missão cumprida — nos vemos na praia!',
  },
];

export function getPhaseIndex(phase: PoolPhase | undefined): number {
  const idx = POOL_PHASES.findIndex((p) => p.id === phase);
  return idx >= 0 ? idx : 0;
}

export function getPhaseMeta(phase: PoolPhase | undefined): PoolPhaseMeta {
  return POOL_PHASES[getPhaseIndex(phase)];
}

/**
 * Só permite assinalar nº de cota no bilhete e marcar comprovante entregue em mãos
 * depois que a aposta foi feita (fase `bet_placed` em diante).
 */
export function canManageTickets(phase: PoolPhase | undefined): boolean {
  return getPhaseIndex(phase) >= getPhaseIndex('bet_placed');
}
