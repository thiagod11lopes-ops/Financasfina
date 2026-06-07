/** Chave partilhada com a app Lista de Compras (mesma origem no GitHub Pages). */
export const SHOPPING_LIST_SYNC_PREFS_KEY = "lista-compras:syncPrefs";
export const SHOPPING_LIST_ACCOUNT_EMAIL_KEY = "lista-compras:financasAccountEmail";

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

export function saveShoppingListAccountEmail(email: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SHOPPING_LIST_ACCOUNT_EMAIL_KEY, email.trim());
  } catch {
    /* quota / modo privado */
  }
}

export function readShoppingListSyncPrefs(): ShoppingListSyncPrefs | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SHOPPING_LIST_SYNC_PREFS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ShoppingListSyncPrefs>;
    const roomHash =
      typeof parsed.roomHash === "string" && /^[a-f0-9]{64}$/.test(parsed.roomHash)
        ? parsed.roomHash
        : null;
    if (!parsed.ativo || !roomHash) return null;
    return { ativo: true, roomHash };
  } catch {
    return null;
  }
}

/** URL pronta no clique — usa prefs já gravadas (pré-calculadas no login). */
export function resolveShoppingListUrl(email?: string | null): string {
  if (!email) return SHOPPING_LIST_URL;
  const prefs = readShoppingListSyncPrefs();
  return buildShoppingListUrl(prefs?.roomHash ?? null, email);
}

/** Liga a lista à conta Google (email + uid) antes de abrir a app externa. */
export async function activateShoppingListSyncForUser(email: string, uid: string): Promise<string> {
  const roomHash = await hashShoppingListRoom(email, uid);
  saveShoppingListSyncPrefs({ ativo: true, roomHash });
  saveShoppingListAccountEmail(email);
  return roomHash;
}

export function buildShoppingListUrl(roomHash?: string | null, email?: string | null): string {
  const url = new URL(SHOPPING_LIST_URL);
  if (roomHash) url.searchParams.set("roomHash", roomHash);
  if (email) url.searchParams.set("accountEmail", email.trim());
  if (!roomHash && !email) return SHOPPING_LIST_URL;
  return url.toString();
}
