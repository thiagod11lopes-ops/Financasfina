import { useCallback, useEffect, useRef, useState } from "react";
import { DASHBOARD_METRIC_EXPLAIN, type DashboardMetricKey } from "./dashboardMetricExplain";
import { IconX } from "./Icons";

const TYPEWRITER_MS = 38;

function TypewriterSubtitle({ text, onComplete }: { text: string; onComplete?: () => void }) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    setDisplayed("");
    setDone(false);
    let index = 0;
    const timer = window.setInterval(() => {
      index += 1;
      setDisplayed(text.slice(0, index));
      if (index >= text.length) {
        window.clearInterval(timer);
        setDone(true);
        onCompleteRef.current?.();
      }
    }, TYPEWRITER_MS);
    return () => window.clearInterval(timer);
  }, [text]);

  return (
    <p className="dash-explain-subtitle" aria-live="polite">
      <span className="dash-explain-subtitle__text">{displayed}</span>
      {!done ? (
        <span className="dash-explain-subtitle__cursor" aria-hidden>
          |
        </span>
      ) : null}
    </p>
  );
}

type Props = {
  metric: DashboardMetricKey | null;
  monthLabel: string;
  onClose: () => void;
};

export function DashboardExplainModal({ metric, monthLabel, onClose }: Props) {
  const open = metric !== null;
  const content = metric ? DASHBOARD_METRIC_EXPLAIN[metric] : null;
  const [showEditGuide, setShowEditGuide] = useState(false);
  const revealEditGuide = useCallback(() => setShowEditGuide(true), []);

  useEffect(() => {
    setShowEditGuide(false);
  }, [metric]);

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
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !content || metric === null) return null;

  return (
    <div className="dash-explain-backdrop" role="presentation" onClick={onClose}>
      <div
        className={`dash-explain-panel dash-explain-panel--${content.tone}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dash-explain-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dash-explain-panel__glow" aria-hidden />
        <header className="dash-explain-head">
          <div className="dash-explain-head__text">
            <span className="dash-explain-head__eyebrow">{monthLabel}</span>
            <h2 id="dash-explain-title">{content.title}</h2>
          </div>
          <button type="button" className="modal-close dash-explain-close" onClick={onClose} aria-label="Fechar">
            <IconX aria-hidden />
          </button>
        </header>
        <div className="dash-explain-body">
          <TypewriterSubtitle key={metric} text={content.subtitle} onComplete={revealEditGuide} />
          {showEditGuide ? (
            <div className="dash-explain-edit-guide">
              <p className="dash-explain-edit-guide__label">Como chegar lá</p>
              <p className="dash-explain-edit-guide__text">{content.editGuide}</p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
