export function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

export function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export function monthKeyFromIsoDate(dueDateIso: string) {
  // dueDateIso: YYYY-MM-DD
  const [y, m] = dueDateIso.split("-").map((x) => Number(x));
  if (!y || !m) return "00/0000";
  return `${pad2(m)}/${y}`;
}

export function formatMoneyBRLFromCents(cents: number) {
  const v = cents / 100;
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function parseMoneyBRLToCents(raw: string) {
  // Aceita: "1234,56" ou "1234.56" ou "R$ 1.234,56"
  const cleaned = raw
    .replace(/[R$\s]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const num = Number(cleaned);
  if (!Number.isFinite(num)) return 0;
  return Math.round(num * 100);
}

export function todayIsoDate() {
  const d = new Date();
  // YYYY-MM-DD
  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  return `${y}-${m}-${day}`;
}

