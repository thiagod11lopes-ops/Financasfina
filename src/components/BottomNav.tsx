import type { ReactNode } from "react";
import { IconCart, IconFlow, IconFutureIncome, IconHome, IconSettings, IconWallet } from "./Icons";

export type TabId = "home" | "flow" | "accounts" | "futureIncome" | "shoppingList" | "settings";

const tabs: { id: TabId; label: ReactNode; Icon: typeof IconHome }[] = [
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
  {
    id: "shoppingList",
    label: (
      <>
        Lista de
        <br />
        compras
      </>
    ),
    Icon: IconCart,
  },
  { id: "settings", label: "Ajustes", Icon: IconSettings },
];

export function BottomNav({
  active,
  onChange,
}: {
  active: TabId;
  onChange: (t: TabId) => void;
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
            title={
              id === "futureIncome" ? "Entradas Futuras" : id === "shoppingList" ? "Lista de compras" : undefined
            }
          >
            <Icon aria-hidden />
            {label}
          </button>
        ))}
      </div>
    </nav>
  );
}
