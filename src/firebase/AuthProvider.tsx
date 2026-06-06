import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type User,
} from "firebase/auth";
import { getFirebaseAuth, resolveGoogleRedirectOnce } from "./auth";
import { isFirebaseConfigured } from "./config";
import {
  clearGoogleRedirectPending,
  isGoogleRedirectPending,
  markGoogleRedirectPending,
} from "./loginRedirectState";
import { PWA_IOS_LOGIN_MESSAGE, requiresBrowserForGoogleLogin } from "../utils/pwa";

const AUTH_INIT_TIMEOUT_MS = 12_000;

function isIOSDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function isSafariBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /Safari/i.test(ua) && !/Chrome|Chromium|CriOS|FxiOS|EdgiOS|Edg|OPR/i.test(ua);
}

function isAndroidDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android/i.test(navigator.userAgent);
}

function shouldUseGoogleRedirect(): boolean {
  if (typeof window === "undefined") return false;
  if (isSafariBrowser() || isIOSDevice()) return true;
  if (isAndroidDevice()) return true;
  if ("ontouchstart" in window) return true;
  return window.matchMedia("(max-width: 640px)").matches;
}

function isPopupAuthError(code: string): boolean {
  return (
    code === "auth/popup-blocked-by-browser" ||
    code === "auth/cancelled-popup-request" ||
    code === "auth/popup-closed-by-user"
  );
}

function formatAuthError(e: unknown): string {
  const code =
    typeof e === "object" && e !== null && "code" in e ? String((e as { code: string }).code) : "";
  if (code === "auth/cancelled-popup-request") {
    return "O login foi interrompido. Tente de novo; no iPhone o Safari abre a página da Google e volta ao app.";
  }
  if (code === "auth/popup-blocked-by-browser") {
    return "O browser bloqueou a janela de login. Permita pop-ups ou tente no Safari/Chrome do telemóvel.";
  }
  if (code === "auth/popup-closed-by-user") {
    return "O login foi cancelado antes de concluir. Tente de novo.";
  }
  if (code === "auth/unauthorized-domain") {
    return "Este endereço do site não está autorizado no Firebase. Adicione thiagod11lopes-ops.github.io em Authentication → Domínios autorizados.";
  }
  if (code === "auth/network-request-failed") {
    return "Sem ligação à internet ou rede bloqueou o login. Verifique a Wi‑Fi e tente de novo.";
  }
  return e instanceof Error ? e.message : String(e);
}

const SAFARI_REDIRECT_HINT =
  "Não foi possível concluir o login no Safari. Em Ajustes do iPhone → Safari, desative «Impedir rastreio entre sites», evite navegação privada e tente «Entrar com Google» em Ajustes.";

type AuthContextValue = {
  configured: boolean;
  ready: boolean;
  authInitializing: boolean;
  user: User | null;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
  lastError: string | null;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const configured = useMemo(() => isFirebaseConfigured(), []);
  const [ready, setReady] = useState(false);
  const [authInitializing, setAuthInitializing] = useState(configured);
  const [user, setUser] = useState<User | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  useEffect(() => {
    if (!configured) {
      setAuthInitializing(false);
      setReady(true);
      return;
    }
    const auth = getFirebaseAuth();
    if (!auth) {
      setLastError("Não foi possível iniciar a autenticação Firebase.");
      setAuthInitializing(false);
      setReady(true);
      return;
    }

    let redirectChecked = false;
    let sawAuthAfterRedirect = false;
    let cancelled = false;

    const finishAuthInit = () => {
      if (redirectChecked && sawAuthAfterRedirect) {
        setAuthInitializing(false);
      }
    };

    const forceFinishAuthInit = () => {
      if (!cancelled) setAuthInitializing(false);
    };

    const timeoutId = window.setTimeout(forceFinishAuthInit, AUTH_INIT_TIMEOUT_MS);

    void resolveGoogleRedirectOnce(auth)
      .then((result) => {
        if (cancelled) return;
        if (isGoogleRedirectPending() && !result?.user) {
          clearGoogleRedirectPending();
          if (isSafariBrowser() || isIOSDevice()) {
            setLastError(SAFARI_REDIRECT_HINT);
          }
        }
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        const code =
          typeof e === "object" && e !== null && "code" in e
            ? String((e as { code: string }).code)
            : "";
        if (code !== "auth/no-auth-event") {
          setLastError(formatAuthError(e));
          console.warn("[Firebase auth redirect]", e);
        }
        clearGoogleRedirectPending();
      })
      .finally(() => {
        if (cancelled) return;
        redirectChecked = true;
        if (!isGoogleRedirectPending()) {
          sawAuthAfterRedirect = true;
        }
        finishAuthInit();
      });

    const unsub = onAuthStateChanged(auth, (u) => {
      if (cancelled) return;
      setUser(u);
      setReady(true);
      if (u) {
        clearGoogleRedirectPending();
        sawAuthAfterRedirect = true;
      } else if (redirectChecked) {
        sawAuthAfterRedirect = true;
      }
      finishAuthInit();
    });

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
      unsub();
    };
  }, [configured]);

  const signInWithGoogle = useCallback(async () => {
    setLastError(null);
    if (!configured) return;
    if (requiresBrowserForGoogleLogin()) {
      setLastError(PWA_IOS_LOGIN_MESSAGE);
      clearGoogleRedirectPending();
      return;
    }
    const auth = getFirebaseAuth();
    if (!auth) {
      setLastError("Não foi possível iniciar a autenticação Firebase.");
      return;
    }
    try {
      const provider = new GoogleAuthProvider();
      if (!shouldUseGoogleRedirect()) {
        provider.setCustomParameters({ prompt: "select_account" });
      }
      if (shouldUseGoogleRedirect()) {
        markGoogleRedirectPending();
        await signInWithRedirect(auth, provider);
        return;
      }
      try {
        await signInWithPopup(auth, provider);
        clearGoogleRedirectPending();
      } catch (popupErr: unknown) {
        const code =
          typeof popupErr === "object" && popupErr !== null && "code" in popupErr
            ? String((popupErr as { code: string }).code)
            : "";
        if (isPopupAuthError(code)) {
          markGoogleRedirectPending();
          await signInWithRedirect(auth, provider);
          return;
        }
        clearGoogleRedirectPending();
        throw popupErr;
      }
    } catch (e) {
      clearGoogleRedirectPending();
      setLastError(formatAuthError(e));
    }
  }, [configured]);

  const signOutUser = useCallback(async () => {
    setLastError(null);
    if (!configured) return;
    const auth = getFirebaseAuth();
    if (!auth) return;
    try {
      await signOut(auth);
      clearGoogleRedirectPending();
    } catch (e) {
      setLastError(formatAuthError(e));
    }
  }, [configured]);

  const value = useMemo(
    () => ({
      configured,
      ready,
      authInitializing,
      user,
      signInWithGoogle,
      signOutUser,
      lastError,
    }),
    [configured, ready, authInitializing, user, signInWithGoogle, signOutUser, lastError],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
