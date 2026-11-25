import {
  Calculator,
  Clover,
  EyeOff,
  Sparkles,
  Trophy,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import {
  calculateGameOdds,
  calculatePoolCombinedOdds,
  checkGameAgainstDraw,
  formatOneIn,
  formatPercent,
  parseLotteryNumbers,
} from '../lib/lottery';

export function GamesPage() {
  const {
    authLoading,
    dataLoading,
    authUser,
    profile,
    publicConfig,
    games,
    drawResult,
  } = useApp();

  const [simInput, setSimInput] = useState('');

  useEffect(() => {
    if (drawResult.numbers.length > 0) {
      setSimInput(
        drawResult.numbers.map((n) => String(n).padStart(2, '0')).join(' ')
      );
    }
  }, [drawResult.numbers]);

  const activeDrawNumbers = useMemo(
    () => parseLotteryNumbers(simInput).slice(0, 6),
    [simInput]
  );

  const combinedOdds = useMemo(
    () => calculatePoolCombinedOdds(games.map((g) => g.numbers)),
    [games]
  );

  const checkedGames = useMemo(
    () =>
      games.map((game) => ({
        game,
        odds: calculateGameOdds(game.numbers.length),
        check:
          activeDrawNumbers.length > 0
            ? checkGameAgainstDraw(game.numbers, activeDrawNumbers)
            : null,
      })),
    [games, activeDrawNumbers]
  );

  const totals = useMemo(() => {
    return checkedGames.reduce(
      (acc, item) => {
        if (item.check) {
          acc.senas += item.check.senaCount;
          acc.quinas += item.check.quinaCount;
          acc.quadras += item.check.quadraCount;
        }
        return acc;
      },
      { senas: 0, quinas: 0, quadras: 0 }
    );
  }, [checkedGames]);

  if (!authLoading && !authUser) {
    return <Navigate to="/" replace />;
  }

  if (authLoading || dataLoading) {
    return (
      <div className="container">
        <div className="card" role="status" aria-busy="true">
          Carregando jogos e probabilidades do MegaCorn...
        </div>
      </div>
    );
  }

  if (!publicConfig.flags.gamesVisible && !profile?.isModerator) {
    return (
      <div className="container">
        <div className="card stack-sm">
          <div className="row" style={{ gap: 10 }}>
            <EyeOff size={22} />
            <h1>Jogos temporariamente ocultos</h1>
          </div>
          <p style={{ color: 'var(--ink-secondary)' }}>
            Os administradores publicarão os volantes oficiais aqui assim que as
            apostas forem registradas.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container stack-lg">
      {/* Resumo de probabilidades acumuladas do bolão */}
      <section className="card stack-md">
        <div className="row-between">
          <div>
            <h1>Jogos Apostados, Probabilidades &amp; Conferidor</h1>
            <p style={{ color: 'var(--ink-secondary)', fontSize: '0.92rem' }}>
              Transparência total dos volantes do {publicConfig.poolName} com
              cálculo exato das chances de ganhar (Mega-Sena / Mega da Virada —
              60 dezenas).
            </p>
          </div>
          {combinedOdds.multiplierVsSingleBet > 0 && (
            <span className="badge badge-warning" style={{ fontSize: '0.86rem', padding: '6px 12px' }}>
              <Sparkles size={14} />
              {combinedOdds.multiplierVsSingleBet.toLocaleString('pt-BR')}x mais
              chance que 1 jogo simples
            </span>
          )}
        </div>

        <div className="grid-4">
          <div className="stat-tile">
            <div className="stat-label">Volantes registrados</div>
            <div className="stat-value">{combinedOdds.totalGames}</div>
            <div className="stat-sub">
              Equivale a{' '}
              <strong>
                {combinedOdds.totalEquivalentSimpleBets.toLocaleString('pt-BR')}
              </strong>{' '}
              aposta(s) de 6 dezenas
            </div>
          </div>

          <div className="stat-tile">
            <div className="stat-label">Chance combinada — Sena (6)</div>
            <div className="stat-value" style={{ fontSize: '1.32rem' }}>
              {formatOneIn(combinedOdds.senaOneIn)}
            </div>
            <div className="stat-sub">
              {formatPercent(combinedOdds.senaCombinedProbability)}
            </div>
          </div>

          <div className="stat-tile">
            <div className="stat-label">Chance combinada — Quina (5)</div>
            <div className="stat-value" style={{ fontSize: '1.32rem' }}>
              {formatOneIn(combinedOdds.quinaOneIn)}
            </div>
            <div className="stat-sub">
              {formatPercent(combinedOdds.quinaCombinedProbability)}
            </div>
          </div>

          <div className="stat-tile">
            <div className="stat-label">Chance combinada — Quadra (4)</div>
            <div className="stat-value" style={{ fontSize: '1.32rem' }}>
              {formatOneIn(combinedOdds.quadraOneIn)}
            </div>
            <div className="stat-sub">
              {formatPercent(combinedOdds.quadraCombinedProbability)}
            </div>
          </div>
        </div>

        {combinedOdds.hasOverlappingGames && (
          <div className="alert alert-info">
            <Calculator size={17} style={{ flexShrink: 0, marginTop: 2 }} />
            <span>
              Alguns volantes compartilham 6 ou mais dezenas entre si — a chance
              combinada exibida acima ajusta essa sobreposição por aproximação
              independente.
            </span>
          </div>
        )}
      </section>

      {/* Conferidor interativo */}
      <section className="card stack-md" id="result-checker-card">
        <div className="row-between">
          <div className="row" style={{ gap: 8 }}>
            <Trophy size={20} color="var(--corn-600)" />
            <h2>Conferidor de Resultado</h2>
          </div>
          {drawResult.numbers.length === 6 ? (
            <span className="badge badge-success">
              Resultado oficial publicado pela organização
            </span>
          ) : (
            <span className="badge badge-neutral">
              Simulador livre — digite 6 dezenas para testar
            </span>
          )}
        </div>

        <div className="row" style={{ alignItems: 'flex-end' }}>
          <div className="field" style={{ flex: 1, minWidth: 260 }}>
            <label htmlFor="checker-draw-input">
              Dezenas sorteadas (6 números de 01 a 60 separados por espaço ou vírgula)
            </label>
            <input
              id="checker-draw-input"
              type="text"
              className="input mono"
              placeholder="Ex.: 04 10 17 23 34 59"
              value={simInput}
              onChange={(e) => setSimInput(e.target.value)}
            />
          </div>
          {simInput && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setSimInput('')}
              id="btn-clear-checker"
            >
              Limpar
            </button>
          )}
        </div>

        {activeDrawNumbers.length > 0 && (
          <div className="stack-sm" role="status" aria-live="polite">
            <div
              className="balls-row"
              role="list"
              aria-label="Dezenas sorteadas em conferência"
            >
              {activeDrawNumbers.map((n) => (
                <span
                  key={n}
                  role="listitem"
                  className="lottery-ball draw"
                  aria-label={`Dezena sorteada ${String(n).padStart(2, '0')}`}
                >
                  {String(n).padStart(2, '0')}
                </span>
              ))}
            </div>

            <div className="grid-3">
              <div className="card-gold">
                <div className="stat-label">Senas (6 acertos)</div>
                <div className="stat-value">{totals.senas}</div>
              </div>
              <div className="card-mint">
                <div className="stat-label">Quinas (5 acertos)</div>
                <div className="stat-value">{totals.quinas}</div>
              </div>
              <div className="card-unicorn">
                <div className="stat-label">Quadras (4 acertos)</div>
                <div className="stat-value">{totals.quadras}</div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Lista de volantes */}
      <section className="stack-md">
        <div className="row" style={{ gap: 8 }}>
          <Clover size={20} color="var(--luck-500)" aria-hidden="true" />
          <h2>Volantes do Bolão ({games.length})</h2>
        </div>

        {games.length === 0 ? (
          <div className="card" role="status">
            Nenhum volante cadastrado ainda pelos organizadores.
          </div>
        ) : (
          <div className="stack-md">
            {checkedGames.map(({ game, odds, check }) => {
              const hitSet = new Set(check?.matchedNumbers || []);
              return (
                <article
                  key={game.id}
                  className="card stack-sm"
                  aria-label={game.label}
                >
                  <div className="row-between">
                    <div>
                      <h3>{game.label}</h3>
                      {game.notes && (
                        <p style={{ fontSize: '0.86rem', color: 'var(--ink-secondary)', marginTop: 2 }}>
                          {game.notes}
                        </p>
                      )}
                    </div>
                    <div className="row" style={{ gap: 6 }}>
                      <span className="badge badge-neutral">
                        {game.numbers.length} dezenas (
                        {odds.equivalentSimpleBets.toLocaleString('pt-BR')} comb.)
                      </span>
                      {check && (
                        <span
                          className={`badge ${
                            check.hitCount >= 4
                              ? 'badge-success'
                              : 'badge-unicorn'
                          }`}
                        >
                          {check.hitCount} acerto{check.hitCount === 1 ? '' : 's'}
                        </span>
                      )}
                    </div>
                  </div>

                  <div
                    className="balls-row"
                    role="list"
                    aria-label={`Dezenas do ${game.label}`}
                  >
                    {game.numbers.map((num) => {
                      const isHit = hitSet.has(num);
                      const labelNum = String(num).padStart(2, '0');
                      return (
                        <span
                          key={num}
                          role="listitem"
                          className={`lottery-ball${isHit ? ' hit' : ''}`}
                          aria-label={
                            isHit
                              ? `Dezena ${labelNum}, acertou`
                              : `Dezena ${labelNum}`
                          }
                        >
                          {labelNum}
                        </span>
                      );
                    })}
                  </div>

                  {check &&
                    (check.senaCount > 0 ||
                      check.quinaCount > 0 ||
                      check.quadraCount > 0) && (
                      <div className="alert alert-success" role="status">
                        <Trophy size={17} aria-hidden="true" />
                        <strong>
                          Volante premiado!{' '}
                          {check.senaCount > 0 && `${check.senaCount} Sena(s) `}
                          {check.quinaCount > 0 && `${check.quinaCount} Quina(s) `}
                          {check.quadraCount > 0 && `${check.quadraCount} Quadra(s)`}
                        </strong>
                      </div>
                    )}

                  <div
                    className="grid-3"
                    style={{
                      borderTop: '1px solid var(--border-subtle)',
                      paddingTop: 12,
                      fontSize: '0.84rem',
                    }}
                  >
                    <div>
                      <span style={{ color: 'var(--ink-muted)' }}>Sena (6): </span>
                      <strong className="mono">{formatOneIn(odds.senaOneIn)}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--ink-muted)' }}>Quina (5): </span>
                      <strong className="mono">{formatOneIn(odds.quinaOneIn)}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--ink-muted)' }}>Quadra (4): </span>
                      <strong className="mono">{formatOneIn(odds.quadraOneIn)}</strong>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
