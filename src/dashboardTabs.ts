import { monthKey } from "./utils/format";
import { isCloudSessionActive } from "./storage/cloudSession";

export const DASH_TABS_KEY = "financas-dashboard-month-tabs-v1";

export const DASH_TABS_SYNC_EVENT = "financas-dashboard-tabs-sync";

export type TabsPersist = {
  tabs: string[];
  active: string;
};

let memoryTabs: TabsPersist | null = null;

/** Sempre o mês civil atual (YYYY-MM). */
export function currentMonthTab(): string {
  return monthKey(new Date());
}

export function defaultTabsPersist(): TabsPersist {
  const ym = currentMonthTab();
  return { tabs: [ym], active: ym };
}

/** Meses YYYY-MM presentes nos lançamentos (fluxo, mercado, combustível, etc.). */
export function monthsWithFinanceData(state: {
  movements: { date: string }[];
  supermarket: { date: string }[];
  fuel: { date: string }[];
  futureIncomes: { expectedDate?: string }[];
}): string[] {
  const set = new Set<string>();
  const add = (iso: string | undefined) => {
    if (typeof iso === "string" && /^\d{4}-\d{2}/.test(iso)) set.add(iso.slice(0, 7));
  };
  for (const m of state.movements) add(m.date);
  for (const s of state.supermarket) add(s.date);
  for (const f of state.fuel) add(f.date);
  for (const e of state.futureIncomes) add(e.expectedDate);
  return [...set].sort();
}

/** Garante que o mês atual existe na lista; não força o active (usado ao sincronizar abas). */
export function ensureCurrentMonthInTabs(data: TabsPersist): TabsPersist {
  const ym = currentMonthTab();
  const tabs = data.tabs.includes(ym) ? data.tabs : [...data.tabs, ym].sort();
  const active = tabs.includes(data.active) ? data.active : ym;
  return { tabs, active };
}

export function mergeTabsWithMonths(tabs: string[], months: string[]): string[] {
  const ym = currentMonthTab();
  return [...new Set([...tabs, ...months, ym])].sort();
}

export function reviveDashboardTabsFromUnknown(raw: unknown): TabsPersist {
  const fallback = defaultTabsPersist();
  if (!raw || typeof raw !== "object") return fallback;
  try {
    const p = raw as Partial<TabsPersist>;
    if (!Array.isArray(p.tabs) || p.tabs.length === 0) return fallback;
    const tabs = [...new Set(p.tabs.map(String))].sort();
    const active = typeof p.active === "string" && tabs.includes(p.active) ? p.active : tabs[0]!;
    return ensureCurrentMonthInTabs({ tabs, active });
  } catch {
    return fallback;
  }
}

export function loadDashboardTabs(): TabsPersist {
  if (isCloudSessionActive()) {
    return memoryTabs ? reviveDashboardTabsFromUnknown(memoryTabs) : defaultTabsPersist();
  }
  try {
    const raw = localStorage.getItem(DASH_TABS_KEY);
    if (!raw) return defaultTabsPersist();
    return reviveDashboardTabsFromUnknown(JSON.parse(raw));
  } catch {
    return defaultTabsPersist();
  }
}

export function saveDashboardTabs(data: TabsPersist): void {
  memoryTabs = reviveDashboardTabsFromUnknown(data);
  if (!isCloudSessionActive()) {
    localStorage.setItem(DASH_TABS_KEY, JSON.stringify(memoryTabs));
  }
}

export function clearDashboardTabsMemory(): void {
  memoryTabs = null;
}

/** Remove um mês da lista de abas do resumo; garante ao menos uma aba. */
export function removeMonthFromDashboardTabs(ym: string): void {
  const p = loadDashboardTabs();
  const tabs = p.tabs.filter((t) => t !== ym);
  if (tabs.length === 0) {
    const fallback = currentMonthTab();
    saveDashboardTabs({ tabs: [fallback], active: fallback });
    return;
  }
  const active = tabs.includes(p.active) ? p.active : tabs[0]!;
  saveDashboardTabs({ tabs, active });
}

export function resetDashboardTabsToCurrentMonth(): void {
  const ym = currentMonthTab();
  saveDashboardTabs({ tabs: [ym], active: ym });
}

export function notifyDashboardTabsSync(): void {
  window.dispatchEvent(new Event(DASH_TABS_SYNC_EVENT));
}
