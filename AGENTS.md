# AGENTS.md — Contexto Rápido do Projeto MegaCorn

Guia de contexto rápido para agentes de IA e desenvolvedores retomarem o projeto **MegaCorn** em uma nova sessão sem perder nenhuma decisão de produto, arquitetura ou segurança.

---

## 1. Visão Geral

- **Projeto:** **MegaCorn** — Bolão de fim de ano do time (~50 a 70 pessoas, edição **2027**, subtítulo *Bolão de Fim de Ano • Unicorn*).
- **Produção:** `https://rodricxc.github.io/megacorn/` (repositório público `rodricxc/megacorn`).
- **Infraestrutura (R$ 0, sem cartão de crédito):**
  - **Frontend:** Vite + React 19 + TypeScript + **Vanilla CSS** (`src/index.css`, sem TailwindCSS), usando `HashRouter` e `base: './'` para compatibilidade total com GitHub Pages.
  - **Backend / Auth / DB:** **Firebase Spark** (Firebase Auth com Email Link / Magic Link + Cloud Firestore + `firestore.rules`).
  - **Modo Demo automático:** quando `VITE_FIREBASE_*` não estão preenchidas em `.env`, `src/services/index.ts` ativa automaticamente `demoAdapter.ts` (`localStorage`) com dados de exemplo.
  - **E-mails transacionais:** **Google Apps Script** (`apps-script/Code.gs`) conectado ao Gmail pessoal do organizador, acionado direto da UI `/admin` via `POST` CORS-safe (`Content-Type: text/plain;charset=utf-8`).

---

## 2. Mapa de Diretórios

```text
.
├── .github/workflows/deploy.yml   # CI/CD: vitest -> build -> GitHub Pages
├── apps-script/Code.gs            # Web App do Google Apps Script (Gmail pessoal, sem emojis 4-byte)
├── docs/
│   ├── ARCHITECTURE.md            # Arquitetura, schema Firestore, regras de segurança e algoritmos
│   └── OPERATIONS.md              # Manual operacional dos moderadores (8 fases, PIX, bilhetes, LGPD)
├── firestore.rules                # Regras de segurança do Firestore (PRECISA publicar no Console se editado!)
├── public/megacorn-mascot.jpg     # Mascote oficial MegaCorn
└── src/
    ├── index.css                  # Design system Vanilla CSS (Milho + Unicórnio + Sorte + Dinheiro)
    ├── types/index.ts             # Interfaces TS centrais (PublicConfig, UserProfile, BoardEntry, PoolPhase...)
    ├── context/AppContext.tsx     # Estado global (auth, perfil, placar, jogos, equidade ao vivo)
    ├── lib/
    │   ├── equity.ts (+test)      # Alocação justa em camadas (round-robin), fila >100 e estornos
    │   ├── phases.ts (+test)      # 8 fases de evolução do bolão + trava canManageTickets()
    │   ├── pix.ts (+test)         # Gerador local EMVCo BR Code (PIX Estático) + CRC16-CCITT
    │   ├── cpf.ts (+test)         # Validação, formatação e mascaramento de CPF opcional
    │   ├── lottery.ts (+test)     # Probabilidades exatas (6..20 dezenas) + conferidor multi-prêmio
    │   ├── session.ts             # Cookies auxiliares + URL ?convite= + retorno Magic Link + sign-out
    │   ├── appsScript.ts          # Cliente POST CORS-safe pro Apps Script + lembrete WhatsApp
    │   └── csv.ts                 # Exportação CSV (CPF mascarado ou completo + bilhete/entrega)
    ├── services/
    │   ├── firebase.ts            # Init Firebase Auth (browserLocalPersistence) + Firestore
    │   ├── dataService.ts         # Interface DataService + defaults (R$ 40,32, 100 cotas, máx. 3/pessoa)
    │   ├── firebaseAdapter.ts     # Implementação real Firebase Auth + Firestore
    │   └── demoAdapter.ts         # Implementação Demo local
    ├── components/                # Navbar, StatusBanner, Timeline, PixCard, MagicLinkHandler, CpfField
    └── pages/                     # HomePage, RulesPage, MyQuotaPage, BoardPage, GamesPage, AdminPage
```

---

## 3. Regras de Negócio & Invariantes Críticos (NÃO QUEBRAR)

1. **Parâmetros padrão (configuráveis em `/admin`):**
   - Limite total: **100 cotas** (limite regulamentar do Bolão Caixa).
   - Valor padrão da cota: **R$ 40,32** (*8 jogos de 9 números, 1 comprovante por cota*, texto customizável via `publicConfig.quotaPriceRationale`).
   - Teto padrão por pessoa: **3 cotas**.
   - Edição: **2027**.
2. **Equidade & Fila de Espera:**
   - 1ª cota de todos tem prioridade máxima; cotas extras entram em camadas (round-robin), desempatando por `createdAt` (ordem de inscrição).
   - Acima de 100 pessoas únicas → Fila de Espera por `createdAt`.
   - Rótulo no Placar/Minha Cota antes do fechamento: **Cotas Estimadas (estado atual)**.
3. **PIX & Pagamento Antecipado:**
   - **Participantes ainda pendentes de aprovação podem pagar PIX** (se recusados, gera estorno integral pendente automaticamente).
   - **Sem upload de comprovante** (mantém plano Spark gratuito sem Storage e evita PII bancária).
   - **Sem exibir campo TXID na UI do `PixCard.tsx`** (o `txid` segue internamente no BR Code do QR Code, mas foi removido da tela de PIX por preferência de UX).
   - O campo de observação em "Já fiz o PIX" orienta a informar o **nome do titular da conta pagadora** caso seja diferente do nome cadastrado.
4. **Privacidade / PII & LGPD:**
   - **Nunca** colocar `email` ou `cpf` em `board/{uid}` ou em qualquer coleção pública.
   - `users/{uid}` (e-mail + CPF opcional mascarado) só é legível pelo próprio `uid` e moderadores.
   - Pendentes de aprovação **nunca** têm o nome exibido no Placar — apenas entram na contagem numérica de `stats/summary`.
   - **Política de retenção:** todas as informações serão **deletadas em até 30 dias após o sorteio** (exibida nas Regras, no campo de CPF, no rodapé e no README).
   - Regras endurecidas em `firestore.rules`: `createdAt` dentro de ±5 min de `request.time`, `requestedQuotas` entre `1..maxQuotasPerPerson`, `email` == `request.auth.token.email`, leitura de `board`/`games`/`stats`/`payment` exige `hasActiveProfile()` (criado com código de convite válido e não recusado/cancelado), e incremento de `stats/summary` somente no batch atômico de criação de `users/{uid}`.
5. **Código de Convite:**
   - Exigido já na tela inicial antes de disparar o Magic Link; aceito automaticamente na URL (`?convite=`, `?invite=`, `?code=`).
   - Apenas admins podem criar/alterar códigos (via `/admin → Configurações & E-mail`, que desativa o código anterior automaticamente).
6. **Timeline de 8 Fases & Trava de Bilhetes:**
   - Fases: `registration` → `registration_closed` → `consolidating_payments` → `bet_placed` → `delivering_tickets` → `draw` → `claiming_prize` → `retired` (*Aposentar*).
   - **Trava obrigatória (`canManageTickets`):** admins só podem atribuir nº de cota do bilhete (`assignedTicketNumbers`) e marcar comprovante entregue em mãos (`receiptDelivered`) a partir da fase **`bet_placed` (Aposta feita)**.
7. **Estilização:**
   - Manter **Vanilla CSS** em `src/index.css` com tema claro creme/pérola (Milho + Unicórnio + Sorte + Dinheiro). Não introduzir TailwindCSS sem pedido explícito.

---

## 4. Comandos & Deploy

```bash
npm install
npm run dev       # Servidor local (Modo Demo se .env estiver vazio)
npm run test      # Vitest (12 testes unitários: equity, pix, cpf, lottery, phases)
npm run lint      # oxlint
npm run build     # TypeScript (tsc -b) + Vite production build
```

- **Deploy automático:** push na branch `main` dispara `.github/workflows/deploy.yml`, injeta os 6 secrets `VITE_FIREBASE_*` do repositório e publica em `https://rodricxc.github.io/megacorn/`.
- **Atenção ao editar `firestore.rules`:** o GitHub Actions **não** publica regras no Firebase — sempre avisar o usuário para copiar e clicar em **Publicar** no Firebase Console → Firestore Database → Regras.
- **Atenção ao editar `apps-script/Code.gs`:** atualizar no Google Apps Script usando **Implantar → Gerenciar implantações → Editar → Nova versão** (mantém a mesma URL `/exec`). Evitar emojis de 4 bytes no corpo texto-puro de `GmailApp.sendEmail`.
