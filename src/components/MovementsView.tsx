import { useMemo, useState } from "react";
import { useFinance } from "../context/FinanceContext";
import type { MovementKind } from "../types";
import { formatBRL, formatShortDate } from "../utils/format";
import { IconSearch, IconTrash } from "./Icons";

type KindFilter = "all" | MovementKind;

function matchesSearchQuery(title: string, dateIso: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (title.toLowerCase().includes(q)) return true;
  if (dateIso.toLowerCase().includes(q)) return true;
  const br = formatShortDate(dateIso).toLowerCase();
  return br.includes(q);
}

export function MovementsView() {
  const { state, removeMovement } = useFinance();
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const [search, setSearch] = useState("");

  const sorted = useMemo(
    () =>
      [...state.movements].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)),
    [state.movements],
  );

  const filtered = useMemo(() => {
    return sorted.filter((m) => {
      if (kindFilter !== "all" && m.kind !== kindFilter) return false;
      return matchesSearchQuery(m.title, m.date, search);
    });
  }, [sorted, kindFilter, search]);

  const hasAny = sorted.length > 0;
  const emptyBecauseFilter = hasAny && filtered.length === 0;

  return (
    <div className="card">
      <h3 style={{ margin: "0 0 8px", fontSize: "0.95rem" }}>Histórico</h3>
      {hasAny ? (
        <div className="history-filters">
          <div className="history-kind-tabs" role="tablist" aria-label="Tipo de lançamento">
            <button
              type="button"
              role="tab"
              aria-selected={kindFilter === "all"}
              className={kindFilter === "all" ? "is-active" : ""}
              onClick={() => setKindFilter("all")}
            >
              Todos
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={kindFilter === "income"}
              className={kindFilter === "income" ? "is-active income-tab" : ""}
              onClick={() => setKindFilter("income")}
            >
              Entrada
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={kindFilter === "expense"}
              className={kindFilter === "expense" ? "is-active expense-tab" : ""}
              onClick={() => setKindFilter("expense")}
            >
              Saída
            </button>
          </div>
          <label className="history-search">
            <IconSearch aria-hidden />
            <input
              type="search"
              className="input"
              placeholder="Localizar no histórico…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Localizar no histórico"
              autoComplete="off"
            />
          </label>
        </div>
      ) : null}
      {!hasAny ? (
        <p className="empty">Nenhum lançamento ainda.</p>
      ) : emptyBecauseFilter ? (
        <p className="empty">Nenhum lançamento corresponde aos filtros.</p>
      ) : (
        filtered.map((m) => (
          <div key={m.id} className="list-item">
            <div className="list-item-meta">
              <h4>{m.title}</h4>
              <small>
                {formatShortDate(m.date)}
                {m.nature ? (
                  <>
                    {" · "}
                    <span className={`badge ${m.nature}`}>
                      {m.nature === "fixed" ? "fixa" : "variável"}
                    </span>
                  </>
                ) : null}
                {m.responsible ? <>{" · "}{m.responsible}</> : null}
              </small>
            </div>
            <div className="list-item-amount-actions">
              <div className={`amount ${m.kind}`}>
                {m.kind === "expense" ? "−" : "+"}
                {formatBRL(m.amount)}
              </div>
              <button
                type="button"
                className="icon-btn icon-btn--danger"
                onClick={() => removeMovement(m.id)}
                aria-label="Excluir lançamento"
                title="Excluir"
              >
                <IconTrash aria-hidden />
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
