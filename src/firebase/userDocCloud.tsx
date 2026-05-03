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
};

const noopApi: UserDocCloudApi = {
  cloudEnabled: false,
  scheduleAgendaPush: () => {},
  pushAgendaImmediate: () => {},
  scheduleDashboardTabsPush: () => {},
  scheduleUsersPush: () => {},
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

  if (timeMs === lastMs && nextJson === lastJson) return;

  if (
    timeMs === lastMs &&
    nextJson !== lastJson &&
    snap.metadata.fromCache &&
    !snap.metadata.hasPendingWrites
  ) {
    return;
  }

  if (timeMs > lastMs && nextJson === lastJson) {
    lastMsRef.current = timeMs;
    return;
  }

  lastMsRef.current = timeMs;
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

  const agendaPushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tabsPushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const usersPushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pendingAgendaRef = useRef<AgendaData | null>(null);
  const pendingTabsRef = useRef<TabsPersist | null>(null);
  const pendingUsersRef = useRef<UserRecord[] | null>(null);

  useEffect(() => {
    lastAgendaMsRef.current = 0;
    lastAgendaJsonRef.current = "";
    lastTabsMsRef.current = 0;
    lastTabsJsonRef.current = "";
    lastUsersMsRef.current = 0;
    lastUsersJsonRef.current = "";
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

  useEffect(
    () => () => {
      if (agendaPushTimer.current) window.clearTimeout(agendaPushTimer.current);
      if (tabsPushTimer.current) window.clearTimeout(tabsPushTimer.current);
      if (usersPushTimer.current) window.clearTimeout(usersPushTimer.current);
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
    ],
  );

  return <UserDocCloudContext.Provider value={value}>{children}</UserDocCloudContext.Provider>;
}

export function useUserDocCloud(): UserDocCloudApi {
  return useContext(UserDocCloudContext);
}
