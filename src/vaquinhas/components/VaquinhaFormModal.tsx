import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { PeriodKind, Vaquinha, VaquinhaInput, VaquinhaPeriod } from "../types";
import {
  currentMonth,
  currentYear,
  monthLabel,
  parseMoneyBRLToCents,
  todayIsoDate,
  yearOptions,
} from "../utils";

type Props = {
  open: boolean;
  mode: "create" | "edit";
  initial?: Vaquinha | null;
  onClose: () => void;
  onSubmit: (input: VaquinhaInput) => void;
};

export function VaquinhaFormModal({ open, mode, initial, onClose, onSubmit }: Props) {
  const [name, setName] = useState("");
  const [total, setTotal] = useState("");
  const [perPerson, setPerPerson] = useState("");
  const [periodKind, setPeriodKind] = useState<PeriodKind>("monthly");
  const [startDate, setStartDate] = useState(todayIsoDate());
  const [endDate, setEndDate] = useState(todayIsoDate());
  const [month, setMonth] = useState(currentMonth());
  const [year, setYear] = useState(currentYear());

  const years = useMemo(() => yearOptions(currentYear()), []);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setName(initial.name);
      setTotal((initial.totalCents / 100).toFixed(2).replace(".", ","));
      setPerPerson((initial.perPersonCents / 100).toFixed(2).replace(".", ","));
      setPeriodKind(initial.period.kind);
      if (initial.period.kind === "range") {
        setStartDate(initial.period.startDateIso);
        setEndDate(initial.period.endDateIso);
        setMonth(currentMonth());
        setYear(currentYear());
      } else if (initial.period.kind === "monthly") {
        setMonth(initial.period.month);
        setYear(initial.period.year);
        setStartDate(todayIsoDate());
        setEndDate(todayIsoDate());
      } else {
        setYear(initial.period.year);
        setMonth(currentMonth());
        setStartDate(todayIsoDate());
        setEndDate(todayIsoDate());
      }
      return;
    }
    setName("");
    setTotal("");
    setPerPerson("");
    setPeriodKind("monthly");
    setStartDate(todayIsoDate());
    setEndDate(todayIsoDate());
    setMonth(currentMonth());
    setYear(currentYear());
  }, [open, mode, initial]);

  const period: VaquinhaPeriod | null = useMemo(() => {
    if (periodKind === "monthly") {
      if (month < 1 || month > 12 || !year) return null;
      return { kind: "monthly", year, month };
    }
    if (periodKind === "yearly") {
      if (!year) return null;
      return { kind: "yearly", year };
    }
    if (!startDate || !endDate || endDate < startDate) return null;
    return { kind: "range", startDateIso: startDate, endDateIso: endDate };
  }, [periodKind, startDate, endDate, month, year]);

  if (!open) return null;

  const canSubmit =
    name.trim().length >= 2 &&
    parseMoneyBRLToCents(total) > 0 &&
    parseMoneyBRLToCents(perPerson) > 0 &&
    period != null;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !period) return;
    onSubmit({
      name: name.trim(),
      totalCents: parseMoneyBRLToCents(total),
      perPersonCents: parseMoneyBRLToCents(perPerson),
      period,
    });
  };

  return (
    <div className="vaq-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="vaq-modal vaq-modal--sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="vaq-form-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="vaq-modal__grab" aria-hidden />
        <h2 id="vaq-form-title" className="vaq-modal__title">
          {mode === "edit" ? "Editar vaquinha" : "Nova vaquinha"}
        </h2>
        <p className="vaq-modal__text">Nome, valores e período (início/fim, mensal ou anual).</p>

        <form className="vaq-form" onSubmit={submit}>
          <label className="vaq-field">
            <span>Nome</span>
            <input
              className="vaq-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Churrasco"
              autoFocus
              autoComplete="off"
            />
          </label>

          <label className="vaq-field">
            <span>Valor total</span>
            <input
              className="vaq-input"
              value={total}
              onChange={(e) => setTotal(e.target.value)}
              placeholder="0,00"
              inputMode="decimal"
              autoComplete="off"
            />
          </label>

          <label className="vaq-field">
            <span>Valor a pagar por cada um</span>
            <input
              className="vaq-input"
              value={perPerson}
              onChange={(e) => setPerPerson(e.target.value)}
              placeholder="0,00"
              inputMode="decimal"
              autoComplete="off"
            />
          </label>

          <fieldset className="vaq-period">
            <legend>Período</legend>
            <div className="vaq-period__kinds" role="radiogroup" aria-label="Tipo de período">
              <button
                type="button"
                role="radio"
                aria-checked={periodKind === "range"}
                className={`vaq-period__chip ${periodKind === "range" ? "is-on" : ""}`}
                onClick={() => setPeriodKind("range")}
              >
                Início e fim
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={periodKind === "monthly"}
                className={`vaq-period__chip ${periodKind === "monthly" ? "is-on" : ""}`}
                onClick={() => {
                  setPeriodKind("monthly");
                  setMonth(currentMonth());
                  setYear(currentYear());
                }}
              >
                Mensal
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={periodKind === "yearly"}
                className={`vaq-period__chip ${periodKind === "yearly" ? "is-on" : ""}`}
                onClick={() => {
                  setPeriodKind("yearly");
                  setYear(currentYear());
                }}
              >
                Anual
              </button>
            </div>

            {periodKind === "range" ? (
              <div className="vaq-period__dates">
                <label className="vaq-field">
                  <span>Data início</span>
                  <input
                    className="vaq-input"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </label>
                <label className="vaq-field">
                  <span>Data fim</span>
                  <input
                    className="vaq-input"
                    type="date"
                    value={endDate}
                    min={startDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </label>
              </div>
            ) : null}

            {periodKind === "monthly" ? (
              <div className="vaq-period__dates vaq-period__dates--split">
                <label className="vaq-field">
                  <span>Mês</span>
                  <select
                    className="vaq-input"
                    value={month}
                    onChange={(e) => setMonth(Number(e.target.value))}
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                      <option key={m} value={m}>
                        {monthLabel(m)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="vaq-field">
                  <span>Ano</span>
                  <select
                    className="vaq-input"
                    value={year}
                    onChange={(e) => setYear(Number(e.target.value))}
                  >
                    {years.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            ) : null}

            {periodKind === "yearly" ? (
              <label className="vaq-field">
                <span>Ano</span>
                <select
                  className="vaq-input"
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value))}
                >
                  {years.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </fieldset>

          <div className="vaq-modal__actions">
            <button type="button" className="vaq-btn vaq-btn--ghost" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="vaq-btn" disabled={!canSubmit}>
              {mode === "edit" ? "Salvar" : "Criar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}