import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../firebase/AuthProvider";
import {
  clearGoogleRedirectPending,
  isGoogleRedirectPending,
  markGoogleRedirectPending,
} from "../firebase/loginRedirectState";

const DISMISS_KEY = "financas-login-prompt-dismissed";

export function useGoogleLoginPrompt(): {
  open: boolean;
  dismiss: () => void;
} {
  const { configured, ready, authInitializing, user } = useAuth();
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return sessionStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [redirectPending, setRedirectPending] = useState(isGoogleRedirectPending);

  useEffect(() => {
    if (user) {
      clearGoogleRedirectPending();
      setRedirectPending(false);
      return;
    }
    setRedirectPending(isGoogleRedirectPending());
  }, [user]);

  const dismiss = useCallback(() => {
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* */
    }
    setDismissed(true);
  }, []);

  const open =
    configured &&
    ready &&
    !authInitializing &&
    !redirectPending &&
    !user &&
    !dismissed;

  return { open, dismiss };
}

export function GoogleLoginPromptModal({
  open,
  onDismiss,
}: {
  open: boolean;
  onDismiss: () => void;
}) {
  const { signInWithGoogle, lastError } = useAuth();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onDismiss]);

  if (!open) return null;

  async function handleSignIn() {
    setBusy(true);
    markGoogleRedirectPending();
    try {
      await signInWithGoogle();
    } catch {
      clearGoogleRedirectPending();
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop login-prompt-backdrop" role="presentation">
      <div
        className="modal-panel login-prompt-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="login-prompt-title"
        aria-describedby="login-prompt-desc"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <div className="modal-head__text">
            <h2 id="login-prompt-title">Entre com Google</h2>
            <p id="login-prompt-desc" className="login-prompt-modal__lead">
              Para guardar os seus dados na nuvem e aceder-lhes em qualquer aparelho, inicie sessão
              com a sua conta Google. No iPhone (Safari), o browser abre a página da Google e volta ao
              app — isso é normal.
            </p>
          </div>
        </div>

        <div className="login-prompt-modal__body">
          <div className="login-prompt-warning" role="note">
            <p>
              <strong>Atenção:</strong> sem login, os dados ficam apenas neste navegador. Podem ser{" "}
              <strong>perdidos</strong> se limpar o histórico, trocar de telemóvel ou reinstalar o
              browser — e <strong>não poderá aceder-lhes noutro local</strong>.
            </p>
          </div>

          {lastError ? <p className="login-prompt-modal__error">{lastError}</p> : null}

          <button
            type="button"
            className="settings-btn settings-btn--primary"
            disabled={busy}
            onClick={() => void handleSignIn()}
          >
            {busy ? "A redirecionar para Google…" : "Entrar com Google"}
          </button>
          <button
            type="button"
            className="settings-btn settings-btn--outline"
            disabled={busy}
            onClick={onDismiss}
          >
            Continuar sem entrar
          </button>
        </div>
      </div>
    </div>
  );
}
