import { useState } from "react";
import { getAbsoluteAppUrl, PWA_IOS_LOGIN_MESSAGE } from "../utils/pwa";

/** Ajuda para login no iPhone quando o app foi aberto pelo ícone no ecrã inicial. */
export function PwaSafariLoginLink({ className }: { className?: string }) {
  const url = getAbsoluteAppUrl();
  const [copied, setCopied] = useState(false);

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="pwa-safari-login-hint">
      <p className="login-prompt-modal__error" role="note">
        {PWA_IOS_LOGIN_MESSAGE}
      </p>
      <p className="settings-muted">
        Abra a app <strong>Safari</strong> no iPhone, cole o endereço na barra de endereços e faça
        login lá. O ícone no ecrã inicial não partilha a sessão com o Safari.
      </p>
      <div className="pwa-safari-login-hint__actions">
        <button type="button" className="settings-btn settings-btn--outline" onClick={() => void copyUrl()}>
          {copied ? "Endereço copiado" : "Copiar endereço"}
        </button>
        <a
          href={url}
          className={className ?? "settings-btn settings-btn--primary"}
        >
          Abrir no browser
        </a>
      </div>
    </div>
  );
}
