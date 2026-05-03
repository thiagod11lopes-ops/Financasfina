import type { AgendaData, AgendaFamilyTask } from "./types";
import { USERS_ALL_OPTION } from "../users";

const STORAGE_KEY = "financas-agenda-v1";

const defaultData = (): AgendaData => ({
  version: 1,
  generalNotes: "",
  reminders: [],
  goals: [],
  familyWeekTasks: [],
});

function newId(): string {
  return crypto.randomUUID();
}

/** Normaliza agenda vinda do `localStorage` ou do Firestore. */
export function reviveAgendaFromUnknown(parsed: unknown): AgendaData {
  if (!parsed || typeof parsed !== "object") return defaultData();
  try {
    const p = parsed as Partial<AgendaData>;
    return {
      version: 1,
      generalNotes: typeof p.generalNotes === "string" ? p.generalNotes : "",
      reminders: Array.isArray(p.reminders) ? p.reminders : [],
      goals: Array.isArray(p.goals) ? p.goals : [],
      familyWeekTasks: Array.isArray(p.familyWeekTasks)
        ? (p.familyWeekTasks as Partial<AgendaFamilyTask>[]).map((t) => {
            const repeat = Array.isArray(t.repeatWeekdays)
              ? [...new Set(t.repeatWeekdays.filter((n): n is number => typeof n === "number" && n >= 0 && n <= 6))]
              : [];
            const hasRepeat = repeat.length > 0;
            const rawResp = t as { responsibles?: unknown; responsible?: unknown };
            let names: string[] = [];
            if (Array.isArray(rawResp.responsibles)) {
              for (const x of rawResp.responsibles) {
                if (typeof x !== "string" || !x.trim()) continue;
                const s = x.trim();
                if (s.toLowerCase() === USERS_ALL_OPTION.toLowerCase()) continue;
                if (!names.some((n) => n.toLowerCase() === s.toLowerCase())) names.push(s);
              }
            }
            if (
              names.length === 0 &&
              typeof rawResp.responsible === "string" &&
              rawResp.responsible.trim()
            ) {
              const r = rawResp.responsible.trim();
              if (r.toLowerCase() !== USERS_ALL_OPTION.toLowerCase()) names = [r];
            }
            const base: AgendaFamilyTask = {
              id: typeof t.id === "string" ? t.id : newId(),
              title: typeof t.title === "string" ? t.title : "",
              done: !!t.done,
              date: hasRepeat ? undefined : typeof t.date === "string" ? t.date : undefined,
              repeatWeekdays: hasRepeat ? repeat.sort((a, b) => a - b) : undefined,
              time: typeof t.time === "string" ? t.time : undefined,
              notes: typeof t.notes === "string" ? t.notes : undefined,
            };
            if (names.length > 0) return { ...base, responsibles: names };
            return base;
          }).filter((t) => {
            const rec = (t.repeatWeekdays?.length ?? 0) > 0;
            return Boolean(t.title && (rec || (t.date && /^\d{4}-\d{2}-\d{2}$/.test(t.date))));
          })
        : [],
    };
  } catch {
    return defaultData();
  }
}

export function loadAgenda(): AgendaData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultData();
    return reviveAgendaFromUnknown(JSON.parse(raw));
  } catch {
    return defaultData();
  }
}

export function saveAgenda(data: AgendaData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* ignore quota */
  }
}

export { newId };
