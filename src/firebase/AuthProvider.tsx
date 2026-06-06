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
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type User,
} from "firebase/auth";
import { getFirebaseAuth } from "./auth";
import { isFirebaseConfigured } from "./config";

function isIOSDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

/** Safari no iPhone/iPad — popup falha; redirect é obrigatório. */
function isSafariBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /Safari/i.test(ua) && !/Chrome|Chromium|CriOS|FxiOS|EdgiOS|Edg|OPR/i.test(ua);
}

function isAndroidDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android/i.test(navigator.userAgent);
}

/** iPhone Safari e telemóveis em geral usam redirect; Chrome Android também (ecrã tátil). */
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
    return "Este endereço do site não está autorizado no Firebase. Adicione o domínio em Authentication → Domínios autorizados.";
  }
  return e instanceof Error ? e.message : String(e);
}

type AuthContextValue = {
  configured: boolean;
  /** `true` depois da primeira resolução do estado de sessão (ou logo se Firebase desligado). */
  ready: boolean;
  /** Aguarda o retorno do redirect da Google (evita modal de login no iPhone a meio do fluxo). */
  redirectResolving: boolean;
  user: User | null;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
  lastError: string | null;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const configured = useMemo(() => isFirebaseConfigured(), []);
  const [ready, setReady] = useState(false);
  const [redirectResolving, setRedirectResolving] = useState(configured);
  const [user, setUser] = useState<User | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  useEffect(() => {
    if (!configured) {
      setRedirectResolving(false);
      setReady(true);
      return;
    }
    const auth = getFirebaseAuth();
    if (!auth) {
      setRedirectResolving(false);
      setReady(true);
      return;
    }

    void (async () => {
      try {
        await getRedirectResult(auth);
      } catch (e: unknown) {
        const code =
          typeof e === "object" && e !== null && "code" in e
            ? String((e as { code: string }).code)
            : "";
        if (code !== "auth/no-auth-event") {
          setLastError(formatAuthError(e));
          console.warn("[Firebase auth redirect]", e);
        }
      } finally {
        setRedirectResolving(false);
      }
    })();

    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setReady(true);
    });
    return () => unsub();
  }, [configured]);

  const signInWithGoogle = useCallback(async () => {
    setLastError(null);
    if (!configured) return;
    const auth = getFirebaseAuth();
    if (!auth) return;
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      if (shouldUseGoogleRedirect()) {
        await signInWithRedirect(auth, provider);
        return;
      }
      try {
        await signInWithPopup(auth, provider);
      } catch (popupErr: unknown) {
        const code =
          typeof popupErr === "object" && popupErr !== null && "code" in popupErr
            ? String((popupErr as { code: string }).code)
            : "";
        if (isPopupAuthError(code)) {
          await signInWithRedirect(auth, provider);
          return;
        }
        throw popupErr;
      }
    } catch (e) {
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
    } catch (e) {
      setLastError(formatAuthError(e));
    }
  }, [configured]);

  const value = useMemo(
    () => ({
      configured,
      ready,
      redirectResolving,
      user,
      signInWithGoogle,
      signOutUser,
      lastError,
    }),
    [configured, ready, redirectResolving, user, signInWithGoogle, signOutUser, lastError],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
