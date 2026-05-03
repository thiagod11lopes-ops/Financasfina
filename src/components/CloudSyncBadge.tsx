import { useAuth } from "../firebase/AuthProvider";

/** Indicador fixo: estado da sincronização Firebase (dados financeiros). */
export function CloudSyncBadge() {
  const { configured, ready, user } = useAuth();

  if (!configured) {
    return (
      <div
        className="cloud-sync-badge cloud-sync-badge--local"
        title="Firebase não configurado. Os dados financeiros ficam só neste dispositivo."
      >
        <span className="cloud-sync-badge__dot" aria-hidden />
        <span className="cloud-sync-badge__text">Só neste aparelho</span>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="cloud-sync-badge cloud-sync-badge--wait" title="A verificar sessão…">
        <span className="cloud-sync-badge__dot cloud-sync-badge__dot--pulse" aria-hidden />
        <span className="cloud-sync-badge__text">A carregar…</span>
      </div>
    );
  }

  if (user) {
    return (
      <div
        className="cloud-sync-badge cloud-sync-badge--sync"
        title="Sincronizado com o Firebase. Finanças, resumo, agenda e utilizadores seguem a última versão na nuvem (cópia local ao sair da conta)."
      >
        <span className="cloud-sync-badge__dot" aria-hidden />
        <span className="cloud-sync-badge__text">Nuvem ativa</span>
      </div>
    );
  }

  return (
    <div
      className="cloud-sync-badge cloud-sync-badge--invite"
      title="Firebase pronto. Abra Definições e use Entrar com Google para guardar os dados financeiros na nuvem."
    >
      <span className="cloud-sync-badge__dot" aria-hidden />
      <span className="cloud-sync-badge__text">Nuvem · entrar</span>
    </div>
  );
}
