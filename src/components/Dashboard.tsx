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
} from "../utils/format";
import { AgendaModal } from "./AgendaModal";
import { IconAgenda, IconCalendar, IconChevronLeft, IconChevronRight, IconPlus, IconX } from "./Icons";
import { MonthYearPickerModal } from "./MonthYearPickerModal";
import {
  DASH_TABS_SYNC_EVENT,
  loadDashboardTabs,
  saveDashboardTabs,
} from "../dashboardTabs";
import { useUserDocCloud } from "../firebase/userDocCloud";
import { USERS_ALL_OPTION, USERS_SYNC_EVENT, loadUsers } from "../users";

function entryDateForMonth(ym: string): string {
  const today = new Date().toISOString().slice(0, 10);
  if (isInMonth(today, ym)) return today;
  return `${ym}-01`;
}

export function Dashboard() {
  const cloud = useUserDocCloud();
  const { state, bootstrapNewMonth, addMovement } = useFinance();
  const [tabs, setTabs] = useState<string[]>(() => loadDashboardTabs().tabs);
  const [activeKey, setActiveKey] = useState<string>(() => loadDashboardTabs().active);
  const [newMonth, setNewMonth] = useState(() => monthKey(new Date()));
  const [pickerOpen, setPickerOpen] = useState(false);
  const [agendaOpen, setAgendaOpen] = useState(false);
  const [balanceModalKind, setBalanceModalKind] = useState<null | "income" | "expense">(null);
  const [addAmount, setAddAmount] = useState("");
  const [addDesc, setAddDesc] = useState("");
  const [balanceResponsible, setBalanceResponsible] = useState(USERS_ALL_OPTION);
  const [users, setUsers] = useState<string[]>(() => loadUsers());

  const balanceModalOpen = balanceModalKind !== null;

  useEffect(() => {
    if (!balanceModalOpen) return;
    setAddAmount("");
    setAddDesc("");
    setBalanceResponsible(USERS_ALL_OPTION);
  }, [balanceModalOpen, balanceModalKind]);

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
    if (!balanceModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setBalanceModalKind(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [balanceModalOpen]);

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
    let variableSpent = 0;
    for (const acc of state.variableAccounts) {
      for (const sp of acc.spends ?? []) {
        if (!isInMonth(sp.date, key)) continue;
        if (sp.amount <= 0) continue;
        variableSpent += sp.amount;
      }
    }
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
      variableSpent,
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

  const submitBalanceMovement = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      if (!balanceModalKind) return;
      const v = parseMoney(addAmount);
      if (v <= 0) return;
      if (balanceModalKind === "income") {
        addMovement({
          kind: "income",
          amount: v,
          title: addDesc.trim() || "Entrada adicional",
          date: entryDateForMonth(activeKey),
          responsible: balanceResponsible || USERS_ALL_OPTION,
        });
      } else {
        addMovement({
          kind: "expense",
          amount: v,
          title: addDesc.trim() || "Gasto adicional",
          date: entryDateForMonth(activeKey),
          responsible: balanceResponsible || USERS_ALL_OPTION,
        });
      }
      setBalanceModalKind(null);
    },
    [addAmount, addDesc, activeKey, addMovement, balanceModalKind, balanceResponsible],
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

      <div
        id="dash-panel"
        className="card card-glow dash-balance-panel"
        role="region"
        aria-label={`Resumo financeiro de ${formatMonthLabelPt(activeKey)}`}
      >
        <div className="dash-balance-grid">
          <span className="badge dash-balance-grid__badge">Saldo Atual</span>
          <div className="dash-balance-grid__action-plus">
            <button
              type="button"
              className="dash-balance-add-btn"
              onClick={() => setBalanceModalKind("income")}
              aria-label="Adicionar entrada ao saldo atual"
              title="Adicionar entrada"
            >
              <IconPlus aria-hidden />
            </button>
          </div>
          <p
            className="dash-balance-value dash-balance-grid__value"
            style={{
              color: stats.balance >= 0 ? "var(--income)" : "var(--expense)",
            }}
          >
            {formatBRL(stats.balance)}
          </p>
          <div className="dash-balance-grid__action-minus">
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

      {balanceModalOpen && balanceModalKind ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setBalanceModalKind(null)}>
          <div
            className="modal-panel dash-balance-income-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="dash-balance-movement-title"
            onClick={(ev) => ev.stopPropagation()}
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
                <label htmlFor="dash-movement-desc">Descrição (opcional)</label>
                <input
                  id="dash-movement-desc"
                  className="input"
                  value={addDesc}
                  onChange={(e) => setAddDesc(e.target.value)}
                  placeholder={
                    balanceModalKind === "income"
                      ? "Ex.: salário extra, reembolso…"
                      : "Ex.: conta extra, compra avulsa…"
                  }
                  enterKeyHint="done"
                />
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

      <div className="stat-grid" style={{ marginTop: 12 }}>
        <div className="stat-pill income">
          <span>Entradas</span>
          <strong>{formatBRL(stats.income)}</strong>
        </div>
        <div className="stat-pill expense">
          <span>Saídas totais</span>
          <strong>{formatBRL(stats.totalOut)}</strong>
        </div>
        <div className="stat-pill">
          <span>Gastos Fixas planejadas</span>
          <strong>{formatBRL(stats.fixedPlanned)}</strong>
        </div>
        <div className="stat-pill expense">
          <span>Gatos Fixos Variaveis</span>
          <strong>{formatBRL(stats.variableSpent)}</strong>
        </div>
        <div className="stat-pill income">
          <span>A receber no mês</span>
          <strong>{formatBRL(pendingFutureMonthTotal)}</strong>
        </div>
        <div className={projectedBalance >= 0 ? "stat-pill income" : "stat-pill expense"}>
          <span>Projeção de saldo</span>
          <strong>{formatBRL(projectedBalance)}</strong>
        </div>
      </div>

    </>
  );
}
