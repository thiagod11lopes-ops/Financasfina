import { useCallback, type SVGProps } from "react";
import { useAuth } from "../firebase/AuthProvider";
import {
  activateShoppingListSyncForUser,
  resolveShoppingListUrl,
} from "../shoppingList/syncPrefs";
import { appendFromFinancasPwaParam, isInstalledPwa, openExternalUrl } from "../utils/pwa";
import { PageBranding } from "./PageBranding";
import { IconCart, IconSettings } from "./Icons";
import type { TabId } from "./BottomNav";

function IconPiggy(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden {...props}>
      <path d="M10.2 8.8L9.1 6.6C8.8 6 9.4 5.4 10 5.7L12.3 6.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <ellipse cx="14.2" cy="16.1" rx="7.4" ry="5.9" stroke="currentColor" strokeWidth="1.6" />
      <ellipse cx="15.2" cy="14.9" rx="2.6" ry="2.2" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="13.5" cy="14.7" r="0.75" fill="currentColor" />
      <circle cx="16" cy="14.7" r="0.75" fill="currentColor" />
      <circle cx="12.3" cy="16.7" r="0.55" fill="currentColor" opacity="0.85" />
      <circle cx="18.1" cy="16.7" r="0.55" fill="currentColor" opacity="0.85" />
      <path d="M12.5 18C13 16.9 14.1 16.3 15.3 16.3H16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M21.2 16.2C22.3 16.5 22.7 17.4 22.2 18.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function AppTopBar({
  activeTab,
  onNavigate,
}: {
  activeTab: TabId;
  onNavigate: (tab: TabId) => void;
}) {
  const { user } = useAuth();

  const openShoppingList = useCallback(() => {
    if (user?.email && user.uid) {
      void activateShoppingListSyncForUser(user.email, user.uid);
    }
    let url = resolveShoppingListUrl(user?.email ?? null);
    if (isInstalledPwa()) url = appendFromFinancasPwaParam(url);
    openExternalUrl(url);
  }, [user]);

  const openVaquinhas = useCallback(() => {
    const base = import.meta.env.BASE_URL || "/";
    const prefix = base.endsWith("/") ? base : `${base}/`;
    // Soft navigate: evita 404 do GitHub Pages em rotas SPA.
    window.history.pushState({}, "", `${prefix}vaquinhas/`);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, []);

  return (
    <header className="app-top-bar" aria-label="Cabeçalho">
      <button
        type="button"
        className="app-top-bar__btn"
        onClick={openShoppingList}
        aria-label="Lista de compras"
        title={
          user?.email
            ? "Lista de compras (sincronizada com a sua conta Google)"
            : "Lista de compras — entre com Google em Ajustes para sincronizar"
        }
      >
        <IconCart aria-hidden />
      </button>
      <button
        type="button"
        className="app-top-bar__btn"
        onClick={openVaquinhas}
        aria-label="Vaquinhas"
        title="Vaquinhas"
      >
        <IconPiggy />
      </button>
      <div className="app-top-bar__brand">
        <PageBranding />
      </div>
      <button
        type="button"
        className={`app-top-bar__btn${activeTab === "settings" ? " is-active" : ""}`}
        onClick={() => onNavigate("settings")}
        aria-label="Ajustes"
        aria-current={activeTab === "settings" ? "page" : undefined}
        title="Ajustes"
      >
        <IconSettings aria-hidden />
      </button>
    </header>
  );
}