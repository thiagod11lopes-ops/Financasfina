import { useCallback } from "react";
import { useAuth } from "../firebase/AuthProvider";
import {
  activateShoppingListSyncForUser,
  buildShoppingListUrl,
} from "../shoppingList/syncPrefs";
import { completeAsyncUrlOpen, prepareAsyncUrlOpen } from "../utils/pwa";
import { PageBranding } from "./PageBranding";
import { IconCart, IconSettings } from "./Icons";
import type { TabId } from "./BottomNav";

export function AppTopBar({
  activeTab,
  onNavigate,
}: {
  activeTab: TabId;
  onNavigate: (tab: TabId) => void;
}) {
  const { user } = useAuth();

  const openShoppingList = useCallback(() => {
    const placeholder = prepareAsyncUrlOpen();
    void (async () => {
      let url = buildShoppingListUrl();
      if (user?.email && user.uid) {
        try {
          const roomHash = await activateShoppingListSyncForUser(user.email, user.uid);
          url = buildShoppingListUrl(roomHash, user.email);
        } catch {
          /* abre mesmo sem prefs se o browser bloquear crypto/localStorage */
        }
      }
      completeAsyncUrlOpen(url, placeholder);
    })();
  }, [user]);

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
