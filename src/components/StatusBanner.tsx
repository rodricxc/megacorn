import { Lock, Megaphone, Sparkles } from 'lucide-react';
import { useApp } from '../context/useApp';
import { getPhaseMeta } from '../lib/phases';

export function StatusBanner() {
  const { publicConfig } = useApp();
  const { flags, bannerMessage } = publicConfig;
  const phaseMeta = getPhaseMeta(publicConfig.currentPhase);

  return (
    <div className="status-banner" role="region" aria-label="Status do bolão">
      <div className="container status-banner-inner">
        <div className="row" style={{ gap: 8 }}>
          {flags.poolClosed ? (
            <Lock size={16} aria-hidden="true" />
          ) : (
            <Megaphone size={16} aria-hidden="true" />
          )}
          <span style={{ fontWeight: 600 }}>
            {flags.poolClosed
              ? 'Bolão fechado — rateio final de equidade congelado!'
              : bannerMessage || `${publicConfig.poolName} ${publicConfig.edition}`}
          </span>
        </div>

        <div className="stage-chips">
          <span className="badge badge-unicorn">
            <Sparkles size={12} aria-hidden="true" />
            Fase: {phaseMeta.label}
          </span>
          <span
            className={`badge ${flags.registrationsOpen ? 'badge-success' : 'badge-neutral'}`}
          >
            Inscrições: {flags.registrationsOpen ? 'Abertas' : 'Pausadas'}
          </span>
          <span
            className={`badge ${flags.pixPaymentOpen ? 'badge-success' : 'badge-neutral'}`}
          >
            PIX: {flags.pixPaymentOpen ? 'Liberado' : 'Pausado'}
          </span>
        </div>
      </div>
    </div>
  );
}
