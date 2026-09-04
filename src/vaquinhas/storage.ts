import type { VaquinhasPersisted, Vaquinha } from "./types";

const KEY = "vaquinhas:v2";
const LEGACY_KEY = "vaquinhas:v1";

function migrateLegacy(): Vaquinha[] {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as {
      version?: number;
      items?: Array<{
        id: string;
        name: string;
        createdAtIso?: string;
        titles?: Array<{ amountCents: number; status: string }>;
      }>;
    };
    if (!parsed?.items) return [];
    return parsed.items.map((v) => {
      const expected = (v.titles ?? []).reduce((a, t) => a + (t.amountCents || 0), 0);
      const paid = (v.titles ?? []).reduce(
        (a, t) => a + (t.status === "paid" ? t.amountCents || 0 : 0),
        0,
      );
      return {
        id: v.id,
        name: v.name,
        expectedCents: expected,
        paidCents: paid,
        createdAtIso: v.createdAtIso ?? new Date().toISOString(),
      };
    });
  } catch {
    return [];
  }
}

export function loadVaquinhas(): VaquinhasPersisted {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      const migrated = migrateLegacy();
      return { version: 2, items: migrated };
    }
    const parsed = JSON.parse(raw) as VaquinhasPersisted;
    if (!parsed || parsed.version !== 2) return { version: 2, items: migrateLegacy() };
    return parsed;
  } catch {
    return { version: 2, items: [] };
  }
}

export function saveVaquinhas(p: VaquinhasPersisted) {
  localStorage.setItem(KEY, JSON.stringify(p));
}