import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useVaquinhas } from "../VaquinhasContext";
import { formatMoneyBRLFromCents, vaquinhaPaidCents, vaquinhaPendingCents } from "../utils";
import { CreateVaquinhaModal } from "../components/CreateVaquinhaModal";

export function Dashboard() {
  const { items, createVaquinha } = useVaquinhas();
  const [createOpen, setCreateOpen] = useState(false);

  const totals = useMemo(() => {
    const expected = items.reduce((a, v) => a + v.totalCents, 0);
    const paid = items.reduce((a, v) => a + vaquinhaPaidCents(v), 0);
    const pending = items.reduce((a, v) => a + vaquinhaPendingCents(v), 0);
    return { expected, paid, pending };
  }, [items]);

  const goHome = () => {
    const base = import.meta.env.BASE_URL || "/";
    const prefix = base.endsWith("/") ? base : `${base}/`;
    window.history.pushState({}, "", prefix);
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  return (
    <div className="vaq-page">
      <div className="vaq-top">
        <button type="button" className="vaq-back" onClick={goHome}>
          Voltar
        </button>
        <h1 className="vaq-title">Vaquinhas</h1>
        <span className="vaq-top__spacer" aria-hidden />
      </div>

      <section className="vaq-dash" aria-label="Dashboard">
        <div className="vaq-dash__glow" aria-hidden />
        <p className="vaq-dash__eyebrow">Dashboard</p>
        <div className="vaq-totals">
          <div className="vaq-total">
            <span className="vaq-total__label">Esperado</span>
            <strong className="vaq-total__value">{formatMoneyBRLFromCents(totals.expected)}</strong>
          </div>
          <div className="vaq-total">
            <span className="vaq-total__label">Pago</span>
            <strong className="vaq-total__value vaq-total__value--paid">
              {formatMoneyBRLFromCents(totals.paid)}
            </strong>
          </div>
          <div className="vaq-total">
            <span className="vaq-total__label">Pendente</span>
            <strong className="vaq-total__value vaq-total__value--pending">
              {formatMoneyBRLFromCents(totals.pending)}
            </strong>
          </div>
        </div>
      </section>

      {items.length > 0 ? (
        <section className="vaq-names" aria-label="Vaquinhas criadas">
          <h2 className="vaq-section-title">Suas vaquinhas</h2>
          <div className="vaq-name-list">
            {items.map((v) => (
              <Link key={v.id} to={`/vaquinhas/${v.id}`} className="vaq-name-card">
                <span className="vaq-name-card__title">{v.name}</span>
                <span className="vaq-name-card__chevron" aria-hidden>
                  ›
                </span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <button
        type="button"
        className="vaq-fab"
        onClick={() => setCreateOpen(true)}
        aria-label="Adicionar nova vaquinha"
        title="Nova vaquinha"
      >
        <span className="vaq-fab__ring" aria-hidden />
        <span className="vaq-fab__plus" aria-hidden>
          +
        </span>
      </button>

      <CreateVaquinhaModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={(input) => {
          const id = createVaquinha(input);
          setCreateOpen(false);
          if (id) {
            // stay on list; user can tap the new name
          }
        }}
      />
    </div>
  );
}