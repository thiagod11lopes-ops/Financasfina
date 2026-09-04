import { doc, getFirestore, serverTimestamp, setDoc } from "firebase/firestore";
import { getFirebaseApp } from "./config";

/** Grava e-mail e último acesso no doc userFinances (métricas do Painel de Controle). */
export async function syncAccountMetaToFirestore(uid: string, email: string): Promise<void> {
  const app = getFirebaseApp();
  if (!app) return;
  const db = getFirestore(app);
  const ref = doc(db, "userFinances", uid);
  await setDoc(
    ref,
    {
      accountEmail: email.trim().toLowerCase(),
      accountLastSeenAt: serverTimestamp(),
    },
    { merge: true },
  );
}
