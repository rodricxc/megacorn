/**
 * Gerador local de PIX Estático (EMVCo / BR Code) com CRC16-CCITT.
 * Zero integração bancária, valor travado e txid único para conferência no extrato.
 */

export interface PixPayloadInput {
  pixKey: string;
  merchantName: string;
  merchantCity: string;
  amount?: number;
  txid: string;
  description?: string;
}

function stripAccents(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, '');
}

function formatField(id: string, value: string): string {
  const len = value.length.toString().padStart(2, '0');
  return `${id}${len}${value}`;
}

export function sanitizeTxid(raw: string): string {
  const clean = stripAccents(raw)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 25);
  return clean.length > 0 ? clean : '***';
}

export function generateParticipantTxid(
  edition: string,
  uid: string
): string {
  const shortYear = edition.replace(/[^0-9]/g, '').slice(-2) || '26';
  const shortUid = uid
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 8)
    .padEnd(6, 'X');
  return sanitizeTxid(`MEGACORN${shortYear}${shortUid}`);
}

/**
 * Calcula CRC16-CCITT (polinômio 0x1021, inicial 0xFFFF) exigido pelo padrão BR Code.
 */
export function computeCrc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export function generatePixPayload(input: PixPayloadInput): string {
  const pixKey = input.pixKey.trim();
  if (!pixKey) {
    throw new Error('Chave PIX não configurada.');
  }

  const merchantName = (
    stripAccents(input.merchantName).trim() || 'BOLAO MEGACORN'
  ).slice(0, 25);
  const merchantCity = (
    stripAccents(input.merchantCity).trim() || 'SAO PAULO'
  )
    .toUpperCase()
    .slice(0, 15);
  const txid = sanitizeTxid(input.txid);

  // Merchant Account Information (Tag 26)
  let merchantAccount =
    formatField('00', 'br.gov.bcb.pix') + formatField('01', pixKey);

  if (input.description) {
    // Limite máximo total da tag 26 é 99 chars
    const maxDescLen = Math.max(0, 99 - merchantAccount.length - 4);
    const cleanDesc = stripAccents(input.description)
      .trim()
      .slice(0, maxDescLen);
    if (cleanDesc.length > 0) {
      merchantAccount += formatField('02', cleanDesc);
    }
  }

  let payload = '';
  payload += formatField('00', '01'); // Payload Format Indicator
  payload += formatField('26', merchantAccount); // Merchant Account Information
  payload += formatField('52', '0000'); // Merchant Category Code
  payload += formatField('53', '986'); // Currency (BRL)

  if (typeof input.amount === 'number' && input.amount > 0) {
    payload += formatField('54', input.amount.toFixed(2));
  }

  payload += formatField('58', 'BR'); // Country Code
  payload += formatField('59', merchantName);
  payload += formatField('60', merchantCity);

  // Additional Data Field Template (Tag 62 -> 05 Reference Label / txid)
  const additionalData = formatField('05', txid);
  payload += formatField('62', additionalData);

  // CRC16 (Tag 63, length 04)
  payload += '6304';
  const crc = computeCrc16(payload);
  return `${payload}${crc}`;
}
