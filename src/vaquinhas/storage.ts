import type { Vaquinha, VaquinhaPeriod, VaquinhasPersisted } from "./types";

const KEY = "vaquinhas:v4";
const KEY_V3 = "vaquinhas:v3";
const KEY_V2 = "vaquinhas:v2";

export const VAQUINHAS_SYNC_EVENT = "financas-vaquinhas-sync";

function nowYear() {
  return new Date().getFullYear();
}
function nowMonth() {
  return new Date().getMonth() + 1;
}

function defaultPeriod(): VaquinhaPeriod {
  return { kind: "monthly", year: nowYear(), month: nowMonth() };
}

function normalizePeriod(period: any): VaquinhaPeriod {
  if (!period || typeof period !== "object") return defaultPeriod();
  if (period.kind === "range") {
    return {
      kind: "range",
      startDateIso: String(period.startDateIso ?? ""),
      endDateIso: String(period.endDateIso ?? ""),
    };
  }
  if (period.kind === "yearly") {
    return { kind: "yearly", year: Number(period.year) || nowYear() };
  }
  if (period.kind === "monthly") {
    return {
      kind: "monthly",
      year: Number(period.year) || nowYear(),
      month: Number(period.month) || nowMonth(),
    };
  }
  return defaultPeriod();
}

function withPeriod(v: Omit<Vaquinha, "period"> & { period?: any }): Vaquinha {
  return {
    ...v,
    period: normalizePeriod(v.period),
    people: Array.isArray(v.people) ? v.people : [],
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

export function reviveVaquinhasFromUnknown(parsed: unknown): VaquinhasPersisted {
  if (!parsed || typeof parsed !== "object") return { version: 4, items: [] };
  try {
    const p = parsed as Partial<VaquinhasPersisted>;
    const items = Array.isArray(p.items)
      ? p.items.map((v) =>
          withPeriod({
            id: String((v as Vaquinha).id ?? ""),
            name: String((v as Vaquinha).name ?? ""),
            totalCents: Number((v as Vaquinha).totalCents) || 0,
            perPersonCents: Number((v as Vaquinha).perPersonCents) || 0,
            people: Array.isArray((v as Vaquinha).people) ? (v as Vaquinha).people : [],
            createdAtIso:
              typeof (v as Vaquinha).createdAtIso === "string"
                ? (v as Vaquinha).createdAtIso
                : new Date().toISOString(),
            period: (v as Vaquinha).period,
          }),
        )
      : [];
    return { version: 4, items: items.filter((v) => v.id && v.name) };
  } catch {
    return { version: 4, items: [] };
  }
}

export function loadVaquinhas(): VaquinhasPersisted {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as VaquinhasPersisted;
      if (parsed?.version === 4 && Array.isArray(parsed.items)) {
        return reviveVaquinhasFromUnknown(parsed);
      }
    }
    const fromV3 = migrateFromV3();
    if (fromV3.length) return { version: 4, items: fromV3 };
    return { version: 4, items: migrateFromV2() };
  } catch {
    return { version: 4, items: [] };
  }
}

export function saveVaquinhas(p: VaquinhasPersisted, opts?: { silent?: boolean }) {
  localStorage.setItem(KEY, JSON.stringify({ version: 4 as const, items: p.items }));
  if (!opts?.silent) {
    window.dispatchEvent(new Event(VAQUINHAS_SYNC_EVENT));
  }
}
