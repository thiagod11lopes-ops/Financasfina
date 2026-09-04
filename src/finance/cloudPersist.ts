import type { AppState } from "../types";
import { FINANCES_EMPTY_STATE, reviveAppStateFromUnknown } from "./reviveAppState";
import { stripUndefinedDeep } from "./stripUndefinedDeep";

const PENDING_KEY_PREFIX = "financas-cloud-pending:";

export function isAppStateEmpty(s: AppState): boolean {
  return (
    s.movements.length === 0 &&
    s.fixedAccounts.length === 0 &&
    s.variableAccounts.length === 0 &&
    s.recurringAccounts.length === 0 &&
    s.supermarket.length === 0 &&
    s.fuel.length === 0 &&
    s.futureIncomes.length === 0 &&
    s.patrimonyAssets.length === 0
  );
}

export function normalizeFinancePayload(state: AppState): AppState {
  return stripUndefinedDeep(reviveAppStateFromUnknown(state));
}

export function readPendingCloudPayload(uid: string): AppState | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(PENDING_KEY_PREFIX + uid);
    if (!raw) return null;
    const parsed = reviveAppStateFromUnknown(JSON.parse(raw));
    return isAppStateEmpty(parsed) ? null : parsed;
  } catch {
    return null;
  }
}

export function writePendingCloudPayload(uid: string, state: AppState): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    const payload = normalizeFinancePayload(state);
    sessionStorage.setItem(PENDING_KEY_PREFIX + uid, JSON.stringify(payload));
  } catch {
    /* quota / privado */
  }
}

export function clearPendingCloudPayload(uid: string): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.removeItem(PENDING_KEY_PREFIX + uid);
  } catch {
    /* ignore */
  }
}

export function emptyFinanceState(): AppState {
  return { ...FINANCES_EMPTY_STATE };
}
