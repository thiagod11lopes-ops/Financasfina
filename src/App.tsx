import { useState } from "react";
import { BottomNav, type TabId } from "./components/BottomNav";
import { Dashboard } from "./components/Dashboard";
import { MovementsView } from "./components/MovementsView";
import { AccountsView } from "./components/AccountsView";
import { FutureIncomesView } from "./components/FutureIncomesView";
import { SettingsView } from "./components/SettingsView";
import { PageBranding } from "./components/PageBranding";
import { CloudSyncBadge } from "./components/CloudSyncBadge";

export default function App() {
  const [tab, setTab] = useState<TabId>("home");

  return (
    <>
      <CloudSyncBadge />
      <main className="app-shell">
        <PageBranding />
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
        <section className="app-tab-panel" hidden={tab !== "settings"} aria-label="Ajustes">
          <SettingsView visible={tab === "settings"} />
        </section>
      </main>
      <BottomNav active={tab} onChange={setTab} />
    </>
  );
}
