import type { ReactNode } from "react";
import { IconFlow, IconFutureIncome, IconHome, IconPatrimony, IconWallet } from "./Icons";

export type BottomTabId = "home" | "flow" | "accounts" | "futureIncome" | "patrimony";
export type TabId = BottomTabId | "settings";

const tabs: { id: BottomTabId; label: ReactNode; Icon: typeof IconHome }[] = [
  { id: "home", label: "Início", Icon: IconHome },
  { id: "flow", label: "Fluxo", Icon: IconFlow },
  { id: "accounts", label: "Contas", Icon: IconWallet },
  {
    id: "futureIncome",
    label: (
      <>
        Entradas
        <br />
        Futuras
      </>
    ),
    Icon: IconFutureIncome,
  },
  { id: "patrimony", label: "Patrimônio", Icon: IconPatrimony },
];

export function BottomNav({
  active,
  onChange,
}: {
  active: BottomTabId | null;
  onChange: (t: BottomTabId) => void;
}) {
  return (
    <nav className="bottom-nav" aria-label="Navegação principal">
      <div className="bottom-nav-inner">
        {tabs.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            className={active === id ? "active" : ""}
            onClick={() => onChange(id)}
            aria-current={active === id ? "page" : undefined}
            title={id === "futureIncome" ? "Entradas Futuras" : undefined}
          >
            <Icon aria-hidden />
            {label}
          </button>
        ))}
      </div>
    </nav>
  );
}
