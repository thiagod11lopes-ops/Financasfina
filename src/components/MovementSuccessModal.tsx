export type MovementSuccessKind = "income" | "expense";

const COPY: Record<MovementSuccessKind, { title: string; subtitle: string }> = {
  income: {
    title: "Entrada adicionada!",
    subtitle: "O saldo foi atualizado com sucesso.",
  },
  expense: {
    title: "Gasto lançado!",
    subtitle: "Registrado no fluxo do mês.",
  },
};

type Props = {
  kind: MovementSuccessKind | null;
};

export function MovementSuccessModal({ kind }: Props) {
  if (!kind) return null;

  const { title, subtitle } = COPY[kind];

  return (
    <div className="movement-success-backdrop" role="status" aria-live="polite" aria-atomic="true">
      <div className={`movement-success-panel movement-success-panel--${kind}`}>
        <div className="movement-success-panel__glow" aria-hidden />
        <div className="movement-success-panel__icon-wrap" aria-hidden>
          <svg className="movement-success-panel__icon" viewBox="0 0 52 52">
            <circle className="movement-success-panel__icon-ring" cx="26" cy="26" r="24" />
            <path
              className="movement-success-panel__icon-check"
              d="M14 27 L22 35 L38 17"
              fill="none"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <h2 className="movement-success-panel__title">{title}</h2>
        <p className="movement-success-panel__subtitle">{subtitle}</p>
        <div className="movement-success-panel__progress" aria-hidden>
          <span className="movement-success-panel__progress-bar" />
        </div>
      </div>
    </div>
  );
}
