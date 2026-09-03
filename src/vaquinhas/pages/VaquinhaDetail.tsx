import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useVaquinhas } from "../VaquinhasContext";
import { formatMoneyBRLFromCents, monthKeyFromIsoDate, parseMoneyBRLToCents, todayIsoDate } from "../utils";

export function VaquinhaDetail() {
  const { id } = useParams();
  const {
    addTitle,
    toggleTitleStatus,
    removeTitle,
    getVaquinhaById,
  } = useVaquinhas();

  const vaquinha = id ? getVaquinhaById(id) : undefined;

  const [payerName, setPayerName] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState(todayIsoDate());
  const [notes, setNotes] = useState("");

  const totals = useMemo(() => {
    if (!vaquinha) return { expected: 0, paid: 0, pending: 0, pendingCount: 0 };
    const expected = vaquinha.titles.reduce((a, t) => a + t.amountCents, 0);
    const paid = vaquinha.titles.reduce((a, t) => a + (t.status === "paid" ? t.amountCents : 0), 0);
    const pending = expected - paid;
    const pendingCount = vaquinha.titles.filter((t) => t.status === "pending").length;
    return { expected, paid, pending, pendingCount };
  }, [vaquinha]);

  const submitNewTitle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!vaquinha || !id) return;
    const payer = payerName.trim();
    const cents = parseMoneyBRLToCents(amount);
    if (!payer || cents <= 0) return;
    addTitle(vaquinha.id, {
      payerName: payer,
      amountCents: cents,
      dueDateIso: dueDate,
      notes: notes.trim() || undefined,
    } as any);
    setPayerName("");
    setAmount("");
    setNotes("");
    setDueDate(todayIsoDate());
  };

  if (!vaquinha) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-slate-300">
          Vaquinha nÃ£o encontrada.
          <div className="mt-4">
            <Link className="text-cyan-300 hover:underline" to="/vaquinhas">
              Voltar ao dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-5 shadow-[0_0_40px_rgba(6,182,212,0.15)]">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3">
              <Link className="text-cyan-300 hover:underline" to="/vaquinhas">
                â† Vaquinhas
              </Link>
              <span className="text-slate-400">/</span>
              <h1 className="text-2xl font-semibold">{vaquinha.name}</h1>
            </div>
            <p className="text-slate-300 mt-1">Controle de pagantes e tÃ­tulos, com marcaÃ§Ã£o de pago/pendente.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full sm:w-auto">
            <div className="rounded-2xl bg-black/30 border border-white/10 p-3">
              <div className="text-xs text-slate-300">Esperado</div>
              <div className="font-semibold">{formatMoneyBRLFromCents(totals.expected)}</div>
            </div>
            <div className="rounded-2xl bg-black/30 border border-white/10 p-3">
              <div className="text-xs text-slate-300">Pago</div>
              <div className="font-semibold text-emerald-300">{formatMoneyBRLFromCents(totals.paid)}</div>
            </div>
            <div className="rounded-2xl bg-black/30 border border-white/10 p-3">
              <div className="text-xs text-slate-300">Pendente</div>
              <div className="font-semibold text-rose-300">{formatMoneyBRLFromCents(totals.pending)}</div>
              {totals.pendingCount > 0 ? (
                <div className="text-xs text-rose-200/90 mt-1">{totals.pendingCount} tÃ­tulo(s)</div>
              ) : (
                <div className="text-xs text-emerald-200/90 mt-1">Tudo pago</div>
              )}
            </div>
          </div>
        </div>

        {/* add title */}
        <form onSubmit={submitNewTitle} className="mt-5 grid grid-cols-1 md:grid-cols-5 gap-3">
          <label className="block md:col-span-2">
            <span className="text-xs text-slate-300">Pagante</span>
            <input
              className="mt-1 w-full rounded-xl bg-black/30 border border-white/10 p-2 outline-none"
              value={payerName}
              onChange={(e) => setPayerName(e.target.value)}
              placeholder="Nome do pagante"
            />
          </label>

          <label className="block">
            <span className="text-xs text-slate-300">Valor</span>
            <input
              className="mt-1 w-full rounded-xl bg-black/30 border border-white/10 p-2 outline-none"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Ex.: 150,00"
              inputMode="decimal"
            />
          </label>

          <label className="block">
            <span className="text-xs text-slate-300">Vencimento</span>
            <input
              className="mt-1 w-full rounded-xl bg-black/30 border border-white/10 p-2 outline-none"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </label>

          <label className="block md:col-span-2">
            <span className="text-xs text-slate-300">Notas (opcional)</span>
            <input
              className="mt-1 w-full rounded-xl bg-black/30 border border-white/10 p-2 outline-none"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Detalhes"
            />
          </label>

          <div className="md:col-span-5 flex items-end">
            <button
              type="submit"
              className="w-full rounded-2xl bg-gradient-to-r from-purple-500/70 via-cyan-400/60 to-fuchsia-500/50 border border-white/15 px-4 py-2 font-semibold hover:opacity-95 transition"
            >
              + Adicionar tÃ­tulo
            </button>
          </div>
        </form>

        {/* titles */}
        <div className="mt-6">
          <h2 className="text-lg font-semibold mb-3">TÃ­tulos</h2>

          {vaquinha.titles.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-slate-300">
              Nenhum tÃ­tulo ainda. Use o formulÃ¡rio acima.
            </div>
          ) : null}

          <div className="space-y-2">
            {vaquinha.titles
              .slice()
              .sort((a, b) => (a.dueDateIso < b.dueDateIso ? 1 : -1))
              .map((t) => {
                const statusClass =
                  t.status === "paid"
                    ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-100"
                    : "border-rose-400/30 bg-rose-400/10 text-rose-100";

                return (
                  <div key={t.id} className={`rounded-2xl border ${statusClass} bg-opacity-60 backdrop-blur-xl p-3`}>
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div>
                        <div className="font-semibold">{t.payerName}</div>
                        <div className="text-sm text-slate-200/90">
                          {monthKeyFromIsoDate(t.dueDateIso)} Â· {t.dueDateIso}
                        </div>
                        {t.notes ? <div className="text-sm mt-1">{t.notes}</div> : null}
                      </div>

                      <div className="text-right">
                        <div className="font-semibold">{formatMoneyBRLFromCents(t.amountCents)}</div>

                        <div className="mt-2 flex items-center gap-2 justify-end">
                          <button
                            type="button"
                            onClick={() => toggleTitleStatus(vaquinha.id, t.id)}
                            className="rounded-xl border border-white/10 bg-black/20 px-3 py-1 text-sm hover:bg-black/30 transition"
                          >
                            {t.status === "paid" ? "Marcar como pendente" : "Marcar como pago"}
                          </button>

                          <button
                            type="button"
                            onClick={() => removeTitle(vaquinha.id, t.id)}
                            className="rounded-xl border border-white/10 bg-black/20 px-3 py-1 text-sm hover:bg-black/30 transition"
                          >
                            Remover
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </div>
    </div>
  );
}


