import { getAbsoluteAppUrl, PWA_IOS_LOGIN_MESSAGE } from "../utils/pwa";

/** Botão que abre o site no Safari (login Google no ícone PWA do iPhone). */
export function PwaSafariLoginLink({ className }: { className?: string }) {
  const url = getAbsoluteAppUrl();

  return (
    <>
      <p className="login-prompt-modal__error" role="note">
        {PWA_IOS_LOGIN_MESSAGE}
      </p>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={className ?? "settings-btn settings-btn--primary"}
      >
        Abrir no Safari
      </a>
    </>
  );
}
