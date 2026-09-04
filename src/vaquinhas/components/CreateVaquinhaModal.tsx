import { useState, type FormEvent } from "react";
import { parseMoneyBRLToCents } from "../utils";

type Props = {
  open: boolean;
  onClose: () => void;
  onCreate: (input: { name: string; totalCents: number; perPersonCents: number }) => void;
};

export function CreateVaquinhaModal({ open, onClose, onCreate }: Props) {
  const [name, setName] = useState("");
  const [total, setTotal] = useState("");
  const [perPerson, setPerPerson] = useState("");

  if (!open) return null;

  const canSubmit =
    name.trim().length >= 2 &&
    parseMoneyBRLToCents(total) > 0 &&
    parseMoneyBRLToCents(perPerson) > 0;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    onCreate({
      name: name.trim(),
      totalCents: parseMoneyBRLToCents(total),
      perPersonCents: parseMoneyBRLToCents(perPerson),
    });
    setName("");
    setTotal("");
    setPerPerson("");
  };

  return (
    <div className="vaq-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="vaq-modal vaq-modal--sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="vaq-create-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="vaq-modal__grab" aria-hidden />
        <h2 id="vaq-create-title" className="vaq-modal__title">
          Nova vaquinha
        </h2>
        <p className="vaq-modal__text">Defina o nome, o valor total e quanto cada um deve pagar.</p>
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
          <div className="vaq-modal__actions">
            <button type="button" className="vaq-btn vaq-btn--ghost" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="vaq-btn" disabled={!canSubmit}>
              Criar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}