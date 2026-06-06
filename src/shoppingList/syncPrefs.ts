/** Chave partilhada com a app Lista de Compras (mesma origem no GitHub Pages). */
export const SHOPPING_LIST_SYNC_PREFS_KEY = "lista-compras:syncPrefs";

export const SHOPPING_LIST_URL = "https://thiagod11lopes-ops.github.io/Lista-de-Compras/";

/** Mesmo algoritmo que `hashSalaSync` em Lista-de-Compras (`nome|senha` → SHA-256 hex). */
export async function hashShoppingListRoom(email: string, secret: string): Promise<string> {
  const input = `${email.trim().toLowerCase()}|${secret}`;
  const encoded = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export type ShoppingListSyncPrefs = {
  ativo: boolean;
  roomHash: string | null;
};

export function saveShoppingListSyncPrefs(prefs: ShoppingListSyncPrefs): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SHOPPING_LIST_SYNC_PREFS_KEY, JSON.stringify(prefs));
  } catch {
    /* quota / modo privado */
  }
}

/** Liga a lista à conta Google (email + uid) antes de abrir a app externa. */
export async function activateShoppingListSyncForUser(email: string, uid: string): Promise<string> {
  const roomHash = await hashShoppingListRoom(email, uid);
  saveShoppingListSyncPrefs({ ativo: true, roomHash });
  return roomHash;
}

export function buildShoppingListUrl(roomHash?: string | null): string {
  if (!roomHash) return SHOPPING_LIST_URL;
  const url = new URL(SHOPPING_LIST_URL);
  url.searchParams.set("roomHash", roomHash);
  return url.toString();
}
