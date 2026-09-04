import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useVaquinhas } from "../VaquinhasContext";
import {
  formatMoneyBRLFromCents,
  isVaquinhaFinished,
  vaquinhaPaidCents,
  vaquinhaPendingCents,
} from "../utils";
import { CreateVaquinhaModal } from "../components/CreateVaquinhaModal";
import type { Vaquinha } from "../types";

function summarize(list: Vaquinha[]) {
  const expected = list.reduce((a, v) => a + v.totalCents, 0);
  const paid = list.reduce((a, v) => a + vaquinhaPaidCents(v), 0);
  const pending = list.reduce((a, v) => a + vaquinhaPendingCents(v), 0);
  return { expected, paid, pending, count: list.length };
}

export function Dashboard() {
  const { items, createVaquinha } = useVaquinhas();
  const [createOpen, setCreateOpen] = useState(false);

  const { active, finished } = useMemo(() => {
    const activeList: Vaquinha[] = [];
    const finishedList: Vaquinha[] = [];
    for (const v of items) {
      if (isVaquinhaFinished(v)) finishedList.push(v);
      else activeList.push(v);
    }
    return { active: activeList, finished: finishedList };
  }, [items]);

  const activeTotals = useMemo(() => summarize(active), [active]);
  const finishedTotals = useMemo(() => summarize(finished), [finished]);

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

      <section className="vaq-dash" aria-label="Dashboard em andamento">
        <div className="vaq-dash__glow" aria-hidden />
        <div className="vaq-dash__head">
          <p className="vaq-dash__eyebrow">Em andamento</p>
          <span className="vaq-dash__count">{activeTotals.count}</span>
        </div>
        <div className="vaq-totals">
          <div className="vaq-total">
            <span className="vaq-total__label">Esperado</span>
            <strong className="vaq-total__value">{formatMoneyBRLFromCents(activeTotals.expected)}</strong>
          </div>
          <div className="vaq-total">
            <span className="vaq-total__label">Pago</span>
            <strong className="vaq-total__value vaq-total__value--paid">
              {formatMoneyBRLFromCents(activeTotals.paid)}
            </strong>
          </div>
          <div className="vaq-total">
            <span className="vaq-total__label">Pendente</span>
            <strong className="vaq-total__value vaq-total__value--pending">
              {formatMoneyBRLFromCents(activeTotals.pending)}
            </strong>
          </div>
        </div>
      </section>

      <section className="vaq-dash vaq-dash--finished" aria-label="Dashboard finalizadas">
        <div className="vaq-dash__head">
          <p className="vaq-dash__eyebrow">Finalizadas</p>
          <span className="vaq-dash__count">{finishedTotals.count}</span>
        </div>
        <div className="vaq-totals">
          <div className="vaq-total">
            <span className="vaq-total__label">Total</span>
            <strong className="vaq-total__value">{formatMoneyBRLFromCents(finishedTotals.expected)}</strong>
          </div>
          <div className="vaq-total">
            <span className="vaq-total__label">Pago</span>
            <strong className="vaq-total__value vaq-total__value--paid">
              {formatMoneyBRLFromCents(finishedTotals.paid)}
            </strong>
          </div>
          <div className="vaq-total">
            <span className="vaq-total__label">Concluídas</span>
            <strong className="vaq-total__value">{finishedTotals.count}</strong>
          </div>
        </div>
      </section>

      {active.length > 0 ? (
        <section className="vaq-names" aria-label="Vaquinhas em andamento">
          <h2 className="vaq-section-title">Atuais</h2>
          <div className="vaq-name-list">
            {active.map((v) => (
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

      {finished.length > 0 ? (
        <section className="vaq-names" aria-label="Vaquinhas finalizadas">
          <h2 className="vaq-section-title">Finalizadas</h2>
          <div className="vaq-name-list">
            {finished.map((v) => (
              <Link key={v.id} to={`/vaquinhas/${v.id}`} className="vaq-name-card vaq-name-card--done">
                <span className="vaq-name-card__title">{v.name}</span>
                <span className="vaq-name-card__badge">OK</span>
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
          createVaquinha(input);
          setCreateOpen(false);
        }}
      />
    </div>
  );
}