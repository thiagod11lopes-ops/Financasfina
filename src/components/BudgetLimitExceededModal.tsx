import { useEffect } from "react";
import { formatBRL } from "../utils/format";
import { expenseAccountKindTag, type ExpenseAccountKind } from "./expenseAccountPicker";
import { IconX } from "./Icons";

type Props = {
  open: boolean;
  accountName: string;
  kind: Extract<ExpenseAccountKind, "variable" | "recurring">;
  budgetLimit: number;
  monthSpent: number;
  newAmount: number;
  onCancel: () => void;
  onConfirm: () => void;
};

export function BudgetLimitExceededModal({
  open,
  accountName,
  kind,
  budgetLimit,
  monthSpent,
  newAmount,
  onCancel,
  onConfirm,
}: Props) {
  const totalAfter = monthSpent + newAmount;
  const overrun = totalAfter - budgetLimit;

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
      className="modal-backdrop budget-limit-backdrop"
      role="presentation"
      onClick={onCancel}
    >
      <div
        className="modal-panel budget-limit-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="budget-limit-title"
        aria-describedby="budget-limit-desc"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <div className="modal-head__text">
            <h2 id="budget-limit-title">Ultrapassagem do teto</h2>
            <p id="budget-limit-desc">
              O gasto de <strong>{formatBRL(newAmount)}</strong> em{" "}
              <strong>{accountName}</strong> ({expenseAccountKindTag(kind)}) ultrapassa o teto mensal
              de {formatBRL(budgetLimit)}.
            </p>
          </div>
          <button type="button" className="modal-close" onClick={onCancel} aria-label="Fechar">
            <IconX aria-hidden />
          </button>
        </div>
        <div className="budget-limit-modal__body">
          <div className="budget-limit-modal__stats">
            <div className="budget-limit-modal__stat">
              <span>Gasto no mês</span>
              <strong>{formatBRL(monthSpent)}</strong>
            </div>
            <div className="budget-limit-modal__stat">
              <span>+ Este lançamento</span>
              <strong>{formatBRL(newAmount)}</strong>
            </div>
            <div className="budget-limit-modal__stat budget-limit-modal__stat--total">
              <span>Total após lançar</span>
              <strong>{formatBRL(totalAfter)}</strong>
            </div>
            <div className="budget-limit-modal__stat budget-limit-modal__stat--over">
              <span>Acima do teto</span>
              <strong>{formatBRL(overrun)}</strong>
            </div>
          </div>
          <p className="budget-limit-modal__question">
            Deseja lançar o gasto mesmo assim?
          </p>
          <div className="budget-limit-modal__actions">
            <button type="button" className="btn btn-ghost" onClick={onCancel}>
              Cancelar
            </button>
            <button type="button" className="btn btn-primary budget-limit-modal__confirm" onClick={onConfirm}>
              Lançar mesmo assim
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
