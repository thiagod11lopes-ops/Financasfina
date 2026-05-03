import { getApps, initializeApp, type FirebaseApp } from "firebase/app";

const keys = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_STORAGE_BUCKET",
  "VITE_FIREBASE_MESSAGING_SENDER_ID",
  "VITE_FIREBASE_APP_ID",
] as const;

export function isFirebaseConfigured(): boolean {
  return keys.every((k) => {
    const v = import.meta.env[k as keyof ImportMetaEnv];
    return typeof v === "string" && v.trim().length > 0;
  });
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
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  };
  cached = getApps().length > 0 ? getApps()[0]! : initializeApp(config);
  return cached;
}
