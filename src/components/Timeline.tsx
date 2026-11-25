import {
  CalendarCheck,
  Check,
  Coins,
  Gift,
  HandCoins,
  Lock,
  Palmtree,
  Ticket,
  Trophy,
} from 'lucide-react';
import { formatDateBr } from '../lib/appsScript';
import { getPhaseIndex, getPhaseMeta, POOL_PHASES } from '../lib/phases';
import type { PoolPhase, PublicConfig } from '../types';

interface TimelineProps {
  config: PublicConfig;
  compact?: boolean;
}

function getPhaseIcon(phase: PoolPhase, size: number) {
  const props = { size, 'aria-hidden': true as const };
  switch (phase) {
    case 'registration':
      return <CalendarCheck {...props} />;
    case 'registration_closed':
      return <Lock {...props} />;
    case 'consolidating_payments':
      return <Coins {...props} />;
    case 'bet_placed':
      return <Ticket {...props} />;
    case 'delivering_tickets':
      return <Gift {...props} />;
    case 'draw':
      return <Trophy {...props} />;
    case 'claiming_prize':
      return <HandCoins {...props} />;
    case 'retired':
      return <Palmtree {...props} />;
  }
}

export function Timeline({ config, compact = false }: TimelineProps) {
  const activeIdx = getPhaseIndex(config.currentPhase);
  const currentMeta = getPhaseMeta(config.currentPhase);

  return (
    <ol
      className={`tl-track${compact ? ' tl-track-compact' : ''}`}
      style={{ listStyle: 'none', margin: 0 }}
      aria-label={`Linha do tempo de evolução do bolão ${config.poolName}: atualmente na etapa ${activeIdx + 1} de ${POOL_PHASES.length}, ${currentMeta.label}`}
    >
      {POOL_PHASES.map((step, index) => {
        const status =
          index < activeIdx
            ? 'past'
            : index === activeIdx
              ? 'current'
              : 'upcoming';

        const statusSrText =
          status === 'past'
            ? 'Concluída'
            : status === 'current'
              ? 'Fase atual'
              : 'Próxima etapa';

        const leftPassed = index > 0 && index <= activeIdx;
        const rightPassed = index < POOL_PHASES.length - 1 && index < activeIdx;
        const isFirst = index === 0;
        const isLast = index === POOL_PHASES.length - 1;
        const position = index % 2 === 0 ? 'top' : 'bottom';
        const dateValue = step.dateField ? config[step.dateField] : '';
        const iconSize = status === 'current' ? 24 : 17;

        const balloon = (
          <div
            className={`tl-balloon tl-balloon-${status} tl-balloon-${position}${
              isFirst ? ' tl-balloon-first' : ''
            }${isLast ? ' tl-balloon-last' : ''}`}
          >
            <span className="sr-only">
              Etapa {index + 1} de {POOL_PHASES.length} ({statusSrText}):
            </span>
            <div className="tl-balloon-head">
              <span className="tl-balloon-title">{step.label}</span>
              {status === 'current' && (
                <span className="tl-now-pill" aria-hidden="true">
                  Agora
                </span>
              )}
              {status === 'past' && (
                <span className="tl-done-pill" aria-hidden="true">
                  <Check size={11} strokeWidth={3} aria-hidden="true" />
                </span>
              )}
            </div>

            {dateValue && (
              <div className="tl-balloon-date mono">
                {step.datePrefix ? `${step.datePrefix} ` : ''}
                {formatDateBr(dateValue)}
              </div>
            )}

            {(!compact || status === 'current') && (
              <p className="tl-balloon-desc">{step.description}</p>
            )}
          </div>
        );

        return (
          <li
            key={step.id}
            aria-current={status === 'current' ? 'step' : undefined}
            className={`tl-item tl-item-${status} tl-item-${position}`}
          >
            {/* Slot superior (desktop: etapas 1, 3, 5, 7) */}
            <div className="tl-slot tl-slot-top">
              {position === 'top' && (
                <>
                  {balloon}
                  <span className="tl-pointer tl-pointer-down" aria-hidden="true" />
                </>
              )}
            </div>

            {/* Trilho + Ponto circular com ícone */}
            <div className="tl-rail" aria-hidden="true">
              {!isFirst && (
                <span
                  className={`tl-seg tl-seg-left${leftPassed ? ' tl-seg-passed' : ''}`}
                />
              )}
              {!isLast && (
                <span
                  className={`tl-seg tl-seg-right${rightPassed ? ' tl-seg-passed' : ''}`}
                />
              )}
              <div className={`tl-node tl-node-${status}`}>
                {getPhaseIcon(step.id, iconSize)}
              </div>
            </div>

            {/* Slot inferior (desktop: etapas 2, 4, 6, 8; mobile: todas) */}
            <div className="tl-slot tl-slot-bottom">
              {position === 'bottom' && (
                <>
                  <span className="tl-pointer tl-pointer-up" aria-hidden="true" />
                  {balloon}
                </>
              )}
              {position === 'top' && (
                <div className="tl-mobile-only">{balloon}</div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
