import { useMemo, useState, type FormEvent } from "react";
import { useFinance } from "../context/FinanceContext";
import { formatBRL, formatShortDate, isInMonth, monthKey, parseMoney } from "../utils/format";
import { IconTrash } from "./Icons";

export function FuelView({ embedded = false }: { embedded?: boolean }) {
  const { state, addFuel, removeFuel } = useFinance();
  const [liters, setLiters] = useState("");
  const [price, setPrice] = useState("");
  const [station, setStation] = useState("");
  const [odometer, setOdometer] = useState("");

  const key = monthKey(new Date());
  const monthStats = useMemo(() => {
    const entries = state.fuel.filter((f) => isInMonth(f.date, key));
    const total = entries.reduce((a, f) => a + f.total, 0);
    const L = entries.reduce((a, f) => a + f.liters, 0);
    return { total, liters: L, count: entries.length };
  }, [state.fuel, key]);

  function submit(e: FormEvent) {
    e.preventDefault();
    const L = parseMoney(liters);
    const p = parseMoney(price);
    if (L <= 0 || p <= 0) return;
    const odo = odometer.trim() ? parseMoney(odometer) : undefined;
    addFuel({
      liters: L,
      pricePerLiter: p,
      station: station.trim() || undefined,
      odometer: odo && odo > 0 ? odo : undefined,
      date: new Date().toISOString().slice(0, 10),
    });
    setLiters("");
    setPrice("");
    setStation("");
    setOdometer("");
  }

  return (
    <>
      {!embedded && (
        <>
          <h1 className="page-title">Combustível</h1>
        </>
      )}

      <div className="stat-grid">
        <div className="stat-pill">
          <span>No mês (R$)</span>
          <strong className="amount expense">{formatBRL(monthStats.total)}</strong>
        </div>
        <div className="stat-pill">
          <span>Litros no mês</span>
          <strong>{monthStats.liters.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} L</strong>
        </div>
      </div>

      <form className="card" onSubmit={submit}>
        <h3 style={{ margin: "0 0 12px", fontSize: "0.95rem" }}>Novo abastecimento</h3>
        <div className="form-row">
          <label htmlFor="fu-L">Litros</label>
          <input
            id="fu-L"
            className="input"
            inputMode="decimal"
            value={liters}
            onChange={(e) => setLiters(e.target.value)}
            placeholder="Ex.: 42,5"
          />
        </div>
        <div className="form-row">
          <label htmlFor="fu-p">Preço por litro (R$)</label>
          <input
            id="fu-p"
            className="input"
            inputMode="decimal"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="Ex.: 5,89"
          />
        </div>
        <div className="form-row">
          <label htmlFor="fu-st">Posto (opcional)</label>
          <input
            id="fu-st"
            className="input"
            value={station}
            onChange={(e) => setStation(e.target.value)}
          />
        </div>
        <div className="form-row">
          <label htmlFor="fu-odo">Odômetro (opcional)</label>
          <input
            id="fu-odo"
            className="input"
            inputMode="numeric"
            value={odometer}
            onChange={(e) => setOdometer(e.target.value)}
            placeholder="Km do painel"
          />
        </div>
        <button type="submit" className="btn btn-primary">
          Registrar abastecimento
        </button>
      </form>

      <div className="card">
        <h3 style={{ margin: "0 0 8px", fontSize: "0.95rem" }}>Histórico</h3>
        {state.fuel.length === 0 ? (
          <p className="empty">Nenhum abastecimento registrado.</p>
        ) : (
          state.fuel.map((f) => (
            <div key={f.id} className="list-item">
              <div className="list-item-meta">
                <h4>
                  {f.liters.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} L ·{" "}
                  {formatBRL(f.pricePerLiter)}/L
                </h4>
                <small>
                  {formatShortDate(f.date)}
                  {f.station ? ` · ${f.station}` : ""}
                  {f.odometer != null ? ` · ${f.odometer} km` : ""}
                </small>
              </div>
              <div className="list-item-amount-actions">
                <div className="amount expense">{formatBRL(f.total)}</div>
                <button
                  type="button"
                  className="icon-btn icon-btn--danger"
                  onClick={() => removeFuel(f.id)}
                  aria-label="Excluir abastecimento"
                  title="Excluir"
                >
                  <IconTrash aria-hidden />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
}
