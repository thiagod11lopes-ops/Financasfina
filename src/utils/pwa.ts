export const PWA_IOS_LOGIN_MESSAGE =
  "No ícone instalado no iPhone, o login Google não funciona. Toque em «Abrir no Safari», entre com a sua conta e use o site no browser.";

export function isIOSDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

/** App aberto pelo «Adicionar ao ecrã inicial» (PWA / standalone). */
export function isInstalledPwa(): boolean {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  if (nav.standalone === true) return true;
  return window.matchMedia("(display-mode: standalone)").matches;
}

/** iPhone em modo PWA: mostrar ajuda para abrir no Safari se o popup falhar. */
export function shouldShowPwaSafariLoginHint(): boolean {
  return isIOSDevice() && isInstalledPwa();
}

/** @deprecated Use shouldShowPwaSafariLoginHint — o login via popup é tentado primeiro. */
export function requiresBrowserForGoogleLogin(): boolean {
  return false;
}

export function getAbsoluteAppUrl(): string {
  const base = import.meta.env.BASE_URL || "/";
  return new URL(base, window.location.origin).href;
}

/**
 * Reserva uma janela no clique (antes de await) para o Safari não bloquear o open.
 * No PWA do iPhone devolve null — aí usamos navegação na mesma janela.
 */
export function prepareAsyncUrlOpen(): Window | null {
  if (typeof window === "undefined") return null;
  if (isIOSDevice() && isInstalledPwa()) return null;
  try {
    return window.open("about:blank", "_blank", "noopener,noreferrer");
  } catch {
    return null;
  }
}

/** Conclui abertura de URL após trabalho assíncrono (ex.: gerar roomHash). */
export function completeAsyncUrlOpen(url: string, placeholder: Window | null): void {
  if (typeof window === "undefined") return;
  if (placeholder && !placeholder.closed) {
    try {
      placeholder.location.replace(url);
      return;
    } catch {
      /* fallback abaixo */
    }
  }
  if (isIOSDevice() && isInstalledPwa()) {
    window.location.assign(url);
    return;
  }
  const win = window.open(url, "_blank", "noopener,noreferrer");
  if (!win) window.location.assign(url);
}
