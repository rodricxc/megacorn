import type { EmailSendPayload, PublicConfig, UserProfile } from '../types';

export interface AppsScriptResponse {
  ok: boolean;
  message: string;
  simulated?: boolean;
}

/**
 * Envia requisição POST CORS-safe (Content-Type: text/plain;charset=utf-8)
 * diretamente da UI do Painel Admin para o Web App do Google Apps Script.
 */
export async function sendEmailViaAppsScript(
  appsScriptUrl: string,
  appsScriptSecret: string,
  payload: EmailSendPayload,
  isDemoMode: boolean
): Promise<AppsScriptResponse> {
  const trimmedUrl = appsScriptUrl.trim();
  const trimmedSecret = appsScriptSecret.trim();

  if (!trimmedUrl) {
    if (isDemoMode) {
      return {
        ok: true,
        simulated: true,
        message: `[Modo Demo] E-mail (${payload.action}) simulado para ${payload.to}. Configure a URL do Apps Script para disparo real.`,
      };
    }
    return {
      ok: false,
      message:
        'URL do Google Apps Script não configurada na aba Configurações.',
    };
  }

  try {
    const response = await fetch(trimmedUrl, {
      method: 'POST',
      headers: {
        // Evita preflight OPTIONS no Google Apps Script Web App
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify({
        secret: trimmedSecret,
        ...payload,
      }),
    });

    const text = await response.text();
    let parsed: { ok?: boolean; message?: string; error?: string } | null = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }

    if (!response.ok || (parsed && parsed.ok === false)) {
      return {
        ok: false,
        message:
          parsed?.error ||
          parsed?.message ||
          `Erro HTTP ${response.status} ao chamar o Apps Script.`,
      };
    }

    return {
      ok: true,
      message: parsed?.message || `E-mail enviado com sucesso para ${payload.to}!`,
    };
  } catch (err) {
    return {
      ok: false,
      message:
        err instanceof Error
          ? `Falha de rede ao chamar Apps Script: ${err.message}`
          : 'Erro inesperado ao chamar o Apps Script.',
    };
  }
}

export function buildWhatsappReminderText(
  config: PublicConfig,
  pendingPayers: UserProfile[]
): string {
  const siteUrl = `${window.location.origin}${window.location.pathname}`;
  const lines = [
    `🌽🦄 *${config.poolName} ${config.edition}* — Lembrete de PIX!`,
    ``,
    `Pessoal, ainda faltam confirmar o pagamento de *${pendingPayers.length}* participante(s) até *${formatDateBr(config.paymentDeadline)}*:`,
    ...pendingPayers.map(
      (u) =>
        `• ${u.displayName} (${u.requestedQuotas} cota${u.requestedQuotas > 1 ? 's' : ''} — R$ ${(u.requestedQuotas * config.quotaPrice).toFixed(2).replace('.', ',')})`
    ),
    ``,
    `Acesse o site para pegar seu QR Code / Copia e Cola e marcar "Já fiz o PIX":`,
    siteUrl,
  ];
  return lines.join('\n');
}

export function formatCurrencyBr(value: number): string {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

export function formatDateBr(isoDate: string): string {
  if (!isoDate) return '—';
  const match = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return isoDate;
  return `${match[3]}/${match[2]}/${match[1]}`;
}
