import { useMemo, useState, type FormEvent } from "react";
import { useFinance } from "../context/FinanceContext";
import { formatBRL, formatShortDate, isInMonth, monthKey, parseMoney } from "../utils/format";
import { IconTrash } from "./Icons";

export function SupermarketView({ embedded = false }: { embedded?: boolean }) {
  const { state, addSupermarket, removeSupermarket } = useFinance();
  const [amount, setAmount] = useState("");
  const [store, setStore] = useState("");
  const [notes, setNotes] = useState("");

  const key = monthKey(new Date());
  const monthTotal = useMemo(
    () => state.supermarket.filter((s) => isInMonth(s.date, key)).reduce((a, s) => a + s.amount, 0),
    [state.supermarket, key],
  );

  function submit(e: FormEvent) {
    e.preventDefault();
    const v = parseMoney(amount);
    if (v <= 0) return;
    addSupermarket({
      amount: v,
      store: store.trim() || undefined,
      notes: notes.trim() || undefined,
      date: new Date().toISOString().slice(0, 10),
    });
    setAmount("");
    setStore("");
    setNotes("");
  }

  return (
    <>
      {!embedded && (
        <>
          <h1 className="page-title">Lista de compras</h1>
        </>
      )}

      <div className="card card-glow">
        <span className="badge">Total no mês</span>
        <p
          style={{
            margin: "12px 0 0",
            fontFamily: "var(--font-mono)",
            fontSize: "1.75rem",
            fontWeight: 600,
            color: "var(--expense)",
          }}
        >
          {formatBRL(monthTotal)}
        </p>
      </div>

      <form className="card" onSubmit={submit}>
        <h3 style={{ margin: "0 0 12px", fontSize: "0.95rem" }}>Nova compra</h3>
        <div className="form-row">
          <label htmlFor="sm-amount">Valor (R$)</label>
          <input
            id="sm-amount"
            className="input"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Total pago no caixa"
          />
        </div>
        <div className="form-row">
          <label htmlFor="sm-store">Mercado (opcional)</label>
          <input
            id="sm-store"
            className="input"
            value={store}
            onChange={(e) => setStore(e.target.value)}
            placeholder="Nome da rede ou loja"
          />
        </div>
        <div className="form-row">
          <label htmlFor="sm-notes">Observações</label>
          <input
            id="sm-notes"
            className="input"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
        <button type="submit" className="btn btn-primary">
          Registrar compra
        </button>
      </form>

      <div className="card">
        <h3 style={{ margin: "0 0 8px", fontSize: "0.95rem" }}>Histórico</h3>
        {state.supermarket.length === 0 ? (
          <p className="empty">Nenhuma compra registrada.</p>
        ) : (
          state.supermarket.map((s) => (
            <div key={s.id} className="list-item">
              <div className="list-item-meta">
                <h4>{s.store || "Compra"}</h4>
                <small>
                  {formatShortDate(s.date)}
                  {s.notes ? ` · ${s.notes}` : ""}
                </small>
              </div>
              <div className="list-item-amount-actions">
                <div className="amount expense">{formatBRL(s.amount)}</div>
                <button
                  type="button"
                  className="icon-btn icon-btn--danger"
                  onClick={() => removeSupermarket(s.id)}
                  aria-label="Excluir compra"
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
