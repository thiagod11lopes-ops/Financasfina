export type DashboardMetricKey =
  | "balance"
  | "projection"
  | "income"
  | "expenses"
  | "pendingFuture"
  | "fixedPlanned"
  | "variableBudget"
  | "variableSpend";

export type DashboardMetricTone = "income" | "expense" | "neutral" | "projection";

export type DashboardMetricExplain = {
  title: string;
  subtitle: string;
  tone: DashboardMetricTone;
};

export const DASHBOARD_METRIC_EXPLAIN: Record<DashboardMetricKey, DashboardMetricExplain> = {
  balance: {
    title: "Saldo atual",
    subtitle: "Quanto você tem disponível neste mês, em tempo real.",
    tone: "neutral",
  },
  projection: {
    title: "Projeção planeada",
    subtitle: "Estimativa de quanto sobraria ao fechar o mês.",
    tone: "projection",
  },
  income: {
    title: "Entradas",
    subtitle: "Todo dinheiro que já entrou no mês selecionado.",
    tone: "income",
  },
  expenses: {
    title: "Saídas",
    subtitle: "Tudo que já saiu do bolso neste mês.",
    tone: "expense",
  },
  pendingFuture: {
    title: "A receber",
    subtitle: "Entradas previstas que ainda não caíram na conta.",
    tone: "income",
  },
  fixedPlanned: {
    title: "Fixas planejadas",
    subtitle: "Compromissos mensais que você definiu nas contas fixas.",
    tone: "neutral",
  },
  variableBudget: {
    title: "Tetos variáveis",
    subtitle: "Limite total que você reservou para gastos flexíveis.",
    tone: "expense",
  },
  variableSpend: {
    title: "Gastos variáveis",
    subtitle: "Quanto você já gastou nas contas variáveis e recorrentes.",
    tone: "expense",
  },
};
