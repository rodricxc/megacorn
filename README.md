# MegaCorn — Bolão de Fim de Ano do Time 🌽🦄🍀💸

Site completo para organizar o bolão de fim de ano do time com **alocação justa de cotas por equidade**, **PIX estático local com QR Code e `txid`**, **proteção de PII (e-mail + CPF opcional)**, **probabilidades exatas e conferidor de jogos**, **toggles de etapas para moderadores** e **disparo de e-mails via Google Apps Script (Gmail pessoal)**.

Hospedagem 100% gratuita em **GitHub Pages + Firebase (plano Spark) + Google Apps Script**, sem cartão de crédito.

### Documentação Adicional
- [**AGENTS.md**](./AGENTS.md) — Contexto rápido do projeto, mapa de arquivos e invariantes para novas sessões de chat / agentes de IA
- [**docs/ARCHITECTURE.md**](./docs/ARCHITECTURE.md) — Arquitetura, modelo de dados no Firestore, segurança/PII e algoritmos
- [**docs/OPERATIONS.md**](./docs/OPERATIONS.md) — Manual operacional dos organizadores pelas 8 fases da timeline e limpeza pós-sorteio

---

## Principais Funcionalidades

- **Equidade em camadas (100 cotas, padrão de até 3 cotas/pessoa — configurável):** todo participante aprovado e pago garante a 1ª cota antes das extras; desempate dentro da camada por ordem de inscrição; acima de 100 pessoas entra na Fila de Espera.
- **Linha do Tempo do Bolão:** cronograma completo na página inicial e na página de regras com **data limite para registro**, **data limite para pagamento PIX**, **data de realizar a aposta** na lotérica e **data do sorteio** (todas configuráveis no `/admin`).
- **PIX Estático (EMVCo / BR Code) sem API bancária:** QR Code + Copia e Cola com valor exato e `txid` único (`MEGACORN26...`). Participantes ainda não aprovados também podem adiantar o PIX (com estorno automático caso recusados).
- **Privacidade & PII:** e-mail pessoal e **CPF opcional** (para constar no bilhete) isolados em `users/{uid}` — nunca aparecem no placar. Pendentes de aprovação aparecem apenas em contador anônimo. Botão LGPD para limpar CPFs após emissão dos bilhetes, e política de **exclusão total das informações em até 30 dias após o sorteio**.
- **Magic Link + Sessão Persistente + Sign-out:** login sem senha por e-mail pessoal, retorno automático no mesmo navegador (cookies auxiliares + `browserLocalPersistence`), confirmação amigável ao abrir em outro dispositivo, recuperação de link expirado e botão **Sair**.
- **Jogos, Probabilidades & Conferidor:** suporte a apostas de 6 a 20 dezenas com cálculo exato de chances (Sena, Quina, Quadra) individual e acumulado do bolão + conferidor automático com múltiplas premiações.
- **Painel Admin Completo:** toggles liga/desliga de etapas e submissões (`registrationsOpen`, `quotaEditsOpen`, `pixPaymentOpen`, `boardVisible`, `gamesVisible`, `poolClosed`), fechamento com cálculo de estornos, integração direta do Google Apps Script na UI, exportação CSV e log de auditoria.

---

## Por que esses parâmetros? (Regras de Negócio)

- **Por que o limite de 100 cotas?** Nas regras oficiais do **Bolão Caixa** para a Mega-Sena / Mega da Virada, o limite regulamentar máximo é de **100 cotas por bolão** (com recibo individual por cota). Manter o teto em 100 cotas alinha o MegaCorn exatamente às regras da lotérica, simplifica a divisão de eventuais prêmios e comporta com folga um time de 50 a 70 pessoas garantindo pelo menos 1 cota para cada participante.
- **Por que o preço da cota (padrão R$ 40,32, configurável)?** Esse valor foi escolhido para ser possível realizar **8 jogos de 9 números** na Mega da Virada (total de 672 combinações simples), mantendo exatamente **um único comprovante oficial da lotérica por cota** (texto editável pelo admin em `/admin`).
- **Por que o limite padrão de 3 cotas por pessoa?** Permite que quem desejar investir um pouco mais amplie sua participação sem concentrar cotas demais em poucas pessoas — preservando o espírito coletivo do bolão e reduzindo a necessidade de estornos no fechamento.

---

## 1. Rodar Localmente (Modo Demo Interativo)

Sem nenhuma configuração externa, o app inicia automaticamente em **Modo Demo** (persistido em `localStorage`) com dados de exemplo, código de convite `MEGACORN2026` e botões de login rápido como Moderadora, Participante ou Pendente:

```bash
npm install
npm run dev
```

Rodar testes unitários (equidade, PIX CRC16, CPF e probabilidades):

```bash
npx vitest run
```

---

## 2. Configurar Firebase (Plano Gratuito Spark)

1. Crie um projeto no [Firebase Console](https://console.firebase.google.com/) (mantenha no plano **Spark** gratuito, sem cartão).
2. **Authentication → Sign-in method:**
   - Ative **E-mail/senha** e habilite a opção **Link de e-mail (login sem senha)**.
   - Em **Authentication → Settings → Authorized domains**, adicione `rodricxc.github.io` (e `localhost` para testes locais).
3. **Firestore Database:**
   - Crie o banco em modo de produção.
   - Em **Rules**, cole o conteúdo do arquivo [`firestore.rules`](./firestore.rules) e publique.
4. **Configurações do Projeto → Seus aplicativos → Web (`</>`)**:
   - Copie as credenciais para `.env` (veja `.env.example`):
     ```env
     VITE_FIREBASE_API_KEY=...
     VITE_FIREBASE_AUTH_DOMAIN=...
     VITE_FIREBASE_PROJECT_ID=...
     VITE_FIREBASE_STORAGE_BUCKET=...
     VITE_FIREBASE_MESSAGING_SENDER_ID=...
     VITE_FIREBASE_APP_ID=...
     ```
5. **Bootstrap inicial no Firestore (primeira vez):**
   - Crie o documento `inviteCodes/MEGACORN2026` (ou o código desejado) com `{ "active": true }`.
   - Crie o documento `config/public` com `flags: { registrationsOpen: true, quotaEditsOpen: true, pixPaymentOpen: true, boardVisible: true, gamesVisible: true, poolClosed: false }` (ou faça login primeiro).
   - Faça login no site com seu e-mail via Magic Link, conclua o cadastro com o código de convite, e no Console do Firestore abra `users/<seu-uid>` e marque `isModerator: true` e `approvalStatus: "approved"`.
   - A partir daí, você acessa `/admin` e configura chave PIX, valores, prazos, outros moderadores e jogos direto pela interface!

---

## 3. Configurar E-mails via Google Apps Script (Seu Gmail)

1. Acesse [script.google.com](https://script.google.com/) logado no seu Gmail pessoal e crie um projeto (`MegaCorn Mailer`).
2. Cole todo o conteúdo de [`apps-script/Code.gs`](./apps-script/Code.gs) em `Code.gs`.
3. Vá em **Configurações do projeto (engrenagem) → Propriedades do script** e adicione:
   - **Propriedade:** `MEGACORN_SECRET`
   - **Valor:** uma senha longa aleatória (ex.: `mc_9f8a7b6c5d4e3f2a1b0c`).
4. Clique em **Implantar → Nova implantação → App da Web**:
   - **Executar como:** Eu (seu e-mail)
   - **Quem tem acesso:** Qualquer pessoa
5. Autorize as permissões do Gmail, copie a URL `/exec` gerada e cole junto com o `MEGACORN_SECRET` na aba **Configurações & E-mail** do painel `/admin` do MegaCorn.
6. Clique em **Testar e-mail** direto na UI para validar!

---

## 4. Publicar no GitHub Pages (`rodricxc/megacorn`)

1. Crie o repositório `rodricxc/megacorn` e faça push da branch `main`.
2. Em **Settings → Secrets and variables → Actions**, cadastre os 6 secrets `VITE_FIREBASE_*`.
3. Em **Settings → Pages**, escolha **Source: GitHub Actions**.
4. A cada push na branch `main`, o workflow [`.github/workflows/deploy.yml`](./.github/workflows/deploy.yml) roda os testes unitários, gera o build e publica automaticamente em `https://rodricxc.github.io/megacorn/`!
