export type MovementKind = "income" | "expense";

export type ExpenseNature = "fixed" | "variable";

export type Movement = {
  id: string;
  kind: MovementKind;
  amount: number;
  title: string;
  date: string;
  /** Usuário responsável (ou "Todos"). */
  responsible?: string;
  nature?: ExpenseNature;
};

export type FixedAccount = {
  id: string;
  name: string;
  monthlyAmount: number;
  notes?: string;
  /** Se true, esta conta está ligada ao fluxo de saídas (lançamento ao marcar). */
  inFlow?: boolean;
  /** Lançamento de saída no fluxo criado ao marcar a conta fixa. */
  linkedMovementId?: string;
};

export type VariableSpend = {
  id: string;
  amount: number;
  title: string;
  date: string;
  notes?: string;
  /** Lançamento de saída no fluxo criado a partir deste gasto. */
  linkedMovementId?: string;
};

export type VariableAccount = {
  id: string;
  name: string;
  budgetLimit?: number;
  notes?: string;
  /** Gastos lançados nesta conta variável (persistidos). */
  spends?: VariableSpend[];
};

export type SupermarketEntry = {
  id: string;
  amount: number;
  store?: string;
  date: string;
  notes?: string;
};

export type FuelEntry = {
  id: string;
  liters: number;
  pricePerLiter: number;
  total: number;
  odometer?: number;
  station?: string;
  date: string;
};

/** Entrada prevista; ao marcar recebido, vira lançamento de renda no fluxo. */
export type FutureIncomeEntry = {
  id: string;
  amount: number;
  /** Descrição do valor a receber */
  title: string;
  /** Data prevista de recebimento (YYYY-MM-DD). */
  expectedDate?: string;
  received: boolean;
  /** Data em que foi marcado como recebido (YYYY-MM-DD). */
  receivedAt?: string;
  /** Lançamento de entrada no fluxo criado ao marcar como recebido (para desmarcar ou excluir). */
  linkedMovementId?: string;
};

export type AppState = {
  movements: Movement[];
  fixedAccounts: FixedAccount[];
  variableAccounts: VariableAccount[];
  supermarket: SupermarketEntry[];
  fuel: FuelEntry[];
  futureIncomes: FutureIncomeEntry[];
};
