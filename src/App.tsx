import { useEffect, useState } from "react";
import { BottomNav, type BottomTabId, type TabId } from "./components/BottomNav";
import { AppTopBar } from "./components/AppTopBar";
import { Dashboard } from "./components/Dashboard";
import { MovementsView } from "./components/MovementsView";
import { AccountsView } from "./components/AccountsView";
import { FutureIncomesView } from "./components/FutureIncomesView";
import { PatrimonyView } from "./components/PatrimonyView";
import { SettingsView } from "./components/SettingsView";
import { CloudSyncBadge } from "./components/CloudSyncBadge";
import { TaskAlarmBanner } from "./components/TaskAlarmBanner";
import { TasksModal } from "./components/TasksModal";
import {
  GoogleLoginPromptModal,
  useGoogleLoginPrompt,
} from "./components/GoogleLoginPromptModal";
import { useFinance } from "./context/FinanceContext";
import { VaquinhasApp } from "./vaquinhas/VaquinhasApp";

function toBottomTab(tab: TabId): BottomTabId | null {
  if (tab === "settings") return null;
  return tab;
}

function isVaquinhasPath(pathname = window.location.pathname): boolean {
  const base = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
  const path = pathname.replace(/\/$/, "");
  return path === `${base}/vaquinhas` || path.startsWith(`${base}/vaquinhas/`);
}

function FinancasShell() {
  const [tab, setTab] = useState<TabId>("home");
  const { refreshFinanceFromCloud } = useFinance();
  const { open: loginPromptOpen, dismiss: dismissLoginPrompt } = useGoogleLoginPrompt();

  useEffect(() => {
    if (tab !== "accounts" && tab !== "futureIncome" && tab !== "patrimony") return;
    refreshFinanceFromCloud();
  }, [tab, refreshFinanceFromCloud]);

  return (
    <>
      <GoogleLoginPromptModal open={loginPromptOpen} onDismiss={dismissLoginPrompt} />
      <CloudSyncBadge />
      <TaskAlarmBanner />
      <TasksModal />
      <main className="app-shell">
        <AppTopBar activeTab={tab} onNavigate={setTab} />
        <section className="app-tab-panel" hidden={tab !== "home"} aria-label="Início">
          <Dashboard visible={tab === "home"} />
        </section>
        <section className="app-tab-panel" hidden={tab !== "flow"} aria-label="Fluxo de caixa">
          <MovementsView />
        </section>
        <section className="app-tab-panel" hidden={tab !== "accounts"} aria-label="Contas">
          <AccountsView visible={tab === "accounts"} />
        </section>
        <section className="app-tab-panel" hidden={tab !== "futureIncome"} aria-label="Entradas futuras">
          <FutureIncomesView />
        </section>
        <section className="app-tab-panel" hidden={tab !== "patrimony"} aria-label="Patrimônio">
          <PatrimonyView />
        </section>
        <section className="app-tab-panel" hidden={tab !== "settings"} aria-label="Ajustes">
          <SettingsView visible={tab === "settings"} />
        </section>
      </main>
      <BottomNav active={toBottomTab(tab)} onChange={setTab} />
    </>
  );
}

export default function App() {
  const [pathname, setPathname] = useState(() => window.location.pathname);

  useEffect(() => {
    const sync = () => setPathname(window.location.pathname);
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);

  if (isVaquinhasPath(pathname)) return <VaquinhasApp />;
  return <FinancasShell />;
}
