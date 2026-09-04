type Props = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = "Excluir",
  onConfirm,
  onCancel,
}: Props) {
  if (!open) return null;
  return (
    <div className="vaq-modal-backdrop" role="presentation" onClick={onCancel}>
      <div
        className="vaq-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="vaq-confirm-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="vaq-confirm-title" className="vaq-modal__title">
          {title}
        </h2>
        <p className="vaq-modal__text">{message}</p>
        <div className="vaq-modal__actions">
          <button type="button" className="vaq-btn vaq-btn--ghost" onClick={onCancel}>
            Cancelar
          </button>
          <button type="button" className="vaq-btn vaq-btn--danger" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}