import type { AppState } from "../types";

const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function formatBRL(value: number): string {
  return brl.format(value);
}

export function parseMoney(input: string): number {
  let s = input.replace(/\s/g, "");
  if (!s) return 0;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma > lastDot) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (lastDot > lastComma) {
    s = s.replace(/,/g, "");
  } else if (lastComma >= 0) {
    s = s.replace(",", ".");
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function isInMonth(isoDate: string, key: string): boolean {
  return isoDate.slice(0, 7) === key;
}

/**
 * Converte data ISO `YYYY-MM-DD` (ou string com prefixo) para **DD/MM/AAAA**.
 */
export function formatDateBr(iso: string): string {
  if (!iso) return "";
  const base = iso.length >= 10 ? iso.slice(0, 10) : iso;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(base)) return iso;
  const d = new Date(base + "T12:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = String(d.getFullYear());
  return `${day}/${month}/${year}`;
}

/**
 * Interpreta `DD/MM/AAAA` (com ou sem zeros à esquerda) e devolve `YYYY-MM-DD`, ou `null` se inválido.
 */
export function parseDateBrToIso(input: string): string | null {
  const s = input.trim().replace(/\s/g, "");
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const d = new Date(year, month - 1, day);
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Só dígitos (máx. 8) formatados como DD/MM/AAAA enquanto digita. */
export function digitsToDateBrDisplay(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

/** Mês civil anterior a `ym` (`YYYY-MM`). */
export function prevMonthKey(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m || m < 1 || m > 12) return ym;
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Primeiro dia do mês em `YYYY-MM-DD`. */
export function isoFirstDayOfMonth(ym: string): string {
  if (!/^\d{4}-\d{2}$/.test(ym)) return ym;
  return `${ym}-01`;
}

/** Soma de entradas futuras **pendentes** (`received` falso) com data prevista no mês `ym`. */
export function sumPendingFutureIncomesForMonth(state: AppState, ym: string): number {
  if (!/^\d{4}-\d{2}$/.test(ym)) return 0;
  let sum = 0;
  for (const e of state.futureIncomes) {
    if (e.received) continue;
    const d = e.expectedDate?.trim();
    if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) continue;
    if (!isInMonth(d, ym)) continue;
    sum += e.amount;
  }
  return sum;
}

/** Soma do teto ainda pendente no mês (teto - gastos variáveis já lançados no fluxo). */
export function sumVariableBudgetPendingForMonth(state: AppState, ym: string): number {
  if (!/^\d{4}-\d{2}$/.test(ym)) return 0;
  return state.variableAccounts.reduce((acc, v) => {
    const lim = v.budgetLimit;
    if (lim == null || lim <= 0) return acc;
    const spent = (v.spends ?? []).reduce((s, sp) => {
      if (!isInMonth(sp.date, ym)) return s;
      if (sp.amount <= 0) return s;
      return s + sp.amount;
    }, 0);
    const pending = lim - spent;
    return acc + (pending > 0 ? pending : 0);
  }, 0);
}

/**
 * Projeção de saldo no mês: saldo atual do painel + entradas futuras pendentes previstas no mês
 * − soma das contas fixas ainda não marcadas no fluxo − teto variável ainda pendente no mês.
 */
export function computeProjectedMonthBalance(state: AppState, ym: string): number {
  const balance = computeMonthDashboardBalance(state, ym);
  const pendingFuture = sumPendingFutureIncomesForMonth(state, ym);
  const fixedPlannedPending = state.fixedAccounts.reduce((a, x) => {
    if (x.inFlow) return a;
    return a + x.monthlyAmount;
  }, 0);
  const variableBudgetPending = sumVariableBudgetPendingForMonth(state, ym);
  return balance + pendingFuture - fixedPlannedPending - variableBudgetPending;
}

/** Saldo do painel (entradas − fluxo − mercado − combustível), igual ao card Início. */
export function computeMonthDashboardBalance(state: AppState, ym: string): number {
  if (!/^\d{4}-\d{2}$/.test(ym)) return 0;
  let income = 0;
  let expenseFlow = 0;
  for (const m of state.movements) {
    if (!isInMonth(m.date, ym)) continue;
    if (m.kind === "income") income += m.amount;
    else expenseFlow += m.amount;
  }
  let market = 0;
  let fuel = 0;
  for (const s of state.supermarket) {
    if (isInMonth(s.date, ym)) market += s.amount;
  }
  for (const f of state.fuel) {
    if (isInMonth(f.date, ym)) fuel += f.total;
  }
  return income - (expenseFlow + market + fuel);
}

/** Título padrão de gasto variável (mesmo padrão da tela Contas). */
export function variableSpendTitleForDate(isoDate: string): string {
  return `Gasto em ${formatDateBr(isoDate)}`;
}

/** Quantidade de lançamentos com data no mês `ym` (YYYY-MM): fluxo, mercado, combustível e gastos variáveis. */
export function countMonthEntries(state: AppState, ym: string): number {
  if (!/^\d{4}-\d{2}$/.test(ym)) return 0;
  let n = 0;
  for (const m of state.movements) {
    if (isInMonth(m.date, ym)) n++;
  }
  for (const s of state.supermarket) {
    if (isInMonth(s.date, ym)) n++;
  }
  for (const f of state.fuel) {
    if (isInMonth(f.date, ym)) n++;
  }
  for (const a of state.variableAccounts) {
    for (const sp of a.spends ?? []) {
      if (isInMonth(sp.date, ym)) n++;
    }
  }
  return n;
}

/** Data em DD/MM/AAAA (alias de {@link formatDateBr}). */
export function formatShortDate(iso: string): string {
  return formatDateBr(iso);
}

/** `ym` no formato `YYYY-MM` — exibe o 1º dia do mês em DD/MM/AAAA. */
export function formatMonthLabelPt(ym: string): string {
  if (!/^\d{4}-\d{2}$/.test(ym)) return ym;
  return formatDateBr(`${ym}-01`);
}

/** Mês abreviado + ano para cabeçalho compacto (`YYYY-MM`). */
export function formatMonthHeadlinePt(ym: string): { month: string; year: string } {
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return { month: "—", year: ym };
  const d = new Date(y, m - 1, 1);
  const raw = d.toLocaleDateString("pt-BR", { month: "short" });
  const month = raw.replace(/\.+$/, "").toUpperCase();
  return { month, year: String(y) };
}
