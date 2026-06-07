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

/** Abre URL no clique do utilizador — sem await (Safari bloqueia opens atrasados). */
export function openExternalUrl(url: string): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  if (isIOSDevice() && isInstalledPwa()) {
    window.location.href = url;
    return;
  }

  const link = document.createElement("a");
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
