import { getApps, initializeApp, type FirebaseApp } from "firebase/app";

const keys = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_STORAGE_BUCKET",
  "VITE_FIREBASE_MESSAGING_SENDER_ID",
  "VITE_FIREBASE_APP_ID",
] as const;

/** Evita URLs inválidas se os segredos no CI tiverem espaço/tab/quebra de linha ao colar. */
function envStr(name: (typeof keys)[number]): string {
  const v = import.meta.env[name as keyof ImportMetaEnv];
  return typeof v === "string" ? v.trim() : "";
}

export function isFirebaseConfigured(): boolean {
  return keys.every((k) => envStr(k).length > 0);
}

let cached: FirebaseApp | null | undefined;

/** Instância única; `null` se as variáveis de ambiente estiverem incompletas. */
export function getFirebaseApp(): FirebaseApp | null {
  if (cached !== undefined) return cached;
  if (!isFirebaseConfigured()) {
    cached = null;
    return null;
  }
  const config = {
    apiKey: envStr("VITE_FIREBASE_API_KEY"),
    authDomain: envStr("VITE_FIREBASE_AUTH_DOMAIN"),
    projectId: envStr("VITE_FIREBASE_PROJECT_ID"),
    storageBucket: envStr("VITE_FIREBASE_STORAGE_BUCKET"),
    messagingSenderId: envStr("VITE_FIREBASE_MESSAGING_SENDER_ID"),
    appId: envStr("VITE_FIREBASE_APP_ID"),
  };
  cached = getApps().length > 0 ? getApps()[0]! : initializeApp(config);
  return cached;
}
