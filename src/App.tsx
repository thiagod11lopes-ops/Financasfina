import { useState } from "react";
import { BottomNav, type TabId } from "./components/BottomNav";
import { Dashboard } from "./components/Dashboard";
import { MovementsView } from "./components/MovementsView";
import { AccountsView } from "./components/AccountsView";
import { FutureIncomesView } from "./components/FutureIncomesView";
import { SettingsView } from "./components/SettingsView";
import { PageBranding } from "./components/PageBranding";

export default function App() {
  const [tab, setTab] = useState<TabId>("home");

  return (
    <>
      <main className="app-shell">
        <PageBranding />
        {tab === "home" && <Dashboard />}
        {tab === "flow" && <MovementsView />}
        {tab === "accounts" && <AccountsView />}
        {tab === "futureIncome" && <FutureIncomesView />}
        {tab === "settings" && <SettingsView />}
      </main>
      <BottomNav active={tab} onChange={setTab} />
    </>
  );
}
