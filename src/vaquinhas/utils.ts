import type { Vaquinha } from "./types";

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

export function vaquinhaPaidCents(v: Vaquinha) {
  return v.people.reduce((a, p) => a + (p.status === "paid" ? v.perPersonCents : 0), 0);
}

export function vaquinhaPendingCents(v: Vaquinha) {
  return Math.max(0, v.totalCents - vaquinhaPaidCents(v));
}
export function isVaquinhaFinished(v: Vaquinha) {
  if (!v.people.length) return false;
  const allPaid = v.people.every((p) => p.status === "paid");
  return allPaid && vaquinhaPendingCents(v) <= 0;
}