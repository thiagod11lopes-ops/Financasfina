import type { ReactNode } from "react";
import { formatBRL } from "../utils/format";
import type { DashboardMetricKey } from "./dashboardMetricExplain";

type Tone = "income" | "expense" | "neutral";

function StatMetric({
  metricKey,
  label,
  value,
  tone = "neutral",
  hint,
  onOpenExplain,
}: {
  metricKey: DashboardMetricKey;
  label: string;
  value: number;
  tone?: Tone;
  hint?: string;
  onOpenExplain: (key: DashboardMetricKey) => void;
}) {
  const toneClass = tone === "neutral" ? "" : ` dash-stat-metric--${tone}`;
  return (
    <button
      type="button"
      className={`dash-stat-metric dash-stat-metric-btn${toneClass}`}
      onClick={() => onOpenExplain(metricKey)}
      aria-label={`${label}: ${formatBRL(value)}. Toque para saber mais.`}
    >
      <span className="dash-stat-metric__label">{label}</span>
      <strong className="dash-stat-metric__value">{formatBRL(value)}</strong>
      {hint ? <p className="dash-stat-metric__hint">{hint}</p> : null}
      <span className="dash-stat-metric__chevron" aria-hidden>
        ›
      </span>
    </button>
  );
}

function StatCell({
  area,
  column,
  children,
}: {
  area: string;
  column: "mov" | "orc";
  children: ReactNode;
}) {
  return (
    <div
      className={`dash-stats-cell dash-stats-cell--${column}`}
      style={{ gridArea: area }}
    >
      {children}
    </div>
  );
}

type Props = {
  income: number;
  totalOut: number;
  pendingFutureMonthTotal: number;
  fixedPlanned: number;
  variableBudgetTotal: number;
  variableSpendGrandTotal: number;
  onOpenExplain: (key: DashboardMetricKey) => void;
};

export function DashboardStats({
  income,
  totalOut,
  pendingFutureMonthTotal,
  fixedPlanned,
  variableBudgetTotal,
  variableSpendGrandTotal,
  onOpenExplain,
}: Props) {
  return (
    <section className="dash-stats card" aria-label="Detalhes do mês">
      <div className="dash-stats-layout">
        <header className="dash-stats-group__head dash-stats-group__head--mov" style={{ gridArea: "mov-head" }}>
          <h3 className="dash-stats-group__title">Movimentação</h3>
          <p className="dash-stats-group__desc">O que já entrou, saiu e ainda vai entrar.</p>
        </header>
        <header className="dash-stats-group__head dash-stats-group__head--orc" style={{ gridArea: "orc-head" }}>
          <h3 className="dash-stats-group__title">Orçamento</h3>
          <p className="dash-stats-group__desc">Compromissos fixos e tetos das variáveis.</p>
        </header>

        <StatCell area="mov-1" column="mov">
          <StatMetric metricKey="income" label="Entradas" value={income} tone="income" onOpenExplain={onOpenExplain} />
        </StatCell>
        <StatCell area="orc-1" column="orc">
          <StatMetric metricKey="fixedPlanned" label="Fixas planejadas" value={fixedPlanned} onOpenExplain={onOpenExplain} />
        </StatCell>

        <StatCell area="mov-2" column="mov">
          <StatMetric metricKey="expenses" label="Saídas" value={totalOut} tone="expense" onOpenExplain={onOpenExplain} />
        </StatCell>
        <StatCell area="orc-2" column="orc">
          <StatMetric
            metricKey="variableBudget"
            label="Tetos variáveis"
            value={variableBudgetTotal}
            tone="expense"
            hint="Limite total"
            onOpenExplain={onOpenExplain}
          />
        </StatCell>

        <StatCell area="mov-3" column="mov">
          <StatMetric
            metricKey="pendingFuture"
            label="A receber"
            value={pendingFutureMonthTotal}
            tone="income"
            hint="Entradas futuras"
            onOpenExplain={onOpenExplain}
          />
        </StatCell>
        <StatCell area="orc-3" column="orc">
          <StatMetric
            metricKey="variableSpend"
            label="Gastos variáveis"
            value={variableSpendGrandTotal}
            tone="expense"
            hint="Já lançados"
            onOpenExplain={onOpenExplain}
          />
        </StatCell>
      </div>
    </section>
  );
}
