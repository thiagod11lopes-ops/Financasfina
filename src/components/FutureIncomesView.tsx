import { useCallback, useMemo, useState, type FormEvent } from "react";
import { useFinance } from "../context/FinanceContext";
import {
  digitsToDateBrDisplay,
  formatBRL,
  formatDateBr,
  formatShortDate,
  parseDateBrToIso,
  parseMoney,
} from "../utils/format";
import { IconChevronDown, IconTrash } from "./Icons";

export function FutureIncomesView() {
  const { state, addFutureIncome, markFutureIncomeReceived, markFutureIncomePending, removeFutureIncome } =
    useFinance();
  const [newFormOpen, setNewFormOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [title, setTitle] = useState("");
  const [expectedDateBr, setExpectedDateBr] = useState(() =>
    formatDateBr(new Date().toISOString().slice(0, 10)),
  );
  const [dateError, setDateError] = useState("");

  const sorted = useMemo(() => {
    return [...state.futureIncomes].sort((a, b) => {
      if (a.received !== b.received) return a.received ? 1 : -1;
      return 0;
    });
  }, [state.futureIncomes]);

  const submit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      const v = parseMoney(amount);
      if (!title.trim() || v <= 0) return;
      const iso = parseDateBrToIso(expectedDateBr);
      if (!iso) {
        setDateError("Informe a data no formato DD/MM/AAAA.");
        return;
      }
      setDateError("");
      addFutureIncome({
        amount: v,
        title: title.trim(),
        expectedDate: iso,
      });
      setAmount("");
      setTitle("");
      setExpectedDateBr(formatDateBr(new Date().toISOString().slice(0, 10)));
      setNewFormOpen(false);
    },
    [amount, title, expectedDateBr, addFutureIncome],
  );

  return (
    <>
      <div className="card card--collapsible card-glow">
        <div className="card-expand-head">
          <h3 id="fi-new-heading" className="card-expand-title">
            Nova entrada futura
          </h3>
          <button
            type="button"
            className="card-expand-trigger"
            aria-expanded={newFormOpen}
            aria-controls="fi-new-form"
            onClick={() => setNewFormOpen((o) => !o)}
            aria-label={newFormOpen ? "Ocultar formulário" : "Expandir formulário"}
          >
            <IconChevronDown className={newFormOpen ? "is-open" : undefined} aria-hidden />
          </button>
        </div>
        <div
          id="fi-new-form"
          className="card-expand-body"
          role="region"
          aria-labelledby="fi-new-heading"
          hidden={!newFormOpen}
        >
          <form onSubmit={submit}>
            <span className="badge">Valor, data e descrição</span>
            <div className="form-row" style={{ marginTop: 12 }}>
              <label htmlFor="fi-amount">Valor a receber (R$)</label>
              <input
                id="fi-amount"
                className="input"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0,00"
              />
            </div>
            <div className="form-row">
              <label htmlFor="fi-date">Data prevista de entrada</label>
              <input
                id="fi-date"
                className="input"
                inputMode="numeric"
                autoComplete="off"
                placeholder="DD/MM/AAAA"
                value={expectedDateBr}
                onChange={(e) => {
                  setDateError("");
                  setExpectedDateBr(digitsToDateBrDisplay(e.target.value));
                }}
                onBlur={() => {
                  const iso = parseDateBrToIso(expectedDateBr);
                  if (iso) setExpectedDateBr(formatDateBr(iso));
                }}
                aria-invalid={dateError ? true : undefined}
                aria-describedby={dateError ? "fi-date-error" : undefined}
              />
              {dateError ? (
                <p id="fi-date-error" className="form-field-error" role="alert">
                  {dateError}
                </p>
              ) : null}
            </div>
            <div className="form-row">
              <label htmlFor="fi-title">Descrição</label>
              <input
                id="fi-title"
                className="input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex.: 13º salário, reembolso cliente…"
                enterKeyHint="done"
              />
            </div>
            <button type="submit" className="btn btn-primary">
              Adicionar à lista
            </button>
          </form>
        </div>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <h3 style={{ margin: "0 0 12px", fontSize: "0.95rem" }}>Suas entradas futuras</h3>
        {sorted.length === 0 ? (
          <p className="empty">Nenhuma entrada futura cadastrada.</p>
        ) : (
          sorted.map((e) => (
            <div key={e.id} className={`list-item future-income-row ${e.received ? "is-received" : ""}`}>
              <label className="future-income-check">
                <input
                  type="checkbox"
                  checked={e.received}
                  onChange={() => {
                    if (e.received) markFutureIncomePending(e.id);
                    else markFutureIncomeReceived(e.id);
                  }}
                  aria-label={
                    e.received
                      ? "Desmarcar recebido e remover do fluxo"
                      : "Marcar como recebido e somar ao saldo"
                  }
                />
              </label>
              <div className="list-item-meta" style={{ flex: 1, minWidth: 0 }}>
                <h4>{e.title}</h4>
                <small>
                  {e.received && e.receivedAt ? (
                    <>Recebido em {formatShortDate(e.receivedAt)}</>
                  ) : e.expectedDate ? (
                    <>Previsto para {formatShortDate(e.expectedDate)} · marque ao receber</>
                  ) : (
                    "Pendente · marque ao receber"
                  )}
                </small>
              </div>
              <div className="future-income-actions-right">
                <div className="amount income">+{formatBRL(e.amount)}</div>
                <button
                  type="button"
                  className="icon-btn icon-btn--danger"
                  onClick={() => {
                    if (
                      e.received &&
                      !window.confirm(
                        "Excluir esta entrada e remover o lançamento correspondente no fluxo?",
                      )
                    ) {
                      return;
                    }
                    removeFutureIncome(e.id);
                  }}
                  aria-label={e.received ? "Excluir entrada e lançamento no fluxo" : "Excluir entrada futura"}
                  title="Excluir"
                >
                  <IconTrash aria-hidden />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
}
