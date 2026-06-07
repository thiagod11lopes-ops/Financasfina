import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../firebase/AuthProvider";
import { clearGoogleRedirectPending, isGoogleRedirectPending } from "../firebase/loginRedirectState";
import { PwaSafariLoginLink } from "./PwaSafariLoginLink";
import { shouldShowPwaSafariLoginHint } from "../utils/pwa";

const DISMISS_KEY = "financas-login-prompt-dismissed";
const REDIRECT_TIMEOUT_MS = 8_000;

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
  const [localError, setLocalError] = useState<string | null>(null);
  const showPwaHint = shouldShowPwaSafariLoginHint();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onDismiss]);

  useEffect(() => {
    if (!busy) return;
    const id = window.setTimeout(() => {
      setBusy(false);
      clearGoogleRedirectPending();
      setLocalError(
        "O login com a Google não abriu. Se abriu pelo ícone do telemóvel, copie o endereço e use o Safari. Caso contrário, tente de novo.",
      );
    }, REDIRECT_TIMEOUT_MS);
    return () => window.clearTimeout(id);
  }, [busy]);

  useEffect(() => {
    if (!open) {
      setBusy(false);
      setLocalError(null);
    }
  }, [open]);

  if (!open) return null;

  async function handleSignIn() {
    setLocalError(null);
    setBusy(true);
    try {
      await signInWithGoogle();
    } catch {
      clearGoogleRedirectPending();
    } finally {
      setBusy(false);
    }
  }

  const errorText = localError ?? lastError;

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
              com a sua conta Google.
              {showPwaHint
                ? " Abriu pelo ícone no ecrã inicial? Tente entrar abaixo; se não funcionar, use o Safari."
                : " No telemóvel pode abrir uma janela da Google — isso é normal."}
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

          {errorText ? <p className="login-prompt-modal__error">{errorText}</p> : null}

          <button
            type="button"
            className="settings-btn settings-btn--primary"
            disabled={busy}
            onClick={() => void handleSignIn()}
          >
            {busy ? "A abrir Google…" : "Entrar com Google"}
          </button>
          {showPwaHint && errorText ? <PwaSafariLoginLink /> : null}
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
