import type { Vaquinha, VaquinhaPeriod, VaquinhasPersisted } from "./types";

const KEY = "vaquinhas:v4";
const KEY_V3 = "vaquinhas:v3";
const KEY_V2 = "vaquinhas:v2";

function defaultPeriod(): VaquinhaPeriod {
  return { kind: "monthly" };
}

function withPeriod(v: Omit<Vaquinha, "period"> & { period?: VaquinhaPeriod }): Vaquinha {
  return {
    ...v,
    period: v.period ?? defaultPeriod(),
    people: v.people ?? [],
  };
}

function migrateFromV3(): Vaquinha[] {
  try {
    const raw = localStorage.getItem(KEY_V3);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { items?: Array<any> };
    return (parsed.items ?? []).map((v) =>
      withPeriod({
        id: v.id,
        name: v.name,
        totalCents: v.totalCents ?? 0,
        perPersonCents: v.perPersonCents ?? 0,
        people: v.people ?? [],
        createdAtIso: v.createdAtIso ?? new Date().toISOString(),
        period: v.period,
      }),
    );
  } catch {
    return [];
  }
}

function migrateFromV2(): Vaquinha[] {
  try {
    const raw = localStorage.getItem(KEY_V2);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { items?: Array<any> };
    return (parsed.items ?? []).map((v) =>
      withPeriod({
        id: v.id,
        name: v.name,
        totalCents: v.expectedCents ?? 0,
        perPersonCents: 0,
        people: [],
        createdAtIso: v.createdAtIso ?? new Date().toISOString(),
      }),
    );
  } catch {
    return [];
  }
}

export function loadVaquinhas(): VaquinhasPersisted {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as VaquinhasPersisted;
      if (parsed?.version === 4 && Array.isArray(parsed.items)) {
        return { version: 4, items: parsed.items.map((v) => withPeriod(v)) };
      }
    }
    const fromV3 = migrateFromV3();
    if (fromV3.length) return { version: 4, items: fromV3 };
    return { version: 4, items: migrateFromV2() };
  } catch {
    return { version: 4, items: [] };
  }
}

export function saveVaquinhas(p: VaquinhasPersisted) {
  localStorage.setItem(KEY, JSON.stringify(p));
}