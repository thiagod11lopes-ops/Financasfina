import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useFinance } from "../context/FinanceContext";
import {
  computeProjectedMonthBalance,
  formatBRL,
  formatMonthHeadlinePt,
  formatMonthLabelPt,
  isInMonth,
  monthKey,
  parseMoney,
  sumPendingFutureIncomesForMonth,
  sumVariableBudgetLimitsTotal,
  variableSpendTitleForDate,
} from "../utils/format";
import { AgendaModal } from "./AgendaModal";
import { DashboardExplainModal } from "./DashboardExplainModal";
import type { DashboardMetricKey } from "./dashboardMetricExplain";
import { DashboardStats } from "./DashboardStats";
import { BudgetLimitExceededModal } from "./BudgetLimitExceededModal";
import { ExpenseAccountCombobox } from "./ExpenseAccountCombobox";
import { FixedAmountOverrideModal } from "./FixedAmountOverrideModal";
import {
  buildExpenseAccountOptions,
  expenseAccountLabel,
  expenseExtraDescription,
  findExpenseOptionByLabel,
  findFixedAccount,
  findRecurringAccount,
  findVariableAccount,
  sumAccountSpendsInMonth,
  willExceedBudgetLimit,
  type ExpenseAccountKind,
  type ExpenseAccountOption,
  type ExpenseAccountTarget,
} from "./expenseAccountPicker";
import { useTasks } from "../tasks/TasksContext";
import { IconAgenda, IconCalendar, IconChevronLeft, IconChevronRight, IconPlus, IconTasks, IconX } from "./Icons";
import { MovementSuccessModal, type MovementSuccessKind } from "./MovementSuccessModal";
import { MonthYearPickerModal } from "./MonthYearPickerModal";
import {
  DASH_TABS_SYNC_EVENT,
  loadDashboardTabs,
  saveDashboardTabs,
} from "../dashboardTabs";
import { useUserDocCloud } from "../firebase/userDocCloud";
import type { FixedAccount } from "../types";
import { USERS_ALL_OPTION, USERS_SYNC_EVENT, loadUsers } from "../users";

type FixedAmountOverridePrompt = {
  accountId: string;
  accountName: string;
  currentAmount: number;
  newAmount: number;
};

type BudgetLimitExceededPrompt = {
  kind: Extract<ExpenseAccountKind, "variable" | "recurring">;
  accountId: string;
  accountName: string;
  budgetLimit: number;
  monthSpent: number;
  newAmount: number;
  extraDesc?: string;
};

function entryDateForMonth(ym: string): string {
  const today = new Date().toISOString().slice(0, 10);
  if (isInMonth(today, ym)) return today;
  return `${ym}-01`;
}

export function Dashboard({ visible = true }: { visible?: boolean }) {
  const cloud = useUserDocCloud();
  const { openModal: openTasksModal } = useTasks();
  const {
    state,
    bootstrapNewMonth,
    addMovement,
    removeMovement,
    updateFixedAccount,
    addVariableSpend,
    addRecurringSpend,
  } = useFinance();
  const [tabs, setTabs] = useState<string[]>(() => loadDashboardTabs().tabs);
  const [activeKey, setActiveKey] = useState<string>(() => loadDashboardTabs().active);
  const [newMonth, setNewMonth] = useState(() => monthKey(new Date()));
  const [pickerOpen, setPickerOpen] = useState(false);
  const [agendaOpen, setAgendaOpen] = useState(false);
  const [balanceModalKind, setBalanceModalKind] = useState<null | "income" | "expense">(null);
  const [explainMetric, setExplainMetric] = useState<DashboardMetricKey | null>(null);
  const [addAmount, setAddAmount] = useState("");
  const [addDesc, setAddDesc] = useState("");
  const [expenseTarget, setExpenseTarget] = useState<ExpenseAccountTarget | null>(null);
  const [fixedAmountPrompt, setFixedAmountPrompt] = useState<FixedAmountOverridePrompt | null>(null);
  const [budgetLimitPrompt, setBudgetLimitPrompt] = useState<BudgetLimitExceededPrompt | null>(null);
  const [movementSuccess, setMovementSuccess] = useState<MovementSuccessKind | null>(null);
  const [balanceResponsible, setBalanceResponsible] = useState(USERS_ALL_OPTION);
  const [users, setUsers] = useState<string[]>(() => loadUsers());

  const balanceModalOpen = balanceModalKind !== null;

  useEffect(() => {
    if (!balanceModalOpen) {
      setFixedAmountPrompt(null);
      setBudgetLimitPrompt(null);
      return;
    }
    setAddAmount("");
    setAddDesc("");
    setExpenseTarget(null);
    setFixedAmountPrompt(null);
    setBudgetLimitPrompt(null);
    setBalanceResponsible(USERS_ALL_OPTION);
  }, [balanceModalOpen, balanceModalKind]);

  const expenseAccountOptions = useMemo(() => buildExpenseAccountOptions(state), [state]);

  const handleExpenseDescChange = useCallback(
    (value: string) => {
      setAddDesc(value);
      const match = findExpenseOptionByLabel(expenseAccountOptions, value);
      if (match) {
        setExpenseTarget(match.target);
        if (match.defaultAmount != null && match.defaultAmount > 0) {
          setAddAmount(String(match.defaultAmount).replace(".", ","));
        }
        return;
      }
      if (!value.trim()) setExpenseTarget(null);
    },
    [expenseAccountOptions],
  );

  const handleExpenseOptionSelect = useCallback((opt: ExpenseAccountOption) => {
    setAddDesc(opt.label);
    setExpenseTarget(opt.target);
    if (opt.defaultAmount != null && opt.defaultAmount > 0) {
      setAddAmount(String(opt.defaultAmount).replace(".", ","));
    }
  }, []);

  useEffect(() => {
    const syncUsers = () => setUsers(loadUsers());
    window.addEventListener(USERS_SYNC_EVENT, syncUsers);
    return () => window.removeEventListener(USERS_SYNC_EVENT, syncUsers);
  }, []);

  useEffect(() => {
    if (users.includes(balanceResponsible)) return;
    setBalanceResponsible(USERS_ALL_OPTION);
  }, [users, balanceResponsible]);

  useEffect(() => {
    if (!balanceModalOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [balanceModalOpen]);

  useEffect(() => {
    if (!fixedAmountPrompt && !budgetLimitPrompt) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (fixedAmountPrompt) {
        setFixedAmountPrompt(null);
        return;
      }
      if (budgetLimitPrompt) {
        setBudgetLimitPrompt(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [budgetLimitPrompt, fixedAmountPrompt]);

  /** Ao mudar de aba na navegação inferior, fechar modais (scroll do body, foco, etc.). */
  useEffect(() => {
    if (visible) return;
    setPickerOpen(false);
    setAgendaOpen(false);
    setBalanceModalKind(null);
    setFixedAmountPrompt(null);
    setBudgetLimitPrompt(null);
    setMovementSuccess(null);
    setExplainMetric(null);
  }, [visible]);

  useEffect(() => {
    const payload = { tabs, active: activeKey };
    saveDashboardTabs(payload);
    cloud.scheduleDashboardTabsPush(payload);
  }, [tabs, activeKey, cloud]);

  useEffect(() => {
    const sync = () => {
      const p = loadDashboardTabs();
      setTabs(p.tabs);
      setActiveKey(p.active);
    };
    window.addEventListener(DASH_TABS_SYNC_EVENT, sync);
    return () => window.removeEventListener(DASH_TABS_SYNC_EVENT, sync);
  }, []);

  useEffect(() => {
    if (!tabs.includes(activeKey)) setActiveKey(tabs[0]!);
  }, [tabs, activeKey]);

  const stats = useMemo(() => {
    const key = activeKey;
    let income = 0;
    let expenseFlow = 0;
    for (const m of state.movements) {
      if (!isInMonth(m.date, key)) continue;
      if (m.kind === "income") income += m.amount;
      else expenseFlow += m.amount;
    }
    let market = 0;
    for (const s of state.supermarket) {
      if (isInMonth(s.date, key)) market += s.amount;
    }
    let fuel = 0;
    for (const f of state.fuel) {
      if (isInMonth(f.date, key)) fuel += f.total;
    }
    const fixedPlanned = state.fixedAccounts.reduce((a, x) => a + x.monthlyAmount, 0);
    const variableBudgetTotal = sumVariableBudgetLimitsTotal(state);
    const sumVariableSpendsInMonth = (spends: { date: string; amount: number }[] | undefined) =>
      (spends ?? []).reduce((s, sp) => (isInMonth(sp.date, key) ? s + sp.amount : s), 0);
    const variableSpendGrandTotal =
      state.variableAccounts.reduce((acc, v) => acc + sumVariableSpendsInMonth(v.spends), 0) +
      state.recurringAccounts.reduce((acc, v) => acc + sumVariableSpendsInMonth(v.spends), 0);
    const totalOut = expenseFlow + market + fuel;
    const balance = income - totalOut;
    return {
      income,
      expenseFlow,
      market,
      fuel,
      totalOut,
      balance,
      fixedPlanned,
      variableBudgetTotal,
      variableSpendGrandTotal,
    };
  }, [state, activeKey]);

  const pendingFutureMonthTotal = useMemo(
    () => sumPendingFutureIncomesForMonth(state, activeKey),
    [state, activeKey],
  );

  const projectedBalance = useMemo(
    () => computeProjectedMonthBalance(state, activeKey),
    [state, activeKey],
  );

  const applyNewMonth = useCallback(
    (ym: string) => {
      if (!/^\d{4}-\d{2}$/.test(ym)) return;
      setNewMonth(ym);
      const wasNew = !tabs.includes(ym);
      setTabs((prev) => {
        if (prev.includes(ym)) return prev;
        return [...prev, ym].sort();
      });
      if (wasNew) bootstrapNewMonth(ym);
      setActiveKey(ym);
      setPickerOpen(false);
    },
    [tabs, bootstrapNewMonth],
  );

  const removeTab = useCallback((ym: string) => {
    setTabs((prev) => (prev.length <= 1 ? prev : prev.filter((t) => t !== ym)));
  }, []);

  const goPrevMonth = useCallback(() => {
    if (tabs.length <= 1) return;
    const i = tabs.indexOf(activeKey);
    const nextI = i <= 0 ? tabs.length - 1 : i - 1;
    setActiveKey(tabs[nextI]!);
  }, [tabs, activeKey]);

  const goNextMonth = useCallback(() => {
    if (tabs.length <= 1) return;
    const i = tabs.indexOf(activeKey);
    const nextI = i >= tabs.length - 1 ? 0 : i + 1;
    setActiveKey(tabs[nextI]!);
  }, [tabs, activeKey]);

  const multi = tabs.length > 1;

  const activeHeadline = useMemo(() => formatMonthHeadlinePt(activeKey), [activeKey]);

  const completeBalanceMovement = useCallback((kind: MovementSuccessKind) => {
    setBalanceModalKind(null);
    setFixedAmountPrompt(null);
    setBudgetLimitPrompt(null);
    setMovementSuccess(kind);
  }, []);

  useEffect(() => {
    if (!movementSuccess) return;
    const timer = window.setTimeout(() => setMovementSuccess(null), 2000);
    return () => window.clearTimeout(timer);
  }, [movementSuccess]);

  const commitFixedExpense = useCallback(
    (account: FixedAccount, amount: number, updateMonthlyAmount?: number) => {
      const date = entryDateForMonth(activeKey);
      const responsible = balanceResponsible || USERS_ALL_OPTION;
      if (account.linkedMovementId) removeMovement(account.linkedMovementId);
      const movementId = addMovement({
        kind: "expense",
        amount,
        title: account.name,
        date,
        nature: "fixed",
        responsible,
      });
      updateFixedAccount(account.id, {
        ...(updateMonthlyAmount != null ? { monthlyAmount: updateMonthlyAmount } : {}),
        inFlow: true,
        linkedMovementId: movementId,
      });
      completeBalanceMovement("expense");
    },
    [activeKey, addMovement, balanceResponsible, completeBalanceMovement, removeMovement, updateFixedAccount],
  );

  const confirmFixedAmountOverride = useCallback(() => {
    if (!fixedAmountPrompt) return;
    const account = findFixedAccount(state, fixedAmountPrompt.accountId);
    if (!account) {
      setFixedAmountPrompt(null);
      return;
    }
    commitFixedExpense(account, fixedAmountPrompt.newAmount, fixedAmountPrompt.newAmount);
  }, [commitFixedExpense, fixedAmountPrompt, state]);

  const commitVariableExpense = useCallback(
    (accountId: string, amount: number, extra?: string) => {
      const date = entryDateForMonth(activeKey);
      addVariableSpend(accountId, {
        title: extra ?? variableSpendTitleForDate(date),
        amount,
        date,
        notes: extra,
      });
      completeBalanceMovement("expense");
    },
    [activeKey, addVariableSpend, completeBalanceMovement],
  );

  const commitRecurringExpense = useCallback(
    (accountId: string, amount: number, accountName: string, extra?: string) => {
      const date = entryDateForMonth(activeKey);
      addRecurringSpend(accountId, {
        title: extra ? `${accountName} — ${extra}` : accountName,
        amount,
        date,
        notes: extra,
      });
      completeBalanceMovement("expense");
    },
    [activeKey, addRecurringSpend, completeBalanceMovement],
  );

  const confirmBudgetLimitExceeded = useCallback(() => {
    if (!budgetLimitPrompt) return;
    if (budgetLimitPrompt.kind === "variable") {
      commitVariableExpense(
        budgetLimitPrompt.accountId,
        budgetLimitPrompt.newAmount,
        budgetLimitPrompt.extraDesc,
      );
      return;
    }
    commitRecurringExpense(
      budgetLimitPrompt.accountId,
      budgetLimitPrompt.newAmount,
      budgetLimitPrompt.accountName,
      budgetLimitPrompt.extraDesc,
    );
  }, [budgetLimitPrompt, commitRecurringExpense, commitVariableExpense]);

  const submitBalanceMovement = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      if (!balanceModalKind) return;
      const v = parseMoney(addAmount);
      if (v <= 0) return;
      const date = entryDateForMonth(activeKey);
      const responsible = balanceResponsible || USERS_ALL_OPTION;

      if (balanceModalKind === "income") {
        addMovement({
          kind: "income",
          amount: v,
          title: addDesc.trim() || "Entrada adicional",
          date,
          responsible,
        });
        completeBalanceMovement("income");
        return;
      }

      const target =
        expenseTarget ?? findExpenseOptionByLabel(expenseAccountOptions, addDesc)?.target ?? null;

      if (target?.kind === "fixed") {
        const account = findFixedAccount(state, target.accountId);
        if (account) {
          if (v > account.monthlyAmount) {
            setFixedAmountPrompt({
              accountId: account.id,
              accountName: account.name,
              currentAmount: account.monthlyAmount,
              newAmount: v,
            });
            return;
          }
          commitFixedExpense(account, v);
          return;
        }
      }

      if (target?.kind === "variable") {
        const account = findVariableAccount(state, target.accountId);
        if (account) {
          const defaultLabel = expenseAccountLabel("variable", account.name);
          const extra = expenseExtraDescription(account.name, addDesc, defaultLabel);
          const monthSpent = sumAccountSpendsInMonth(account.spends, activeKey);
          if (willExceedBudgetLimit(account.budgetLimit, monthSpent, v)) {
            setBudgetLimitPrompt({
              kind: "variable",
              accountId: account.id,
              accountName: account.name,
              budgetLimit: account.budgetLimit!,
              monthSpent,
              newAmount: v,
              extraDesc: extra,
            });
            return;
          }
          commitVariableExpense(account.id, v, extra);
          return;
        }
      }

      if (target?.kind === "recurring") {
        const account = findRecurringAccount(state, target.accountId);
        if (account) {
          const defaultLabel = expenseAccountLabel("recurring", account.name);
          const extra = expenseExtraDescription(account.name, addDesc, defaultLabel);
          const monthSpent = sumAccountSpendsInMonth(account.spends, activeKey);
          if (willExceedBudgetLimit(account.budgetLimit, monthSpent, v)) {
            setBudgetLimitPrompt({
              kind: "recurring",
              accountId: account.id,
              accountName: account.name,
              budgetLimit: account.budgetLimit!,
              monthSpent,
              newAmount: v,
              extraDesc: extra,
            });
            return;
          }
          commitRecurringExpense(account.id, v, account.name, extra);
          return;
        }
      }

      addMovement({
        kind: "expense",
        amount: v,
        title: addDesc.trim() || "Gasto adicional",
        date,
        responsible,
      });
      completeBalanceMovement("expense");
    },
    [
      addAmount,
      addDesc,
      activeKey,
      addMovement,
      balanceModalKind,
      balanceResponsible,
      commitFixedExpense,
      commitRecurringExpense,
      commitVariableExpense,
      completeBalanceMovement,
      expenseAccountOptions,
      expenseTarget,
      state,
    ],
  );

  return (
    <>
      <div className="dashboard-month-ui">
        <div className="dashboard-month-add">
          {multi ? (
            <button
              type="button"
              className="dashboard-month-nav-btn"
              onClick={goPrevMonth}
              aria-label="Mês anterior na lista"
            >
              <IconChevronLeft aria-hidden />
            </button>
          ) : null}
          <div className="dashboard-month-head">
            <div className="dashboard-month-field" aria-hidden="true">
              <div className="dashboard-month-current">
                <span className="dashboard-month-current__m">{activeHeadline.month}</span>
                <span className="dashboard-month-current__y">{activeHeadline.year}</span>
              </div>
            </div>
            <button
              type="button"
              className="dashboard-month-picker-trigger"
              onClick={() => setPickerOpen(true)}
              aria-label="Abrir calendário para novo mês"
            >
              <span className="dashboard-month-picker-icon" aria-hidden>
                <IconCalendar />
              </span>
            </button>
          </div>
          <div className="dashboard-month-triggers">
            <button
              type="button"
              className="dashboard-month-plus-btn"
              onClick={() => setPickerOpen(true)}
              aria-label="Adicionar mês ao resumo"
            >
              <IconPlus aria-hidden />
            </button>
            <button
              type="button"
              className="dashboard-month-agenda-btn"
              onClick={() => setAgendaOpen(true)}
              aria-label="Abrir agenda familiar"
              title="Agenda familiar"
            >
              <IconAgenda aria-hidden />
            </button>
            <button
              type="button"
              className="dashboard-month-tasks-btn"
              onClick={openTasksModal}
              aria-label="Abrir tarefas"
              title="Tarefas"
            >
              <IconTasks aria-hidden />
            </button>
          </div>
          {multi ? (
            <button
              type="button"
              className="dashboard-month-nav-btn"
              onClick={goNextMonth}
              aria-label="Próximo mês na lista"
            >
              <IconChevronRight aria-hidden />
            </button>
          ) : null}
          {multi ? (
            <button
              type="button"
              className="dashboard-month-nav-btn dashboard-month-remove-btn"
              onClick={() => removeTab(activeKey)}
              aria-label={`Remover ${formatMonthLabelPt(activeKey)} da lista`}
            >
              <IconX aria-hidden />
            </button>
          ) : null}
        </div>
      </div>

      <MonthYearPickerModal
        open={pickerOpen}
        initialYm={newMonth}
        existingTabs={tabs}
        onClose={() => setPickerOpen(false)}
        onConfirm={applyNewMonth}
      />

      <AgendaModal open={agendaOpen} onClose={() => setAgendaOpen(false)} />

      <section
        id="dash-panel"
        className="card card-glow dash-overview-hero"
        role="region"
        aria-label={`Resumo financeiro de ${formatMonthLabelPt(activeKey)}`}
      >
        <div className="dash-overview-hero__balance">
          <div className="dash-balance-grid">
            <button
              type="button"
              className="dash-balance-tap"
              onClick={() => setExplainMetric("balance")}
              aria-label={`Saldo atual: ${formatBRL(stats.balance)}. Toque para saber mais.`}
            >
              <span className="badge dash-balance-grid__badge">Saldo atual</span>
              <p
                className="dash-balance-value dash-balance-grid__value"
                style={{
                  color: stats.balance >= 0 ? "var(--income)" : "var(--expense)",
                }}
              >
                {formatBRL(stats.balance)}
              </p>
              <span className="dash-balance-tap__chevron" aria-hidden>
                ›
              </span>
            </button>
            <div className="dash-balance-grid__actions">
              <button
                type="button"
                className="dash-balance-add-btn"
                onClick={() => setBalanceModalKind("income")}
                aria-label="Adicionar entrada ao saldo atual"
                title="Adicionar entrada"
              >
                <IconPlus aria-hidden />
              </button>
              <button
                type="button"
                className="dash-balance-subtract-btn"
                onClick={() => setBalanceModalKind("expense")}
                aria-label="Registrar gasto no fluxo do mês"
                title="Registrar gasto"
              >
                <span aria-hidden>-</span>
              </button>
            </div>
          </div>
        </div>
        <button
          type="button"
          className={`dash-overview-hero__projection dash-overview-hero__projection-btn${projectedBalance >= 0 ? " dash-overview-hero__projection--income" : " dash-overview-hero__projection--expense"}`}
          onClick={() => setExplainMetric("projection")}
          aria-label={`Projeção planeada: ${formatBRL(projectedBalance)}. Toque para saber mais.`}
        >
          <span className="dash-overview-hero__projection-label">Projeção planeada</span>
          <strong className="dash-overview-hero__projection-value">{formatBRL(projectedBalance)}</strong>
          <span className="dash-overview-hero__projection-hint">Fim do mês · 100% tetos</span>
          <span className="dash-overview-hero__projection-chevron" aria-hidden>
            ›
          </span>
        </button>
      </section>

      {balanceModalOpen && balanceModalKind ? (
        <div className="modal-backdrop dash-balance-backdrop" role="presentation">
          <div
            className="modal-panel dash-balance-income-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="dash-balance-movement-title"
          >
            <div className="modal-head">
              <div className="modal-head__text">
                <h2 id="dash-balance-movement-title">
                  {balanceModalKind === "income" ? "Adicionar ao saldo" : "Registrar gasto"}
                </h2>
                <p>
                  {balanceModalKind === "income"
                    ? `Lança uma entrada no mês de ${formatMonthLabelPt(activeKey)}.`
                    : `Lança uma saída no fluxo do mês de ${formatMonthLabelPt(activeKey)}.`}
                </p>
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={() => setBalanceModalKind(null)}
                aria-label="Fechar"
              >
                <IconX aria-hidden />
              </button>
            </div>
            <form className="dash-balance-income-form" onSubmit={submitBalanceMovement}>
              <div className="form-row">
                <label htmlFor="dash-movement-amount">Valor (R$)</label>
                <input
                  id="dash-movement-amount"
                  className="input"
                  inputMode="decimal"
                  value={addAmount}
                  onChange={(e) => setAddAmount(e.target.value)}
                  placeholder="0,00"
                  autoComplete="off"
                  autoFocus
                />
              </div>
              <div className="form-row">
                <label htmlFor="dash-movement-desc">
                  {balanceModalKind === "income" ? "Descrição (opcional)" : "Descrição"}
                </label>
                {balanceModalKind === "expense" ? (
                  <>
                    <ExpenseAccountCombobox
                      id="dash-movement-desc"
                      options={expenseAccountOptions}
                      value={addDesc}
                      selectedTarget={expenseTarget}
                      onValueChange={handleExpenseDescChange}
                      onSelectOption={handleExpenseOptionSelect}
                    />
                    <p className="form-row-hint">
                      Escolha na lista ou digite livremente. O lançamento vincula automaticamente à conta.
                    </p>
                  </>
                ) : (
                  <input
                    id="dash-movement-desc"
                    className="input"
                    value={addDesc}
                    onChange={(e) => setAddDesc(e.target.value)}
                    placeholder="Ex.: salário extra, reembolso…"
                    enterKeyHint="done"
                  />
                )}
              </div>
              <div className="form-row">
                <label htmlFor="dash-movement-user">Responsável</label>
                <select
                  id="dash-movement-user"
                  className="select"
                  value={balanceResponsible}
                  onChange={(e) => setBalanceResponsible(e.target.value)}
                >
                  {users.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>
              <div className="dash-balance-income-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setBalanceModalKind(null)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  {balanceModalKind === "income" ? "Adicionar" : "Lançar gasto"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <DashboardStats
        income={stats.income}
        totalOut={stats.totalOut}
        pendingFutureMonthTotal={pendingFutureMonthTotal}
        fixedPlanned={stats.fixedPlanned}
        variableBudgetTotal={stats.variableBudgetTotal}
        variableSpendGrandTotal={stats.variableSpendGrandTotal}
        onOpenExplain={setExplainMetric}
      />

      <DashboardExplainModal
        metric={explainMetric}
        monthLabel={formatMonthLabelPt(activeKey)}
        onClose={() => setExplainMetric(null)}
      />

      <FixedAmountOverrideModal
        open={fixedAmountPrompt !== null}
        accountName={fixedAmountPrompt?.accountName ?? ""}
        currentAmount={fixedAmountPrompt?.currentAmount ?? 0}
        newAmount={fixedAmountPrompt?.newAmount ?? 0}
        onCancel={() => setFixedAmountPrompt(null)}
        onConfirm={confirmFixedAmountOverride}
      />

      <BudgetLimitExceededModal
        open={budgetLimitPrompt !== null}
        accountName={budgetLimitPrompt?.accountName ?? ""}
        kind={budgetLimitPrompt?.kind ?? "variable"}
        budgetLimit={budgetLimitPrompt?.budgetLimit ?? 0}
        monthSpent={budgetLimitPrompt?.monthSpent ?? 0}
        newAmount={budgetLimitPrompt?.newAmount ?? 0}
        onCancel={() => setBudgetLimitPrompt(null)}
        onConfirm={confirmBudgetLimitExceeded}
      />

      <MovementSuccessModal kind={movementSuccess} />

    </>
  );
}
