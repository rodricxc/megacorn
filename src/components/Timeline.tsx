import { CalendarCheck, CheckCircle2, Coins, Ticket, Trophy } from 'lucide-react';
import { formatDateBr } from '../lib/appsScript';
import type { PublicConfig } from '../types';

interface TimelineProps {
  config: PublicConfig;
  compact?: boolean;
}

interface TimelineStep {
  id: string;
  label: string;
  description: string;
  dateIso: string;
  icon: React.ReactNode;
}

function getStepStatus(dateIso: string): 'past' | 'today' | 'upcoming' {
  if (!dateIso) return 'upcoming';
  const today = new Date();
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  if (dateIso < todayIso) return 'past';
  if (dateIso === todayIso) return 'today';
  return 'upcoming';
}

export function Timeline({ config, compact = false }: TimelineProps) {
  const steps: TimelineStep[] = [
    {
      id: 'registration',
      label: 'Limite para registro',
      description: 'Último dia para se cadastrar e reservar cotas.',
      dateIso: config.registrationDeadline,
      icon: <CalendarCheck size={17} />,
    },
    {
      id: 'payment',
      label: 'Limite para pagamento',
      description: 'Prazo final para fazer o PIX e avisar no site.',
      dateIso: config.paymentDeadline,
      icon: <Coins size={17} />,
    },
    {
      id: 'bet',
      label: 'Realização da aposta',
      description: 'Registro oficial dos volantes na lotérica + publicação.',
      dateIso: config.betPlacementDate,
      icon: <Ticket size={17} />,
    },
    {
      id: 'draw',
      label: 'Sorteio oficial',
      description: 'Conferência ao vivo dos acertos na aba Jogos.',
      dateIso: config.drawDate,
      icon: <Trophy size={17} />,
    },
  ];

  return (
    <div
      className={`timeline${compact ? ' timeline-compact' : ''}`}
      aria-label="Linha do tempo do bolão MegaCorn"
    >
      {steps.map((step, index) => {
        const status = getStepStatus(step.dateIso);
        return (
          <div
            key={step.id}
            className={`timeline-step timeline-step-${status}`}
          >
            <div className="timeline-step-head">
              <span className="timeline-icon" aria-hidden="true">
                {status === 'past' ? <CheckCircle2 size={16} /> : step.icon}
              </span>
              <span className="timeline-order">Etapa {index + 1}</span>
            </div>
            <div className="timeline-date mono">{formatDateBr(step.dateIso)}</div>
            <div className="timeline-label">{step.label}</div>
            {!compact && (
              <p className="timeline-desc">{step.description}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
