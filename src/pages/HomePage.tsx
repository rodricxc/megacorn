import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clover,
  Mail,
  ShieldCheck,
  Sparkles,
  User,
} from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Timeline } from '../components/Timeline';
import { useApp } from '../context/AppContext';
import { formatCurrencyBr } from '../lib/appsScript';
import { getSessionCookieHint } from '../lib/session';
import { dataService } from '../services';

export function HomePage() {
  const { authUser, profile, publicConfig, isDemoMode } = useApp();
  const navigate = useNavigate();

  const [email, setEmail] = useState(getSessionCookieHint() || '');
  const [sending, setSending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const clean = email.trim().toLowerCase();
    if (!clean || !clean.includes('@')) {
      setError('Informe um endereço de e-mail pessoal válido.');
      return;
    }
    setSending(true);
    try {
      await dataService.sendMagicLink(clean, '/minha-cota');
      setSentTo(clean);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Não foi possível enviar o Magic Link. Verifique a configuração do Firebase.'
      );
    } finally {
      setSending(false);
    }
  }

  async function handleDemoInstantLogin(targetEmail: string) {
    if (!dataService.demoQuickSignIn) return;
    setSending(true);
    try {
      await dataService.demoQuickSignIn(targetEmail);
      navigate('/minha-cota');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="container stack-lg">
      <section className="card stack-md">
        <div className="hero-grid">
          <div className="stack-md">
            <div className="row" style={{ gap: 8 }}>
              <span className="badge badge-warning">
                <Sparkles size={13} />
                Edição {publicConfig.edition}
              </span>
              <span className="badge badge-success">
                <Clover size={13} />
                {publicConfig.totalQuotas} cotas • {formatCurrencyBr(publicConfig.quotaPrice)} cada
              </span>
            </div>

            <h1>
              Bolão {publicConfig.poolName}: sorte coletiva com equidade de verdade
            </h1>

            <p className="hero-lead">
              Reserve suas cotas do bolão de fim de ano do time com regra justa:
              todo mundo tem prioridade na 1ª cota antes das extras. Pagamento por
              PIX com identificador único, transparência total dos jogos e
              privacidade protegida.
            </p>

            <div className="row">
              {authUser ? (
                <>
                  <Link
                    to="/minha-cota"
                    className="btn btn-primary"
                    id="hero-go-my-quota"
                  >
                    Ir para Minha Cota
                    <ArrowRight size={16} />
                  </Link>
                  {profile?.isModerator && (
                    <Link to="/admin" className="btn btn-unicorn" id="hero-go-admin">
                      <ShieldCheck size={16} />
                      Abrir Painel Admin
                    </Link>
                  )}
                </>
              ) : null}

              <Link
                to="/regras"
                className="btn btn-secondary"
                id="hero-read-rules"
              >
                <BookOpen size={16} />
                Ler Regras e Funcionamento
              </Link>
            </div>
          </div>

          <div className="hero-mascot-wrap">
            <img
              src="./megacorn-mascot.jpg"
              alt="Mascote MegaCorn — Milho dourado com chifre de unicórnio, trevos da sorte e moedas"
              className="hero-mascot"
            />
            <p
              style={{
                textAlign: 'center',
                fontSize: '0.84rem',
                color: 'var(--ink-muted)',
                maxWidth: '30ch',
              }}
            >
              Milho dourado, unicórnio da sorte e contas claras para a virada do
              time.
            </p>
          </div>
        </div>

        <div
          className="stack-xs"
          style={{
            borderTop: '1px solid var(--border-subtle)',
            paddingTop: 18,
          }}
        >
          <div className="stat-label">Cronograma do {publicConfig.poolName}</div>
          <Timeline config={publicConfig} compact />
        </div>
      </section>

      {!authUser && (
        <section className="grid-2">
          <div className="card stack-md" id="login-card">
            <div>
              <h2>Entrar com Magic Link (sem senha)</h2>
              <p style={{ color: 'var(--ink-secondary)', fontSize: '0.92rem', marginTop: 4 }}>
                Use seu <strong>e-mail pessoal</strong>. Enviaremos um link de
                acesso rápido e sua sessão ficará salva neste navegador até você
                clicar em <strong>Sair</strong>.
              </p>
            </div>

            {sentTo ? (
              <div className="stack-sm">
                <div className="alert alert-success">
                  <CheckCircle2 size={18} style={{ flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <strong>Magic Link enviado para {sentTo}!</strong>
                    <p style={{ marginTop: 4 }}>
                      Abra seu e-mail (verifique também Spam/Promoções) e clique
                      no link para entrar automaticamente. Se abrir em outro
                      dispositivo, basta confirmar o e-mail na tela de retorno.
                    </p>
                  </div>
                </div>

                {isDemoMode && (
                  <div className="card-unicorn stack-sm">
                    <strong>Simulação do Magic Link (Modo Demo):</strong>
                    <p style={{ fontSize: '0.86rem', color: 'var(--ink-secondary)' }}>
                      Como o Firebase ainda não está conectado neste ambiente,
                      clique abaixo para simular o clique no link recebido por
                      e-mail:
                    </p>
                    <button
                      type="button"
                      className="btn btn-unicorn"
                      onClick={() => handleDemoInstantLogin(sentTo)}
                      id="btn-demo-complete-magic-link"
                    >
                      Abrir link de {sentTo} agora
                      <ArrowRight size={15} />
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setSentTo(null)}
                >
                  Usar outro e-mail
                </button>
              </div>
            ) : (
              <form onSubmit={handleSendMagicLink} className="stack-sm">
                <div className="field">
                  <label htmlFor="login-email-input">Seu e-mail pessoal</label>
                  <input
                    id="login-email-input"
                    type="email"
                    required
                    className="input"
                    placeholder="seu.nome@gmail.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                  <span className="field-hint">
                    No primeiro acesso você informará o código de convite do time.
                  </span>
                </div>

                {error && <div className="alert alert-danger">{error}</div>}

                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={sending}
                  id="btn-send-magic-link"
                >
                  <Mail size={16} />
                  {sending ? 'Enviando link...' : 'Receber link de acesso no e-mail'}
                </button>
              </form>
            )}
          </div>

          <div className="card stack-md">
            <div>
              <h2>Como funciona em 4 passos</h2>
              <p style={{ color: 'var(--ink-secondary)', fontSize: '0.9rem', marginTop: 4 }}>
                Simples, justo e transparente para todo mundo do time.
              </p>
            </div>

            <div className="stack-sm" style={{ fontSize: '0.92rem' }}>
              <div className="card-cream">
                <strong>1. Entre com seu e-mail + código de convite</strong>
                <p style={{ color: 'var(--ink-secondary)', marginTop: 2 }}>
                  Sem criar senha. O código garante que só o time participe, com
                  revisão dos moderadores.
                </p>
              </div>
              <div className="card-cream">
                <strong>2. Escolha quantas cotas deseja (até {publicConfig.maxQuotasPerPerson})</strong>
                <p style={{ color: 'var(--ink-secondary)', marginTop: 2 }}>
                  A 1ª cota de todo mundo tem prioridade absoluta. Cotas extras
                  entram por camadas de equidade.
                </p>
              </div>
              <div className="card-cream">
                <strong>3. Pague pelo PIX com código único (TXID)</strong>
                <p style={{ color: 'var(--ink-secondary)', marginTop: 2 }}>
                  Mesmo antes da aprovação você já pode fazer o PIX e clicar em
                  “Já fiz o PIX”. Se perder cota extra no fechamento, controlamos
                  o estorno automaticamente.
                </p>
              </div>
              <div className="card-mint">
                <strong>4. Acompanhe o placar, jogos e probabilidades</strong>
                <p style={{ color: 'var(--ink-secondary)', marginTop: 2 }}>
                  Veja os volantes registrados, as chances exatas de Sena/Quina/Quadra
                  e confira o resultado na hora!
                </p>
              </div>
            </div>

            {isDemoMode && (
              <div className="card-unicorn stack-sm" id="demo-quick-panel">
                <div className="row-between">
                  <strong>Acesso rápido — Modo Demo</strong>
                  <span className="badge badge-unicorn">Convite: MEGACORN2026</span>
                </div>
                <p style={{ fontSize: '0.84rem', color: 'var(--ink-secondary)' }}>
                  Teste a aplicação agora mesmo com um perfil pronto ou entre com
                  qualquer e-mail novo acima:
                </p>
                <div className="row">
                  <button
                    type="button"
                    className="btn btn-unicorn btn-sm"
                    onClick={() =>
                      handleDemoInstantLogin('organizador@megacorn.demo')
                    }
                    id="btn-demo-login-admin"
                  >
                    <ShieldCheck size={14} />
                    Entrar como Moderadora
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() =>
                      handleDemoInstantLogin('bia.almeida@pessoal.demo')
                    }
                    id="btn-demo-login-member"
                  >
                    <User size={14} />
                    Entrar como Participante
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() =>
                      handleDemoInstantLogin('thiago.mendes@pessoal.demo')
                    }
                    id="btn-demo-login-pending"
                  >
                    <User size={14} />
                    Entrar como Pendente
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
