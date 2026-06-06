import { useEffect } from "react";
import { formatBRL } from "../utils/format";
import { IconX } from "./Icons";

type Props = {
  open: boolean;
  accountName: string;
  currentAmount: number;
  newAmount: number;
  onCancel: () => void;
  onConfirm: () => void;
};

export function FixedAmountOverrideModal({
  open,
  accountName,
  currentAmount,
  newAmount,
  onCancel,
  onConfirm,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="modal-backdrop fixed-amount-backdrop"
      role="presentation"
      onClick={onCancel}
    >
      <div
        className="modal-panel fixed-amount-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="fixed-amount-title"
        aria-describedby="fixed-amount-desc"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <div className="modal-head__text">
            <h2 id="fixed-amount-title">Valor acima do fixo</h2>
            <p id="fixed-amount-desc">
              O gasto de <strong>{formatBRL(newAmount)}</strong> em{" "}
              <strong>{accountName}</strong> é maior que o valor fixo cadastrado (
              {formatBRL(currentAmount)}).
            </p>
          </div>
          <button type="button" className="modal-close" onClick={onCancel} aria-label="Fechar">
            <IconX aria-hidden />
          </button>
        </div>
        <div className="fixed-amount-modal__body">
          <p className="fixed-amount-modal__question">
            Deseja atualizar o valor fixo para <strong>{formatBRL(newAmount)}</strong> e lançar o
            gasto?
          </p>
          <div className="fixed-amount-modal__compare">
            <div className="fixed-amount-modal__compare-item">
              <span>Valor fixo atual</span>
              <strong>{formatBRL(currentAmount)}</strong>
            </div>
            <span className="fixed-amount-modal__compare-arrow" aria-hidden>
              →
            </span>
            <div className="fixed-amount-modal__compare-item fixed-amount-modal__compare-item--new">
              <span>Novo valor fixo</span>
              <strong>{formatBRL(newAmount)}</strong>
            </div>
          </div>
          <div className="fixed-amount-modal__actions">
            <button type="button" className="btn btn-ghost" onClick={onCancel}>
              Cancelar
            </button>
            <button type="button" className="btn btn-primary fixed-amount-modal__confirm" onClick={onConfirm}>
              Atualizar e lançar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
