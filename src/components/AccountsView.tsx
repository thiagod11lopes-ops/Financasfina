import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useFinance } from "../context/FinanceContext";
import type { FixedAccount, Movement, RecurringAccount, VariableAccount, VariableSpend } from "../types";
import { IconChevronDown, IconEdit, IconPlus, IconTrash } from "./Icons";
import {
  formatBRL,
  formatShortDate,
  isInMonth,
  monthKey,
  parseMoney,
  variableSpendTitleForDate,
} from "../utils/format";

type Seg = "fixed" | "variable" | "recurring";

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
    addRecurringAccount,
    updateRecurringAccount,
    removeRecurringAccount,
    addRecurringSpend,
    removeRecurringSpend,
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

  const [rName, setRName] = useState("");
  const [rLimit, setRLimit] = useState("");
  const [rNotes, setRNotes] = useState("");
  const [recurringFormOpen, setRecurringFormOpen] = useState(false);

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

  function addRecurring(e: FormEvent) {
    e.preventDefault();
    if (!rName.trim()) return;
    const budgetLimit = rLimit.trim() ? parseMoney(rLimit) : undefined;
    addRecurringAccount({
      name: rName.trim(),
      budgetLimit: budgetLimit && budgetLimit > 0 ? budgetLimit : undefined,
      notes: rNotes.trim() || undefined,
    });
    setRName("");
    setRLimit("");
    setRNotes("");
    setRecurringFormOpen(false);
  }

  return (
    <>
      <div className="seg seg--triple">
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
        <button
          type="button"
          className={seg === "recurring" ? "active" : ""}
          onClick={() => setSeg("recurring")}
        >
          Recorrentes
        </button>
      </div>

      {seg === "fixed" && (
        <>
          <div className="accounts-seg-hint" role="note" aria-label="Sobre contas fixas">
            <p>
              Despesas <strong>mensais fixas</strong> com <strong>valor que não muda</strong>.
            </p>
          </div>

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
          <div className="accounts-seg-hint" role="note" aria-label="Sobre contas variáveis">
            <p>
              Defina o <strong>teto do gasto</strong> (valor máximo). O gasto real pode variar e, em alguns casos,{" "}
              <strong>ultrapassar o teto</strong>.
            </p>
          </div>

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

      {seg === "recurring" && (
        <>
          <div className="accounts-seg-hint" role="note" aria-label="Sobre contas recorrentes">
            <p>
              Defina o <strong>teto do gasto</strong> (valor máximo). Use o <strong>+</strong> para lançar cada gasto;
              no mês os valores <strong>se somam</strong> e podem ultrapassar o teto.
            </p>
          </div>

          <div className="card card--collapsible">
            <div className="card-expand-head">
              <h3 id="rec-new-heading" className="card-expand-title">
                Nova conta recorrente
              </h3>
              <button
                type="button"
                className="card-expand-trigger"
                aria-expanded={recurringFormOpen}
                aria-controls="rec-new-form"
                onClick={() => setRecurringFormOpen((o) => !o)}
                aria-label={recurringFormOpen ? "Ocultar formulário" : "Expandir formulário"}
              >
                <IconChevronDown
                  className={recurringFormOpen ? "is-open" : undefined}
                  aria-hidden
                />
              </button>
            </div>
            <div
              id="rec-new-form"
              className="card-expand-body"
              role="region"
              aria-labelledby="rec-new-heading"
              hidden={!recurringFormOpen}
            >
              <form onSubmit={addRecurring}>
                <div className="form-row">
                  <label htmlFor="rec-name">Nome</label>
                  <input
                    id="rec-name"
                    className="input"
                    value={rName}
                    onChange={(e) => setRName(e.target.value)}
                    placeholder="Mercado, combustível, farmácia…"
                  />
                </div>
                <div className="form-row">
                  <label htmlFor="rec-limit">Teto mensal (opcional, R$)</label>
                  <input
                    id="rec-limit"
                    className="input"
                    inputMode="decimal"
                    value={rLimit}
                    onChange={(e) => setRLimit(e.target.value)}
                    placeholder="Deixe vazio se não quiser limite"
                  />
                </div>
                <div className="form-row">
                  <label htmlFor="rec-notes">Observações</label>
                  <input
                    id="rec-notes"
                    className="input"
                    value={rNotes}
                    onChange={(e) => setRNotes(e.target.value)}
                  />
                </div>
                <button type="submit" className="btn btn-primary">
                  Salvar conta recorrente
                </button>
              </form>
            </div>
          </div>

          <div className="card">
            <h3 style={{ margin: "0 0 8px", fontSize: "0.95rem" }}>Contas recorrentes</h3>
            {state.recurringAccounts.length === 0 ? (
              <p className="empty">Nenhuma conta recorrente.</p>
            ) : (
              state.recurringAccounts.map((a) => (
                <RecurringRow
                  key={a.id}
                  panelActive={visible}
                  account={a}
                  onUpdate={updateRecurringAccount}
                  onRemove={removeRecurringAccount}
                  addRecurringSpend={addRecurringSpend}
                  removeRecurringSpend={removeRecurringSpend}
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
  const [spendFormOpen, setSpendFormOpen] = useState(false);
  const [spendAmount, setSpendAmount] = useState("");
  const [name, setName] = useState(account.name);
  const [limit, setLimit] = useState(
    account.budgetLimit != null ? String(account.budgetLimit).replace(".", ",") : "",
  );

  const currentMonthKey = monthKey(new Date());

  const currentMonthSpends = useMemo(
    () => (account.spends ?? []).filter((s) => isInMonth(s.date, currentMonthKey)),
    [account.spends, currentMonthKey],
  );

  const hasCurrentMonthSpend = currentMonthSpends.length > 0;

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
      setSpendFormOpen(false);
      setSpendAmount("");
      setEditing(false);
    }
  }, [panelActive]);

  function submitSpend(e: FormEvent) {
    e.preventDefault();
    const v = parseMoney(spendAmount);
    if (v <= 0) return;
    const date = new Date().toISOString().slice(0, 10);
    addVariableSpend(account.id, {
      title: variableSpendTitleForDate(date),
      amount: v,
      date,
    });
    setSpendAmount("");
    setSpendFormOpen(false);
  }

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
    <div className="variable-row">
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
            <label
              className="inline-checkbox"
              htmlFor={`var-spend-${account.id}`}
              title="Registrar gasto real"
            >
              <input
                id={`var-spend-${account.id}`}
                type="checkbox"
                checked={spendFormOpen || hasCurrentMonthSpend}
                onChange={(e) => {
                  const next = e.target.checked;
                  if (next) {
                    setSpendFormOpen(true);
                    return;
                  }
                  setSpendFormOpen(false);
                  setSpendAmount("");
                  for (const sp of currentMonthSpends) {
                    removeVariableSpend(account.id, sp.id);
                  }
                }}
                aria-label="Registrar gasto real"
              />
            </label>
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
      </div>
      {spendFormOpen ? (
        <form className="variable-spend-inline" onSubmit={submitSpend}>
          <label className="variable-spend-inline__label" htmlFor={`var-spend-amount-${account.id}`}>
            Valor real (R$)
          </label>
          <input
            id={`var-spend-amount-${account.id}`}
            className="input variable-spend-inline__input"
            inputMode="decimal"
            value={spendAmount}
            onChange={(e) => setSpendAmount(e.target.value)}
            placeholder="0,00"
            autoFocus
          />
          <button type="submit" className="btn btn-primary variable-spend-inline__submit">
            OK
          </button>
        </form>
      ) : null}
    </div>
  );
}

function RecurringRow({
  panelActive,
  account,
  onUpdate,
  onRemove,
  addRecurringSpend,
  removeRecurringSpend,
}: {
  panelActive: boolean;
  account: RecurringAccount;
  onUpdate: (id: string, p: Partial<RecurringAccount>) => void;
  onRemove: (id: string) => void;
  addRecurringSpend: (accountId: string, e: Omit<VariableSpend, "id">) => void;
  removeRecurringSpend: (accountId: string, spendId: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [spendFormOpen, setSpendFormOpen] = useState(false);
  const [spendAmount, setSpendAmount] = useState("");
  const [spendDesc, setSpendDesc] = useState("");
  const [name, setName] = useState(account.name);
  const [limit, setLimit] = useState(
    account.budgetLimit != null ? String(account.budgetLimit).replace(".", ",") : "",
  );

  const currentMonthKey = monthKey(new Date());

  const monthSpends = useMemo(
    () =>
      [...(account.spends ?? [])]
        .filter((s) => isInMonth(s.date, currentMonthKey))
        .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)),
    [account.spends, currentMonthKey],
  );

  const monthSpendTotal = useMemo(
    () => monthSpends.reduce((a, s) => a + s.amount, 0),
    [monthSpends],
  );

  const spendTone = useMemo(
    () => variableSpendToneClass(monthSpendTotal, account.budgetLimit),
    [monthSpendTotal, account.budgetLimit],
  );

  useEffect(() => {
    if (!panelActive) {
      setSpendFormOpen(false);
      setSpendAmount("");
      setSpendDesc("");
      setEditing(false);
    }
  }, [panelActive]);

  function submitSpend(e: FormEvent) {
    e.preventDefault();
    const desc = spendDesc.trim();
    const v = parseMoney(spendAmount);
    if (v <= 0) return;
    const date = new Date().toISOString().slice(0, 10);
    addRecurringSpend(account.id, {
      title: desc ? `${account.name} — ${desc}` : account.name,
      amount: v,
      date,
      notes: desc || undefined,
    });
    setSpendAmount("");
    setSpendDesc("");
    setSpendFormOpen(false);
  }

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
    <div className="variable-row">
      <div className="list-item">
        <div className="list-item-meta">
          <h4>{account.name}</h4>
          <small>
            {account.budgetLimit != null ? (
              <>
                Teto: {formatBRL(account.budgetLimit)} · No mês:{" "}
                <span className={spendTone}>{formatBRL(monthSpendTotal)}</span>
              </>
            ) : (
              <>
                No mês: <span className="var-spend--blue">{formatBRL(monthSpendTotal)}</span>
              </>
            )}
            {account.notes ? ` · ${account.notes}` : ""}
          </small>
        </div>
        <div style={{ textAlign: "right" }}>
          <span className="badge variable">recorrente</span>
          <div className="fixed-row-actions" style={{ marginTop: 8 }}>
            <button
              type="button"
              className="icon-btn icon-btn--plus"
              onClick={() => setSpendFormOpen((o) => !o)}
              aria-label="Adicionar gasto"
              aria-expanded={spendFormOpen}
              title="Adicionar gasto"
            >
              <IconPlus aria-hidden />
            </button>
            <button
              type="button"
              className="icon-btn icon-btn--ghost"
              onClick={() => setEditing(true)}
              aria-label="Editar conta recorrente"
              title="Editar"
            >
              <IconEdit aria-hidden />
            </button>
            <button
              type="button"
              className="icon-btn icon-btn--danger"
              onClick={() => onRemove(account.id)}
              aria-label="Excluir conta recorrente"
              title="Excluir"
            >
              <IconTrash aria-hidden />
            </button>
          </div>
        </div>
      </div>
      {spendFormOpen ? (
        <form className="variable-spend-inline" onSubmit={submitSpend}>
          <label className="variable-spend-inline__label" htmlFor={`rec-spend-amount-${account.id}`}>
            Valor do gasto (R$)
          </label>
          <input
            id={`rec-spend-amount-${account.id}`}
            className="input variable-spend-inline__input"
            inputMode="decimal"
            value={spendAmount}
            onChange={(e) => setSpendAmount(e.target.value)}
            placeholder="0,00"
            autoFocus
          />
          <label className="variable-spend-inline__label" htmlFor={`rec-spend-desc-${account.id}`}>
            Descrição <span className="agenda-label__hint">(opcional)</span>
          </label>
          <input
            id={`rec-spend-desc-${account.id}`}
            className="input variable-spend-inline__input variable-spend-inline__input--full"
            value={spendDesc}
            onChange={(e) => setSpendDesc(e.target.value)}
            placeholder="Ex.: compra do fim de semana, abastecimento…"
          />
          <button type="submit" className="btn btn-primary variable-spend-inline__submit">
            OK
          </button>
        </form>
      ) : null}
      {monthSpends.length > 0 ? (
        <ul className="recurring-spend-list">
          {monthSpends.map((s) => (
            <li key={s.id} className="recurring-spend-list__item">
              <span className="recurring-spend-list__meta">
                {s.notes ? <strong>{s.notes}</strong> : null}
                <small>{formatShortDate(s.date)}</small>
              </span>
              <span className="amount expense">{formatBRL(s.amount)}</span>
              <button
                type="button"
                className="icon-btn icon-btn--danger"
                onClick={() => removeRecurringSpend(account.id, s.id)}
                aria-label="Excluir gasto"
                title="Excluir"
              >
                <IconTrash aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
