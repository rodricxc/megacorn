import {
  CheckCircle2,
  Clock,
  EyeOff,
  Lock,
  Sparkles,
  Users,
} from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { Timeline } from '../components/Timeline';
import { useApp } from '../context/AppContext';
import { formatCurrencyBr } from '../lib/appsScript';

export function BoardPage() {
  const {
    authLoading,
    dataLoading,
    authUser,
    profile,
    publicConfig,
    boardEntries,
    poolStats,
    boardEquity,
  } = useApp();

  if (!authLoading && !authUser) {
    return <Navigate to="/" replace />;
  }

  if (authLoading || dataLoading) {
    return (
      <div className="container">
        <div className="card">Carregando placar de transparência...</div>
      </div>
    );
  }

  if (!publicConfig.flags.boardVisible && !profile?.isModerator) {
    return (
      <div className="container">
        <div className="card stack-sm">
          <div className="row" style={{ gap: 10 }}>
            <EyeOff size={22} />
            <h1>Placar temporariamente oculto</h1>
          </div>
          <p style={{ color: 'var(--ink-secondary)' }}>
            Os administradores desabilitaram temporariamente a visualização do
            placar de participantes.
          </p>
        </div>
      </div>
    );
  }

  const totalConfirmedQuotas = boardEntries.reduce(
    (sum, b) => sum + (b.paymentStatus === 'confirmed' ? b.paidQuotas : 0),
    0
  );
  const effectiveFundedQuotas = Math.min(
    publicConfig.totalQuotas,
    totalConfirmedQuotas
  );
  const fillPercent = Math.min(
    100,
    Math.round((boardEquity.totalAllocated / Math.max(1, publicConfig.totalQuotas)) * 100)
  );

  return (
    <div className="container stack-lg">
      <section className="card stack-md">
        <div className="row-between">
          <div>
            <h1>Placar de Transparência — {publicConfig.poolName}</h1>
            <p style={{ color: 'var(--ink-secondary)', fontSize: '0.92rem' }}>
              Acompanhe em tempo real os participantes aprovados, o rateio justo
              por equidade e o andamento dos pagamentos.
            </p>
          </div>
          <span className="badge badge-unicorn">
            <Lock size={13} />
            Sem e-mails ou CPFs expostos
          </span>
        </div>

        <div className="grid-4">
          <div className="stat-tile">
            <div className="stat-label">Cotas alocadas</div>
            <div className="stat-value">
              {boardEquity.totalAllocated}/{publicConfig.totalQuotas}
            </div>
            <div className="stat-sub">
              {boardEquity.totalRequested} cota(s) pedida(s) no total
            </div>
          </div>

          <div className="stat-tile">
            <div className="stat-label">Aprovados no placar</div>
            <div className="stat-value">{boardEntries.length}</div>
            <div className="stat-sub">
              {boardEquity.waitlistCount > 0
                ? `${boardEquity.waitlistCount} na fila de espera`
                : 'Todos com ao menos 1 cota'}
            </div>
          </div>

          <div className="stat-tile">
            <div className="stat-label">Aguardando aprovação</div>
            <div className="stat-value">{poolStats.pendingApprovalCount}</div>
            <div className="stat-sub">Contagem anônima (sem nomes)</div>
          </div>

          <div className="stat-tile">
            <div className="stat-label">PIX confirmados</div>
            <div className="stat-value">
              {formatCurrencyBr(effectiveFundedQuotas * publicConfig.quotaPrice)}
            </div>
            <div className="stat-sub">
              {totalConfirmedQuotas} cota(s) paga(s) confirmada(s)
            </div>
          </div>
        </div>

        <div className="stack-xs">
          <div className="row-between" style={{ fontSize: '0.84rem', fontWeight: 700 }}>
            <span>Preenchimento das {publicConfig.totalQuotas} cotas</span>
            <span>{fillPercent}%</span>
          </div>
          <div className="progress-track">
            <div
              className="progress-fill"
              style={{ width: `${fillPercent}%` }}
            />
          </div>
        </div>
      </section>

      <section className="card stack-sm" id="board-timeline-section">
        <h2>Evolução do Bolão</h2>
        <Timeline config={publicConfig} />
      </section>

      <section className="card stack-md">
        <div className="row-between">
          <div className="row" style={{ gap: 8 }}>
            <Users size={20} color="var(--luck-500)" />
            <h2>Participantes Aprovados</h2>
          </div>
          <span className="field-hint">
            Ordenado por ordem de inscrição (critério de desempate nas camadas)
          </span>
        </div>

        {boardEntries.length === 0 ? (
          <div className="card-cream">
            Nenhum participante aprovado ainda.
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Participante</th>
                  <th>Cotas Pedidas</th>
                  <th>
                    {publicConfig.flags.poolClosed
                      ? 'Cotas Finais'
                      : 'Cotas Estimadas (estado atual)'}
                  </th>
                  <th>Pagamento PIX</th>
                  <th>Nº Cota Bilhete / Entrega</th>
                  <th>Observação</th>
                </tr>
              </thead>
              <tbody>
                {boardEntries.map((entry, idx) => {
                  const alloc = boardEquity.allocations.get(entry.uid);
                  const isMe = entry.uid === authUser?.uid;
                  return (
                    <tr key={entry.uid}>
                      <td className="mono" style={{ color: 'var(--ink-muted)' }}>
                        {idx + 1}
                      </td>
                      <td>
                        <strong>{entry.displayName}</strong>{' '}
                        {isMe && (
                          <span className="badge badge-unicorn">Você</span>
                        )}
                      </td>
                      <td className="mono">{entry.requestedQuotas}</td>
                      <td>
                        {alloc?.isWaitlisted ? (
                          <span className="badge badge-warning">
                            Fila #{alloc.waitlistPosition}
                          </span>
                        ) : (
                          <span className="mono" style={{ fontWeight: 700 }}>
                            {publicConfig.flags.poolClosed
                              ? (entry.finalQuotas ?? alloc?.allocatedQuotas ?? 0)
                              : (alloc?.allocatedQuotas ?? 0)}
                          </span>
                        )}
                        {alloc && alloc.excessQuotas > 0 && !alloc.isWaitlisted && (
                          <span
                            className="field-hint"
                            style={{ marginLeft: 6 }}
                          >
                            (-{alloc.excessQuotas} exced.)
                          </span>
                        )}
                      </td>
                      <td>
                        {entry.paymentStatus === 'confirmed' && (
                          <span className="badge badge-success">
                            <CheckCircle2 size={13} />
                            Confirmado ({entry.paidQuotas}c)
                          </span>
                        )}
                        {entry.paymentStatus === 'reported' && (
                          <span className="badge badge-warning">
                            <Clock size={13} />
                            Avisou PIX
                          </span>
                        )}
                        {entry.paymentStatus === 'unpaid' && (
                          <span className="badge badge-neutral">Pendente</span>
                        )}
                      </td>
                      <td>
                        {entry.assignedTicketNumbers || entry.receiptDelivered ? (
                          <div className="row" style={{ gap: 6 }}>
                            {entry.assignedTicketNumbers && (
                              <span className="badge badge-warning mono">
                                {entry.assignedTicketNumbers}
                              </span>
                            )}
                            {entry.receiptDelivered && (
                              <span className="badge badge-success">
                                <CheckCircle2 size={12} />
                                Em mãos
                              </span>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: 'var(--ink-muted)', fontSize: '0.82rem' }}>
                            Após aposta
                          </span>
                        )}
                      </td>
                      <td>
                        {entry.refundStatus === 'pending' && (
                          <span className="badge badge-warning">
                            Estorno ({entry.refundQuotas}c)
                          </span>
                        )}
                        {entry.refundStatus === 'completed' && (
                          <span className="badge badge-success">
                            Estorno concluído
                          </span>
                        )}
                        {entry.refundStatus === 'none' && (
                          <span style={{ color: 'var(--ink-muted)', fontSize: '0.82rem' }}>
                            {publicConfig.flags.poolClosed &&
                            entry.paymentStatus === 'confirmed' ? (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                <Sparkles size={12} /> Confirmado no rateio
                              </span>
                            ) : (
                              '—'
                            )}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
