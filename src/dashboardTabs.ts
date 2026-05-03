import { monthKey } from "./utils/format";

export const DASH_TABS_KEY = "financas-dashboard-month-tabs-v1";

export const DASH_TABS_SYNC_EVENT = "financas-dashboard-tabs-sync";

const LEGACY_DEFAULT_TAB = "2026-04";

export type TabsPersist = {
  tabs: string[];
  active: string;
};

export function reviveDashboardTabsFromUnknown(raw: unknown): TabsPersist {
  if (!raw || typeof raw !== "object") {
    return { tabs: [LEGACY_DEFAULT_TAB], active: LEGACY_DEFAULT_TAB };
  }
  try {
    const p = raw as Partial<TabsPersist>;
    if (!Array.isArray(p.tabs) || p.tabs.length === 0) {
      return { tabs: [LEGACY_DEFAULT_TAB], active: LEGACY_DEFAULT_TAB };
    }
    const tabs = [...new Set(p.tabs.map(String))].sort();
    const active = typeof p.active === "string" && tabs.includes(p.active) ? p.active : tabs[0]!;
    return { tabs, active };
  } catch {
    return { tabs: [LEGACY_DEFAULT_TAB], active: LEGACY_DEFAULT_TAB };
  }
}

export function loadDashboardTabs(): TabsPersist {
  try {
    const raw = localStorage.getItem(DASH_TABS_KEY);
    if (!raw) return { tabs: [LEGACY_DEFAULT_TAB], active: LEGACY_DEFAULT_TAB };
    return reviveDashboardTabsFromUnknown(JSON.parse(raw));
  } catch {
    return { tabs: [LEGACY_DEFAULT_TAB], active: LEGACY_DEFAULT_TAB };
  }
}

export function saveDashboardTabs(data: TabsPersist): void {
  localStorage.setItem(DASH_TABS_KEY, JSON.stringify(data));
}

/** Remove um mês da lista de abas do resumo; garante ao menos uma aba. */
export function removeMonthFromDashboardTabs(ym: string): void {
  const p = loadDashboardTabs();
  const tabs = p.tabs.filter((t) => t !== ym);
  if (tabs.length === 0) {
    const fallback = monthKey(new Date());
    saveDashboardTabs({ tabs: [fallback], active: fallback });
    return;
  }
  const active = tabs.includes(p.active) ? p.active : tabs[0]!;
  saveDashboardTabs({ tabs, active });
}

export function resetDashboardTabsToCurrentMonth(): void {
  const ym = monthKey(new Date());
  saveDashboardTabs({ tabs: [ym], active: ym });
}

export function notifyDashboardTabsSync(): void {
  window.dispatchEvent(new Event(DASH_TABS_SYNC_EVENT));
}
