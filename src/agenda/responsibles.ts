import type { AgendaFamilyTask } from "./types";
import { USERS_ALL_OPTION } from "../users";

/** Lista de responsáveis (sem "Todos"); vazio = toda a família. */
export function getFamilyTaskResponsibles(t: AgendaFamilyTask): string[] {
  const fromArr = (t.responsibles ?? []).filter((x) => typeof x === "string" && x.trim());
  if (fromArr.length > 0) {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const raw of fromArr) {
      const s = raw.trim();
      if (s.toLowerCase() === USERS_ALL_OPTION.toLowerCase()) continue;
      const k = s.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(s);
    }
    return out;
  }
  const one = t.responsible?.trim();
  if (one && one.toLowerCase() !== USERS_ALL_OPTION.toLowerCase()) return [one];
  return [];
}

export function getFamilyTaskResponsibleLabel(t: AgendaFamilyTask): string {
  const list = getFamilyTaskResponsibles(t);
  if (list.length === 0) return USERS_ALL_OPTION;
  return list.join(", ");
}
