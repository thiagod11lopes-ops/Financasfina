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

export function Dashboard() {
  const { items, createVaquinha } = useVaquinhas();
  const [createOpen, setCreateOpen] = useState(false);
  const [finishedOpen, setFinishedOpen] = useState(false);

  const { active, finished } = useMemo(() => {
    const activeList = [];
    const finishedList = [];
    for (const v of items) {
      if (isVaquinhaFinished(v)) finishedList.push(v);
      else activeList.push(v);
    }
    return { active: activeList, finished: finishedList };
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
        {finished.length > 0 ? (
          <button
            type="button"
            className="vaq-icon-btn vaq-finished-btn"
            onClick={() => setFinishedOpen(true)}
            aria-label={`Ver ${finished.length} vaquinhas finalizadas`}
            title="Finalizadas"
          >
            <ArchiveIcon />
            <span className="vaq-finished-btn__badge">{finished.length}</span>
          </button>
        ) : (
          <span className="vaq-top__spacer" aria-hidden />
        )}
      </div>

      {active.length === 0 ? (
        <div className="vaq-empty">Nenhuma vaquinha em andamento.</div>
      ) : (
        <div className="vaq-active-list">
          {active.map((v) => {
            const paid = vaquinhaPaidCents(v);
            const pending = vaquinhaPendingCents(v);
            return (
              <Link
                key={v.id}
                to={`/vaquinhas/${v.id}`}
                className="vaq-dash vaq-dash--link"
                aria-label={`Abrir ${v.name}`}
              >
                <div className="vaq-dash__glow" aria-hidden />
                <div className="vaq-dash__head">
                  <p className="vaq-dash__eyebrow">
                    Em andamento
                    <span className="vaq-dash__name"> · {v.name}</span>
                  </p>
                  <span className="vaq-name-card__chevron" aria-hidden>
                    ›
                  </span>
                </div>
                <div className="vaq-totals">
                  <div className="vaq-total">
                    <span className="vaq-total__label">Esperado</span>
                    <strong className="vaq-total__value">{formatMoneyBRLFromCents(v.totalCents)}</strong>
                  </div>
                  <div className="vaq-total">
                    <span className="vaq-total__label">Pago</span>
                    <strong className="vaq-total__value vaq-total__value--paid">
                      {formatMoneyBRLFromCents(paid)}
                    </strong>
                  </div>
                  <div className="vaq-total">
                    <span className="vaq-total__label">Pendente</span>
                    <strong className="vaq-total__value vaq-total__value--pending">
                      {formatMoneyBRLFromCents(pending)}
                    </strong>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

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

      {finishedOpen ? (
        <div className="vaq-modal-backdrop" role="presentation" onClick={() => setFinishedOpen(false)}>
          <div
            className="vaq-modal vaq-modal--sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="vaq-finished-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="vaq-modal__grab" aria-hidden />
            <h2 id="vaq-finished-title" className="vaq-modal__title">
              Finalizadas
            </h2>
            <p className="vaq-modal__text">Vaquinhas concluídas com todos os pagamentos.</p>
            <div className="vaq-name-list">
              {finished.map((v) => (
                <Link
                  key={v.id}
                  to={`/vaquinhas/${v.id}`}
                  className="vaq-name-card vaq-name-card--done"
                  onClick={() => setFinishedOpen(false)}
                >
                  <span className="vaq-name-card__title">{v.name}</span>
                  <span className="vaq-name-card__badge">OK</span>
                </Link>
              ))}
            </div>
            <div className="vaq-modal__actions" style={{ marginTop: 14, gridTemplateColumns: "1fr" }}>
              <button type="button" className="vaq-btn vaq-btn--ghost" onClick={() => setFinishedOpen(false)}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ArchiveIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 7.5h16v2.2c0 .4-.3.8-.7.8H4.7c-.4 0-.7-.4-.7-.8V7.5Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M6 10.5h12v8.2c0 .7-.6 1.3-1.3 1.3H7.3c-.7 0-1.3-.6-1.3-1.3v-8.2Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="M9.5 14h5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M5 5.2h14" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}