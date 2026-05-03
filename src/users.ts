const USERS_KEY = "financas-users-v1";
export const USERS_SYNC_EVENT = "financas-users-sync";
export const USERS_ALL_OPTION = "Todos";

/** Paleta inicial ao migrar listas antigas ou quando a cor é inválida. */
export const USER_COLOR_PRESETS = [
  "#38bdf8",
  "#a78bfa",
  "#34d399",
  "#fbbf24",
  "#fb7185",
  "#2dd4bf",
  "#818cf8",
  "#f472b6",
] as const;

export type UserRecord = {
  name: string;
  /** #rrggbb; ausente para "Todos". */
  color?: string;
};

type StoredV2 = { version: 2; users: UserRecord[] };

function normalizeHex(c: string | undefined | null): string | undefined {
  if (c == null || typeof c !== "string") return undefined;
  const s = c.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(s)) return s.toLowerCase();
  return undefined;
}

function sanitizeNameList(input: unknown): string[] {
  const base = Array.isArray(input) ? input : [];
  const seen = new Set<string>();
  const out: string[] = [USERS_ALL_OPTION];
  seen.add(USERS_ALL_OPTION.toLowerCase());
  for (const raw of base) {
    if (typeof raw !== "string") continue;
    const name = raw.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

function nextAutoColor(existing: UserRecord[]): string {
  const used = new Set(existing.map((r) => (r.color ?? "").toLowerCase()).filter(Boolean));
  for (const c of USER_COLOR_PRESETS) {
    if (!used.has(c)) return c;
  }
  return USER_COLOR_PRESETS[existing.length % USER_COLOR_PRESETS.length]!;
}

function migrateFromLegacyNames(names: string[]): UserRecord[] {
  const clean = sanitizeNameList(names);
  let pi = 0;
  return clean.map((name) => {
    if (name === USERS_ALL_OPTION) return { name };
    const color = USER_COLOR_PRESETS[pi % USER_COLOR_PRESETS.length]!;
    pi++;
    return { name, color };
  });
}

function sanitizeV2Users(input: unknown): UserRecord[] {
  const arr = Array.isArray(input) ? input : [];
  const seen = new Set<string>();
  const body: UserRecord[] = [];

  for (const raw of arr) {
    if (!raw || typeof raw !== "object") continue;
    const o = raw as { name?: unknown; color?: unknown };
    const name = typeof o.name === "string" ? o.name.trim() : "";
    if (!name) continue;
    const key = name.toLowerCase();
    if (key === USERS_ALL_OPTION.toLowerCase()) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    const color =
      normalizeHex(typeof o.color === "string" ? o.color : undefined) ??
      nextAutoColor([{ name: USERS_ALL_OPTION }, ...body]);
    body.push({ name, color });
  }

  return [{ name: USERS_ALL_OPTION }, ...body];
}

/** Comparar listas de utilizadores de forma estável (ex.: sincronização Firestore). */
export function sanitizeForCloudCompare(users: UserRecord[]): string {
  return JSON.stringify(sanitizeV2Users(users));
}

function isStoredV2(x: unknown): x is StoredV2 {
  return Boolean(x && typeof x === "object" && (x as StoredV2).version === 2 && Array.isArray((x as StoredV2).users));
}

function persistRecords(users: UserRecord[]): void {
  const payload: StoredV2 = { version: 2, users };
  localStorage.setItem(USERS_KEY, JSON.stringify(payload));
}

/** Grava a lista de utilizadores (ex.: após sincronizar a partir do Firestore). */
export function saveUserRecords(users: UserRecord[]): void {
  persistRecords(sanitizeV2Users(users));
}

export function loadUserRecords(): UserRecord[] {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    if (!raw) return [{ name: USERS_ALL_OPTION }];
    const data = JSON.parse(raw) as unknown;
    if (Array.isArray(data)) {
      const migrated = migrateFromLegacyNames(data);
      persistRecords(migrated);
      return migrated;
    }
    if (isStoredV2(data)) {
      return sanitizeV2Users(data.users);
    }
  } catch {
    /* ignore */
  }
  return [{ name: USERS_ALL_OPTION }];
}

export function loadUsers(): string[] {
  return loadUserRecords().map((r) => r.name);
}

/** Cor hex do responsável, ou `undefined` para "Todos" / desconhecido. */
export function getUserColor(name: string | undefined | null): string | undefined {
  if (name == null) return undefined;
  const n = String(name).trim();
  if (!n || n === USERS_ALL_OPTION) return undefined;
  const rec = loadUserRecords().find((r) => r.name.toLowerCase() === n.toLowerCase());
  return rec?.color;
}

export function loadUserColorMap(): Record<string, string> {
  const m: Record<string, string> = {};
  for (const r of loadUserRecords()) {
    if (r.color && r.name !== USERS_ALL_OPTION) m[r.name.toLowerCase()] = r.color;
  }
  return m;
}

/** Cor de fundo para "Todos": gradiente com as cores de todos os utilizadores (ou cinza se não houver ninguém). */
export function getTodosMergedBackground(): string {
  const colors = loadUserRecords()
    .filter((r) => r.name !== USERS_ALL_OPTION && r.color)
    .map((r) => r.color!.toLowerCase());
  const uniq = [...new Set(colors)];
  if (uniq.length === 0) return "linear-gradient(135deg, #64748b 0%, #94a3b8 100%)";
  if (uniq.length === 1) return uniq[0]!;
  return `linear-gradient(90deg, ${uniq.join(", ")})`;
}

/** Gradiente com as cores dos nomes indicados (para vários responsáveis na rotina). */
export function getMergedBackgroundForUserSubset(names: string[]): string {
  if (names.length === 0) return getTodosMergedBackground();
  const map = loadUserColorMap();
  const colors = names.map((n) => map[n.toLowerCase()]).filter((c): c is string => Boolean(c));
  const uniq = [...new Set(colors.map((c) => c.toLowerCase()))];
  if (uniq.length === 0) return "linear-gradient(135deg, #64748b 0%, #94a3b8 100%)";
  if (uniq.length === 1) return uniq[0]!;
  return `linear-gradient(90deg, ${uniq.join(", ")})`;
}

export function addUserWithColor(name: string, color: string): string[] {
  const n = name.trim();
  if (!n || n.toLowerCase() === USERS_ALL_OPTION.toLowerCase()) return loadUsers();
  const hex = normalizeHex(color) ?? nextAutoColor(loadUserRecords());
  const current = loadUserRecords();
  if (current.some((r) => r.name.toLowerCase() === n.toLowerCase())) return loadUsers();
  persistRecords(sanitizeV2Users([...current, { name: n, color: hex }]));
  return loadUsers();
}

export function setUserColor(name: string, color: string): string[] {
  const n = name.trim();
  if (!n || n.toLowerCase() === USERS_ALL_OPTION.toLowerCase()) return loadUsers();
  const hex = normalizeHex(color) ?? nextAutoColor([]);
  const next = loadUserRecords().map((r) =>
    r.name.toLowerCase() === n.toLowerCase() && r.name !== USERS_ALL_OPTION ? { ...r, color: hex } : r,
  );
  persistRecords(sanitizeV2Users(next));
  return loadUsers();
}

export function removeUserName(name: string): string[] {
  const n = name.trim();
  if (!n || n.toLowerCase() === USERS_ALL_OPTION.toLowerCase()) return loadUsers();
  const next = loadUserRecords().filter((r) => r.name.toLowerCase() !== n.toLowerCase());
  persistRecords(sanitizeV2Users(next));
  return loadUsers();
}

export function notifyUsersSync() {
  window.dispatchEvent(new CustomEvent(USERS_SYNC_EVENT));
}
