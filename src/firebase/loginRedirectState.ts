const REDIRECT_PENDING_KEY = "financas-google-redirect-pending";

export function markGoogleRedirectPending(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(REDIRECT_PENDING_KEY, String(Date.now()));
  } catch {
    /* */
  }
}

export function clearGoogleRedirectPending(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(REDIRECT_PENDING_KEY);
  } catch {
    /* */
  }
}

export function isGoogleRedirectPending(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return sessionStorage.getItem(REDIRECT_PENDING_KEY) != null;
  } catch {
    return false;
  }
}
