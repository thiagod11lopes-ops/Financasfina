import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, type User } from "firebase/auth";
import { getFirebaseApp, isFirebaseConfigured } from "./config";

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
      await signInWithPopup(auth, provider);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setLastError(msg);
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
      const msg = e instanceof Error ? e.message : String(e);
      setLastError(msg);
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
