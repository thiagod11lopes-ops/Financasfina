import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useVaquinhas } from "../VaquinhasContext";
import {
  formatMoneyBRLFromCents,
  formatPeriodLabel,
  isVaquinhaFinished,
  vaquinhaPaidCents,
  vaquinhaPendingCents,
} from "../utils";
import { VaquinhaFormModal } from "../components/VaquinhaFormModal";
import { ConfirmModal } from "../components/ConfirmModal";
import { CopyLastVaquinhaModal } from "../components/CopyLastVaquinhaModal";
import type { Vaquinha, VaquinhaInput } from "../types";

export function Dashboard() {
  const { items, createVaquinha, updateVaquinha, deleteVaquinha } = useVaquinhas();
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);
  const [createDraft, setCreateDraft] = useState<Vaquinha | null>(null);
  const [copyPromptOpen, setCopyPromptOpen] = useState(false);
  const [finishedOpen, setFinishedOpen] = useState(false);
  const [editing, setEditing] = useState<Vaquinha | null>(null);
  const [deleting, setDeleting] = useState<Vaquinha | null>(null);

  const { active, finished } = useMemo(() => {
    const activeList: Vaquinha[] = [];
    const finishedList: Vaquinha[] = [];
    for (const v of items) {
      if (isVaquinhaFinished(v)) finishedList.push(v);
      else activeList.push(v);
    }
    const byNewest = (a: Vaquinha, b: Vaquinha) => (a.createdAtIso < b.createdAtIso ? 1 : -1);
    activeList.sort(byNewest);
    finishedList.sort(byNewest);
    return { active: activeList, finished: finishedList };
  }, [items]);

  const lastVaquinha = useMemo(() => {
    if (!items.length) return null;
    return [...items].sort((a, b) => (a.createdAtIso < b.createdAtIso ? 1 : -1))[0] ?? null;
  }, [items]);

  const openCreateBlank = () => {
    setCreateDraft(null);
    setCreateOpen(true);
  };

  const openCreateFromLast = () => {
    if (!lastVaquinha) {
      openCreateBlank();
      return;
    }
    setCreateDraft(lastVaquinha);
    setCreateOpen(true);
  };

  const startCreateFlow = () => {
    if (lastVaquinha) {
      setCopyPromptOpen(true);
      return;
    }
    openCreateBlank();
  };

  const closeCreate = () => {
    setCreateOpen(false);
    setCreateDraft(null);
  };

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
        <div className="vaq-top__right">
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
          ) : null}
          <button
            type="button"
            className="vaq-add-top"
            onClick={startCreateFlow}
            aria-label="Adicionar nova vaquinha"
            title="Nova vaquinha"
          >
            <span className="vaq-add-top__plus" aria-hidden>
              +
            </span>
          </button>
        </div>
      </div>

      {active.length === 0 ? (
        <div className="vaq-empty">Nenhuma vaquinha em andamento.</div>
      ) : (
        <div className="vaq-active-list">
          {active.map((v) => {
            const paid = vaquinhaPaidCents(v);
            const pending = vaquinhaPendingCents(v);
            return (
              <article key={v.id} className="vaq-dash">
                <div className="vaq-dash__glow" aria-hidden />
                <div className="vaq-dash__head">
                  <button
                    type="button"
                    className="vaq-dash__open"
                    onClick={() => navigate(`/vaquinhas/${v.id}`)}
                  >
                    <p className="vaq-dash__eyebrow">
                      Em andamento
                      <span className="vaq-dash__name"> - {v.name}</span>
                    </p>
                    <span className="vaq-dash__period">{formatPeriodLabel(v.period)}</span>
                  </button>
                  <div className="vaq-dash__actions">
                    <button
                      type="button"
                      className="vaq-icon-btn"
                      aria-label={`Editar ${v.name}`}
                      onClick={() => setEditing(v)}
                    >
                      <EditIcon />
                    </button>
                    <button
                      type="button"
                      className="vaq-icon-btn vaq-icon-btn--danger"
                      aria-label={`Excluir ${v.name}`}
                      onClick={() => setDeleting(v)}
                    >
                      <TrashIcon />
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  className="vaq-dash__body"
                  onClick={() => navigate(`/vaquinhas/${v.id}`)}
                >
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
                </button>
              </article>
            );
          })}
        </div>
      )}

      <CopyLastVaquinhaModal
        open={copyPromptOpen}
        source={lastVaquinha}
        onClose={() => setCopyPromptOpen(false)}
        onNo={() => {
          setCopyPromptOpen(false);
          openCreateBlank();
        }}
        onYes={() => {
          setCopyPromptOpen(false);
          openCreateFromLast();
        }}
      />

      <VaquinhaFormModal
        open={createOpen}
        mode="create"
        initial={createDraft}
        onClose={closeCreate}
        onSubmit={(input: VaquinhaInput) => {
          createVaquinha(input);
          closeCreate();
        }}
      />

      <VaquinhaFormModal
        open={editing !== null}
        mode="edit"
        initial={editing}
        onClose={() => setEditing(null)}
        onSubmit={(input: VaquinhaInput) => {
          if (!editing) return;
          updateVaquinha(editing.id, input);
          setEditing(null);
        }}
      />

      <ConfirmModal
        open={deleting !== null}
        title="Excluir vaquinha?"
        message={deleting ? `Apagar "${deleting.name}" e todas as pessoas?` : ""}
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) deleteVaquinha(deleting.id);
          setDeleting(null);
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
            <p className="vaq-modal__text">Vaquinhas concluÃ­das com todos os pagamentos.</p>
            <div className="vaq-name-list">
              {finished.map((v) => (
                <div key={v.id} className="vaq-name-card vaq-name-card--done">
                  <button
                    type="button"
                    className="vaq-name-card__main"
                    onClick={() => {
                      setFinishedOpen(false);
                      navigate(`/vaquinhas/${v.id}`);
                    }}
                  >
                    <span className="vaq-name-card__title">{v.name}</span>
                    <span className="vaq-dash__period">{formatPeriodLabel(v.period)}</span>
                  </button>
                  <div className="vaq-dash__actions">
                    <button
                      type="button"
                      className="vaq-icon-btn"
                      aria-label={`Editar ${v.name}`}
                      onClick={() => {
                        setFinishedOpen(false);
                        setEditing(v);
                      }}
                    >
                      <EditIcon />
                    </button>
                    <button
                      type="button"
                      className="vaq-icon-btn vaq-icon-btn--danger"
                      aria-label={`Excluir ${v.name}`}
                      onClick={() => {
                        setFinishedOpen(false);
                        setDeleting(v);
                      }}
                    >
                      <TrashIcon />
                    </button>
                  </div>
                </div>
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

function EditIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="M13 6.5 17.5 11" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M5 7h14" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M9 7V5h6v2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M8 7l1 13h6l1-13" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  );
}