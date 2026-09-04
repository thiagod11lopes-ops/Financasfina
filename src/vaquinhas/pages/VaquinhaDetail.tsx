import { useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useVaquinhas } from "../VaquinhasContext";
import { formatMoneyBRLFromCents, formatPeriodLabel, vaquinhaPaidCents, vaquinhaPendingCents } from "../utils";
import { ConfirmModal } from "../components/ConfirmModal";

export function VaquinhaDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const {
    getVaquinhaById,
    addPerson,
    updatePerson,
    setPersonStatus,
    removePerson,
    deleteVaquinha,
  } = useVaquinhas();

  const vaquinha = id ? getVaquinhaById(id) : undefined;
  const [personName, setPersonName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [confirmPersonId, setConfirmPersonId] = useState<string | null>(null);
  const [confirmDeleteVaquinha, setConfirmDeleteVaquinha] = useState(false);

  const totals = useMemo(() => {
    if (!vaquinha) return { paid: 0, pending: 0 };
    return {
      paid: vaquinhaPaidCents(vaquinha),
      pending: vaquinhaPendingCents(vaquinha),
    };
  }, [vaquinha]);

  if (!vaquinha) {
    return (
      <div className="vaq-page">
        <p className="vaq-empty">Vaquinha nÃ£o encontrada.</p>
        <Link className="vaq-back" to="/vaquinhas">
          Voltar
        </Link>
      </div>
    );
  }

  const submitPerson = (e: FormEvent) => {
    e.preventDefault();
    if (!personName.trim()) return;
    addPerson(vaquinha.id, personName);
    setPersonName("");
  };

  const confirmPerson = vaquinha.people.find((p) => p.id === confirmPersonId);

  return (
    <div className="vaq-page">
      <div className="vaq-top">
        <Link to="/vaquinhas" className="vaq-back">
          Voltar
        </Link>
        <h1 className="vaq-title vaq-title--compact">{vaquinha.name}</h1>
        <button
          type="button"
          className="vaq-icon-btn vaq-icon-btn--danger"
          aria-label="Excluir vaquinha"
          onClick={() => setConfirmDeleteVaquinha(true)}
        >
          <TrashIcon />
        </button>
      </div>

      <section className="vaq-dash vaq-dash--compact" aria-label="Resumo">
        <p className="vaq-dash__period vaq-dash__period--block">{formatPeriodLabel(vaquinha.period)}</p>
        <div className="vaq-meta-row">
          <div>
            <span className="vaq-total__label">Total</span>
            <strong className="vaq-total__value">{formatMoneyBRLFromCents(vaquinha.totalCents)}</strong>
          </div>
          <div>
            <span className="vaq-total__label">Por pessoa</span>
            <strong className="vaq-total__value">{formatMoneyBRLFromCents(vaquinha.perPersonCents)}</strong>
          </div>
        </div>
        <div className="vaq-totals">
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

      <form className="vaq-create vaq-create--inline" onSubmit={submitPerson}>
        <label className="vaq-field">
          <span>Adicionar pessoa</span>
          <div className="vaq-inline-row">
            <input
              className="vaq-input"
              value={personName}
              onChange={(e) => setPersonName(e.target.value)}
              placeholder="Nome"
              autoComplete="off"
            />
            <button type="submit" className="vaq-btn vaq-btn--mini" disabled={!personName.trim()}>
              +
            </button>
          </div>
        </label>
      </form>

      <section className="vaq-people" aria-label="Pessoas">
        {vaquinha.people.length === 0 ? (
          <div className="vaq-empty">Nenhuma pessoa ainda.</div>
        ) : null}

        {vaquinha.people.map((p) => (
          <article key={p.id} className="vaq-person">
            <div className="vaq-person__row">
              {editingId === p.id ? (
                <input
                  className="vaq-input vaq-input--compact vaq-person__name-input"
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onBlur={() => {
                    updatePerson(vaquinha.id, p.id, { name: editingName });
                    setEditingId(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      updatePerson(vaquinha.id, p.id, { name: editingName });
                      setEditingId(null);
                    }
                  }}
                  autoFocus
                />
              ) : (
                <h3 className="vaq-person__name">{p.name}</h3>
              )}

              <div className="vaq-check-group" role="radiogroup" aria-label={`SituaÃ§Ã£o de ${p.name}`}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={p.status === "paid"}
                  className={`vaq-check ${p.status === "paid" ? "is-on is-paid" : ""}`}
                  onClick={() => setPersonStatus(vaquinha.id, p.id, "paid")}
                >
                  <span className="vaq-check__dot" aria-hidden />
                  Pago
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={p.status === "pending"}
                  className={`vaq-check ${p.status === "pending" ? "is-on is-pending" : ""}`}
                  onClick={() => setPersonStatus(vaquinha.id, p.id, "pending")}
                >
                  <span className="vaq-check__dot" aria-hidden />
                  Pendente
                </button>
              </div>

              <div className="vaq-person__actions">
                <button
                  type="button"
                  className="vaq-icon-btn"
                  aria-label={`Editar ${p.name}`}
                  onClick={() => {
                    setEditingId(p.id);
                    setEditingName(p.name);
                  }}
                >
                  <EditIcon />
                </button>
                <button
                  type="button"
                  className="vaq-icon-btn vaq-icon-btn--danger"
                  aria-label={`Excluir ${p.name}`}
                  onClick={() => setConfirmPersonId(p.id)}
                >
                  <TrashIcon />
                </button>
              </div>
            </div>
          </article>
        ))}
      </section>

      <ConfirmModal
        open={confirmPersonId !== null}
        title="Excluir pessoa?"
        message={
          confirmPerson
            ? `Remover "${confirmPerson.name}" desta vaquinha?`
            : "Remover esta pessoa?"
        }
        onCancel={() => setConfirmPersonId(null)}
        onConfirm={() => {
          if (confirmPersonId) removePerson(vaquinha.id, confirmPersonId);
          setConfirmPersonId(null);
        }}
      />

      <ConfirmModal
        open={confirmDeleteVaquinha}
        title="Excluir vaquinha?"
        message={`Apagar "${vaquinha.name}" e todas as pessoas?`}
        onCancel={() => setConfirmDeleteVaquinha(false)}
        onConfirm={() => {
          deleteVaquinha(vaquinha.id);
          setConfirmDeleteVaquinha(false);
          navigate("/vaquinhas");
        }}
      />
    </div>
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
      <path
        d="M8 7l1 13h6l1-13"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}