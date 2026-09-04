import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { User } from "firebase/auth";
import {
  doc,
  getDocFromServer,
  getFirestore,
  increment,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { FINANCES_EMPTY_STATE, reviveAppStateFromUnknown } from "../finance/reviveAppState";
import {
  clearPendingCloudPayload,
  emptyFinanceState,
  isAppStateEmpty,
  normalizeFinancePayload,
  readPendingCloudPayload,
  writePendingCloudPayload,
} from "../finance/cloudPersist";
import { useAuth } from "../firebase/AuthProvider";
import { getFirebaseApp } from "../firebase/config";
import type {
  AppState,
  FixedAccount,
  FuelEntry,
  FutureIncomeEntry,
  Movement,
  PatrimonyAsset,
  RecurringAccount,
  SupermarketEntry,
  VariableAccount,
  VariableSpend,
} from "../types";
import {
  clearLocalAppData,
  isCloudSessionActive,
  setCloudSessionActive,
} from "../storage/cloudSession";
import { clearAgendaMemory } from "../agenda/persist";
import { clearTasksMemory } from "../tasks/persist";
import { clearVaquinhasMemory } from "../vaquinhas/storage";
import { clearDashboardTabsMemory } from "../dashboardTabs";
import { clearUsersMemory } from "../users";
import {
  computeMonthDashboardBalance,
  isInMonth,
  isoFirstDayOfMonth,
  prevMonthKey,
  variableSpendTitleForDate,
} from "../utils/format";

const STORAGE_KEY = "financas-app-v1";

function loadState(): AppState {
  if (isCloudSessionActive()) return { ...FINANCES_EMPTY_STATE };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...FINANCES_EMPTY_STATE };
    return reviveAppStateFromUnknown(JSON.parse(raw));
  } catch {
    return { ...FINANCES_EMPTY_STATE };
  }
}

function clearAllDomainMemory(opts?: { wipeCloudMirrors?: boolean }): void {
  clearLocalAppData();
  if (!opts?.wipeCloudMirrors) return;
  clearAgendaMemory();
  clearTasksMemory();
  clearVaquinhasMemory();
  clearDashboardTabsMemory();
  clearUsersMemory();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("financas-tasks-sync"));
    window.dispatchEvent(new Event("financas-vaquinhas-sync"));
    window.dispatchEvent(new Event("financas-users-sync"));
    window.dispatchEvent(new Event("financas-dashboard-tabs-sync"));
    window.dispatchEvent(new Event("financas-agenda-cloud-sync"));
  }
}

type FinanceContextValue = {
  state: AppState;
  addMovement: (m: Omit<Movement, "id">) => string;
  removeMovement: (id: string) => void;
  addFixedAccount: (a: Omit<FixedAccount, "id">) => void;
  updateFixedAccount: (id: string, patch: Partial<FixedAccount>) => void;
  removeFixedAccount: (id: string) => void;
  addVariableAccount: (a: Omit<VariableAccount, "id">) => void;
  updateVariableAccount: (id: string, patch: Partial<VariableAccount>) => void;
  removeVariableAccount: (id: string) => void;
  addVariableSpend: (
    accountId: string,
    entry: Omit<VariableSpend, "id" | "linkedMovementId">,
  ) => void;
  removeVariableSpend: (accountId: string, spendId: string) => void;
  addRecurringAccount: (a: Omit<RecurringAccount, "id">) => void;
  updateRecurringAccount: (id: string, patch: Partial<RecurringAccount>) => void;
  removeRecurringAccount: (id: string) => void;
  addRecurringSpend: (
    accountId: string,
    entry: Omit<VariableSpend, "id" | "linkedMovementId">,
  ) => void;
  removeRecurringSpend: (accountId: string, spendId: string) => void;
  addSupermarket: (e: Omit<SupermarketEntry, "id">) => void;
  removeSupermarket: (id: string) => void;
  addFuel: (e: Omit<FuelEntry, "id" | "total"> & { total?: number }) => void;
  removeFuel: (id: string) => void;
  /** Remove lançamentos do fluxo, mercado, combustível e gastos variáveis naquele mês (YYYY-MM). */
  deleteMonthData: (ym: string) => void;
  /** Apaga todo o armazenamento financeiro (contas, fluxo, mercado, combustível). */
  resetAllData: () => void;
  /**
   * Ao abrir um mês novo no resumo: saldo do mês civil anterior no fluxo,
   * contas fixas com “no fluxo” desmarcado, e uma linha de gasto zerada por conta variável (teto mantido).
   */
  bootstrapNewMonth: (ym: string) => void;
  addFutureIncome: (e: Omit<FutureIncomeEntry, "id" | "received" | "receivedAt" | "linkedMovementId">) => void;
  markFutureIncomeReceived: (id: string) => void;
  markFutureIncomePending: (id: string) => void;
  removeFutureIncome: (id: string) => void;
  addPatrimonyAsset: (a: Omit<PatrimonyAsset, "id">) => void;
  updatePatrimonyAsset: (id: string, patch: Partial<PatrimonyAsset>) => void;
  removePatrimonyAsset: (id: string) => void;
  /** Força leitura do `payload` no servidor (complementa o listener; útil nas abas Contas / Entradas futuras). */
  refreshFinanceFromCloud: () => void;
};

const FinanceContext = createContext<FinanceContextValue | null>(null);

function newId(): string {
  return crypto.randomUUID();
}

/** ID do lançamento de entrada vinculado, ou busca por valor/título/data (dados antigos). */
function resolveFutureIncomeMovementId(
  movements: Movement[],
  entry: FutureIncomeEntry,
): string | null {
  if (entry.linkedMovementId) return entry.linkedMovementId;
  if (!entry.received || !entry.receivedAt) return null;
  const rawDate = entry.expectedDate?.trim();
  const movementDate =
    rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : entry.receivedAt;
  const hit = movements.find(
    (m) =>
      m.kind === "income" &&
      m.amount === entry.amount &&
      m.title === entry.title &&
      m.date === movementDate,
  );
  return hit?.id ?? null;
}

/** ID do lançamento de saída vinculado ao gasto variável, com fallback para dados antigos. */
function resolveVariableSpendMovementId(
  movements: Movement[],
  spend: VariableSpend,
): string | null {
  if (spend.linkedMovementId) return spend.linkedMovementId;
  const hit = movements.find(
    (m) =>
      m.kind === "expense" &&
      m.nature === "variable" &&
      m.amount === spend.amount &&
      m.title === spend.title &&
      m.date === spend.date,
  );
  return hit?.id ?? null;
}

export function FinanceProvider({ children }: { children: ReactNode }) {
  const { configured: fbConfigured, ready: authReady, user: fbUser } = useAuth();
  const [state, setState] = useState<AppState>(() =>
    fbConfigured || isCloudSessionActive() ? { ...FINANCES_EMPTY_STATE } : loadState(),
  );
  const stateRef = useRef(state);
  stateRef.current = state;
  const prevFbUserRef = useRef<User | null | undefined>(undefined);
  /** Evita sobrescrever edições locais com snapshots antigos (cache / fora de ordem). */
  const lastPayloadRemoteMsRef = useRef(0);
  const lastPayloadRemoteJsonRef = useRef("");
  /** Monotónico vindo do Firestore (`increment`); rejeita snapshots antigos sem timestamp válido. */
  const lastPayloadWriteSeqRef = useRef(0);
  /** Após aplicar estado vindo do Firestore, não regravar o mesmo documento (efeito debounced). */
  const skipNextFinancePersistRef = useRef(false);
  /** Ids criados nesta sessão (para não perder edições locais antes do ack na nuvem). */
  const localEntityBirthRef = useRef<Map<string, number>>(new Map());
  const persistTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const persistInFlightRef = useRef(false);
  /** Se um flush chegou enquanto outro ainda gravava, repetir no fim. */
  const persistQueuedRef = useRef(false);
  /** Há edições locais ainda não confirmadas na nuvem — snapshots remotos não podem apagá-las. */
  const dirtyRef = useRef(false);
  /** uid já hidratado do servidor (gravações só depois disso). */
  const hydratedUidRef = useRef<string | null>(null);
  /** Permite gravar estado vazio na nuvem (ex.: “apagar todos os dados”). */
  const allowEmptyCloudWriteRef = useRef(false);
  /** Com sessão ativa: em rede, a nuvem é a única fonte (sem fundir com cache local). */
  const networkOnlineRef = useRef(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  /** Permite pedir `getDocFromServer` fora do efeito (ex.: troca de aba na UI). */
  const pullFinanceFromServerRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const sync = () => {
      networkOnlineRef.current = navigator.onLine;
    };
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    sync();
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  const refreshFinanceFromCloud = useCallback(() => {
    pullFinanceFromServerRef.current?.();
  }, []);

  function touchLocalEntity(id: string) {
    localEntityBirthRef.current.set(id, Date.now());
    dirtyRef.current = true;
  }
  function forgetLocalEntity(id: string) {
    localEntityBirthRef.current.delete(id);
    dirtyRef.current = true;
  }

  const flushFinancePersistToCloud = useCallback(() => {
    void (async () => {
      if (!fbConfigured || !authReady || !fbUser) return;
      if (hydratedUidRef.current !== fbUser.uid) return;
      if (persistInFlightRef.current) {
        persistQueuedRef.current = true;
        return;
      }
      persistInFlightRef.current = true;
      const app = getFirebaseApp();
      if (!app) {
        persistInFlightRef.current = false;
        return;
      }
      const uid = fbUser.uid;
      const db = getFirestore(app);
      const ref = doc(db, "userFinances", uid);
      const payload = normalizeFinancePayload(stateRef.current);

      try {
        if (isAppStateEmpty(payload) && !allowEmptyCloudWriteRef.current) {
          persistInFlightRef.current = false;
          dirtyRef.current = false;
          return;
        }

        writePendingCloudPayload(uid, payload);
        await setDoc(
          ref,
          {
            version: 1,
            payload,
            updatedAt: serverTimestamp(),
            payloadUpdatedAt: serverTimestamp(),
            payloadWriteSeq: increment(1),
          },
          { merge: true },
        );
        allowEmptyCloudWriteRef.current = false;
        lastPayloadWriteSeqRef.current = Math.max(lastPayloadWriteSeqRef.current + 1, 1);
        lastPayloadRemoteJsonRef.current = JSON.stringify(payload);
        dirtyRef.current = false;
        localEntityBirthRef.current.clear();
        clearPendingCloudPayload(uid);
      } catch (err) {
        console.error("[Finanças Firestore persist]", err);
        persistQueuedRef.current = true;
      } finally {
        persistInFlightRef.current = false;
        if (persistQueuedRef.current) {
          persistQueuedRef.current = false;
          flushFinancePersistToCloud();
        }
      }
    })();
  }, [fbConfigured, authReady, fbUser]);

  /** Login / troca de conta: hidrata só do Firebase (+ pending da sessão se a nuvem vier vazia). */
  useEffect(() => {
    lastPayloadRemoteMsRef.current = 0;
    lastPayloadRemoteJsonRef.current = "";
    lastPayloadWriteSeqRef.current = 0;
    localEntityBirthRef.current.clear();
    allowEmptyCloudWriteRef.current = false;
    persistQueuedRef.current = false;
    dirtyRef.current = false;
    skipNextFinancePersistRef.current = true;
    hydratedUidRef.current = null;

    if (!fbConfigured || !authReady) return;

    if (!fbUser?.uid) {
      setCloudSessionActive(false);
      clearAllDomainMemory({ wipeCloudMirrors: true });
      stateRef.current = emptyFinanceState();
      setState(emptyFinanceState());
      return;
    }

    const uid = fbUser.uid;
    setCloudSessionActive(true);
    clearAllDomainMemory();
    stateRef.current = emptyFinanceState();
    setState(emptyFinanceState());

    const app = getFirebaseApp();
    if (!app) return;
    const db = getFirestore(app);
    const ref = doc(db, "userFinances", uid);
    let alive = true;

    void (async () => {
      try {
        const serverSnap = await getDocFromServer(ref);
        if (!alive) return;

        let next = emptyFinanceState();
        let seq = 0;

        if (serverSnap.exists()) {
          const data = serverSnap.data() as Record<string, unknown>;
          if (data.payload != null) {
            next = reviveAppStateFromUnknown(data.payload);
            seq =
              typeof data.payloadWriteSeq === "number" && Number.isFinite(data.payloadWriteSeq)
                ? data.payloadWriteSeq
                : 0;
          }
        }

        const pending = readPendingCloudPayload(uid);
        if (isAppStateEmpty(next) && pending) {
          next = pending;
          try {
            await setDoc(
              ref,
              {
                version: 1,
                payload: normalizeFinancePayload(next),
                updatedAt: serverTimestamp(),
                payloadUpdatedAt: serverTimestamp(),
                payloadWriteSeq: increment(1),
              },
              { merge: true },
            );
            seq = Math.max(seq + 1, 1);
            clearPendingCloudPayload(uid);
          } catch (err) {
            console.error("[Finanças] reenvio pending", err);
          }
        } else if (!serverSnap.exists()) {
          try {
            await setDoc(
              ref,
              {
                version: 1,
                payload: normalizeFinancePayload(next),
                updatedAt: serverTimestamp(),
                payloadUpdatedAt: serverTimestamp(),
                payloadWriteSeq: increment(1),
              },
              { merge: true },
            );
            seq = 1;
          } catch (err) {
            console.error("[Finanças Firestore bootstrap]", err);
          }
        }

        if (!alive) return;
        lastPayloadWriteSeqRef.current = seq;
        lastPayloadRemoteJsonRef.current = JSON.stringify(next);
        skipNextFinancePersistRef.current = true;
        dirtyRef.current = false;
        stateRef.current = next;
        setState(next);
        hydratedUidRef.current = uid;
      } catch (e) {
        console.warn("[Finanças] hidratação inicial", e);
        if (!alive) return;
        const pending = readPendingCloudPayload(uid);
        if (pending) {
          skipNextFinancePersistRef.current = true;
          stateRef.current = pending;
          setState(pending);
          dirtyRef.current = true;
        }
        hydratedUidRef.current = uid;
      }
    })();

    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!alive || !snap.exists()) return;
        if (hydratedUidRef.current !== uid) return;
        if (dirtyRef.current || persistInFlightRef.current) return;

        const data = snap.data() as Record<string, unknown>;
        if (data.payload == null) return;
        const remoteWriteSeq =
          typeof data.payloadWriteSeq === "number" && Number.isFinite(data.payloadWriteSeq)
            ? data.payloadWriteSeq
            : 0;
        if (remoteWriteSeq < lastPayloadWriteSeqRef.current) return;

        const remote = reviveAppStateFromUnknown(data.payload);
        const remoteJson = JSON.stringify(remote);
        if (remoteJson === JSON.stringify(stateRef.current)) {
          lastPayloadWriteSeqRef.current = Math.max(lastPayloadWriteSeqRef.current, remoteWriteSeq);
          return;
        }
        if (remoteWriteSeq === lastPayloadWriteSeqRef.current && remoteJson === lastPayloadRemoteJsonRef.current) {
          return;
        }

        lastPayloadWriteSeqRef.current = Math.max(lastPayloadWriteSeqRef.current, remoteWriteSeq);
        lastPayloadRemoteJsonRef.current = remoteJson;
        skipNextFinancePersistRef.current = true;
        stateRef.current = remote;
        setState(remote);
      },
      (err) => console.error("[Finanças Firestore]", err),
    );

    return () => {
      alive = false;
      unsub();
    };
  }, [fbConfigured, authReady, fbUser?.uid]);

  /** Sem login: espelho local. Com login: pending só em sessionStorage até confirmar na nuvem. */
  useEffect(() => {
    if (fbUser) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* quota */
    }
  }, [state, fbUser]);

  useEffect(() => {
    const prev = prevFbUserRef.current;
    prevFbUserRef.current = fbUser ?? null;
    if (prev && !fbUser) {
      clearAllDomainMemory();
    }
  }, [fbUser]);

  /** Pull manual / foco: só se não houver edição local pendente. */
  useEffect(() => {
    if (!fbConfigured || !authReady || !fbUser) return;
    const app = getFirebaseApp();
    if (!app) return;
    const db = getFirestore(app);
    const ref = doc(db, "userFinances", fbUser.uid);
    let cancelled = false;
    const pullFromServer = () => {
      if (dirtyRef.current || persistInFlightRef.current) return;
      if (hydratedUidRef.current !== fbUser.uid) return;
      void getDocFromServer(ref)
        .then((snap) => {
          if (cancelled || !snap.exists()) return;
          if (dirtyRef.current || persistInFlightRef.current) return;
          const data = snap.data() as Record<string, unknown>;
          if (data.payload == null) return;
          const remoteWriteSeq =
            typeof data.payloadWriteSeq === "number" && Number.isFinite(data.payloadWriteSeq)
              ? data.payloadWriteSeq
              : 0;
          if (remoteWriteSeq < lastPayloadWriteSeqRef.current) return;
          const remote = reviveAppStateFromUnknown(data.payload);
          const remoteJson = JSON.stringify(remote);
          if (remoteJson === JSON.stringify(stateRef.current)) {
            lastPayloadWriteSeqRef.current = Math.max(lastPayloadWriteSeqRef.current, remoteWriteSeq);
            return;
          }
          lastPayloadWriteSeqRef.current = Math.max(lastPayloadWriteSeqRef.current, remoteWriteSeq);
          lastPayloadRemoteJsonRef.current = remoteJson;
          skipNextFinancePersistRef.current = true;
          stateRef.current = remote;
          setState(remote);
        })
        .catch((e) => console.warn("[Finanças] pull servidor", e));
    };
    pullFinanceFromServerRef.current = pullFromServer;
    const onVis = () => {
      if (document.visibilityState === "visible") pullFromServer();
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("online", pullFromServer);
    window.addEventListener("focus", pullFromServer);
    return () => {
      cancelled = true;
      pullFinanceFromServerRef.current = null;
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("online", pullFromServer);
      window.removeEventListener("focus", pullFromServer);
    };
  }, [fbConfigured, authReady, fbUser]);

  useEffect(() => {
    if (!fbConfigured || !authReady || !fbUser) return;
    if (hydratedUidRef.current !== fbUser.uid) return;
    if (skipNextFinancePersistRef.current) {
      skipNextFinancePersistRef.current = false;
      return;
    }
    dirtyRef.current = true;
    writePendingCloudPayload(fbUser.uid, stateRef.current);
    if (persistTimerRef.current != null) {
      window.clearTimeout(persistTimerRef.current);
      persistTimerRef.current = null;
    }
    persistTimerRef.current = window.setTimeout(() => {
      persistTimerRef.current = null;
      flushFinancePersistToCloud();
    }, 120);
    return () => {
      if (persistTimerRef.current != null) {
        window.clearTimeout(persistTimerRef.current);
        persistTimerRef.current = null;
      }
    };
  }, [state, fbConfigured, authReady, fbUser, flushFinancePersistToCloud]);

  useEffect(() => {
    if (!fbConfigured || !authReady || !fbUser) return;
    const flush = () => {
      if (persistTimerRef.current != null) {
        window.clearTimeout(persistTimerRef.current);
        persistTimerRef.current = null;
      }
      flushFinancePersistToCloud();
    };
    window.addEventListener("pagehide", flush);
    window.addEventListener("beforeunload", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("beforeunload", flush);
    };
  }, [fbConfigured, authReady, fbUser, flushFinancePersistToCloud]);

  const addMovement = useCallback((m: Omit<Movement, "id">): string => {
    const id = newId();
    touchLocalEntity(id);
    setState((s) => ({
      ...s,
      movements: [{ ...m, id }, ...s.movements],
    }));
    return id;
  }, []);

  const removeMovement = useCallback((id: string) => {
    forgetLocalEntity(id);
    setState((s) => ({
      ...s,
      movements: s.movements.filter((x) => x.id !== id),
    }));
  }, []);

  const addFixedAccount = useCallback((a: Omit<FixedAccount, "id">) => {
    const id = newId();
    touchLocalEntity(id);
    setState((s) => ({
      ...s,
      fixedAccounts: [...s.fixedAccounts, { ...a, id }],
    }));
  }, []);

  const updateFixedAccount = useCallback(
    (id: string, patch: Partial<FixedAccount>) => {
      setState((s) => ({
        ...s,
        fixedAccounts: s.fixedAccounts.map((x) =>
          x.id === id ? { ...x, ...patch } : x,
        ),
      }));
    },
    [],
  );

  const removeFixedAccount = useCallback((id: string) => {
    forgetLocalEntity(id);
    setState((s) => ({
      ...s,
      fixedAccounts: s.fixedAccounts.filter((x) => x.id !== id),
    }));
  }, []);

  const addVariableAccount = useCallback((a: Omit<VariableAccount, "id">) => {
    const { spends: _s, ...rest } = a;
    const id = newId();
    touchLocalEntity(id);
    setState((s) => ({
      ...s,
      variableAccounts: [
        ...s.variableAccounts,
        { ...rest, id, spends: [] },
      ],
    }));
  }, []);

  const updateVariableAccount = useCallback(
    (id: string, patch: Partial<VariableAccount>) => {
      setState((s) => ({
        ...s,
        variableAccounts: s.variableAccounts.map((x) =>
          x.id === id ? { ...x, ...patch } : x,
        ),
      }));
    },
    [],
  );

  const removeVariableAccount = useCallback((id: string) => {
    setState((s) => {
      const acc = s.variableAccounts.find((x) => x.id === id);
      for (const sp of acc?.spends ?? []) forgetLocalEntity(sp.id);
      forgetLocalEntity(id);
      return {
        ...s,
        variableAccounts: s.variableAccounts.filter((x) => x.id !== id),
      };
    });
  }, []);

  const addVariableSpend = useCallback(
    (accountId: string, entry: Omit<VariableSpend, "id" | "linkedMovementId">) => {
      const movementId = newId();
      const spendId = newId();
      touchLocalEntity(movementId);
      touchLocalEntity(spendId);
      setState((s) => {
        const movement: Movement = {
          id: movementId,
          kind: "expense",
          amount: entry.amount,
          title: entry.title,
          date: entry.date,
          nature: "variable",
        };
        return {
          ...s,
          movements: [movement, ...s.movements],
          variableAccounts: s.variableAccounts.map((x) =>
            x.id === accountId
              ? {
                  ...x,
                  spends: [
                    { ...entry, id: spendId, linkedMovementId: movementId },
                    ...(x.spends ?? []),
                  ],
                }
              : x,
          ),
        };
      });
    },
    [],
  );

  const removeVariableSpend = useCallback(
    (accountId: string, spendId: string) => {
      setState((s) => {
        const account = s.variableAccounts.find((x) => x.id === accountId);
        const spend = account?.spends?.find((sp) => sp.id === spendId);
        const movementId = spend ? resolveVariableSpendMovementId(s.movements, spend) : null;
        forgetLocalEntity(spendId);
        if (movementId) forgetLocalEntity(movementId);
        return {
          ...s,
          movements: movementId
            ? s.movements.filter((m) => m.id !== movementId)
            : s.movements,
          variableAccounts: s.variableAccounts.map((x) =>
            x.id === accountId
              ? {
                  ...x,
                  spends: (x.spends ?? []).filter((sp) => sp.id !== spendId),
                }
              : x,
          ),
        };
      });
    },
    [],
  );

  const addRecurringAccount = useCallback((a: Omit<RecurringAccount, "id">) => {
    const { spends: _s, ...rest } = a;
    const id = newId();
    touchLocalEntity(id);
    setState((s) => ({
      ...s,
      recurringAccounts: [...s.recurringAccounts, { ...rest, id, spends: [] }],
    }));
  }, []);

  const updateRecurringAccount = useCallback(
    (id: string, patch: Partial<RecurringAccount>) => {
      setState((s) => ({
        ...s,
        recurringAccounts: s.recurringAccounts.map((x) =>
          x.id === id ? { ...x, ...patch } : x,
        ),
      }));
    },
    [],
  );

  const removeRecurringAccount = useCallback((id: string) => {
    setState((s) => {
      const acc = s.recurringAccounts.find((x) => x.id === id);
      for (const sp of acc?.spends ?? []) {
        forgetLocalEntity(sp.id);
        const movementId = resolveVariableSpendMovementId(s.movements, sp);
        if (movementId) forgetLocalEntity(movementId);
      }
      forgetLocalEntity(id);
      const movementIds = new Set<string>();
      for (const sp of acc?.spends ?? []) {
        const mid = resolveVariableSpendMovementId(s.movements, sp);
        if (mid) movementIds.add(mid);
      }
      return {
        ...s,
        movements: s.movements.filter((m) => !movementIds.has(m.id)),
        recurringAccounts: s.recurringAccounts.filter((x) => x.id !== id),
      };
    });
  }, []);

  const addRecurringSpend = useCallback(
    (accountId: string, entry: Omit<VariableSpend, "id" | "linkedMovementId">) => {
      const movementId = newId();
      const spendId = newId();
      touchLocalEntity(movementId);
      touchLocalEntity(spendId);
      setState((s) => {
        const movement: Movement = {
          id: movementId,
          kind: "expense",
          amount: entry.amount,
          title: entry.title,
          date: entry.date,
          nature: "variable",
        };
        return {
          ...s,
          movements: [movement, ...s.movements],
          recurringAccounts: s.recurringAccounts.map((x) =>
            x.id === accountId
              ? {
                  ...x,
                  spends: [
                    { ...entry, id: spendId, linkedMovementId: movementId },
                    ...(x.spends ?? []),
                  ],
                }
              : x,
          ),
        };
      });
    },
    [],
  );

  const removeRecurringSpend = useCallback(
    (accountId: string, spendId: string) => {
      setState((s) => {
        const account = s.recurringAccounts.find((x) => x.id === accountId);
        const spend = account?.spends?.find((sp) => sp.id === spendId);
        const movementId = spend ? resolveVariableSpendMovementId(s.movements, spend) : null;
        forgetLocalEntity(spendId);
        if (movementId) forgetLocalEntity(movementId);
        return {
          ...s,
          movements: movementId
            ? s.movements.filter((m) => m.id !== movementId)
            : s.movements,
          recurringAccounts: s.recurringAccounts.map((x) =>
            x.id === accountId
              ? {
                  ...x,
                  spends: (x.spends ?? []).filter((sp) => sp.id !== spendId),
                }
              : x,
          ),
        };
      });
    },
    [],
  );

  const addSupermarket = useCallback((e: Omit<SupermarketEntry, "id">) => {
    const id = newId();
    touchLocalEntity(id);
    setState((s) => ({
      ...s,
      supermarket: [{ ...e, id }, ...s.supermarket],
    }));
  }, []);

  const removeSupermarket = useCallback((id: string) => {
    forgetLocalEntity(id);
    setState((s) => ({
      ...s,
      supermarket: s.supermarket.filter((x) => x.id !== id),
    }));
  }, []);

  const addFuel = useCallback(
    (e: Omit<FuelEntry, "id" | "total"> & { total?: number }) => {
      const total =
        e.total ?? Math.round(e.liters * e.pricePerLiter * 100) / 100;
      const id = newId();
      touchLocalEntity(id);
      setState((s) => ({
        ...s,
        fuel: [
          {
            id,
            liters: e.liters,
            pricePerLiter: e.pricePerLiter,
            total,
            odometer: e.odometer,
            station: e.station,
            date: e.date,
          },
          ...s.fuel,
        ],
      }));
    },
    [],
  );

  const removeFuel = useCallback((id: string) => {
    forgetLocalEntity(id);
    setState((s) => ({
      ...s,
      fuel: s.fuel.filter((x) => x.id !== id),
    }));
  }, []);

  const deleteMonthData = useCallback((ym: string) => {
    if (!/^\d{4}-\d{2}$/.test(ym)) return;
    setState((s) => ({
      ...s,
      movements: s.movements.filter((m) => !isInMonth(m.date, ym)),
      supermarket: s.supermarket.filter((e) => !isInMonth(e.date, ym)),
      fuel: s.fuel.filter((f) => !isInMonth(f.date, ym)),
      variableAccounts: s.variableAccounts.map((acc) => ({
        ...acc,
        spends: (acc.spends ?? []).filter((sp) => !isInMonth(sp.date, ym)),
      })),
      recurringAccounts: s.recurringAccounts.map((acc) => ({
        ...acc,
        spends: (acc.spends ?? []).filter((sp) => !isInMonth(sp.date, ym)),
      })),
    }));
  }, []);

  const resetAllData = useCallback(() => {
    localEntityBirthRef.current.clear();
    allowEmptyCloudWriteRef.current = true;
    dirtyRef.current = true;
    setState({ ...FINANCES_EMPTY_STATE });
  }, []);

  const addFutureIncome = useCallback(
    (e: Omit<FutureIncomeEntry, "id" | "received" | "receivedAt" | "linkedMovementId">) => {
      const id = newId();
      touchLocalEntity(id);
      setState((s) => ({
        ...s,
        futureIncomes: [{ ...e, id, received: false }, ...s.futureIncomes],
      }));
    },
    [],
  );

  const markFutureIncomeReceived = useCallback((id: string) => {
    setState((s) => {
      const entry = s.futureIncomes.find((x) => x.id === id);
      if (!entry || entry.received) return s;
      const today = new Date().toISOString().slice(0, 10);
      const rawDate = entry.expectedDate?.trim();
      const movementDate =
        rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : today;
      const movementId = newId();
      touchLocalEntity(movementId);
      const movement: Movement = {
        id: movementId,
        kind: "income",
        amount: entry.amount,
        title: entry.title,
        date: movementDate,
      };
      return {
        ...s,
        movements: [movement, ...s.movements],
        futureIncomes: s.futureIncomes.map((x) =>
          x.id === id
            ? { ...x, received: true, receivedAt: today, linkedMovementId: movementId }
            : x,
        ),
      };
    });
  }, []);

  const markFutureIncomePending = useCallback((id: string) => {
    setState((s) => {
      const entry = s.futureIncomes.find((x) => x.id === id);
      if (!entry || !entry.received) return s;
      const mid = resolveFutureIncomeMovementId(s.movements, entry);
      if (mid) forgetLocalEntity(mid);
      const movements = mid ? s.movements.filter((m) => m.id !== mid) : s.movements;
      return {
        ...s,
        movements,
        futureIncomes: s.futureIncomes.map((x) =>
          x.id === id
            ? {
                ...x,
                received: false,
                receivedAt: undefined,
                linkedMovementId: undefined,
              }
            : x,
        ),
      };
    });
  }, []);

  const removeFutureIncome = useCallback((id: string) => {
    setState((s) => {
      const entry = s.futureIncomes.find((x) => x.id === id);
      if (!entry) return s;
      forgetLocalEntity(id);
      const mid = entry.received ? resolveFutureIncomeMovementId(s.movements, entry) : null;
      if (mid) forgetLocalEntity(mid);
      const movements =
        entry.received && mid ? s.movements.filter((m) => m.id !== mid) : s.movements;
      return {
        ...s,
        movements,
        futureIncomes: s.futureIncomes.filter((x) => x.id !== id),
      };
    });
  }, []);

  const addPatrimonyAsset = useCallback((a: Omit<PatrimonyAsset, "id">) => {
    const id = newId();
    touchLocalEntity(id);
    setState((s) => ({
      ...s,
      patrimonyAssets: [{ ...a, id }, ...s.patrimonyAssets],
    }));
  }, []);

  const updatePatrimonyAsset = useCallback((id: string, patch: Partial<PatrimonyAsset>) => {
    setState((s) => ({
      ...s,
      patrimonyAssets: s.patrimonyAssets.map((x) => (x.id === id ? { ...x, ...patch } : x)),
    }));
  }, []);

  const removePatrimonyAsset = useCallback((id: string) => {
    forgetLocalEntity(id);
    setState((s) => ({
      ...s,
      patrimonyAssets: s.patrimonyAssets.filter((x) => x.id !== id),
    }));
  }, []);

  const bootstrapNewMonth = useCallback((ym: string) => {
    if (!/^\d{4}-\d{2}$/.test(ym)) return;
    setState((s) => {
      const startDate = isoFirstDayOfMonth(ym);
      const hasInherit = s.movements.some(
        (m) =>
          m.date === startDate &&
          (m.title === "Saldo herdado (mês anterior)" ||
            m.title === "Saldo herdado (déficit mês anterior)"),
      );
      if (hasInherit) return s;

      const prev = prevMonthKey(ym);
      const prevBalance = computeMonthDashboardBalance(s, prev);
      const inherit: Movement[] = [];
      if (prevBalance > 0) {
        const hid = newId();
        touchLocalEntity(hid);
        inherit.push({
          id: hid,
          kind: "income",
          amount: prevBalance,
          title: "Saldo herdado (mês anterior)",
          date: startDate,
        });
      } else if (prevBalance < 0) {
        const hid = newId();
        touchLocalEntity(hid);
        inherit.push({
          id: hid,
          kind: "expense",
          amount: Math.abs(prevBalance),
          title: "Saldo herdado (déficit mês anterior)",
          date: startDate,
          nature: "variable",
        });
      }

      const fixedAccounts = s.fixedAccounts.map((a) => ({
        ...a,
        inFlow: false,
        linkedMovementId: undefined,
      }));

      const variableAccounts = s.variableAccounts.map((acc) => {
        const spends = [...(acc.spends ?? [])];
        const hasYmSpend = spends.some((sp) => isInMonth(sp.date, ym));
        if (hasYmSpend) return { ...acc, spends };
        const zid = newId();
        touchLocalEntity(zid);
        spends.push({
          id: zid,
          amount: 0,
          title: variableSpendTitleForDate(startDate),
          date: startDate,
        });
        return { ...acc, spends };
      });

      return {
        ...s,
        movements: [...inherit, ...s.movements],
        fixedAccounts,
        variableAccounts,
      };
    });
  }, []);

  const value = useMemo(
    () => ({
      state,
      addMovement,
      removeMovement,
      addFixedAccount,
      updateFixedAccount,
      removeFixedAccount,
      addVariableAccount,
      updateVariableAccount,
      removeVariableAccount,
      addVariableSpend,
      removeVariableSpend,
      addRecurringAccount,
      updateRecurringAccount,
      removeRecurringAccount,
      addRecurringSpend,
      removeRecurringSpend,
      addSupermarket,
      removeSupermarket,
      addFuel,
      removeFuel,
      deleteMonthData,
      resetAllData,
      bootstrapNewMonth,
      addFutureIncome,
      markFutureIncomeReceived,
      markFutureIncomePending,
      removeFutureIncome,
      addPatrimonyAsset,
      updatePatrimonyAsset,
      removePatrimonyAsset,
      refreshFinanceFromCloud,
    }),
    [
      state,
      addMovement,
      removeMovement,
      addFixedAccount,
      updateFixedAccount,
      removeFixedAccount,
      addVariableAccount,
      updateVariableAccount,
      removeVariableAccount,
      addVariableSpend,
      removeVariableSpend,
      addRecurringAccount,
      updateRecurringAccount,
      removeRecurringAccount,
      addRecurringSpend,
      removeRecurringSpend,
      addSupermarket,
      removeSupermarket,
      addFuel,
      removeFuel,
      deleteMonthData,
      resetAllData,
      bootstrapNewMonth,
      addFutureIncome,
      markFutureIncomeReceived,
      markFutureIncomePending,
      removeFutureIncome,
      addPatrimonyAsset,
      updatePatrimonyAsset,
      removePatrimonyAsset,
      refreshFinanceFromCloud,
    ],
  );

  return (
    <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>
  );
}

export function useFinance(): FinanceContextValue {
  const ctx = useContext(FinanceContext);
  if (!ctx) throw new Error("useFinance must be used within FinanceProvider");
  return ctx;
}
