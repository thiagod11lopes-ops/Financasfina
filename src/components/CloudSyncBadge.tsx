import { useAuth } from "../firebase/AuthProvider";
import { emailDisplayLabel } from "../utils/format";

/** Indicador fixo: estado da sincronização Firebase (dados financeiros). */
export function CloudSyncBadge() {
  const { configured, ready, authInitializing, user } = useAuth();

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

  if (!ready || authInitializing) {
    return (
      <div
        className="cloud-sync-badge cloud-sync-badge--wait"
        title={authInitializing ? "A concluir login com Google…" : "A verificar sessão…"}
      >
        <span className="cloud-sync-badge__dot cloud-sync-badge__dot--pulse" aria-hidden />
        <span className="cloud-sync-badge__text">
          {authInitializing ? "A concluir login…" : "A carregar…"}
        </span>
      </div>
    );
  }

  if (user) {
    return (
      <div
        className="cloud-sync-badge cloud-sync-badge--sync cloud-sync-badge--with-email"
        title="Sincronizado com o Firebase. Finanças, resumo, agenda e utilizadores seguem a última versão na nuvem (cópia local ao sair da conta)."
      >
        <div className="cloud-sync-badge__row">
          <span className="cloud-sync-badge__dot" aria-hidden />
          <span className="cloud-sync-badge__text">Nuvem ativa</span>
        </div>
        {user.email ? (
          <span className="cloud-sync-badge__email" title={user.email}>
            {emailDisplayLabel(user.email)}
          </span>
        ) : null}
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
