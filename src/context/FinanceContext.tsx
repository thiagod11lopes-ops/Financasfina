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
import { doc, getFirestore, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { firestoreTimestampMs } from "../firebase/firestoreTime";
import type {
  AppState,
  FixedAccount,
  FuelEntry,
  FutureIncomeEntry,
  Movement,
  SupermarketEntry,
  VariableAccount,
  VariableSpend,
} from "../types";
import {
  mergeRemotePreservingPendingUploads,
  pruneBirthRefForIdsAckedInRemote,
  pruneOrphanBirthIds,
} from "../finance/mergeRemoteSnapshot";
import { FINANCES_EMPTY_STATE, reviveAppStateFromUnknown } from "../finance/reviveAppState";
import { useAuth } from "../firebase/AuthProvider";
import { getFirebaseApp } from "../firebase/config";
import {
  computeMonthDashboardBalance,
  isInMonth,
  isoFirstDayOfMonth,
  prevMonthKey,
  variableSpendTitleForDate,
} from "../utils/format";

const STORAGE_KEY = "financas-app-v1";

function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...FINANCES_EMPTY_STATE };
    return reviveAppStateFromUnknown(JSON.parse(raw));
  } catch {
    return { ...FINANCES_EMPTY_STATE };
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
  const [state, setState] = useState<AppState>(() => loadState());
  const { configured: fbConfigured, ready: authReady, user: fbUser } = useAuth();
  const stateRef = useRef(state);
  stateRef.current = state;
  const prevFbUserRef = useRef<User | null | undefined>(undefined);
  /** Evita sobrescrever edições locais com snapshots antigos (cache / fora de ordem). */
  const lastPayloadRemoteMsRef = useRef(0);
  const lastPayloadRemoteJsonRef = useRef("");
  /** Após aplicar estado vindo do Firestore, não regravar o mesmo documento (efeito debounced). */
  const skipNextFinancePersistRef = useRef(false);
  /** Ids criados nesta sessão (com timestamp) para fundir com snapshots remotos e não perder dados entre dispositivos. */
  const localEntityBirthRef = useRef<Map<string, number>>(new Map());
  const persistTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);

  function touchLocalEntity(id: string) {
    localEntityBirthRef.current.set(id, Date.now());
  }
  function forgetLocalEntity(id: string) {
    localEntityBirthRef.current.delete(id);
  }

  const flushFinancePersistToCloud = useCallback(() => {
    if (!fbConfigured || !authReady || !fbUser) return;
    const app = getFirebaseApp();
    if (!app) return;
    const db = getFirestore(app);
    const ref = doc(db, "userFinances", fbUser.uid);
    pruneOrphanBirthIds(localEntityBirthRef.current, stateRef.current);
    const payload = reviveAppStateFromUnknown(stateRef.current);
    void setDoc(
      ref,
      {
        version: 1,
        payload,
        updatedAt: serverTimestamp(),
        payloadUpdatedAt: serverTimestamp(),
      },
      { merge: true },
    ).catch((err) => {
      console.error("[Finanças Firestore persist]", err);
    });
  }, [fbConfigured, authReady, fbUser]);

  useEffect(() => {
    lastPayloadRemoteMsRef.current = 0;
    lastPayloadRemoteJsonRef.current = "";
    localEntityBirthRef.current.clear();
  }, [fbUser?.uid]);

  /** Cópia local sempre atualizada (offline, recarga com login, ou antes do snapshot). */
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* quota */
    }
  }, [state]);

  /** Ao sair da conta Google, grava uma cópia local para voltar a usar offline. */
  useEffect(() => {
    const prev = prevFbUserRef.current;
    prevFbUserRef.current = fbUser ?? null;
    if (prev && !fbUser) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stateRef.current));
    }
  }, [fbUser]);

  useEffect(() => {
    if (!fbConfigured || !authReady || !fbUser) return;
    const app = getFirebaseApp();
    if (!app) return;
    const db = getFirestore(app);
    const ref = doc(db, "userFinances", fbUser.uid);
    let firstSnapshot = true;
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          if (firstSnapshot) {
            firstSnapshot = false;
            const payload = reviveAppStateFromUnknown(stateRef.current);
            void setDoc(
              ref,
              {
                version: 1,
                payload,
                updatedAt: serverTimestamp(),
                payloadUpdatedAt: serverTimestamp(),
              },
              { merge: true },
            ).catch((err) => console.error("[Finanças Firestore bootstrap]", err));
          }
          return;
        }
        firstSnapshot = false;
        const data = snap.data() as Record<string, unknown>;
        if (data.payload == null) return;

        const payloadTimeMs =
          firestoreTimestampMs(data.payloadUpdatedAt) || firestoreTimestampMs(data.updatedAt);
        const remoteRevived = reviveAppStateFromUnknown(data.payload);
        pruneBirthRefForIdsAckedInRemote(localEntityBirthRef.current, remoteRevived);
        pruneOrphanBirthIds(localEntityBirthRef.current, stateRef.current);
        const merged = mergeRemotePreservingPendingUploads(
          stateRef.current,
          remoteRevived,
          localEntityBirthRef.current,
          Date.now(),
        );
        const remoteCanonicalJson = JSON.stringify(remoteRevived);
        const nextJson = JSON.stringify(merged);
        const lastMs = lastPayloadRemoteMsRef.current;
        const lastJson = lastPayloadRemoteJsonRef.current;

        if (payloadTimeMs < lastMs) return;

        if (payloadTimeMs === lastMs && nextJson === lastJson) return;

        if (
          payloadTimeMs === lastMs &&
          nextJson !== lastJson &&
          snap.metadata.fromCache &&
          !snap.metadata.hasPendingWrites
        ) {
          return;
        }

        if (payloadTimeMs > lastMs && nextJson === lastJson) {
          lastPayloadRemoteMsRef.current = payloadTimeMs;
          return;
        }

        if (JSON.stringify(stateRef.current) === nextJson) {
          lastPayloadRemoteMsRef.current = payloadTimeMs;
          lastPayloadRemoteJsonRef.current = nextJson;
          return;
        }

        lastPayloadRemoteMsRef.current = payloadTimeMs;
        lastPayloadRemoteJsonRef.current = nextJson;
        /**
         * Só evita regravar na nuvem quando o estado fundido é igual ao remoto puro.
         * Se o merge acrescentou contas/lançamentos só locais, TEM de persistir — caso contrário
         * nunca chegavam ao Firestore e sumiam ao recarregar ou noutros aparelhos.
         */
        skipNextFinancePersistRef.current = nextJson === remoteCanonicalJson;
        setState(merged);
      },
      (err) => console.error("[Finanças Firestore]", err),
    );
    return () => unsub();
  }, [fbConfigured, authReady, fbUser]);

  useEffect(() => {
    if (!fbConfigured || !authReady || !fbUser) return;
    if (skipNextFinancePersistRef.current) {
      skipNextFinancePersistRef.current = false;
      return;
    }
    if (persistTimerRef.current != null) {
      window.clearTimeout(persistTimerRef.current);
      persistTimerRef.current = null;
    }
    persistTimerRef.current = window.setTimeout(() => {
      persistTimerRef.current = null;
      flushFinancePersistToCloud();
    }, 280);
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
    }));
  }, []);

  const resetAllData = useCallback(() => {
    localEntityBirthRef.current.clear();
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
