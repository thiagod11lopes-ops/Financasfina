import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useFinance } from "../context/FinanceContext";
import type { FixedAccount, Movement, VariableAccount, VariableSpend } from "../types";
import { IconChevronDown, IconEdit, IconPlus, IconTrash, IconX } from "./Icons";
import { formatBRL, formatShortDate, parseMoney, variableSpendTitleForDate } from "../utils/format";

type Seg = "fixed" | "variable";

export function AccountsView({ visible = true }: { visible?: boolean }) {
  const {
    state,
    addFixedAccount,
    updateFixedAccount,
    removeFixedAccount,
    addMovement,
    removeMovement,
    addVariableAccount,
    updateVariableAccount,
    removeVariableAccount,
    addVariableSpend,
    removeVariableSpend,
  } = useFinance();

  const [seg, setSeg] = useState<Seg>("fixed");

  const [fName, setFName] = useState("");
  const [fAmount, setFAmount] = useState("");
  const [fNotes, setFNotes] = useState("");
  const [fixedFormOpen, setFixedFormOpen] = useState(false);

  const [vName, setVName] = useState("");
  const [vLimit, setVLimit] = useState("");
  const [vNotes, setVNotes] = useState("");
  const [variableFormOpen, setVariableFormOpen] = useState(false);

  function addFixed(e: FormEvent) {
    e.preventDefault();
    const monthlyAmount = parseMoney(fAmount);
    if (!fName.trim() || monthlyAmount <= 0) return;
    addFixedAccount({
      name: fName.trim(),
      monthlyAmount,
      notes: fNotes.trim() || undefined,
    });
    setFName("");
    setFAmount("");
    setFNotes("");
    setFixedFormOpen(false);
  }

  function addVariable(e: FormEvent) {
    e.preventDefault();
    if (!vName.trim()) return;
    const budgetLimit = vLimit.trim() ? parseMoney(vLimit) : undefined;
    addVariableAccount({
      name: vName.trim(),
      budgetLimit: budgetLimit && budgetLimit > 0 ? budgetLimit : undefined,
      notes: vNotes.trim() || undefined,
    });
    setVName("");
    setVLimit("");
    setVNotes("");
    setVariableFormOpen(false);
  }

  return (
    <>
      <div className="seg">
        <button
          type="button"
          className={seg === "fixed" ? "active" : ""}
          onClick={() => setSeg("fixed")}
        >
          Fixas
        </button>
        <button
          type="button"
          className={seg === "variable" ? "active" : ""}
          onClick={() => setSeg("variable")}
        >
          Variáveis
        </button>
      </div>

      {seg === "fixed" && (
        <>
          <div className="card card--collapsible">
            <div className="card-expand-head">
              <h3 id="fx-new-heading" className="card-expand-title">
                Nova conta fixa
              </h3>
              <button
                type="button"
                className="card-expand-trigger"
                aria-expanded={fixedFormOpen}
                aria-controls="fx-new-form"
                onClick={() => setFixedFormOpen((o) => !o)}
                aria-label={fixedFormOpen ? "Ocultar formulário" : "Expandir formulário"}
              >
                <IconChevronDown
                  className={fixedFormOpen ? "is-open" : undefined}
                  aria-hidden
                />
              </button>
            </div>
            <div
              id="fx-new-form"
              className="card-expand-body"
              role="region"
              aria-labelledby="fx-new-heading"
              hidden={!fixedFormOpen}
            >
              <form onSubmit={addFixed}>
                <div className="form-row">
                  <label htmlFor="fx-name">Nome</label>
                  <input
                    id="fx-name"
                    className="input"
                    value={fName}
                    onChange={(e) => setFName(e.target.value)}
                    placeholder="Aluguel, internet, academia…"
                  />
                </div>
                <div className="form-row">
                  <label htmlFor="fx-val">Valor mensal (R$)</label>
                  <input
                    id="fx-val"
                    className="input"
                    inputMode="decimal"
                    value={fAmount}
                    onChange={(e) => setFAmount(e.target.value)}
                    placeholder="0,00"
                  />
                </div>
                <div className="form-row">
                  <label htmlFor="fx-notes">Observações (opcional)</label>
                  <input
                    id="fx-notes"
                    className="input"
                    value={fNotes}
                    onChange={(e) => setFNotes(e.target.value)}
                  />
                </div>
                <button type="submit" className="btn btn-primary">
                  Salvar conta fixa
                </button>
              </form>
            </div>
          </div>

          <div className="card">
            <h3 style={{ margin: "0 0 8px", fontSize: "0.95rem" }}>Suas contas fixas</h3>
            {state.fixedAccounts.length === 0 ? (
              <p className="empty">Nenhuma conta fixa cadastrada.</p>
            ) : (
              state.fixedAccounts.map((a) => (
                <FixedRow
                  key={a.id}
                  account={a}
                  onUpdate={updateFixedAccount}
                  onRemove={removeFixedAccount}
                  addMovement={addMovement}
                  removeMovement={removeMovement}
                />
              ))
            )}
          </div>
        </>
      )}

      {seg === "variable" && (
        <>
          <div className="card card--collapsible">
            <div className="card-expand-head">
              <h3 id="var-new-heading" className="card-expand-title">
                Nova conta variável
              </h3>
              <button
                type="button"
                className="card-expand-trigger"
                aria-expanded={variableFormOpen}
                aria-controls="var-new-form"
                onClick={() => setVariableFormOpen((o) => !o)}
                aria-label={variableFormOpen ? "Ocultar formulário" : "Expandir formulário"}
              >
                <IconChevronDown
                  className={variableFormOpen ? "is-open" : undefined}
                  aria-hidden
                />
              </button>
            </div>
            <div
              id="var-new-form"
              className="card-expand-body"
              role="region"
              aria-labelledby="var-new-heading"
              hidden={!variableFormOpen}
            >
              <form onSubmit={addVariable}>
                <div className="form-row">
                  <label htmlFor="vr-name">Nome</label>
                  <input
                    id="vr-name"
                    className="input"
                    value={vName}
                    onChange={(e) => setVName(e.target.value)}
                    placeholder="Lazer, presentes, roupas…"
                  />
                </div>
                <div className="form-row">
                  <label htmlFor="vr-limit">Teto mensal (opcional, R$)</label>
                  <input
                    id="vr-limit"
                    className="input"
                    inputMode="decimal"
                    value={vLimit}
                    onChange={(e) => setVLimit(e.target.value)}
                    placeholder="Deixe vazio se não quiser limite"
                  />
                </div>
                <div className="form-row">
                  <label htmlFor="vr-notes">Observações</label>
                  <input
                    id="vr-notes"
                    className="input"
                    value={vNotes}
                    onChange={(e) => setVNotes(e.target.value)}
                  />
                </div>
                <button type="submit" className="btn btn-primary">
                  Salvar conta variável
                </button>
              </form>
            </div>
          </div>

          <div className="card">
            <h3 style={{ margin: "0 0 8px", fontSize: "0.95rem" }}>Contas variáveis</h3>
            {state.variableAccounts.length === 0 ? (
              <p className="empty">Nenhuma conta variável.</p>
            ) : (
              state.variableAccounts.map((a) => (
                <VariableRow
                  key={a.id}
                  panelActive={visible}
                  account={a}
                  onUpdate={updateVariableAccount}
                  onRemove={removeVariableAccount}
                  addVariableSpend={addVariableSpend}
                  removeVariableSpend={removeVariableSpend}
                />
              ))
            )}
          </div>
        </>
      )}
    </>
  );
}

function FixedRow({
  account,
  onUpdate,
  onRemove,
  addMovement,
  removeMovement,
}: {
  account: FixedAccount;
  onUpdate: (id: string, p: Partial<FixedAccount>) => void;
  onRemove: (id: string) => void;
  addMovement: (m: Omit<Movement, "id">) => string;
  removeMovement: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(account.name);
  const [amount, setAmount] = useState(String(account.monthlyAmount).replace(".", ","));

  if (editing) {
    return (
      <div className="list-item" style={{ flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 100%", display: "flex", flexDirection: "column", gap: 8 }}>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          <input
            className="input"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              const v = parseMoney(amount);
              if (name.trim() && v > 0) {
                onUpdate(account.id, { name: name.trim(), monthlyAmount: v });
                setEditing(false);
              }
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
        <h4>{account.name}</h4>
        <small>{account.notes || "Recorrente todo mês"}</small>
      </div>
      <div style={{ textAlign: "right" }}>
        <div className="amount expense">{formatBRL(account.monthlyAmount)}</div>
        <div className="fixed-row-actions">
          <label className="inline-checkbox" htmlFor={`fx-flow-${account.id}`} title="No fluxo de saídas">
            <input
              id={`fx-flow-${account.id}`}
              type="checkbox"
              checked={account.inFlow ?? false}
              onChange={(e) => {
                const next = e.target.checked;
                if (next && !account.inFlow) {
                  const movementId = account.linkedMovementId ?? addMovement({
                    kind: "expense",
                    amount: account.monthlyAmount,
                    title: account.name,
                    date: new Date().toISOString().slice(0, 10),
                    nature: "fixed",
                  });
                  onUpdate(account.id, { inFlow: true, linkedMovementId: movementId });
                  return;
                }
                if (!next) {
                  if (account.linkedMovementId) removeMovement(account.linkedMovementId);
                  onUpdate(account.id, { inFlow: false, linkedMovementId: undefined });
                }
              }}
              aria-label="Lançar no fluxo de saídas"
            />
          </label>
          <button
            type="button"
            className="icon-btn icon-btn--ghost"
            onClick={() => setEditing(true)}
            aria-label="Editar conta fixa"
            title="Editar"
          >
            <IconEdit aria-hidden />
          </button>
          <button
            type="button"
            className="icon-btn icon-btn--danger"
            onClick={() => onRemove(account.id)}
            aria-label="Excluir conta fixa"
            title="Excluir"
          >
            <IconTrash aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}

function variableSpendToneClass(
  spendTotal: number,
  budgetLimit?: number,
): "var-spend--blue" | "var-spend--orange" | "var-spend--red" {
  if (budgetLimit == null || budgetLimit <= 0) return "var-spend--blue";
  if (spendTotal >= budgetLimit) return "var-spend--red";
  if (budgetLimit - spendTotal <= 100) return "var-spend--orange";
  return "var-spend--blue";
}

function VariableRow({
  panelActive,
  account,
  onUpdate,
  onRemove,
  addVariableSpend,
  removeVariableSpend,
}: {
  panelActive: boolean;
  account: VariableAccount;
  onUpdate: (id: string, p: Partial<VariableAccount>) => void;
  onRemove: (id: string) => void;
  addVariableSpend: (accountId: string, e: Omit<VariableSpend, "id">) => void;
  removeVariableSpend: (accountId: string, spendId: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [spendOpen, setSpendOpen] = useState(false);
  const [name, setName] = useState(account.name);
  const [limit, setLimit] = useState(
    account.budgetLimit != null ? String(account.budgetLimit).replace(".", ",") : "",
  );

  const spendTotal = useMemo(
    () => (account.spends ?? []).reduce((a, s) => a + s.amount, 0),
    [account.spends],
  );

  const spendTone = useMemo(
    () => variableSpendToneClass(spendTotal, account.budgetLimit),
    [spendTotal, account.budgetLimit],
  );

  useEffect(() => {
    if (!panelActive) {
      setSpendOpen(false);
      setEditing(false);
    }
  }, [panelActive]);

  if (editing) {
    return (
      <div className="list-item">
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          <input
            className="input"
            inputMode="decimal"
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
            placeholder="Teto (opcional)"
          />
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              if (!name.trim()) return;
              const lim = limit.trim() ? parseMoney(limit) : undefined;
              onUpdate(account.id, {
                name: name.trim(),
                budgetLimit: lim && lim > 0 ? lim : undefined,
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
        <h4>{account.name}</h4>
        <small>
          {account.budgetLimit != null ? (
            <>
              Teto: {formatBRL(account.budgetLimit)} · Gasto:{" "}
              <span className={spendTone}>{formatBRL(spendTotal)}</span>
            </>
          ) : (
            <>
              Gasto: <span className="var-spend--blue">{formatBRL(spendTotal)}</span>
            </>
          )}
          {account.notes ? ` · ${account.notes}` : ""}
        </small>
      </div>
      <div style={{ textAlign: "right" }}>
        <span className="badge variable">variável</span>
        <div className="fixed-row-actions" style={{ marginTop: 8 }}>
          <button
            type="button"
            className="icon-btn icon-btn--plus"
            onClick={() => setSpendOpen(true)}
            aria-label="Adicionar gasto"
            title="Adicionar gasto"
          >
            <IconPlus aria-hidden />
          </button>
          <button
            type="button"
            className="icon-btn icon-btn--ghost"
            onClick={() => setEditing(true)}
            aria-label="Editar conta variável"
            title="Editar"
          >
            <IconEdit aria-hidden />
          </button>
          <button
            type="button"
            className="icon-btn icon-btn--danger"
            onClick={() => onRemove(account.id)}
            aria-label="Excluir conta variável"
            title="Excluir"
          >
            <IconTrash aria-hidden />
          </button>
        </div>
      </div>
      <VariableSpendModal
        account={account}
        open={spendOpen}
        onClose={() => setSpendOpen(false)}
        addVariableSpend={addVariableSpend}
        removeVariableSpend={removeVariableSpend}
      />
    </div>
  );
}

function VariableSpendModal({
  account,
  open,
  onClose,
  addVariableSpend,
  removeVariableSpend,
}: {
  account: VariableAccount;
  open: boolean;
  onClose: () => void;
  addVariableSpend: (accountId: string, e: Omit<VariableSpend, "id">) => void;
  removeVariableSpend: (accountId: string, spendId: string) => void;
}) {
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));

  useEffect(() => {
    if (open) {
      setAmount("");
      setDate(new Date().toISOString().slice(0, 10));
    }
  }, [open, account.id]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const spends = useMemo(
    () =>
      [...(account.spends ?? [])].sort((a, b) =>
        a.date < b.date ? 1 : a.date > b.date ? -1 : 0,
      ),
    [account.spends],
  );

  const total = useMemo(
    () => spends.reduce((a, s) => a + s.amount, 0),
    [spends],
  );

  const overBudget =
    account.budgetLimit != null && total > account.budgetLimit;

  function submit(e: FormEvent) {
    e.preventDefault();
    const v = parseMoney(amount);
    if (v <= 0) return;
    addVariableSpend(account.id, {
      title: variableSpendTitleForDate(date),
      amount: v,
      date,
    });
    setAmount("");
    setDate(new Date().toISOString().slice(0, 10));
  }

  if (!open) return null;

  return (
    <div className="modal-backdrop modal-backdrop--fullscreen" role="presentation">
      <div
        className="modal-panel modal-panel--fullscreen"
        role="dialog"
        aria-modal="true"
        aria-labelledby="var-spend-title"
        onClick={(ev) => ev.stopPropagation()}
      >
        <div className="modal-head modal-head--fullscreen">
          <div className="modal-head__text">
            <h2 id="var-spend-title">Gastos · {account.name}</h2>
            <p>
              {account.budgetLimit != null
                ? `Teto ${formatBRL(account.budgetLimit)} · Total ${formatBRL(total)}`
                : `Total: ${formatBRL(total)}`}
              {overBudget ? (
                <span style={{ display: "block", color: "#f87171", marginTop: 6 }}>
                  Acima do teto em {formatBRL(total - account.budgetLimit!)}.
                </span>
              ) : null}
            </p>
          </div>
          <button
            type="button"
            className="modal-close modal-close--fullscreen"
            onClick={onClose}
            aria-label="Fechar"
          >
            <IconX aria-hidden />
          </button>
        </div>
        <div className="modal-body">
          <div className="modal-form-block">
            <p className="modal-section-title">Novo gasto</p>
            <form
              onSubmit={submit}
              className="card"
              style={{
                marginBottom: 0,
                background: "rgba(3, 7, 18, 0.55)",
                padding: 14,
              }}
            >
              <div className="form-row">
                <label htmlFor={`vs-amount-${account.id}`}>Valor (R$)</label>
                <input
                  id={`vs-amount-${account.id}`}
                  className="input"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0,00"
                />
              </div>
              <div className="form-row">
                <label htmlFor={`vs-date-${account.id}`}>Data</label>
                <input
                  id={`vs-date-${account.id}`}
                  className="input"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
              <button type="submit" className="btn btn-primary">
                Adicionar gasto
              </button>
            </form>
          </div>

          <div
            className="modal-list-scroll"
            role="region"
            aria-label={`Gastos salvos, ${spends.length} itens`}
          >
            <p className="modal-section-title" style={{ marginTop: 0 }}>
              Gastos salvos ({spends.length})
            </p>
            {spends.length === 0 ? (
              <p className="empty" style={{ padding: "12px 0 8px" }}>
                Nenhum gasto nesta conta ainda.
              </p>
            ) : (
              <ul className="modal-list">
                {spends.map((s) => (
                  <li key={s.id}>
                    <div className="meta">
                      <strong>{s.title}</strong>
                      <small>
                        {formatShortDate(s.date)}
                        {s.notes ? ` · ${s.notes}` : ""}
                      </small>
                    </div>
                    <span className="amount expense" style={{ flexShrink: 0 }}>
                      {formatBRL(s.amount)}
                    </span>
                    <button
                      type="button"
                      className="icon-btn icon-btn--danger"
                      onClick={() => removeVariableSpend(account.id, s.id)}
                      aria-label="Excluir gasto"
                      title="Excluir"
                    >
                      <IconTrash aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
