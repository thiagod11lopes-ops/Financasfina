import type { Vaquinha, VaquinhasPersisted } from "./types";

const KEY = "vaquinhas:v3";
const KEY_V2 = "vaquinhas:v2";
const KEY_V1 = "vaquinhas:v1";

function migrateFromV2(): Vaquinha[] {
  try {
    const raw = localStorage.getItem(KEY_V2);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as {
      items?: Array<{
        id: string;
        name: string;
        expectedCents?: number;
        paidCents?: number;
        createdAtIso?: string;
      }>;
    };
    return (parsed.items ?? []).map((v) => ({
      id: v.id,
      name: v.name,
      totalCents: v.expectedCents ?? 0,
      perPersonCents: 0,
      people: [],
      createdAtIso: v.createdAtIso ?? new Date().toISOString(),
    }));
  } catch {
    return [];
  }
}

function migrateFromV1(): Vaquinha[] {
  try {
    const raw = localStorage.getItem(KEY_V1);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as {
      items?: Array<{
        id: string;
        name: string;
        createdAtIso?: string;
        titles?: Array<{ payerName?: string; amountCents?: number; status?: string }>;
      }>;
    };
    return (parsed.items ?? []).map((v) => {
      const total = (v.titles ?? []).reduce((a, t) => a + (t.amountCents || 0), 0);
      const people = (v.titles ?? []).map((t, i) => ({
        id: `migrated_${v.id}_${i}`,
        name: t.payerName?.trim() || `Pessoa ${i + 1}`,
        status: (t.status === "paid" ? "paid" : "pending") as "paid" | "pending",
      }));
      const perPerson =
        people.length > 0
          ? Math.round(total / people.length)
          : 0;
      return {
        id: v.id,
        name: v.name,
        totalCents: total,
        perPersonCents: perPerson,
        people,
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
    if (raw) {
      const parsed = JSON.parse(raw) as VaquinhasPersisted;
      if (parsed?.version === 3 && Array.isArray(parsed.items)) return parsed;
    }
    const fromV2 = migrateFromV2();
    if (fromV2.length) return { version: 3, items: fromV2 };
    return { version: 3, items: migrateFromV1() };
  } catch {
    return { version: 3, items: [] };
  }
}

export function saveVaquinhas(p: VaquinhasPersisted) {
  localStorage.setItem(KEY, JSON.stringify(p));
}