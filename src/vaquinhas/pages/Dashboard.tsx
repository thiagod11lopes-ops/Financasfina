import { useMemo, useState } from "react";
import { useVaquinhas } from "../VaquinhasContext";
import { formatMoneyBRLFromCents, parseMoneyBRLToCents, pendingCents } from "../utils";

export function Dashboard() {
  const { items, createVaquinha, updateVaquinha, deleteVaquinha } = useVaquinhas();
  const [newName, setNewName] = useState("");
  const [newExpected, setNewExpected] = useState("");

  const totals = useMemo(() => {
    const expected = items.reduce((a, v) => a + v.expectedCents, 0);
    const paid = items.reduce((a, v) => a + v.paidCents, 0);
    return { expected, paid, pending: pendingCents(expected, paid) };
  }, [items]);

  const canCreate = newName.trim().length >= 2 && parseMoneyBRLToCents(newExpected) > 0;

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
        <span style={{ width: 64 }} aria-hidden />
      </div>

      <section className="vaq-totals" aria-label="Totais">
        <div className="vaq-total">
          <span className="vaq-total__label">Esperado</span>
          <strong className="vaq-total__value">{formatMoneyBRLFromCents(totals.expected)}</strong>
        </div>
        <div className="vaq-total">
          <span className="vaq-total__label">Pago</span>
          <strong className="vaq-total__value vaq-total__value--paid">{formatMoneyBRLFromCents(totals.paid)}</strong>
        </div>
        <div className="vaq-total">
          <span className="vaq-total__label">Pendente</span>
          <strong className="vaq-total__value vaq-total__value--pending">
            {formatMoneyBRLFromCents(totals.pending)}
          </strong>
        </div>
      </section>

      <section className="vaq-create" aria-label="Criar nova vaquinha">
        <div className="vaq-create__head">
          <h2 className="vaq-create__title">Nova vaquinha</h2>
          <p className="vaq-create__hint">Informe o título e o valor esperado.</p>
        </div>
        <form
          className="vaq-create__form"
          onSubmit={(e) => {
            e.preventDefault();
            if (!canCreate) return;
            createVaquinha(newName, parseMoneyBRLToCents(newExpected));
            setNewName("");
            setNewExpected("");
          }}
        >
          <label className="vaq-field">
            <span>Título</span>
            <input
              className="vaq-input"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Ex.: Churrasco, Presente..."
              autoComplete="off"
              enterKeyHint="next"
            />
          </label>
          <label className="vaq-field">
            <span>Valor esperado</span>
            <input
              className="vaq-input"
              value={newExpected}
              onChange={(e) => setNewExpected(e.target.value)}
              placeholder="0,00"
              inputMode="decimal"
              autoComplete="off"
              enterKeyHint="done"
            />
          </label>
          <button type="submit" className="vaq-btn" disabled={!canCreate}>
            Criar vaquinha
          </button>
        </form>
      </section>

      <section className="vaq-list" aria-label="Lista de vaquinhas">
        {items.length === 0 ? <div className="vaq-empty">Nenhuma vaquinha ainda.</div> : null}

        {items.map((v) => {
          const pending = pendingCents(v.expectedCents, v.paidCents);
          return (
            <article key={v.id} className="vaq-card">
              <div className="vaq-card__head">
                <input
                  className="vaq-card__title"
                  value={v.name}
                  onChange={(e) => updateVaquinha(v.id, { name: e.target.value })}
                  aria-label="Título da vaquinha"
                />
                <button
                  type="button"
                  className="vaq-card__delete"
                  onClick={() => {
                    if (!window.confirm(`Apagar "${v.name}"?`)) return;
                    deleteVaquinha(v.id);
                  }}
                >
                  Apagar
                </button>
              </div>

              <div className="vaq-card__metrics">
                <label className="vaq-metric">
                  <span>Total esperado</span>
                  <input
                    inputMode="decimal"
                    defaultValue={(v.expectedCents / 100).toFixed(2).replace(".", ",")}
                    key={`e-${v.id}-${v.expectedCents}`}
                    onBlur={(e) => updateVaquinha(v.id, { expectedCents: parseMoneyBRLToCents(e.target.value) })}
                  />
                </label>
                <label className="vaq-metric vaq-metric--paid">
                  <span>Pago</span>
                  <input
                    inputMode="decimal"
                    defaultValue={(v.paidCents / 100).toFixed(2).replace(".", ",")}
                    key={`p-${v.id}-${v.paidCents}`}
                    onBlur={(e) => updateVaquinha(v.id, { paidCents: parseMoneyBRLToCents(e.target.value) })}
                  />
                </label>
                <div className="vaq-metric vaq-metric--pending">
                  <span>Pendente</span>
                  <strong>{formatMoneyBRLFromCents(pending)}</strong>
                </div>
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}