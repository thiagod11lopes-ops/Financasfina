import {
  browserLocalPersistence,
  browserPopupRedirectResolver,
  getAuth,
  indexedDBLocalPersistence,
  initializeAuth,
  type Auth,
} from "firebase/auth";
import { getFirebaseApp } from "./config";

let cachedAuth: Auth | null | undefined;

/**
 * Auth com persistência IndexedDB + resolver de redirect — necessário para Safari no iPhone
 * concluir o login ao voltar da página da Google.
 */
export function getFirebaseAuth(): Auth | null {
  if (cachedAuth !== undefined) return cachedAuth;
  const app = getFirebaseApp();
  if (!app) {
    cachedAuth = null;
    return null;
  }
  try {
    cachedAuth = initializeAuth(app, {
      persistence: [indexedDBLocalPersistence, browserLocalPersistence],
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
