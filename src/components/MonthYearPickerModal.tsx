import { useCallback, useEffect, useRef, useState } from "react";
import { formatMonthLabelPt } from "../utils/format";
import { IconChevronLeft, IconChevronRight, IconX } from "./Icons";

const YEAR_MIN = 2000;
const YEAR_MAX = 2100;

function parseYm(ym: string): { y: number; m: number } {
  const [ys, ms] = ym.split("-");
  const y = Number(ys);
  const m = Number(ms);
  if (!y || !m || m < 1 || m > 12) {
    const d = new Date();
    return { y: d.getFullYear(), m: d.getMonth() + 1 };
  }
  return { y, m };
}

function ymKey(y: number, m: number) {
  return `${y}-${String(m).padStart(2, "0")}`;
}

function monthShortLabel(m: number): string {
  const raw = new Date(2000, m - 1, 1).toLocaleDateString("pt-BR", { month: "short" });
  return raw.replace(/\.+$/, "");
}

type Props = {
  open: boolean;
  initialYm: string;
  existingTabs: string[];
  onClose: () => void;
  onConfirm: (ym: string) => void;
  /** `add`: incluir mês no resumo. `delete`: escolher mês para apagar lançamentos. */
  mode?: "add" | "delete";
  /** Obrigatório em `mode="delete"` para resumo e desabilitar mês sem dados. */
  getMonthEntryCount?: (ym: string) => number;
};

export function MonthYearPickerModal({
  open,
  initialYm,
  existingTabs,
  onClose,
  onConfirm,
  mode = "add",
  getMonthEntryCount,
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [year, setYear] = useState(() => parseYm(initialYm).y);
  const [month, setMonth] = useState(() => parseYm(initialYm).m);

  useEffect(() => {
    if (!open) return;
    const { y, m } = parseYm(initialYm);
    setYear(y);
    setMonth(m);
  }, [open, initialYm]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const { m } = parseYm(initialYm);
    const id = window.requestAnimationFrame(() => {
      panelRef.current?.querySelector<HTMLButtonElement>(`button[data-month="${m}"]`)?.focus();
    });
    return () => window.cancelAnimationFrame(id);
  }, [open, initialYm]);

  const decYear = useCallback(() => setYear((y) => Math.max(YEAR_MIN, y - 1)), []);
  const incYear = useCallback(() => setYear((y) => Math.min(YEAR_MAX, y + 1)), []);

  const handleConfirm = useCallback(() => {
    onConfirm(ymKey(year, month));
  }, [year, month, onConfirm]);

  if (!open) return null;

  const draftYm = ymKey(year, month);
  const alreadyIn = existingTabs.includes(draftYm);
  const isDelete = mode === "delete";
  const entryCount = isDelete ? (getMonthEntryCount?.(draftYm) ?? 0) : 0;
  const deleteDisabled = isDelete && entryCount === 0;

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        ref={panelRef}
        className="modal-panel month-year-picker-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="month-year-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <div className="modal-head__text">
            <h2 id="month-year-modal-title">
              {isDelete ? "Excluir dados de um mês" : "Novo mês no resumo"}
            </h2>
            <p>
              {isDelete
                ? "Remove lançamentos do fluxo, mercado, combustível e gastos variáveis desse mês. Contas fixas e contas variáveis (cadastro) permanecem."
                : "Escolha o ano e o mês para acompanhar neste painel."}
            </p>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Fechar">
            <IconX aria-hidden />
          </button>
        </div>

        <div className="month-year-picker">
          <p className="month-year-picker__preview" aria-live="polite">
            {formatMonthLabelPt(draftYm)}
          </p>
          {isDelete ? (
            <p className="month-year-picker__count" aria-live="polite">
              {entryCount === 0
                ? "Nenhum lançamento neste mês."
                : `${entryCount} lançamento${entryCount === 1 ? "" : "s"} neste mês.`}
            </p>
          ) : null}

          <div className="month-year-picker__year-row">
            <button
              type="button"
              className="month-year-picker__year-nav"
              onClick={decYear}
              disabled={year <= YEAR_MIN}
              aria-label="Ano anterior"
            >
              <IconChevronLeft aria-hidden />
            </button>
            <span className="month-year-picker__year-display" aria-live="polite">
              {year}
            </span>
            <button
              type="button"
              className="month-year-picker__year-nav"
              onClick={incYear}
              disabled={year >= YEAR_MAX}
              aria-label="Próximo ano"
            >
              <IconChevronRight aria-hidden />
            </button>
          </div>

          <div className="month-year-picker__grid">
            {Array.from({ length: 12 }, (_, i) => {
              const m = i + 1;
              const ym = ymKey(year, m);
              const sel = m === month;
              const inList = !isDelete && existingTabs.includes(ym);
              const cellCount = isDelete ? (getMonthEntryCount?.(ym) ?? 0) : 0;
              return (
                <button
                  key={m}
                  type="button"
                  data-month={m}
                  aria-pressed={sel}
                  className={`month-year-picker__cell ${sel ? "is-selected" : ""} ${inList ? "is-inlist" : ""}`}
                  onClick={() => setMonth(m)}
                >
                  <span className="month-year-picker__cell-label">{monthShortLabel(m)}</span>
                  {inList ? <span className="month-year-picker__cell-tag">Na lista</span> : null}
                  {isDelete && cellCount > 0 ? (
                    <span className="month-year-picker__cell-tag month-year-picker__cell-tag--data">
                      {cellCount}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          <div className="month-year-picker__actions">
            <button type="button" className="month-year-picker__btn month-year-picker__btn--ghost" onClick={onClose}>
              Cancelar
            </button>
            <button
              type="button"
              className={`month-year-picker__btn ${isDelete ? "month-year-picker__btn--danger" : "month-year-picker__btn--primary"}`}
              onClick={handleConfirm}
              disabled={deleteDisabled}
            >
              {isDelete
                ? "Excluir dados deste mês"
                : alreadyIn
                  ? "Ir para este mês"
                  : "Adicionar mês"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
