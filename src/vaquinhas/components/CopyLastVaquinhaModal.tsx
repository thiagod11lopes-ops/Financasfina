import type { Vaquinha } from "../types";
import { formatMoneyBRLFromCents, formatPeriodLabel } from "../utils";

type Props = {
  open: boolean;
  source: Vaquinha | null;
  onYes: () => void;
  onNo: () => void;
  onClose: () => void;
};

export function CopyLastVaquinhaModal({ open, source, onYes, onNo, onClose }: Props) {
  if (!open || !source) return null;

  return (
    <div className="vaq-modal-backdrop vaq-copy-backdrop" role="presentation" onClick={onClose}>
      <div
        className="vaq-modal vaq-copy-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="vaq-copy-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="vaq-copy-modal__orb" aria-hidden />
        <div className="vaq-copy-modal__orb vaq-copy-modal__orb--2" aria-hidden />

        <div className="vaq-copy-modal__icon" aria-hidden>
          <CopyIcon />
        </div>

        <h2 id="vaq-copy-title" className="vaq-copy-modal__title">
          Repetir a ultima?
        </h2>
        <p className="vaq-copy-modal__lead">
          Quer copiar os dados da ultima vaquinha para criar uma nova com tudo ja preenchido?
        </p>

        <div className="vaq-copy-preview">
          <span className="vaq-copy-preview__label">Base para copiar</span>
          <strong className="vaq-copy-preview__name">{source.name}</strong>
          <div className="vaq-copy-preview__meta">
            <span>{formatPeriodLabel(source.period)}</span>
            <span>{formatMoneyBRLFromCents(source.totalCents)}</span>
          </div>
          <div className="vaq-copy-preview__meta vaq-copy-preview__meta--soft">
            <span>Por pessoa</span>
            <span>{formatMoneyBRLFromCents(source.perPersonCents)}</span>
          </div>
        </div>

        <div className="vaq-copy-modal__actions">
          <button type="button" className="vaq-btn vaq-btn--ghost" onClick={onNo}>
            Nao, do zero
          </button>
          <button type="button" className="vaq-btn vaq-copy-modal__yes" onClick={onYes}>
            Sim, copiar
          </button>
        </div>
      </div>
    </div>
  );
}

function CopyIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="8"
        y="8"
        width="11"
        height="11"
        rx="2.5"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M5.5 15.5V6.8c0-1 .8-1.8 1.8-1.8h8.7"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}
