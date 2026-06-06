import type { AppState, FixedAccount, RecurringAccount, VariableAccount, VariableSpend } from "../types";
import { isInMonth } from "../utils/format";

export type ExpenseAccountKind = "fixed" | "variable" | "recurring";

export type ExpenseAccountTarget = {
  kind: ExpenseAccountKind;
  accountId: string;
};

export type ExpenseAccountOption = {
  name: string;
  kind: ExpenseAccountKind;
  kindTag: string;
  label: string;
  target: ExpenseAccountTarget;
  defaultAmount?: number;
};

export function expenseAccountKindTag(kind: ExpenseAccountKind): string {
  return kind === "fixed" ? "Fixa" : kind === "variable" ? "Variável" : "Recorrente";
}

export function expenseAccountLabel(kind: ExpenseAccountKind, name: string): string {
  return `${name} · ${expenseAccountKindTag(kind)}`;
}

export function buildExpenseAccountOptions(state: AppState): ExpenseAccountOption[] {
  const options: ExpenseAccountOption[] = [];
  for (const a of state.fixedAccounts) {
    options.push({
      name: a.name,
      kind: "fixed",
      kindTag: expenseAccountKindTag("fixed"),
      label: expenseAccountLabel("fixed", a.name),
      target: { kind: "fixed", accountId: a.id },
      defaultAmount: a.monthlyAmount,
    });
  }
  for (const a of state.variableAccounts) {
    options.push({
      name: a.name,
      kind: "variable",
      kindTag: expenseAccountKindTag("variable"),
      label: expenseAccountLabel("variable", a.name),
      target: { kind: "variable", accountId: a.id },
    });
  }
  for (const a of state.recurringAccounts) {
    options.push({
      name: a.name,
      kind: "recurring",
      kindTag: expenseAccountKindTag("recurring"),
      label: expenseAccountLabel("recurring", a.name),
      target: { kind: "recurring", accountId: a.id },
    });
  }
  return options.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

export function findExpenseOptionByLabel(
  options: ExpenseAccountOption[],
  label: string,
): ExpenseAccountOption | undefined {
  const trimmed = label.trim();
  return options.find((o) => o.label === trimmed);
}

export function findExpenseOptionByTarget(
  options: ExpenseAccountOption[],
  target: ExpenseAccountTarget | null,
): ExpenseAccountOption | undefined {
  if (!target) return undefined;
  return options.find(
    (o) => o.target.kind === target.kind && o.target.accountId === target.accountId,
  );
}

export function filterExpenseAccountOptions(
  options: ExpenseAccountOption[],
  query: string,
): ExpenseAccountOption[] {
  const q = query.trim().toLowerCase();
  if (!q) return options;
  return options.filter(
    (o) =>
      o.name.toLowerCase().includes(q) ||
      o.kindTag.toLowerCase().includes(q) ||
      o.label.toLowerCase().includes(q),
  );
}

export function findFixedAccount(state: AppState, id: string): FixedAccount | undefined {
  return state.fixedAccounts.find((a) => a.id === id);
}

export function findVariableAccount(state: AppState, id: string): VariableAccount | undefined {
  return state.variableAccounts.find((a) => a.id === id);
}

export function findRecurringAccount(state: AppState, id: string): RecurringAccount | undefined {
  return state.recurringAccounts.find((a) => a.id === id);
}

export function sumAccountSpendsInMonth(spends: VariableSpend[] | undefined, ym: string): number {
  return (spends ?? []).reduce((total, sp) => (isInMonth(sp.date, ym) ? total + sp.amount : total), 0);
}

/** Verifica se o lançamento ultrapassa o teto no mês (só quando há teto definido). */
export function willExceedBudgetLimit(
  budgetLimit: number | undefined,
  monthSpent: number,
  newAmount: number,
): boolean {
  if (budgetLimit == null || budgetLimit <= 0) return false;
  return monthSpent + newAmount > budgetLimit;
}

/** Texto extra após o nome da conta (ex.: descrição editada manualmente). */
export function expenseExtraDescription(
  accountName: string,
  desc: string,
  defaultLabel: string,
): string | undefined {
  const trimmed = desc.trim();
  if (!trimmed || trimmed === defaultLabel || trimmed === accountName) return undefined;

  const fullLabel = new RegExp(
    `^${escapeRegExp(accountName)}\\s*·\\s*(Fixa|Variável|Recorrente)$`,
  );
  if (fullLabel.test(trimmed)) return undefined;

  let extra = trimmed;
  if (extra.startsWith(accountName)) {
    extra = extra.slice(accountName.length).replace(/^\s*·\s*/, "").replace(/^[—–-]\s*/, "").trim();
    if (/^(Fixa|Variável|Recorrente)$/.test(extra)) return undefined;
  }

  return extra || undefined;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
