/**
 * Estratégia de persistência e retorno de Magic Link usando cookies auxiliares
 * + localStorage, complementando o browserLocalPersistence do Firebase Auth.
 * Nunca armazena segredos ou tokens em cookies; apenas pistas de fluxo de login.
 */

const SIGNIN_EMAIL_COOKIE = 'megacorn_signin_email';
const SESSION_HINT_COOKIE = 'megacorn_session_hint';
const INVITE_CODE_COOKIE = 'megacorn_invite_code';
const REDIRECT_KEY = 'megacorn_post_login_redirect';
const SIGNIN_EMAIL_LS = 'megacorn_email_for_signin';
const INVITE_CODE_LS = 'megacorn_invite_code_ls';

function setCookie(name: string, value: string, maxAgeSeconds: number): void {
  const encoded = encodeURIComponent(value);
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${name}=${encoded}; Max-Age=${maxAgeSeconds}; Path=/; SameSite=Lax${secure}`;
}

function getCookie(name: string): string | null {
  const prefix = `${name}=`;
  const parts = document.cookie.split(';');
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.startsWith(prefix)) {
      try {
        return decodeURIComponent(trimmed.slice(prefix.length));
      } catch {
        return null;
      }
    }
  }
  return null;
}

function deleteCookie(name: string): void {
  document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax`;
}

export function rememberSignInEmail(email: string): void {
  const clean = email.trim().toLowerCase();
  try {
    window.localStorage.setItem(SIGNIN_EMAIL_LS, clean);
  } catch {
    // fallback cookie
  }
  // Cookie curto (1h) para sobreviver redirecionamentos dentro do mesmo browser
  setCookie(SIGNIN_EMAIL_COOKIE, clean, 3600);
}

export function getRememberedSignInEmail(): string | null {
  try {
    const fromLs = window.localStorage.getItem(SIGNIN_EMAIL_LS);
    if (fromLs) return fromLs;
  } catch {
    // ignore
  }
  return getCookie(SIGNIN_EMAIL_COOKIE);
}

export function clearRememberedSignInEmail(): void {
  try {
    window.localStorage.removeItem(SIGNIN_EMAIL_LS);
  } catch {
    // ignore
  }
  deleteCookie(SIGNIN_EMAIL_COOKIE);
}

export function setSessionCookieHint(email: string): void {
  // Cookie não sensível de 30 dias indicando sessão ativa para UX instantânea
  setCookie(SESSION_HINT_COOKIE, email.trim().toLowerCase(), 60 * 60 * 24 * 30);
}

export function getSessionCookieHint(): string | null {
  return getCookie(SESSION_HINT_COOKIE);
}

export function savePostLoginRedirect(path: string): void {
  if (!path.startsWith('/')) return;
  try {
    window.sessionStorage.setItem(REDIRECT_KEY, path);
  } catch {
    // ignore
  }
}

export function consumePostLoginRedirect(): string {
  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get('redirect');
  let fromStorage: string | null = null;
  try {
    fromStorage = window.sessionStorage.getItem(REDIRECT_KEY);
    window.sessionStorage.removeItem(REDIRECT_KEY);
  } catch {
    // ignore
  }
  const candidate = fromQuery || fromStorage || '/minha-cota';
  return candidate.startsWith('/') ? candidate : '/minha-cota';
}

export function clearAllSessionArtifacts(): void {
  clearRememberedSignInEmail();
  deleteCookie(SESSION_HINT_COOKIE);
  try {
    window.sessionStorage.removeItem(REDIRECT_KEY);
  } catch {
    // ignore
  }
}

/**
 * Extrai o código de convite da URL, aceitando `?convite=`, `?invite=` ou `?code=`
 * tanto na query string raiz quanto dentro do hash (`#/?convite=...`).
 */
export function extractInviteCodeFromUrl(): string | null {
  const keys = ['convite', 'invite', 'code'];

  const searchParams = new URLSearchParams(window.location.search);
  for (const key of keys) {
    const val = searchParams.get(key);
    if (val && val.trim()) return val.trim().toUpperCase();
  }

  const hash = window.location.hash || '';
  const qIdx = hash.indexOf('?');
  if (qIdx !== -1) {
    const hashParams = new URLSearchParams(hash.slice(qIdx + 1));
    for (const key of keys) {
      const val = hashParams.get(key);
      if (val && val.trim()) return val.trim().toUpperCase();
    }
  }

  return null;
}

export function rememberInviteCode(code: string): void {
  const clean = code.trim().toUpperCase();
  if (!clean) return;
  try {
    window.localStorage.setItem(INVITE_CODE_LS, clean);
  } catch {
    // ignore
  }
  setCookie(INVITE_CODE_COOKIE, clean, 60 * 60 * 24 * 7);
}

export function getRememberedInviteCode(): string {
  const fromUrl = extractInviteCodeFromUrl();
  if (fromUrl) {
    rememberInviteCode(fromUrl);
    return fromUrl;
  }
  try {
    const fromLs = window.localStorage.getItem(INVITE_CODE_LS);
    if (fromLs) return fromLs;
  } catch {
    // ignore
  }
  return getCookie(INVITE_CODE_COOKIE) || '';
}

export function buildInviteShareUrl(code: string): string {
  const base = `${window.location.origin}${window.location.pathname}`;
  const url = new URL(base);
  const clean = code.trim().toUpperCase();
  if (clean) {
    url.searchParams.set('convite', clean);
  }
  return url.toString();
}

/**
 * Monta a URL de retorno na raiz do site (compatível com GitHub Pages + HashRouter),
 * preservando o código de convite se disponível.
 */
export function buildMagicLinkReturnUrl(redirectPath = '/minha-cota'): string {
  const base = `${window.location.origin}${window.location.pathname}`;
  const url = new URL(base);
  url.searchParams.set('redirect', redirectPath);
  const invite = getRememberedInviteCode();
  if (invite) {
    url.searchParams.set('convite', invite);
  }
  return url.toString();
}
