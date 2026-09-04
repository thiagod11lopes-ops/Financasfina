import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type MutableRefObject,
  type ReactNode,
} from "react";
import type { DocumentSnapshot } from "firebase/firestore";
import { doc, getFirestore, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import type { AgendaData } from "../agenda/types";
import { reviveAgendaFromUnknown, saveAgenda } from "../agenda/persist";
import {
  notifyDashboardTabsSync,
  reviveDashboardTabsFromUnknown,
  saveDashboardTabs,
  type TabsPersist,
} from "../dashboardTabs";
import { notifyUsersSync, saveUserRecords, sanitizeForCloudCompare, type UserRecord } from "../users";
import { reviveTasksFromUnknown, saveTasks } from "../tasks/persist";
import type { TasksData } from "../tasks/types";
import {
  clearVaquinhasPending,
  isVaquinhasDirty,
  loadVaquinhas,
  markVaquinhasDirty,
  reviveVaquinhasFromUnknown,
  saveVaquinhas,
} from "../vaquinhas/storage";
import type { VaquinhasPersisted } from "../vaquinhas/types";
import {
  applyShoppingListPrefsFromCloud,
  loadShoppingListPrefsForCloud,
  reviveShoppingListPrefsFromUnknown,
  SHOPPING_LIST_PREFS_SYNC_EVENT,
  type ShoppingListPrefsCloud,
} from "../shoppingList/syncPrefs";
import { useAuth } from "./AuthProvider";
import { getFirebaseApp } from "./config";
import { firestoreTimestampMs } from "./firestoreTime";

export const AGENDA_CLOUD_SYNC_EVENT = "financas-agenda-cloud-sync";

type UserDocCloudApi = {
  cloudEnabled: boolean;
  scheduleAgendaPush: (data: AgendaData) => void;
  /** Grava agenda na nuvem já (ex.: ao fechar o modal). */
  pushAgendaImmediate: (data: AgendaData) => void;
  scheduleDashboardTabsPush: (data: TabsPersist) => void;
  scheduleUsersPush: (records: UserRecord[]) => void;
  scheduleTasksPush: (data: TasksData) => void;
  scheduleVaquinhasPush: (data: VaquinhasPersisted) => void;
  pushVaquinhasImmediate: (data: VaquinhasPersisted) => void;
  scheduleShoppingListPrefsPush: (data: ShoppingListPrefsCloud) => void;
};

const noopApi: UserDocCloudApi = {
  cloudEnabled: false,
  scheduleAgendaPush: () => {},
  pushAgendaImmediate: () => {},
  scheduleDashboardTabsPush: () => {},
  scheduleUsersPush: () => {},
  scheduleTasksPush: () => {},
  scheduleVaquinhasPush: () => {},
  pushVaquinhasImmediate: () => {},
  scheduleShoppingListPrefsPush: () => {},
};

const UserDocCloudContext = createContext<UserDocCloudApi>(noopApi);

function applyRemoteField(args: {
  snap: DocumentSnapshot;
  timeMs: number;
  lastMsRef: MutableRefObject<number>;
  lastJsonRef: MutableRefObject<string>;
  nextJson: string;
  onApply: () => void;
}): void {
  const { snap, timeMs, lastMsRef, lastJsonRef, nextJson, onApply } = args;
  const lastMs = lastMsRef.current;
  const lastJson = lastJsonRef.current;

  if (timeMs < lastMs) return;
  if (nextJson === lastJson) {
    if (timeMs > lastMs) lastMsRef.current = timeMs;
    return;
  }

  /** Só ignora cache ambíguo depois de já termos um timestamp real do servidor. */
  if (
    timeMs === lastMs &&
    timeMs > 0 &&
    snap.metadata.fromCache &&
    !snap.metadata.hasPendingWrites
  ) {
    return;
  }

  lastMsRef.current = Math.max(timeMs, lastMs);
  lastJsonRef.current = nextJson;
  onApply();
}

export function UserDocCloudProvider({ children }: { children: ReactNode }) {
  const { configured: fbConfigured, ready: authReady, user: fbUser } = useAuth();

  const lastAgendaMsRef = useRef(0);
  const lastAgendaJsonRef = useRef("");
  const lastTabsMsRef = useRef(0);
  const lastTabsJsonRef = useRef("");
  const lastUsersMsRef = useRef(0);
  const lastUsersJsonRef = useRef("");
  const lastTasksMsRef = useRef(0);
  const lastTasksJsonRef = useRef("");
  const lastVaquinhasMsRef = useRef(0);
  const lastVaquinhasJsonRef = useRef("");
  const lastShoppingMsRef = useRef(0);
  const lastShoppingJsonRef = useRef("");

  const agendaPushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tabsPushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const usersPushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tasksPushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const vaquinhasPushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shoppingPushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pendingAgendaRef = useRef<AgendaData | null>(null);
  const pendingTabsRef = useRef<TabsPersist | null>(null);
  const pendingUsersRef = useRef<UserRecord[] | null>(null);
  const pendingTasksRef = useRef<TasksData | null>(null);
  const pendingVaquinhasRef = useRef<VaquinhasPersisted | null>(null);
  const pendingShoppingRef = useRef<ShoppingListPrefsCloud | null>(null);

  useEffect(() => {
    lastAgendaMsRef.current = 0;
    lastAgendaJsonRef.current = "";
    lastTabsMsRef.current = 0;
    lastTabsJsonRef.current = "";
    lastUsersMsRef.current = 0;
    lastUsersJsonRef.current = "";
    lastTasksMsRef.current = 0;
    lastTasksJsonRef.current = "";
    lastVaquinhasMsRef.current = 0;
    lastVaquinhasJsonRef.current = "";
    lastShoppingMsRef.current = 0;
    lastShoppingJsonRef.current = "";
  }, [fbUser?.uid]);

  useEffect(() => {
    if (!fbConfigured || !authReady || !fbUser) return;
    const app = getFirebaseApp();
    if (!app) return;
    const db = getFirestore(app);
    const ref = doc(db, "userFinances", fbUser.uid);

    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) return;
        const data = snap.data() as Record<string, unknown>;

        if (data.agenda != null && typeof data.agenda === "object") {
          const t = firestoreTimestampMs(data.agendaUpdatedAt);
          const agenda = reviveAgendaFromUnknown(data.agenda);
          const json = JSON.stringify(agenda);
          applyRemoteField({
            snap,
            timeMs: t,
            lastMsRef: lastAgendaMsRef,
            lastJsonRef: lastAgendaJsonRef,
            nextJson: json,
            onApply: () => {
              saveAgenda(agenda);
              window.dispatchEvent(new Event(AGENDA_CLOUD_SYNC_EVENT));
            },
          });
        }

        if (data.dashboardTabs != null && typeof data.dashboardTabs === "object") {
          const t = firestoreTimestampMs(data.dashboardTabsUpdatedAt);
          const tabs = reviveDashboardTabsFromUnknown(data.dashboardTabs);
          const json = JSON.stringify(tabs);
          applyRemoteField({
            snap,
            timeMs: t,
            lastMsRef: lastTabsMsRef,
            lastJsonRef: lastTabsJsonRef,
            nextJson: json,
            onApply: () => {
              saveDashboardTabs(tabs);
              notifyDashboardTabsSync();
            },
          });
        }

        if (data.usersPayload != null && typeof data.usersPayload === "object") {
          const t = firestoreTimestampMs(data.usersUpdatedAt);
          const raw = data.usersPayload as { users?: unknown };
          const users = Array.isArray(raw.users) ? (raw.users as UserRecord[]) : [];
          const json = sanitizeForCloudCompare(users);
          applyRemoteField({
            snap,
            timeMs: t,
            lastMsRef: lastUsersMsRef,
            lastJsonRef: lastUsersJsonRef,
            nextJson: json,
            onApply: () => {
              saveUserRecords(users);
              notifyUsersSync();
            },
          });
        }

        if (data.tasks != null && typeof data.tasks === "object") {
          const t = firestoreTimestampMs(data.tasksUpdatedAt);
          const tasks = reviveTasksFromUnknown(data.tasks);
          const json = JSON.stringify(tasks);
          applyRemoteField({
            snap,
            timeMs: t,
            lastMsRef: lastTasksMsRef,
            lastJsonRef: lastTasksJsonRef,
            nextJson: json,
            onApply: () => {
              saveTasks(tasks);
            },
          });
        }

        if (data.vaquinhas != null && typeof data.vaquinhas === "object") {
          if (!isVaquinhasDirty()) {
            const t = firestoreTimestampMs(data.vaquinhasUpdatedAt);
            const vaquinhas = reviveVaquinhasFromUnknown(data.vaquinhas);
            const json = JSON.stringify(vaquinhas);
            applyRemoteField({
              snap,
              timeMs: t,
              lastMsRef: lastVaquinhasMsRef,
              lastJsonRef: lastVaquinhasJsonRef,
              nextJson: json,
              onApply: () => {
                saveVaquinhas(vaquinhas, { fromCloud: true });
              },
            });
          }
        } else if (!isVaquinhasDirty()) {
          const localOrPending = loadVaquinhas();
          if (localOrPending.items.length > 0) {
            pendingVaquinhasRef.current = localOrPending;
            void setDoc(
              ref,
              { vaquinhas: localOrPending, vaquinhasUpdatedAt: serverTimestamp() },
              { merge: true },
            )
              .then(() => {
                markVaquinhasDirty(false);
                clearVaquinhasPending();
                lastVaquinhasJsonRef.current = JSON.stringify(localOrPending);
              })
              .catch((err) => console.error("[UserDoc vaquinhas pending]", err));
          }
        }

        if (data.shoppingListPrefs != null && typeof data.shoppingListPrefs === "object") {
          const t = firestoreTimestampMs(data.shoppingListPrefsUpdatedAt);
          const prefs = reviveShoppingListPrefsFromUnknown(data.shoppingListPrefs);
          const json = JSON.stringify(prefs);
          applyRemoteField({
            snap,
            timeMs: t,
            lastMsRef: lastShoppingMsRef,
            lastJsonRef: lastShoppingJsonRef,
            nextJson: json,
            onApply: () => {
              applyShoppingListPrefsFromCloud(prefs);
            },
          });
        }
      },
      (err) => console.error("[UserDoc cloud extras]", err),
    );

    return () => unsub();
  }, [fbConfigured, authReady, fbUser]);

  const flushAgenda = useCallback(() => {
    if (!fbConfigured || !authReady || !fbUser) return;
    if (agendaPushTimer.current) {
      window.clearTimeout(agendaPushTimer.current);
      agendaPushTimer.current = null;
    }
    const data = pendingAgendaRef.current;
    if (!data) return;
    pendingAgendaRef.current = null;
    const app = getFirebaseApp();
    if (!app) return;
    const db = getFirestore(app);
    const ref = doc(db, "userFinances", fbUser.uid);
    void setDoc(
      ref,
      { agenda: data, agendaUpdatedAt: serverTimestamp() },
      { merge: true },
    );
  }, [fbConfigured, authReady, fbUser]);

  const flushTabs = useCallback(() => {
    if (!fbConfigured || !authReady || !fbUser) return;
    const data = pendingTabsRef.current;
    if (!data) return;
    pendingTabsRef.current = null;
    const app = getFirebaseApp();
    if (!app) return;
    const db = getFirestore(app);
    const ref = doc(db, "userFinances", fbUser.uid);
    void setDoc(
      ref,
      { dashboardTabs: data, dashboardTabsUpdatedAt: serverTimestamp() },
      { merge: true },
    );
  }, [fbConfigured, authReady, fbUser]);

  const flushUsers = useCallback(() => {
    if (!fbConfigured || !authReady || !fbUser) return;
    const records = pendingUsersRef.current;
    if (!records) return;
    pendingUsersRef.current = null;
    const app = getFirebaseApp();
    if (!app) return;
    const db = getFirestore(app);
    const ref = doc(db, "userFinances", fbUser.uid);
    void setDoc(
      ref,
      { usersPayload: { version: 2 as const, users: records }, usersUpdatedAt: serverTimestamp() },
      { merge: true },
    );
  }, [fbConfigured, authReady, fbUser]);

  const flushTasks = useCallback(() => {
    if (!fbConfigured || !authReady || !fbUser) return;
    if (tasksPushTimer.current) {
      window.clearTimeout(tasksPushTimer.current);
      tasksPushTimer.current = null;
    }
    const data = pendingTasksRef.current;
    if (!data) return;
    pendingTasksRef.current = null;
    const json = JSON.stringify(data);
    lastTasksJsonRef.current = json;
    const app = getFirebaseApp();
    if (!app) return;
    const db = getFirestore(app);
    const ref = doc(db, "userFinances", fbUser.uid);
    void setDoc(ref, { tasks: data, tasksUpdatedAt: serverTimestamp() }, { merge: true });
  }, [fbConfigured, authReady, fbUser]);

  const flushVaquinhas = useCallback(() => {
    if (!fbConfigured || !authReady || !fbUser) return;
    if (vaquinhasPushTimer.current) {
      window.clearTimeout(vaquinhasPushTimer.current);
      vaquinhasPushTimer.current = null;
    }
    const data = pendingVaquinhasRef.current;
    if (!data) return;
    pendingVaquinhasRef.current = null;
    const json = JSON.stringify(data);
    lastVaquinhasJsonRef.current = json;
    const app = getFirebaseApp();
    if (!app) return;
    const db = getFirestore(app);
    const ref = doc(db, "userFinances", fbUser.uid);
    void setDoc(ref, { vaquinhas: data, vaquinhasUpdatedAt: serverTimestamp() }, { merge: true })
      .then(() => {
        markVaquinhasDirty(false);
        clearVaquinhasPending();
        saveVaquinhas(data, { silent: true, fromCloud: true });
      })
      .catch((err) => console.error("[UserDoc vaquinhas push]", err));
  }, [fbConfigured, authReady, fbUser]);

  const flushShopping = useCallback(() => {
    if (!fbConfigured || !authReady || !fbUser) return;
    if (shoppingPushTimer.current) {
      window.clearTimeout(shoppingPushTimer.current);
      shoppingPushTimer.current = null;
    }
    const data = pendingShoppingRef.current;
    if (!data) return;
    pendingShoppingRef.current = null;
    const json = JSON.stringify(data);
    lastShoppingJsonRef.current = json;
    const app = getFirebaseApp();
    if (!app) return;
    const db = getFirestore(app);
    const ref = doc(db, "userFinances", fbUser.uid);
    void setDoc(
      ref,
      { shoppingListPrefs: data, shoppingListPrefsUpdatedAt: serverTimestamp() },
      { merge: true },
    );
  }, [fbConfigured, authReady, fbUser]);

  const scheduleAgendaPush = useCallback(
    (data: AgendaData) => {
      if (!fbConfigured || !authReady || !fbUser) return;
      pendingAgendaRef.current = data;
      if (agendaPushTimer.current) window.clearTimeout(agendaPushTimer.current);
      agendaPushTimer.current = window.setTimeout(() => {
        agendaPushTimer.current = null;
        flushAgenda();
      }, 550);
    },
    [fbConfigured, authReady, fbUser, flushAgenda],
  );

  const pushAgendaImmediate = useCallback(
    (data: AgendaData) => {
      if (!fbConfigured || !authReady || !fbUser) return;
      pendingAgendaRef.current = data;
      flushAgenda();
    },
    [fbConfigured, authReady, fbUser, flushAgenda],
  );

  const scheduleDashboardTabsPush = useCallback(
    (data: TabsPersist) => {
      if (!fbConfigured || !authReady || !fbUser) return;
      pendingTabsRef.current = data;
      if (tabsPushTimer.current) window.clearTimeout(tabsPushTimer.current);
      tabsPushTimer.current = window.setTimeout(() => {
        tabsPushTimer.current = null;
        flushTabs();
      }, 450);
    },
    [fbConfigured, authReady, fbUser, flushTabs],
  );

  const scheduleUsersPush = useCallback(
    (records: UserRecord[]) => {
      if (!fbConfigured || !authReady || !fbUser) return;
      pendingUsersRef.current = records;
      if (usersPushTimer.current) window.clearTimeout(usersPushTimer.current);
      usersPushTimer.current = window.setTimeout(() => {
        usersPushTimer.current = null;
        flushUsers();
      }, 450);
    },
    [fbConfigured, authReady, fbUser, flushUsers],
  );

  const scheduleTasksPush = useCallback(
    (data: TasksData) => {
      if (!fbConfigured || !authReady || !fbUser) return;
      pendingTasksRef.current = data;
      if (tasksPushTimer.current) window.clearTimeout(tasksPushTimer.current);
      tasksPushTimer.current = window.setTimeout(() => {
        tasksPushTimer.current = null;
        flushTasks();
      }, 450);
    },
    [fbConfigured, authReady, fbUser, flushTasks],
  );

  const scheduleVaquinhasPush = useCallback(
    (data: VaquinhasPersisted) => {
      if (!fbConfigured || !authReady || !fbUser) return;
      pendingVaquinhasRef.current = data;
      if (vaquinhasPushTimer.current) window.clearTimeout(vaquinhasPushTimer.current);
      vaquinhasPushTimer.current = window.setTimeout(() => {
        vaquinhasPushTimer.current = null;
        flushVaquinhas();
      }, 120);
    },
    [fbConfigured, authReady, fbUser, flushVaquinhas],
  );

  const pushVaquinhasImmediate = useCallback(
    (data: VaquinhasPersisted) => {
      if (!fbConfigured || !authReady || !fbUser) return;
      pendingVaquinhasRef.current = data;
      flushVaquinhas();
    },
    [fbConfigured, authReady, fbUser, flushVaquinhas],
  );

  const scheduleShoppingListPrefsPush = useCallback(
    (data: ShoppingListPrefsCloud) => {
      if (!fbConfigured || !authReady || !fbUser) return;
      pendingShoppingRef.current = data;
      if (shoppingPushTimer.current) window.clearTimeout(shoppingPushTimer.current);
      shoppingPushTimer.current = window.setTimeout(() => {
        shoppingPushTimer.current = null;
        flushShopping();
      }, 450);
    },
    [fbConfigured, authReady, fbUser, flushShopping],
  );

  useEffect(() => {
    if (!fbConfigured || !authReady || !fbUser) return;
    const onPrefs = () => {
      scheduleShoppingListPrefsPush(loadShoppingListPrefsForCloud());
    };
    window.addEventListener(SHOPPING_LIST_PREFS_SYNC_EVENT, onPrefs);
    return () => window.removeEventListener(SHOPPING_LIST_PREFS_SYNC_EVENT, onPrefs);
  }, [fbConfigured, authReady, fbUser, scheduleShoppingListPrefsPush]);

  useEffect(
    () => () => {
      if (agendaPushTimer.current) window.clearTimeout(agendaPushTimer.current);
      if (tabsPushTimer.current) window.clearTimeout(tabsPushTimer.current);
      if (usersPushTimer.current) window.clearTimeout(usersPushTimer.current);
      if (tasksPushTimer.current) window.clearTimeout(tasksPushTimer.current);
      if (vaquinhasPushTimer.current) window.clearTimeout(vaquinhasPushTimer.current);
      if (shoppingPushTimer.current) window.clearTimeout(shoppingPushTimer.current);
    },
    [],
  );

  const value = useMemo<UserDocCloudApi>(
    () =>
      fbConfigured && authReady && fbUser
        ? {
            cloudEnabled: true,
            scheduleAgendaPush,
            pushAgendaImmediate,
            scheduleDashboardTabsPush,
            scheduleUsersPush,
            scheduleTasksPush,
            scheduleVaquinhasPush,
            pushVaquinhasImmediate,
            scheduleShoppingListPrefsPush,
          }
        : noopApi,
    [
      fbConfigured,
      authReady,
      fbUser,
      scheduleAgendaPush,
      pushAgendaImmediate,
      scheduleDashboardTabsPush,
      scheduleUsersPush,
      scheduleTasksPush,
      scheduleVaquinhasPush,
      pushVaquinhasImmediate,
      scheduleShoppingListPrefsPush,
    ],
  );

  return <UserDocCloudContext.Provider value={value}>{children}</UserDocCloudContext.Provider>;
}

export function useUserDocCloud(): UserDocCloudApi {
  return useContext(UserDocCloudContext);
}
