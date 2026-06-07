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
  editGuide: string;
  tone: DashboardMetricTone;
};

export const DASHBOARD_METRIC_EXPLAIN: Record<DashboardMetricKey, DashboardMetricExplain> = {
  balance: {
    title: "Saldo atual",
    subtitle: "Quanto você tem disponível neste mês, em tempo real.",
    editGuide:
      "Use os botões + e − ao lado do saldo, aqui no Início, para lançar entradas ou gastos. Para ver ou apagar lançamentos já feitos, abra a aba Fluxo, no menu inferior.",
    tone: "neutral",
  },
  projection: {
    title: "Projeção planeada",
    subtitle: "Estimativa de quanto sobraria ao fechar o mês.",
    editGuide:
      "Este valor é calculado automaticamente. Para influenciá-lo, cadastre entradas futuras em Entradas Futuras; ajuste contas fixas e tetos em Contas (Fixas, Variáveis ou Recorrentes).",
    tone: "projection",
  },
  income: {
    title: "Entradas",
    subtitle: "Todo dinheiro que já entrou no mês selecionado.",
    editGuide:
      "Toque no botão + ao lado do saldo, aqui no Início, e preencha o valor da entrada. Para alterar ou excluir lançamentos, vá em Fluxo e use o histórico (filtro Entrada).",
    tone: "income",
  },
  expenses: {
    title: "Saídas",
    subtitle: "Tudo que já saiu do bolso neste mês.",
    editGuide:
      "Toque no botão − ao lado do saldo para registrar um gasto, ou lançe pela aba Contas (fixas, variáveis ou recorrentes). Para alterar ou excluir itens do fluxo, abra Fluxo e filtre por Saída.",
    tone: "expense",
  },
  pendingFuture: {
    title: "A receber",
    subtitle: "Entradas previstas que ainda não caíram na conta.",
    editGuide:
      "Na barra inferior, abra Entradas Futuras. Use Nova entrada futura ou edite e exclua itens na lista.",
    tone: "income",
  },
  fixedPlanned: {
    title: "Fixas planejadas",
    subtitle: "Compromissos mensais que você definiu nas contas fixas.",
    editGuide:
      "Na barra inferior, abra Contas e escolha Fixas. Crie uma nova conta ou toque no ícone de lápis em uma conta existente para alterar nome e valor mensal.",
    tone: "neutral",
  },
  variableBudget: {
    title: "Tetos variáveis",
    subtitle: "Limite total que você reservou para gastos flexíveis.",
    editGuide:
      "Na barra inferior, abra Contas e escolha Variáveis ou Recorrentes. Defina ou edite o campo Teto mensal ao criar a conta ou pelo ícone de lápis.",
    tone: "expense",
  },
  variableSpend: {
    title: "Gastos variáveis",
    subtitle: "Quanto você já gastou nas contas variáveis e recorrentes.",
    editGuide:
      "Na barra inferior, abra Contas → Variáveis ou Recorrentes e use o botão + em cada conta para lançar gastos. Também pode registrar pelo botão − ao lado do saldo no Início.",
    tone: "expense",
  },
};
