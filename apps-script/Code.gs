/**
 * Bolão MegaCorn — Google Apps Script Web App (Envio de E-mails via Gmail pessoal)
 *
 * COMO PUBLICAR:
 * 1. Acesse https://script.google.com e crie um novo projeto ("MegaCorn Mailer").
 * 2. Cole este código em Code.gs.
 * 3. Em Configurações do Projeto (engrenagem) -> Propriedades do script, adicione:
 *    Chave: MEGACORN_SECRET
 *    Valor: <crie uma senha longa aleatória, ex: mc_9f8a7b6c5d4e...>
 * 4. Clique em Implantar -> Nova implantação -> Tipo: App da Web:
 *    - Executar como: Eu (seu Gmail)
 *    - Quem tem acesso: Qualquer pessoa
 * 5. Copie a URL gerada (/exec) e a senha MEGACORN_SECRET para a aba
 *    "Configurações" do painel /admin do MegaCorn.
 */

function doPost(e) {
  try {
    var raw = e && e.postData && e.postData.contents ? e.postData.contents : '{}';
    var data = JSON.parse(raw);

    var expectedSecret = PropertiesService.getScriptProperties().getProperty('MEGACORN_SECRET');
    if (!expectedSecret || data.secret !== expectedSecret) {
      return jsonResponse({ ok: false, error: 'Segredo inválido ou não configurado nas Script Properties.' });
    }

    var to = (data.to || '').trim();
    if (!to || to.indexOf('@') === -1) {
      return jsonResponse({ ok: false, error: 'Destinatário (e-mail) inválido.' });
    }

    var poolName = data.poolName || 'MegaCorn';
    var displayName = data.displayName || 'Participante';
    var siteUrl = data.siteUrl || '';
    var amountStr = formatBrl(data.amount);
    var refundStr = formatBrl(data.refundAmount);

    var subject = '';
    var body = '';

    switch (data.action) {
      case 'test':
        subject = '[MegaCorn] Teste de integração de e-mail';
        body =
          'Olá, ' + displayName + '!\n\n' +
          'A integração do Google Apps Script com o painel admin do ' + poolName + ' está funcionando perfeitamente.\n' +
          (siteUrl ? '\nAcesse o bolão: ' + siteUrl + '\n' : '') +
          '\nBoa sorte!';
        break;

      case 'approval':
        subject = '[' + poolName + '] Sua participação foi aprovada!';
        body =
          'Olá, ' + displayName + '!\n\n' +
          'Sua participação no bolão ' + poolName + ' foi aprovada pelos organizadores.\n' +
          'Cotas reservadas: ' + (data.requestedQuotas || 1) + '\n' +
          (data.amount ? 'Valor total: ' + amountStr + '\n' : '') +
          (data.txid ? 'Identificador PIX (txid): ' + data.txid + '\n' : '') +
          (data.customMessage ? '\nRecado dos organizadores: ' + data.customMessage + '\n' : '') +
          (siteUrl ? '\nAcesse o site para ver seu QR Code PIX e acompanhar o placar: ' + siteUrl + '\n' : '') +
          '\nBoa sorte!';
        break;

      case 'payment_confirmed':
        subject = '[' + poolName + '] Pagamento PIX confirmado!';
        body =
          'Olá, ' + displayName + '!\n\n' +
          'Confirmamos o recebimento do seu PIX no ' + poolName + '.\n' +
          'Cotas pagas: ' + (data.requestedQuotas || 1) + '\n' +
          (data.amount ? 'Valor confirmado: ' + amountStr + '\n' : '') +
          (data.txid ? 'Identificador PIX (txid): ' + data.txid + '\n' : '') +
          '\nLembrete: a distribuição final segue a regra de equidade no fechamento das cotas.\n' +
          (siteUrl ? 'Acompanhe no site: ' + siteUrl + '\n' : '') +
          '\nBoa sorte!';
        break;

      case 'payment_reminder':
        subject = '[' + poolName + '] Lembrete de pagamento PIX';
        body =
          'Olá, ' + displayName + '!\n\n' +
          'Passando para lembrar do pagamento do seu PIX no bolão ' + poolName + '.\n' +
          'Cotas reservadas: ' + (data.requestedQuotas || 1) + '\n' +
          (data.amount ? 'Valor: ' + amountStr + '\n' : '') +
          (data.txid ? 'Identificador PIX (txid): ' + data.txid + '\n' : '') +
          (data.customMessage ? '\nRecado: ' + data.customMessage + '\n' : '') +
          (siteUrl ? '\nAcesse para copiar o PIX e marcar "Já fiz o PIX": ' + siteUrl + '\n' : '') +
          '\nQualquer dúvida, fale com os organizadores.';
        break;

      case 'refund_notice':
        subject = '[' + poolName + '] Aviso de estorno de cota(s)';
        body =
          'Olá, ' + displayName + '!\n\n' +
          'Informamos sobre o estorno referente ao bolão ' + poolName + ':\n' +
          'Cotas estornadas: ' + (data.refundQuotas || 0) + '\n' +
          'Valor do estorno: ' + refundStr + '\n' +
          (data.customMessage ? '\nDetalhes: ' + data.customMessage + '\n' : '') +
          (siteUrl ? '\nConfira seu status atualizado: ' + siteUrl + '\n' : '') +
          '\nAbraços, Organização ' + poolName;
        break;

      case 'rejection':
        subject = '[' + poolName + '] Atualização sobre sua inscrição';
        body =
          'Olá, ' + displayName + '!\n\n' +
          'Sua inscrição no bolão ' + poolName + ' não pôde ser aprovada pela organização.' +
          (data.refundAmount && data.refundAmount > 0
            ? '\nComo você já realizou o pagamento, o estorno de ' + refundStr + ' foi registrado e será devolvido pelos organizadores.'
            : '') +
          (data.customMessage ? '\nObservação: ' + data.customMessage + '\n' : '') +
          '\nQualquer dúvida, procure um dos organizadores do time.';
        break;

      default:
        return jsonResponse({ ok: false, error: 'Ação de e-mail desconhecida: ' + data.action });
    }

    GmailApp.sendEmail(to, subject, body, {
      name: poolName + ' — Organização',
    });

    return jsonResponse({
      ok: true,
      message: 'E-mail (' + data.action + ') enviado com sucesso para ' + to,
    });
  } catch (err) {
    return jsonResponse({
      ok: false,
      error: 'Erro no Apps Script: ' + (err && err.message ? err.message : String(err)),
    });
  }
}

function formatBrl(value) {
  var num = Number(value || 0);
  return 'R$ ' + num.toFixed(2).replace('.', ',');
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
