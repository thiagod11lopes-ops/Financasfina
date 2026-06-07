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

function toBottomTab(tab: TabId): BottomTabId | null {
  if (tab === "settings") return null;
  return tab;
}

export default function App() {
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
        {/*
          Manter todas as vistas montadas: o contexto financeiro e o Firestore atualizam todas
          ao mesmo tempo; evita perda de rascunhos e estados ao mudar de aba na navegação inferior.
        */}
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
