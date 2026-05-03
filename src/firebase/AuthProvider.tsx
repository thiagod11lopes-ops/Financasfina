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
  getAuth,
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type User,
} from "firebase/auth";
import { getFirebaseApp, isFirebaseConfigured } from "./config";

/** Em telemóveis o popup costuma falhar (auth/cancelled-popup-request); o redirect é mais fiável. */
function shouldUseGoogleRedirect(): boolean {
  if (typeof window === "undefined") return false;
  if ("ontouchstart" in window) return true;
  return window.matchMedia("(max-width: 640px)").matches;
}

function formatAuthError(e: unknown): string {
  const code =
    typeof e === "object" && e !== null && "code" in e ? String((e as { code: string }).code) : "";
  if (code === "auth/cancelled-popup-request") {
    return "O login foi interrompido (janela fechada ou bloqueada). Tente de novo; em telemóvel use o fluxo que abre a página da Google.";
  }
  if (code === "auth/popup-blocked-by-browser") {
    return "O browser bloqueou a janela de login. Permita pop-ups para este site ou tente noutro browser.";
  }
  return e instanceof Error ? e.message : String(e);
}

type AuthContextValue = {
  configured: boolean;
  /** `true` depois da primeira resolução do estado de sessão (ou logo se Firebase desligado). */
  ready: boolean;
  user: User | null;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
  lastError: string | null;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const configured = useMemo(() => isFirebaseConfigured(), []);
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  useEffect(() => {
    if (!configured) {
      setReady(true);
      return;
    }
    const app = getFirebaseApp();
    if (!app) {
      setReady(true);
      return;
    }
    const auth = getAuth(app);
    void getRedirectResult(auth).catch((e: unknown) => {
      const code =
        typeof e === "object" && e !== null && "code" in e
          ? String((e as { code: string }).code)
          : "";
      if (code === "auth/no-auth-event") return;
      console.warn("[Firebase auth redirect]", e);
    });
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setReady(true);
    });
    return () => unsub();
  }, [configured]);

  const signInWithGoogle = useCallback(async () => {
    setLastError(null);
    if (!configured) return;
    const app = getFirebaseApp();
    if (!app) return;
    try {
      const auth = getAuth(app);
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      if (shouldUseGoogleRedirect()) {
        await signInWithRedirect(auth, provider);
        return;
      }
      await signInWithPopup(auth, provider);
    } catch (e) {
      setLastError(formatAuthError(e));
    }
  }, [configured]);

  const signOutUser = useCallback(async () => {
    setLastError(null);
    if (!configured) return;
    const app = getFirebaseApp();
    if (!app) return;
    try {
      await signOut(getAuth(app));
    } catch (e) {
      setLastError(formatAuthError(e));
    }
  }, [configured]);

  const value = useMemo(
    () => ({
      configured,
      ready,
      user,
      signInWithGoogle,
      signOutUser,
      lastError,
    }),
    [configured, ready, user, signInWithGoogle, signOutUser, lastError],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
