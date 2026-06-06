import type { FirebaseApp } from "firebase/app";
import {
  browserLocalPersistence,
  browserPopupRedirectResolver,
  getAuth,
  getRedirectResult,
  inMemoryPersistence,
  indexedDBLocalPersistence,
  initializeAuth,
  type Auth,
  type UserCredential,
} from "firebase/auth";

let cachedAuth: Auth | null = null;

/** Uma vez por carregamento — Safari quebra se getRedirectResult for chamado duas vezes. */
let redirectResultPromise: Promise<UserCredential | null> | null = null;

/**
 * Tem de correr logo após initializeApp, antes de getAuth() automático,
 * para o Safari ter popupRedirectResolver no redirect da Google.
 */
export function initFirebaseAuth(app: FirebaseApp): Auth {
  if (cachedAuth) return cachedAuth;
  try {
    cachedAuth = initializeAuth(app, {
      persistence: [indexedDBLocalPersistence, browserLocalPersistence, inMemoryPersistence],
      popupRedirectResolver: browserPopupRedirectResolver,
    });
  } catch (e: unknown) {
    const code =
      typeof e === "object" && e !== null && "code" in e
        ? String((e as { code: string }).code)
        : "";
    if (code === "auth/already-initialized") {
      cachedAuth = getAuth(app);
    } else {
      throw e;
    }
  }
  return cachedAuth;
}

export function getFirebaseAuth(): Auth | null {
  return cachedAuth;
}

export function resolveGoogleRedirectOnce(auth: Auth): Promise<UserCredential | null> {
  if (redirectResultPromise) return redirectResultPromise;
  redirectResultPromise = getRedirectResult(auth).catch((e: unknown) => {
    redirectResultPromise = null;
    throw e;
  });
  return redirectResultPromise;
}
