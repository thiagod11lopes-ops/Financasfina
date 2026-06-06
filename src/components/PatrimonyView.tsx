import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useFinance } from "../context/FinanceContext";
import { DASH_TABS_SYNC_EVENT, loadDashboardTabs } from "../dashboardTabs";
import { computeMonthDashboardBalance, formatBRL, formatMonthLabelPt, parseMoney } from "../utils/format";
import { IconChevronDown, IconEdit, IconTrash } from "./Icons";
import type { PatrimonyAsset } from "../types";

function PatrimonyRow({
  asset,
  onUpdate,
  onRemove,
}: {
  asset: PatrimonyAsset;
  onUpdate: (id: string, patch: Partial<PatrimonyAsset>) => void;
  onRemove: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(asset.name);
  const [value, setValue] = useState(String(asset.value).replace(".", ","));
  const [notes, setNotes] = useState(asset.notes ?? "");

  if (editing) {
    return (
      <div className="list-item" style={{ flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 100%", display: "flex", flexDirection: "column", gap: 8 }}>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome" />
          <input
            className="input"
            inputMode="decimal"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Valor (R$)"
          />
          <input
            className="input"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Observações (opcional)"
          />
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              const v = parseMoney(value);
              if (!name.trim() || v < 0) return;
              onUpdate(asset.id, {
                name: name.trim(),
                value: v,
                notes: notes.trim() || undefined,
              });
              setEditing(false);
            }}
          >
            OK
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => setEditing(false)}>
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="list-item">
      <div className="list-item-meta">
        <h4>{asset.name}</h4>
        <small>{asset.notes || "Saldo em outro lugar"}</small>
      </div>
      <div className="list-item-amount-actions">
        <div className="amount income">{formatBRL(asset.value)}</div>
        <button
          type="button"
          className="icon-btn icon-btn--ghost"
          onClick={() => setEditing(true)}
          aria-label="Editar saldo"
          title="Editar"
        >
          <IconEdit aria-hidden />
        </button>
        <button
          type="button"
          className="icon-btn icon-btn--danger"
          onClick={() => onRemove(asset.id)}
          aria-label="Excluir saldo"
          title="Excluir"
        >
          <IconTrash aria-hidden />
        </button>
      </div>
    </div>
  );
}

export function PatrimonyView() {
  const { state, addPatrimonyAsset, updatePatrimonyAsset, removePatrimonyAsset } = useFinance();
  const [activeMonth, setActiveMonth] = useState(() => loadDashboardTabs().active);
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState("");
  const [value, setValue] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    const sync = () => setActiveMonth(loadDashboardTabs().active);
    window.addEventListener(DASH_TABS_SYNC_EVENT, sync);
    return () => window.removeEventListener(DASH_TABS_SYNC_EVENT, sync);
  }, []);

  const systemBalance = useMemo(
    () => computeMonthDashboardBalance(state, activeMonth),
    [state, activeMonth],
  );

  const externalTotal = useMemo(
    () => state.patrimonyAssets.reduce((a, x) => a + x.value, 0),
    [state.patrimonyAssets],
  );

  const patrimonyTotal = systemBalance + externalTotal;

  function submit(e: FormEvent) {
    e.preventDefault();
    const v = parseMoney(value);
    if (!name.trim() || v < 0) return;
    addPatrimonyAsset({
      name: name.trim(),
      value: v,
      notes: notes.trim() || undefined,
    });
    setName("");
    setValue("");
    setNotes("");
    setFormOpen(false);
  }

  return (
    <>
      <div className="accounts-seg-hint" role="note" aria-label="Sobre o patrimônio">
        <p>
          O <strong>saldo atual do sistema</strong> vem do Início (fluxo do mês). Adicione saldos em{" "}
          <strong>outros lugares</strong> — investimentos, cofrinhos, poupanças — para ver o patrimônio completo.
        </p>
      </div>

      <div className="card card-glow">
        <span className="badge">Patrimônio total</span>
        <p
          style={{
            margin: "12px 0 0",
            fontFamily: "var(--font-mono)",
            fontSize: "1.75rem",
            fontWeight: 600,
            color: patrimonyTotal >= 0 ? "var(--income)" : "var(--expense)",
          }}
        >
          {formatBRL(patrimonyTotal)}
        </p>
        <p style={{ margin: "8px 0 0", fontSize: "0.75rem", color: "var(--text-muted)" }}>
          Sistema {formatBRL(systemBalance)} + outros lugares {formatBRL(externalTotal)}
        </p>
      </div>

      <div className="card">
        <h3 style={{ margin: "0 0 8px", fontSize: "0.95rem" }}>Composição</h3>
        <div className="list-item patrimony-system-row">
          <div className="list-item-meta">
            <h4>Saldo atual do sistema</h4>
            <small>
              Mês de {formatMonthLabelPt(activeMonth)} · calculado pelo fluxo, mercado e combustível
            </small>
          </div>
          <div style={{ textAlign: "right" }}>
            <span className="badge fixed">Sistema</span>
            <div
              className={systemBalance >= 0 ? "amount income" : "amount expense"}
              style={{ marginTop: 8 }}
            >
              {formatBRL(systemBalance)}
            </div>
          </div>
        </div>
      </div>

      <div className="card card--collapsible">
        <div className="card-expand-head">
          <h3 id="pat-new-heading" className="card-expand-title">
            Novo saldo em outro lugar
          </h3>
          <button
            type="button"
            className="card-expand-trigger"
            aria-expanded={formOpen}
            aria-controls="pat-new-form"
            onClick={() => setFormOpen((o) => !o)}
            aria-label={formOpen ? "Ocultar formulário" : "Expandir formulário"}
          >
            <IconChevronDown className={formOpen ? "is-open" : undefined} aria-hidden />
          </button>
        </div>
        <div
          id="pat-new-form"
          className="card-expand-body"
          role="region"
          aria-labelledby="pat-new-heading"
          hidden={!formOpen}
        >
          <form onSubmit={submit}>
            <div className="form-row">
              <label htmlFor="pat-name">Nome</label>
              <input
                id="pat-name"
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex.: poupança, cofrinho, ações, CDB…"
              />
            </div>
            <div className="form-row">
              <label htmlFor="pat-value">Valor (R$)</label>
              <input
                id="pat-value"
                className="input"
                inputMode="decimal"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="0,00"
              />
            </div>
            <div className="form-row">
              <label htmlFor="pat-notes">Observações</label>
              <input
                id="pat-notes"
                className="input"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Opcional"
              />
            </div>
            <button type="submit" className="btn btn-primary">
              Adicionar saldo
            </button>
          </form>
        </div>
      </div>

      <div className="card">
        <h3 style={{ margin: "0 0 8px", fontSize: "0.95rem" }}>Outros saldos</h3>
        {state.patrimonyAssets.length === 0 ? (
          <p className="empty">Nenhum saldo externo cadastrado.</p>
        ) : (
          state.patrimonyAssets.map((a) => (
            <PatrimonyRow
              key={a.id}
              asset={a}
              onUpdate={updatePatrimonyAsset}
              onRemove={removePatrimonyAsset}
            />
          ))
        )}
      </div>
    </>
  );
}
