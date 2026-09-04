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
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-5 shadow-[0_0_40px_rgba(168,85,247,0.15)]">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <button type="button" onClick={goHome} className="text-cyan-300 hover:underline text-sm">
              ← Voltar ao Finanças
            </button>
            <h1 className="text-2xl font-semibold tracking-tight mt-2">Vaquinhas</h1>
          </div>
          <div className="grid grid-cols-3 gap-2 min-w-[260px]">
            <div className="rounded-2xl bg-black/30 border border-white/10 p-3">
              <div className="text-xs text-slate-300">Esperado</div>
              <div className="text-sm font-semibold">{formatMoneyBRLFromCents(totals.expected)}</div>
            </div>
            <div className="rounded-2xl bg-black/30 border border-white/10 p-3">
              <div className="text-xs text-slate-300">Pago</div>
              <div className="text-sm font-semibold text-emerald-300">{formatMoneyBRLFromCents(totals.paid)}</div>
            </div>
            <div className="rounded-2xl bg-black/30 border border-white/10 p-3">
              <div className="text-xs text-slate-300">Pendente</div>
              <div className="text-sm font-semibold text-rose-300">{formatMoneyBRLFromCents(totals.pending)}</div>
            </div>
          </div>
        </div>

        <form
          className="mt-5 grid grid-cols-1 sm:grid-cols-[1fr_140px_auto] gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!canCreate) return;
            createVaquinha(newName, parseMoneyBRLToCents(newExpected));
            setNewName("");
            setNewExpected("");
          }}
        >
          <input
            className="rounded-xl bg-black/30 border border-white/10 p-2 outline-none"
            placeholder="Título da vaquinha"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <input
            className="rounded-xl bg-black/30 border border-white/10 p-2 outline-none"
            placeholder="Esperado"
            inputMode="decimal"
            value={newExpected}
            onChange={(e) => setNewExpected(e.target.value)}
          />
          <button
            type="submit"
            disabled={!canCreate}
            className="rounded-xl border border-white/10 bg-gradient-to-r from-purple-500/70 via-cyan-400/50 to-fuchsia-500/40 px-4 py-2 font-semibold disabled:opacity-50"
          >
            + Criar
          </button>
        </form>

        <div className="mt-5 space-y-3">
          {items.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-slate-300">
              Nenhuma vaquinha ainda.
            </div>
          ) : null}

          {items.map((v) => {
            const pending = pendingCents(v.expectedCents, v.paidCents);
            return (
              <article key={v.id} className="rounded-3xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-start justify-between gap-3">
                  <input
                    className="bg-transparent border-b border-white/10 focus:border-cyan-300/50 outline-none text-lg font-semibold w-full"
                    value={v.name}
                    onChange={(e) => updateVaquinha(v.id, { name: e.target.value })}
                    aria-label="Título"
                  />
                  <button
                    type="button"
                    className="text-xs text-rose-300 hover:underline shrink-0"
                    onClick={() => {
                      if (!window.confirm(`Apagar "${v.name}"?`)) return;
                      deleteVaquinha(v.id);
                    }}
                  >
                    Apagar
                  </button>
                </div>

                <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <label className="block rounded-2xl bg-black/25 border border-white/10 p-3">
                    <span className="text-xs text-slate-300">Total esperado</span>
                    <input
                      className="mt-1 w-full bg-transparent outline-none font-semibold"
                      inputMode="decimal"
                      defaultValue={(v.expectedCents / 100).toFixed(2).replace(".", ",")}
                      key={`e-${v.id}-${v.expectedCents}`}
                      onBlur={(e) => {
                        const cents = parseMoneyBRLToCents(e.target.value);
                        updateVaquinha(v.id, { expectedCents: cents });
                      }}
                    />
                  </label>

                  <label className="block rounded-2xl bg-black/25 border border-emerald-400/20 p-3">
                    <span className="text-xs text-slate-300">Pago</span>
                    <input
                      className="mt-1 w-full bg-transparent outline-none font-semibold text-emerald-300"
                      inputMode="decimal"
                      defaultValue={(v.paidCents / 100).toFixed(2).replace(".", ",")}
                      key={`p-${v.id}-${v.paidCents}`}
                      onBlur={(e) => {
                        const cents = parseMoneyBRLToCents(e.target.value);
                        updateVaquinha(v.id, { paidCents: cents });
                      }}
                    />
                  </label>

                  <div className="rounded-2xl bg-black/25 border border-rose-400/20 p-3">
                    <div className="text-xs text-slate-300">Pendente</div>
                    <div className="mt-1 font-semibold text-rose-300">{formatMoneyBRLFromCents(pending)}</div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}