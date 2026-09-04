/** Chaves de domínio que o app já usou em localStorage (não inclui sessão Auth). */
export const LOCAL_APP_DATA_KEYS = [
  "financas-app-v1",
  "financas-agenda-v1",
  "financas-users-v1",
  "financas-dashboard-month-tabs-v1",
  "financas-tasks-v1",
  "vaquinhas:v4",
  "vaquinhas:v3",
  "vaquinhas:v2",
  "lista-compras:syncPrefs",
  "lista-compras:financasAccountEmail",
] as const;

let cloudSessionActive = false;

/** Sessão Google ativa: dados vêm só do Firebase (sem persistir domínio no localStorage). */
export function setCloudSessionActive(active: boolean): void {
  cloudSessionActive = active;
}

export function isCloudSessionActive(): boolean {
  return cloudSessionActive;
}

export function clearLocalAppData(): void {
  if (typeof window === "undefined") return;
  for (const key of LOCAL_APP_DATA_KEYS) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* privado / quota */
    }
  }
}
