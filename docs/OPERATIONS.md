# Manual Operacional dos Organizadores — MegaCorn

Guia prático para os moderadores operarem o bolão **MegaCorn** do início ao fim, sem precisar mexer em código.

---

## 1. Fluxo Operacional pelas 8 Fases da Timeline

No painel **Admin → Etapas & Fechamento**, use o **Controlador da Timeline** (e os toggles individuais logo abaixo) para conduzir o bolão:

1. **Fase de cadastro**
   - Toggles recomendados: `Inscrições = ON`, `Edição de cotas = ON`, `PIX = ON`, `Placar = ON`.
   - Em **Admin → Configurações & E-mail**, ajuste o código de convite (dica: use um código com letras e números, ex.: `MC27-8F4K9Q`) e clique em **Copiar link (`?convite=`)** para divulgar no grupo do time.
   - Aprove os cadastros na aba **Participantes & PIX** (lembre: pendentes já podem adiantar o PIX; se alguém for recusado após pagar, o estorno integral é gerado automaticamente).

2. **Cadastro fechado**
   - Avance a timeline para **Cadastro fechado** e desligue o toggle **Novas inscrições**.
   - Aprove ou recuse os últimos cadastros pendentes.

3. **Consolidando pagamentos**
   - Avance para **Consolidando pagamentos**.
   - Use o filtro **Avisaram PIX** e confira os pagamentos no extrato (observe o campo de observação caso alguém tenha pago pela conta bancária de um terceiro).
   - Use **Enviar cobrança por e-mail (pendentes)** ou **Copiar lembrete p/ WhatsApp** para cobrar quem ainda não pagou.
   - Após o prazo de pagamento, cancele inadimplentes (se houver) e clique em **Fechar Bolão e Gerar Estornos** (na aba *Etapas & Fechamento*) para congelar as cotas finais pela regra de equidade e calcular automaticamente eventuais devoluções.
   - Devolva eventuais estornos via PIX e clique em **Marcar Estornado**.
   - Se precisarem colocar CPFs no bilhete, clique em **CSV p/ bilhete (CPF completo)** para levar à lotérica.

4. **Aposta feita** *(libera marcação de bilhetes!)*
   - Após registrar os volantes na lotérica:
     1. Cadastre todos os jogos na aba **Admin → Jogos & Sorteio** (com conferência automática das probabilidades).
     2. Ligue o toggle **Visibilidade de Jogos & Probabilidades**.
     3. Avance a timeline para **Aposta feita** — isso desbloqueia a coluna **Bilhete / Entrega em Mãos** na tabela de participantes.
     4. Preencha o **Nº da(s) cota(s) do bilhete** (ex.: `#14` ou `#14, #52`) para cada participante e clique no ícone de salvar (aparece automaticamente no Placar e em Minha Cota).

5. **Bilhetes sendo entregues**
   - Avance para **Bilhetes sendo entregues**.
   - Use o filtro **Comprovante a entregar em mãos** e clique em **Marcar entregue em mãos** conforme for entregando os recibos físicos.
   - Opcional (LGPD): após emitir os bilhetes, clique em **Limpar CPFs (LGPD)** para apagar todos os CPFs armazenados antecipadamente.

6. **Sorteio**
   - Avance para **Sorteio**.
   - Assim que saírem as 6 dezenas oficiais, salve-as em **Admin → Jogos & Sorteio → Publicar Dezenas Sorteadas** — todo o time verá os acertos destacados (Senas, Quinas e Quadras) na aba **Jogos & Chances**.

7. **Resgatar prêmio**
   - Se houver premiação, avance para **Resgatar prêmio** e publique orientações no **Banner do topo** (*Admin → Etapas & Fechamento*).

8. **Aposentar**
   - Avance para **Aposentar**!
   - **Compromisso de privacidade (até 30 dias após o sorteio):** apague as coleções `users`, `board`, `auditLog`, `stats` e `games` no Firebase Console (Firestore Database) e remova os usuários em **Authentication → Users** para cumprir a exclusão total em até 30 dias.

---

## 2. Tarefas Comuns de Moderação

- **Adicionar / remover outro Admin:** aprove o participante em *Participantes & PIX* e clique no ícone de **escudo** na coluna *Ações*. *(Se remover um moderador, lembre de trocar também o `MEGACORN_SECRET` no Apps Script e em `/admin`.)*
- **Ajustar cotas de um participante depois do PIX:** use os botões **`-`** e **`+`** na coluna *Cotas & TXID* da tabela de participantes.
- **Atualizar o código do Google Apps Script (`Code.gs`):** após editar e salvar no Apps Script, vá em **Implantar → Gerenciar implantações → Editar (lápis) → Versão: Nova versão → Implantar**. Isso mantém a mesma URL `/exec` sem precisar mexer no MegaCorn.
- **Atualizar `firestore.rules`:** sempre que houver mudança nas regras no repositório, copie [`firestore.rules`](../firestore.rules) no GitHub e clique em **Publicar** no Firebase Console → Firestore Database → Regras.

---

## 3. Troubleshooting Rápido

- **Site voltou a mostrar "Modo Demo":** verifique se os 6 secrets `VITE_FIREBASE_*` estão cadastrados em *Settings → Secrets and variables → Actions* no GitHub e rode novamente o workflow `Deploy MegaCorn to GitHub Pages`.
- **Magic Link não chega:** verifique Spam/Promoções e confirme que `rodricxc.github.io` está em *Firebase Authentication → Settings → Authorized domains*.
- **E-mail do Apps Script falha:** confirme que a URL termina em `/exec`, que a implantação está como *Executar como: Eu* / *Quem tem acesso: Qualquer pessoa* e que `MEGACORN_SECRET` nas *Propriedades do script* é idêntico ao salvo em `/admin`.
- **Caracteres estranhos (``) no e-mail:** evite emojis de 4 bytes no corpo texto-puro de `Code.gs`.
