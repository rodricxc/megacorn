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
import { getPhaseIndex, POOL_PHASES } from '../lib/phases';
import type { PoolPhase, PublicConfig } from '../types';

interface TimelineProps {
  config: PublicConfig;
  compact?: boolean;
}

function getPhaseIcon(phase: PoolPhase, size: number) {
  switch (phase) {
    case 'registration':
      return <CalendarCheck size={size} />;
    case 'registration_closed':
      return <Lock size={size} />;
    case 'consolidating_payments':
      return <Coins size={size} />;
    case 'bet_placed':
      return <Ticket size={size} />;
    case 'delivering_tickets':
      return <Gift size={size} />;
    case 'draw':
      return <Trophy size={size} />;
    case 'claiming_prize':
      return <HandCoins size={size} />;
    case 'retired':
      return <Palmtree size={size} />;
  }
}

export function Timeline({ config, compact = false }: TimelineProps) {
  const activeIdx = getPhaseIndex(config.currentPhase);

  return (
    <div
      className={`tl-track${compact ? ' tl-track-compact' : ''}`}
      role="list"
      aria-label="Linha do tempo de evolução do bolão MegaCorn"
    >
      {POOL_PHASES.map((step, index) => {
        const status =
          index < activeIdx
            ? 'past'
            : index === activeIdx
              ? 'current'
              : 'upcoming';

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
            <div className="tl-balloon-head">
              <span className="tl-balloon-title">{step.label}</span>
              {status === 'current' && (
                <span className="tl-now-pill">Agora</span>
              )}
              {status === 'past' && (
                <span className="tl-done-pill" aria-label="Concluído">
                  <Check size={11} strokeWidth={3} />
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
          <div
            key={step.id}
            role="listitem"
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
            <div className="tl-rail">
              {!isFirst && (
                <span
                  className={`tl-seg tl-seg-left${leftPassed ? ' tl-seg-passed' : ''}`}
                  aria-hidden="true"
                />
              )}
              {!isLast && (
                <span
                  className={`tl-seg tl-seg-right${rightPassed ? ' tl-seg-passed' : ''}`}
                  aria-hidden="true"
                />
              )}
              <div
                className={`tl-node tl-node-${status}`}
                title={`${index + 1}. ${step.label}`}
              >
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
              {/* Versão mobile (exibida apenas em telas pequenas para itens 'top') */}
              {position === 'top' && (
                <div className="tl-mobile-only">{balloon}</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
