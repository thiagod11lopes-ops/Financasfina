export function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

export function formatMoneyBRLFromCents(cents: number) {
  const v = cents / 100;
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function parseMoneyBRLToCents(raw: string) {
  const cleaned = raw
    .replace(/[R$\s]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const num = Number(cleaned);
  if (!Number.isFinite(num)) return 0;
  return Math.max(0, Math.round(num * 100));
}

export function pendingCents(expectedCents: number, paidCents: number) {
  return Math.max(0, expectedCents - paidCents);
}