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
import type { DocumentSnapshot } from "firebase/firestore";
import {
  doc,
  getDocFromServer,
  getFirestore,
  increment,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
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
import { stripUndefinedDeep } from "../finance/stripUndefinedDeep";
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
  const [state, setState] = useState<AppState>(() => loadState());
  const { configured: fbConfigured, ready: authReady, user: fbUser } = useAuth();
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
  /**
   * Evita gravar `payload` na nuvem antes de sincronizar com o Firestore (ex.: estado vazio ao iniciar
   * sessão online sobrescrevia contas / entradas futuras noutros aparelhos).
   */
  const allowFinanceCloudPersistRef = useRef(false);
  /** Ids criados nesta sessão (com timestamp) para fundir com snapshots remotos e não perder dados entre dispositivos. */
  const localEntityBirthRef = useRef<Map<string, number>>(new Map());
  const persistTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const persistInFlightRef = useRef(false);
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
  }
  function forgetLocalEntity(id: string) {
    localEntityBirthRef.current.delete(id);
  }

  const flushFinancePersistToCloud = useCallback(() => {
    void (async () => {
      if (!allowFinanceCloudPersistRef.current) return;
      if (!fbConfigured || !authReady || !fbUser) return;
      if (persistInFlightRef.current) return;
      persistInFlightRef.current = true;
      const app = getFirebaseApp();
      if (!app) {
        persistInFlightRef.current = false;
        return;
      }
      const db = getFirestore(app);
      const ref = doc(db, "userFinances", fbUser.uid);
      const online =
        typeof navigator !== "undefined" ? navigator.onLine : true;
      let serverSeqForBump = 0;

      try {
        if (online) {
          let serverSnap: Awaited<ReturnType<typeof getDocFromServer>>;
          try {
            serverSnap = await getDocFromServer(ref);
          } catch (e) {
            console.warn("[Finanças] persist: leitura no servidor falhou", e);
            return;
          }
          if (serverSnap.exists()) {
            const d = serverSnap.data() as Record<string, unknown>;
            const srvSeq =
              typeof d.payloadWriteSeq === "number" &&
              Number.isFinite(d.payloadWriteSeq) &&
              d.payloadWriteSeq >= 0
                ? d.payloadWriteSeq
                : 0;
            serverSeqForBump = srvSeq;
            /** Outro aparelho (ou outra aba) gravou primeiro: o Firebase é a fonte da verdade. */
            if (srvSeq > lastPayloadWriteSeqRef.current && d.payload != null) {
              tryApplyRemoteFinanceDoc(d, serverSnap as DocumentSnapshot);
              return;
            }
          }
        }

        pruneOrphanBirthIds(localEntityBirthRef.current, stateRef.current);
        const payload = stripUndefinedDeep(reviveAppStateFromUnknown(stateRef.current));
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
        if (online) {
          lastPayloadWriteSeqRef.current = Math.max(
            lastPayloadWriteSeqRef.current,
            serverSeqForBump + 1,
          );
        }
      } catch (err) {
        console.error("[Finanças Firestore persist]", err);
      } finally {
        persistInFlightRef.current = false;
      }
    })();
  }, [fbConfigured, authReady, fbUser]);

  const tryApplyRemoteFinanceDoc = useCallback((data: Record<string, unknown>, snap: DocumentSnapshot) => {
    if (data.payload == null) return;
    const online = networkOnlineRef.current;
    /** Evita aplicar/gravar payload antigo da IndexedDB antes do servidor (outro aparelho “não vê” dados e o refresh pode sobrescrever a nuvem). */
    if (online && snap.metadata.fromCache && !snap.metadata.hasPendingWrites) {
      return;
    }
    const remoteWriteSeq =
      typeof data.payloadWriteSeq === "number" &&
      Number.isFinite(data.payloadWriteSeq) &&
      data.payloadWriteSeq >= 0
        ? data.payloadWriteSeq
        : 0;
    if (remoteWriteSeq < lastPayloadWriteSeqRef.current) {
      return;
    }
    const allowPersistAfterRemote = () => {
      lastPayloadWriteSeqRef.current = Math.max(
        lastPayloadWriteSeqRef.current,
        remoteWriteSeq,
      );
      allowFinanceCloudPersistRef.current = true;
    };
    const payloadTimeMs =
      firestoreTimestampMs(data.payloadUpdatedAt) || firestoreTimestampMs(data.updatedAt);
    const remoteRevived = reviveAppStateFromUnknown(data.payload);
    if (online) {
      localEntityBirthRef.current.clear();
    } else {
      pruneBirthRefForIdsAckedInRemote(localEntityBirthRef.current, remoteRevived);
      pruneOrphanBirthIds(localEntityBirthRef.current, stateRef.current);
    }
    const merged = online
      ? remoteRevived
      : mergeRemotePreservingPendingUploads(
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
      allowPersistAfterRemote();
      return;
    }

    if (JSON.stringify(stateRef.current) === nextJson) {
      lastPayloadRemoteMsRef.current = payloadTimeMs;
      lastPayloadRemoteJsonRef.current = nextJson;
      allowPersistAfterRemote();
      return;
    }

    lastPayloadRemoteMsRef.current = payloadTimeMs;
    lastPayloadRemoteJsonRef.current = nextJson;
    skipNextFinancePersistRef.current = nextJson === remoteCanonicalJson;
    allowPersistAfterRemote();
    setState(merged);
  }, []);

  useEffect(() => {
    lastPayloadRemoteMsRef.current = 0;
    lastPayloadRemoteJsonRef.current = "";
    lastPayloadWriteSeqRef.current = 0;
    localEntityBirthRef.current.clear();
    allowFinanceCloudPersistRef.current = false;
    const uid = fbUser?.uid;
    if (uid && typeof navigator !== "undefined" && navigator.onLine) {
      setState({ ...FINANCES_EMPTY_STATE });
    }
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

  /**
   * 1) Lê o documento no servidor (await) antes de registar o listener — evita que o 1.º evento
   * seja só cache IndexedDB e sobrescreva o estado / a nuvem.
   * 2) Depois mantém `onSnapshot` para atualizações em tempo real.
   */
  useEffect(() => {
    if (!fbConfigured || !authReady || !fbUser) return;
    const app = getFirebaseApp();
    if (!app) return;
    const db = getFirestore(app);
    const ref = doc(db, "userFinances", fbUser.uid);
    let cancelled = false;
    let unsub: (() => void) | null = null;

    void (async () => {
      try {
        const serverSnap = await getDocFromServer(ref);
        if (cancelled) return;

        if (!serverSnap.exists()) {
          const payload = stripUndefinedDeep(
            networkOnlineRef.current
              ? reviveAppStateFromUnknown({ ...FINANCES_EMPTY_STATE })
              : reviveAppStateFromUnknown(stateRef.current),
          );
          try {
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
          } catch (err) {
            console.error("[Finanças Firestore bootstrap]", err);
          }
          if (cancelled) return;
          skipNextFinancePersistRef.current = true;
          setState(payload);
          allowFinanceCloudPersistRef.current = true;
          lastPayloadWriteSeqRef.current = Math.max(lastPayloadWriteSeqRef.current, 1);
        } else {
          const data = serverSnap.data() as Record<string, unknown>;
          if (data.payload != null) {
            tryApplyRemoteFinanceDoc(data, serverSnap);
          }
        }
      } catch (e) {
        console.warn("[Finanças] hidratação inicial (getDocFromServer)", e);
      }

      if (cancelled) return;

      let firstSnapshot = true;
      unsub = onSnapshot(
        ref,
        (snap) => {
          if (cancelled) return;
          if (!snap.exists()) {
            if (firstSnapshot) {
              firstSnapshot = false;
              const payload = stripUndefinedDeep(
                networkOnlineRef.current
                  ? reviveAppStateFromUnknown({ ...FINANCES_EMPTY_STATE })
                  : reviveAppStateFromUnknown(stateRef.current),
              );
              void setDoc(
                ref,
                {
                  version: 1,
                  payload,
                  updatedAt: serverTimestamp(),
                  payloadUpdatedAt: serverTimestamp(),
                  payloadWriteSeq: increment(1),
                },
                { merge: true },
              ).catch((err) => console.error("[Finanças Firestore bootstrap]", err));
            }
            return;
          }
          firstSnapshot = false;
          tryApplyRemoteFinanceDoc(snap.data() as Record<string, unknown>, snap);
        },
        (err) => console.error("[Finanças Firestore]", err),
      );
      if (cancelled) {
        unsub();
        unsub = null;
      }
    })();

    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [fbConfigured, authReady, fbUser, tryApplyRemoteFinanceDoc]);

  /** Ao voltar ao primeiro plano / rede: força leitura no servidor (complementa o listener). */
  useEffect(() => {
    if (!fbConfigured || !authReady || !fbUser) return;
    const app = getFirebaseApp();
    if (!app) return;
    const db = getFirestore(app);
    const ref = doc(db, "userFinances", fbUser.uid);
    let cancelled = false;
    const pullFromServer = () => {
      void getDocFromServer(ref)
        .then((snap) => {
          if (cancelled || !snap.exists()) return;
          tryApplyRemoteFinanceDoc(snap.data() as Record<string, unknown>, snap);
        })
        .catch((e) => {
          console.warn("[Finanças] pull servidor (getDocFromServer)", e);
        });
    };
    pullFinanceFromServerRef.current = pullFromServer;
    const onVis = () => {
      if (document.visibilityState === "visible") pullFromServer();
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("online", pullFromServer);
    return () => {
      cancelled = true;
      pullFinanceFromServerRef.current = null;
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("online", pullFromServer);
    };
  }, [fbConfigured, authReady, fbUser, tryApplyRemoteFinanceDoc]);

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
