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

/** iPhone em modo PWA: Firebase redirect não navega — login tem de ser no Safari. */
export function requiresBrowserForGoogleLogin(): boolean {
  return isIOSDevice() && isInstalledPwa();
}

export function getAbsoluteAppUrl(): string {
  const base = import.meta.env.BASE_URL || "/";
  return new URL(base, window.location.origin).href;
}
