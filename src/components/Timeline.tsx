import {
  CalendarCheck,
  CheckCircle2,
  Coins,
  Gift,
  HandCoins,
  Lock,
  Palmtree,
  Ticket,
  Trophy,
} from 'lucide-react';
import { formatDateBr } from '../lib/appsScript';
import { getPhaseIndex, POOL_PHASES } from '../lib/phases';
import type { PoolPhase, PublicConfig } from '../types';

interface TimelineProps {
  config: PublicConfig;
  compact?: boolean;
}

function getPhaseIcon(phase: PoolPhase) {
  switch (phase) {
    case 'registration':
      return <CalendarCheck size={16} />;
    case 'registration_closed':
      return <Lock size={16} />;
    case 'consolidating_payments':
      return <Coins size={16} />;
    case 'bet_placed':
      return <Ticket size={16} />;
    case 'delivering_tickets':
      return <Gift size={16} />;
    case 'draw':
      return <Trophy size={16} />;
    case 'claiming_prize':
      return <HandCoins size={16} />;
    case 'retired':
      return <Palmtree size={16} />;
  }
}

export function Timeline({ config, compact = false }: TimelineProps) {
  const activeIdx = getPhaseIndex(config.currentPhase);

  return (
    <div
      className={`timeline timeline-8${compact ? ' timeline-compact' : ''}`}
      aria-label="Linha do tempo de evolução do bolão MegaCorn"
    >
      {POOL_PHASES.map((step, index) => {
        const status =
          index < activeIdx
            ? 'past'
            : index === activeIdx
              ? 'today'
              : 'upcoming';
        const dateValue = step.dateField ? config[step.dateField] : '';

        return (
          <div
            key={step.id}
            className={`timeline-step timeline-step-${status}`}
          >
            <div className="timeline-step-head">
              <span className="timeline-icon" aria-hidden="true">
                {status === 'past' ? (
                  <CheckCircle2 size={16} />
                ) : (
                  getPhaseIcon(step.id)
                )}
              </span>
              {status === 'today' ? (
                <span className="badge badge-warning" style={{ fontSize: '0.68rem', padding: '2px 7px' }}>
                  Agora
                </span>
              ) : (
                <span className="timeline-order">
                  {status === 'past' ? 'Feito' : `Etapa ${index + 1}`}
                </span>
              )}
            </div>

            <div className="timeline-label" style={{ marginTop: 6 }}>
              {step.label}
            </div>

            {dateValue && (
              <div className="timeline-date mono" style={{ fontSize: '0.82rem', marginTop: 2 }}>
                {step.datePrefix ? `${step.datePrefix} ` : ''}
                {formatDateBr(dateValue)}
              </div>
            )}

            {!compact && <p className="timeline-desc">{step.description}</p>}
          </div>
        );
      })}
    </div>
  );
}
