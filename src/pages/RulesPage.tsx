import {
  ArrowRight,
  Calendar,
  Clover,
  Coins,
  HelpCircle,
  Lock,
  Scale,
  ShieldCheck,
  Undo2,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Timeline } from '../components/Timeline';
import { useApp } from '../context/AppContext';
import { formatCurrencyBr, formatDateBr } from '../lib/appsScript';

export function RulesPage() {
  const { authUser, publicConfig } = useApp();
  const maxPoolBudget = publicConfig.totalQuotas * publicConfig.quotaPrice;

  return (
    <div className="container stack-lg">
      <div className="card stack-md">
        <div className="row-between">
          <div className="stack-xs">
            <span className="badge badge-warning" style={{ width: 'fit-content' }}>
              Página Pública • Regras Oficiais
            </span>
            <h1>Regras e Funcionamento — {publicConfig.poolName}</h1>
            <p style={{ color: 'var(--ink-secondary)', maxWidth: '64ch' }}>
              Tudo o que você precisa saber sobre cotas, prioridade por equidade,
              cronograma, pagamento via PIX, estornos e privacidade antes de
              participar.
            </p>
          </div>
          <Link
            to={authUser ? '/minha-cota' : '/'}
            className="btn btn-primary"
            id="rules-cta-participate"
          >
            {authUser ? 'Ir para Minha Cota' : 'Participar agora'}
            <ArrowRight size={16} />
          </Link>
        </div>

        <div className="grid-4">
          <div className="stat-tile">
            <div className="stat-label">Valor por cota</div>
            <div className="stat-value">
              {formatCurrencyBr(publicConfig.quotaPrice)}
            </div>
          </div>
          <div className="stat-tile">
            <div className="stat-label">Limite total do bolão</div>
            <div className="stat-value">{publicConfig.totalQuotas} cotas</div>
          </div>
          <div className="stat-tile">
            <div className="stat-label">Máximo por pessoa</div>
            <div className="stat-value">
              {publicConfig.maxQuotasPerPerson} cotas
            </div>
          </div>
          <div className="stat-tile">
            <div className="stat-label">Data do sorteio</div>
            <div className="stat-value" style={{ fontSize: '1.45rem' }}>
              {formatDateBr(publicConfig.drawDate)}
            </div>
          </div>
        </div>
      </div>

      {/* Cronograma / Timeline completa */}
      <section className="card stack-md" id="rules-timeline-section">
        <div className="row" style={{ gap: 10 }}>
          <Calendar size={22} color="var(--luck-500)" />
          <div>
            <h2>Linha do Tempo do Bolão</h2>
            <p style={{ color: 'var(--ink-secondary)', fontSize: '0.9rem' }}>
              Fique atento às datas limite de registro, pagamento PIX, registro
              das apostas na lotérica e sorteio oficial.
            </p>
          </div>
        </div>
        <Timeline config={publicConfig} />
      </section>

      {/* Por que essas regras? (Transparência da organização) */}
      <section className="card stack-md" id="rules-rationale-section">
        <div className="row" style={{ gap: 10 }}>
          <HelpCircle size={22} color="var(--corn-600)" />
          <div>
            <h2>Por que esses limites e esse valor de cota?</h2>
            <p style={{ color: 'var(--ink-secondary)', fontSize: '0.9rem' }}>
              Entenda os motivos práticos e regulamentares por trás das regras
              do {publicConfig.poolName}.
            </p>
          </div>
        </div>

        <div className="grid-3">
          <div className="card-gold stack-xs">
            <h3>Por que o limite de {publicConfig.totalQuotas} cotas?</h3>
            <p style={{ fontSize: '0.88rem', color: 'var(--ink-secondary)' }}>
              Nas regras oficiais do <strong>Bolão Caixa</strong> para a
              Mega-Sena / Mega da Virada, o limite máximo regulamentar é de{' '}
              <strong>100 cotas por bolão</strong> (com recibo individual por
              cota). Manter o teto em 100 cotas garante total aderência à regra
              oficial da lotérica, simplifica a divisão dos prêmios e dá espaço
              para todo o time participar com equidade.
            </p>
          </div>

          <div className="card-mint stack-xs">
            <h3>
              Por que {formatCurrencyBr(publicConfig.quotaPrice)} por cota?
            </h3>
            <p style={{ fontSize: '0.88rem', color: 'var(--ink-secondary)' }}>
              O valor busca equilibrar <strong>acessibilidade</strong> (para
              ninguém ficar de fora) com <strong>poder de aposta</strong>: com{' '}
              {publicConfig.totalQuotas} cotas, formamos um caixa de até{' '}
              <strong>{formatCurrencyBr(maxPoolBudget)}</strong>, suficiente
              para registrar <strong>apostas múltiplas estratégicas</strong> (7
              a 10+ dezenas por volante, multiplicando em centenas de vezes as
              chances contra um jogo simples) — sempre acima do valor mínimo por
              cota exigido pela Caixa.
            </p>
          </div>

          <div className="card-unicorn stack-xs">
            <h3>
              Por que até {publicConfig.maxQuotasPerPerson} cotas por pessoa?
            </h3>
            <p style={{ fontSize: '0.88rem', color: 'var(--ink-secondary)' }}>
              O teto padrão de{' '}
              <strong>{publicConfig.maxQuotasPerPerson} cotas por pessoa</strong>{' '}
              permite a quem quiser investir um pouco mais aumentar sua
              participação sem concentrar cotas em poucas pessoas — preservando
              o espírito coletivo do bolão e reduzindo a chance de estornos no
              fechamento.
            </p>
          </div>
        </div>
      </section>

      <div className="grid-2">
        <section className="card stack-sm">
          <div className="row" style={{ gap: 10 }}>
            <Scale size={22} color="var(--unicorn-500)" />
            <h2>1. Regra de Equidade (Cotas Justas)</h2>
          </div>
          <p style={{ color: 'var(--ink-secondary)' }}>
            O bolão tem um teto fixo de{' '}
            <strong>{publicConfig.totalQuotas} cotas</strong>. Quem quiser
            aumentar sua participação pode pedir até{' '}
            <strong>{publicConfig.maxQuotasPerPerson} cotas</strong>, mas a
            distribuição <strong>não é por ordem de chegada no total</strong> —
            ela segue camadas de equidade:
          </p>
          <ul
            style={{
              margin: 0,
              paddingLeft: 20,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              color: 'var(--ink-secondary)',
            }}
          >
            <li>
              <strong>Camada 1 (Prioridade máxima):</strong> todo participante
              aprovado e pago garante primeiro a sua <strong>1ª cota</strong>.
            </li>
            <li>
              <strong>Camadas 2, 3... (Extras):</strong> somente depois que
              todos garantirem 1 cota é que as cotas restantes vão para quem
              pediu 2ª cota, depois 3ª cota, e assim por diante.
            </li>
            <li>
              <strong>Desempate dentro da mesma camada:</strong> se sobrarem
              cotas insuficientes para todos que pediram a 2ª (ou 3ª) cota, o
              desempate segue a <strong>ordem de inscrição no site</strong>{' '}
              (desde que o PIX seja confirmado dentro do prazo).
            </li>
          </ul>
          <div className="card-unicorn" style={{ fontSize: '0.88rem' }}>
            <strong>Exemplo prático:</strong> se alguém pediu 3 cotas no dia 1,
            mas no fim 95 colegas entraram pedindo 1 cota cada, os 95 garantem
            1 cota e apenas as 5 cotas restantes vão para as 2ªs cotas dos
            primeiros inscritos. Ninguém fica sem cota porque outra pessoa
            reservou várias antes!
          </div>
        </section>

        <section className="card stack-sm">
          <div className="row" style={{ gap: 10 }}>
            <Calendar size={22} color="var(--luck-500)" />
            <h2>2. Fila de Espera &amp; Prazos</h2>
          </div>
          <p style={{ color: 'var(--ink-secondary)' }}>
            O limite máximo é de{' '}
            <strong>{publicConfig.totalQuotas} pessoas únicas</strong> (1 cota
            cada). Caso mais de {publicConfig.totalQuotas} pessoas se inscrevam:
          </p>
          <ul
            style={{
              margin: 0,
              paddingLeft: 20,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              color: 'var(--ink-secondary)',
            }}
          >
            <li>
              A partir da {publicConfig.totalQuotas + 1}ª pessoa, o cadastro
              entra automaticamente na <strong>Fila de Espera</strong> por ordem
              de inscrição.
            </li>
            <li>
              Se algum participante não for aprovado, desistir ou não pagar até
              o prazo, a fila anda automaticamente.
            </li>
          </ul>

          <div className="card-cream stack-xs" style={{ marginTop: 6 }}>
            <div className="row-between">
              <span>Data limite para registro:</span>
              <strong>{formatDateBr(publicConfig.registrationDeadline)}</strong>
            </div>
            <div className="row-between">
              <span>Data limite para pagamento PIX:</span>
              <strong>{formatDateBr(publicConfig.paymentDeadline)}</strong>
            </div>
            <div className="row-between">
              <span>Data de realizar a aposta:</span>
              <strong>{formatDateBr(publicConfig.betPlacementDate)}</strong>
            </div>
            <div className="row-between">
              <span>Sorteio oficial:</span>
              <strong>{formatDateBr(publicConfig.drawDate)}</strong>
            </div>
          </div>
        </section>

        <section className="card stack-sm">
          <div className="row" style={{ gap: 10 }}>
            <Coins size={22} color="var(--corn-600)" />
            <h2>3. Pagamento PIX &amp; Estornos</h2>
          </div>
          <ul
            style={{
              margin: 0,
              paddingLeft: 20,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              color: 'var(--ink-secondary)',
            }}
          >
            <li>
              Assim que você validar o código de convite e escolher suas cotas,
              o site gera seu <strong>QR Code e PIX Copia e Cola</strong> com o
              valor total e um identificador único (<code>txid</code>).
            </li>
            <li>
              <strong>Pagamento antecipado liberado:</strong> mesmo enquanto sua
              inscrição ainda aguarda aprovação dos moderadores, você já pode
              fazer o PIX e clicar em <strong>“Já fiz o PIX”</strong>.
            </li>
            <li>
              <strong>Não precisa enviar foto de comprovante:</strong> a
              conferência é feita pelo <code>txid</code> no extrato bancário.
            </li>
            <li>
              <strong>Política de estorno automático:</strong> se você pagou por
              cotas extras que acabaram reduzidas pela regra de equidade no
              fechamento (ou caso uma inscrição não seja aprovada), o sistema
              calcula automaticamente o valor exato a devolver e os organizadores
              realizam o estorno via PIX.
            </li>
          </ul>
          <div className="alert alert-info" style={{ marginTop: 4 }}>
            <Undo2 size={17} style={{ flexShrink: 0, marginTop: 2 }} />
            <span>
              Depois de marcar “Já fiz o PIX”, a edição de cotas fica bloqueada
              para você. Se precisar ajustar ou desistir, fale com um moderador.
            </span>
          </div>
        </section>

        <section className="card stack-sm">
          <div className="row" style={{ gap: 10 }}>
            <ShieldCheck size={22} color="var(--luck-500)" />
            <h2>4. Acesso Exclusivo, Privacidade (PII) e CPF</h2>
          </div>
          <ul
            style={{
              margin: 0,
              paddingLeft: 20,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              color: 'var(--ink-secondary)',
            }}
          >
            <li>
              <strong>Apenas o time participa:</strong> a entrada exige login
              por Magic Link no e-mail pessoal, código de convite compartilhado
              internamente e aprovação dos moderadores.
            </li>
            <li>
              <strong>Placar sem vazamento de dados:</strong> apenas pessoas
              autenticadas veem o placar. Ele mostra somente os nomes dos
              participantes aprovados, cotas e status de pagamento —{' '}
              <strong>nenhum e-mail ou CPF aparece no placar</strong>. Cadastros
              pendentes aparecem apenas como contagem numérica (sem nomes).
            </li>
            <li>
              <strong>CPF opcional no bilhete:</strong> se desejar que seu CPF
              conste no registro do bolão/bilhete, você pode informá-lo de forma
              opcional no seu perfil. Ele fica mascarado por padrão, acessível
              apenas a você e aos moderadores, e pode ser removido a qualquer
              momento.
            </li>
          </ul>
          <div className="card-mint" style={{ fontSize: '0.88rem' }}>
            <div className="row" style={{ gap: 6 }}>
              <Lock size={15} />
              <strong>Transparência dos jogos &amp; prêmios:</strong>
            </div>
            <p style={{ marginTop: 4, color: 'var(--ink-secondary)' }}>
              {publicConfig.rulesExtraNotes} Todos os prêmios conquistados são
              divididos proporcionalmente ao número de{' '}
              <strong>cotas finais confirmadas</strong> de cada participante.
            </p>
          </div>
        </section>
      </div>

      {publicConfig.organizerContact && (
        <section className="card-mint stack-xs" id="rules-contact-section">
          <h3>Contato dos Organizadores</h3>
          <p style={{ color: 'var(--ink-secondary)', fontSize: '0.92rem' }}>
            {publicConfig.organizerContact}
          </p>
        </section>
      )}

      <div className="card-gold row-between">
        <div className="row" style={{ gap: 10 }}>
          <Clover size={20} />
          <strong>
            Os organizadores podem abrir ou pausar etapas (inscrições, edição de
            cotas, PIX, placar e jogos) a qualquer momento conforme o cronograma.
          </strong>
        </div>
        <Link
          to={authUser ? '/minha-cota' : '/'}
          className="btn btn-primary btn-sm"
        >
          {authUser ? 'Ver Minha Cota' : 'Fazer login'}
        </Link>
      </div>
    </div>
  );
}
