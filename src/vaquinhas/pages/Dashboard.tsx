import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useVaquinhas } from "../VaquinhasContext";
import { formatMoneyBRLFromCents, monthKeyFromIsoDate, todayIsoDate } from "../utils";

export function Dashboard() {
  const { items, createVaquinha, deleteVaquinha } = useVaquinhas();

  const allMonthKeys = useMemo(() => {
    const s = new Set<string>();
    for (const v of items) for (const t of v.titles) s.add(monthKeyFromIsoDate(t.dueDateIso));
    return Array.from(s).sort((a, b) => (a < b ? 1 : -1));
  }, [items]);

  const [monthKey, setMonthKey] = useState<string>(() => allMonthKeys[0] ?? monthKeyFromIsoDate(todayIsoDate()));
  const [vaquinhaId, setVaquinhaId] = useState<string>("all");
  const [payerQuery, setPayerQuery] = useState<string>("");
  const [status, setStatus] = useState<"all" | "paid" | "pending">("all");

  const filteredRows = useMemo(() => {
    const q = payerQuery.trim().toLowerCase();
    const rows: Array<{ vaquinhaId: string; vaquinhaName: string; title: { payerName: string; amountCents: number; dueDateIso: string; status: "paid" | "pending" } }> =
      [];
    for (const v of items) {
      if (vaquinhaId !== "all" && v.id !== vaquinhaId) continue;
      for (const t of v.titles) {
        const mk = monthKeyFromIsoDate(t.dueDateIso);
        if (mk !== monthKey) continue;
        if (status !== "all" && t.status !== status) continue;
        if (q && !t.payerName.toLowerCase().includes(q)) continue;
        rows.push({ vaquinhaId: v.id, vaquinhaName: v.name, title: t });
      }
    }
    return rows;
  }, [items, vaquinhaId, payerQuery, monthKey, status]);

  const summaryByVaquinha = useMemo(() => {
    const map = new Map<string, { name: string; expected: number; paid: number; pending: number }>();
    for (const r of filteredRows) {
      const cur = map.get(r.vaquinhaId) ?? { name: r.vaquinhaName, expected: 0, paid: 0, pending: 0 };
      cur.expected += r.title.amountCents;
      if (r.title.status === "paid") cur.paid += r.title.amountCents;
      if (r.title.status === "pending") cur.pending += r.title.amountCents;
      map.set(r.vaquinhaId, cur);
    }
    return Array.from(map.entries()).map(([id, v]) => ({ id, ...v }));
  }, [filteredRows]);

  const totals = useMemo(() => {
    const expected = filteredRows.reduce((a, r) => a + r.title.amountCents, 0);
    const paid = filteredRows.reduce((a, r) => a + (r.title.status === "paid" ? r.title.amountCents : 0), 0);
    const pending = expected - paid;
    return { expected, paid, pending };
  }, [filteredRows]);

  // create vaquinha (simple)
  const [newName, setNewName] = useState("");
  const canCreate = newName.trim().length >= 2;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-5 shadow-[0_0_40px_rgba(168,85,247,0.15)]">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Vaquinhas <span className="text-cyan-300/80">â€¢</span> Dashboard
            </h1>
            <p className="text-slate-300 mt-1">Controle de pagamentos coletivos com filtros por mÃªs, nome e situaÃ§Ã£o.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full sm:w-auto">
            <div className="rounded-2xl bg-black/30 border border-white/10 p-3">
              <div className="text-xs text-slate-300">Total (esperado)</div>
              <div className="text-lg font-semibold">{formatMoneyBRLFromCents(totals.expected)}</div>
            </div>
            <div className="rounded-2xl bg-black/30 border border-white/10 p-3">
              <div className="text-xs text-slate-300">Pago</div>
              <div className="text-lg font-semibold text-emerald-300">{formatMoneyBRLFromCents(totals.paid)}</div>
            </div>
            <div className="rounded-2xl bg-black/30 border border-white/10 p-3">
              <div className="text-xs text-slate-300">Pendente</div>
              <div className="text-lg font-semibold text-rose-300">{formatMoneyBRLFromCents(totals.pending)}</div>
            </div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 md:grid-cols-4 gap-3">
          <label className="block md:col-span-1">
            <span className="text-xs text-slate-300">MÃªs (mm/aaaa)</span>
            <select
              className="mt-1 w-full rounded-xl bg-black/30 border border-white/10 p-2 outline-none"
              value={monthKey}
              onChange={(e) => setMonthKey(e.target.value)}
              disabled={allMonthKeys.length === 0}
            >
              {allMonthKeys.length === 0 ? <option value={monthKey}>Sem dados</option> : null}
              {allMonthKeys.map((mk) => (
                <option key={mk} value={mk}>
                  {mk}
                </option>
              ))}
            </select>
          </label>

          <label className="block md:col-span-1">
            <span className="text-xs text-slate-300">Vaquinha</span>
            <select
              className="mt-1 w-full rounded-xl bg-black/30 border border-white/10 p-2 outline-none"
              value={vaquinhaId}
              onChange={(e) => setVaquinhaId(e.target.value)}
            >
              <option value="all">Todas</option>
              {items.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block md:col-span-1 md:col-span-2">
            <span className="text-xs text-slate-300">Nome do pagante</span>
            <input
              className="mt-1 w-full rounded-xl bg-black/30 border border-white/10 p-2 outline-none"
              placeholder="Ex.: Ana, JoÃ£o..."
              value={payerQuery}
              onChange={(e) => setPayerQuery(e.target.value)}
            />
          </label>

          <label className="block md:col-span-2">
            <span className="text-xs text-slate-300">SituaÃ§Ã£o</span>
            <select
              className="mt-1 w-full rounded-xl bg-black/30 border border-white/10 p-2 outline-none"
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
            >
              <option value="all">Todas</option>
              <option value="paid">Pago</option>
              <option value="pending">Pendente</option>
            </select>
          </label>
        </div>

        {/* create vaquinha */}
        <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="text-sm font-semibold">Criar nova vaquinha</div>
              <div className="text-xs text-slate-300 mt-1">Cria uma vaquinha vazia; tÃ­tulos sÃ£o adicionados na tela de detalhe.</div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!canCreate) return;
                createVaquinha(newName);
                setNewName("");
              }}
              className="flex items-center gap-2"
            >
              <input
                className="rounded-xl bg-black/30 border border-white/10 p-2 outline-none w-64"
                placeholder="Nome da vaquinha"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
              <button
                type="submit"
                disabled={!canCreate}
                className="rounded-xl border border-white/10 bg-gradient-to-r from-purple-500/70 via-cyan-400/50 to-fuchsia-500/40 px-4 py-2 font-semibold disabled:opacity-50"
              >
                + Criar
              </button>
            </form>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-3">
          {summaryByVaquinha.length === 0 ? (
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-slate-300">
              Nenhuma vaquinha com os filtros selecionados para <span className="text-slate-100 font-semibold">{monthKey}</span>.
            </div>
          ) : null}

          {summaryByVaquinha.map((v) => (
            <Link
              key={v.id}
              to={`/vaquinhas/${v.id}`}
              className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl hover:bg-white/10 transition"
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm text-slate-300">Vaquinha</div>
                  <div className="text-lg font-semibold">{v.name}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-300">Esperado</div>
                  <div className="font-semibold">{formatMoneyBRLFromCents(v.expected)}</div>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-black/25 border border-white/10 p-3">
                  <div className="text-xs text-slate-300">Pago</div>
                  <div className="text-sm font-semibold text-emerald-300">{formatMoneyBRLFromCents(v.paid)}</div>
                </div>
                <div className="rounded-2xl bg-black/25 border border-white/10 p-3">
                  <div className="text-xs text-slate-300">Pendente</div>
                  <div className="text-sm font-semibold text-rose-300">{formatMoneyBRLFromCents(v.pending)}</div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {items.length > 0 ? (
          <div className="mt-5">
            <div className="text-xs text-slate-400">Gerenciar vaquinhas (apagar remove tÃ­tulos tambÃ©m)</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {items.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => {
                    // confirm simples sem depender de libs
                    // eslint-disable-next-line no-alert
                    const ok = window.confirm(`Apagar "${v.name}"? Isso remove todos os tÃ­tulos.`);
                    if (!ok) return;
                    deleteVaquinha(v.id);
                  }}
                  className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm hover:bg-black/30 transition"
                >
                  Apagar: {v.name}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}


