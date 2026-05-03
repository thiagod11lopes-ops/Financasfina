import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { AgendaData, AgendaFamilyTask, AgendaReminder } from "../agenda/types";
import { loadAgenda, newId, saveAgenda } from "../agenda/persist";
import { AGENDA_CLOUD_SYNC_EVENT, useUserDocCloud } from "../firebase/userDocCloud";
import { getFamilyTaskResponsibleLabel, getFamilyTaskResponsibles } from "../agenda/responsibles";
import {
  IconCalendar,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconTrash,
  IconX,
} from "./Icons";
import {
  USERS_ALL_OPTION,
  USERS_SYNC_EVENT,
  getMergedBackgroundForUserSubset,
  getTodosMergedBackground,
  loadUserColorMap,
  loadUsers,
} from "../users";

type TabId = "calendar" | "week" | "goals" | "notes";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toYMD(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function startOfWeekMonday(d: Date): Date {
  const x = new Date(d);
  x.setHours(12, 0, 0, 0);
  const dow = x.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  x.setDate(x.getDate() + diff);
  return x;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function monthGrid(year: number, month: number): { date: string; inMonth: boolean }[] {
  const first = new Date(year, month - 1, 1, 12, 0, 0, 0);
  const startMonday = startOfWeekMonday(first);
  const cells: { date: string; inMonth: boolean }[] = [];
  for (let i = 0; i < 42; i++) {
    const d = addDays(startMonday, i);
    const inMonth = d.getMonth() === month - 1 && d.getFullYear() === year;
    cells.push({ date: toYMD(d), inMonth });
  }
  return cells;
}

const WEEKDAY_HEADERS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

/** Só dígitos, insere barras: até dd/mm/aaaa */
function formatGoalDateDigits(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

/** dd/mm/aaaa → YYYY-MM-DD; inválido → undefined */
function parseBRDateToYMD(s: string): string | undefined {
  const t = s.trim();
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(t);
  if (!m) return undefined;
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return undefined;
  const dt = new Date(year, month - 1, day, 12, 0, 0, 0);
  if (dt.getFullYear() !== year || dt.getMonth() !== month - 1 || dt.getDate() !== day) return undefined;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** YYYY-MM-DD → dd/mm/aaaa */
function formatYMDToBR(ymd: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd;
  const [y, mo, d] = ymd.split("-");
  return `${d}/${mo}/${y}`;
}

function timeSortKey(time?: string): number {
  if (!time) return 24 * 60 + 120;
  const m = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!m) return 24 * 60 + 120;
  return Number(m[1]) * 60 + Number(m[2]);
}

/** Exibição na aba Rotina: 24h com sufixo h (ex.: 09:05h, 14:30h). */
function formatTime24hLabel(raw?: string | null): string {
  if (raw == null) return "—";
  const s = String(raw).trim();
  if (!s) return "—";
  const m = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (!m) return s;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min) || min < 0 || min > 59) return s;
  if (h === 24 && min === 0) return "24:00h";
  if (h < 0 || h > 23) return s;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}h`;
}

/** Interpreta o texto do campo de rotina (aceita sufixo h, ex.: 14:30h, 24:00h). */
function parseTime24hField(s: string): { ok: true; value: string } | { ok: false } {
  const t = s.trim().replace(/\s*h\s*$/i, "").trim();
  if (!t) return { ok: false };
  const m = /^(\d{1,2}):(\d{2})$/.exec(t);
  if (!m) return { ok: false };
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min) || min < 0 || min > 59) return { ok: false };
  if (h === 24 && min === 0) return { ok: true, value: "24:00" };
  if (h < 0 || h > 23) return { ok: false };
  return { ok: true, value: `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}` };
}

function isRecurringFamilyTask(t: AgendaFamilyTask): boolean {
  return (t.repeatWeekdays?.length ?? 0) > 0;
}

const WEEKDAY_CHIP_LABELS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

type RoutineDeleteDraft = {
  taskId: string;
  dayIndex: number;
  title: string;
  dayLabel: string;
};

type WeekSlotDetailModal = {
  slotKey: string;
  taskId: string;
  dayIndex: number;
};

type Props = {
  open: boolean;
  onClose: () => void;
};

export function AgendaModal({ open, onClose }: Props) {
  const cloud = useUserDocCloud();
  const [tab, setTab] = useState<TabId>("calendar");
  const [data, setData] = useState<AgendaData>(() => loadAgenda());
  const [calYear, setCalYear] = useState(() => new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(() => new Date().getMonth() + 1);
  const [selectedDate, setSelectedDate] = useState<string | null>(() => toYMD(new Date()));
  const [remTitle, setRemTitle] = useState("");
  const [remTime, setRemTime] = useState("");
  const [remNotes, setRemNotes] = useState("");
  const [reminderFormExpanded, setReminderFormExpanded] = useState(false);
  const [goalTitle, setGoalTitle] = useState("");
  const [goalTarget, setGoalTarget] = useState("");
  const [goalNotes, setGoalNotes] = useState("");
  const [goalFormExpanded, setGoalFormExpanded] = useState(false);
  const [weekCursor, setWeekCursor] = useState(() => new Date());
  const [routineFormExpanded, setRoutineFormExpanded] = useState(false);
  const [routineTitle, setRoutineTitle] = useState("");
  const [routineTimeInput, setRoutineTimeInput] = useState(() => formatTime24hLabel("09:00"));
  const [routineDays, setRoutineDays] = useState<boolean[]>(() => [false, false, false, false, false, false, false]);
  const [routineNotes, setRoutineNotes] = useState("");
  /** Vazio = Toda a família ("Todos"); caso contrário, integrantes selecionados. */
  const [routineResponsibles, setRoutineResponsibles] = useState<string[]>([]);
  /** YYYY-MM-DD: tarefa só nesse dia (sem repetição nos outros). */
  const [routineOneShotYmd, setRoutineOneShotYmd] = useState<string | null>(null);
  const [routineDatePickerOpen, setRoutineDatePickerOpen] = useState(false);
  const [routinePickCalYear, setRoutinePickCalYear] = useState(() => new Date().getFullYear());
  const [routinePickCalMonth, setRoutinePickCalMonth] = useState(() => new Date().getMonth() + 1);
  const [users, setUsers] = useState<string[]>(() => loadUsers());
  const [routineDeleteDraft, setRoutineDeleteDraft] = useState<RoutineDeleteDraft | null>(null);
  /** Modal de detalhe da programação (abre ao clicar no horário na grelha da semana). */
  const [weekSlotDetailModal, setWeekSlotDetailModal] = useState<WeekSlotDetailModal | null>(null);

  const routineDateWrapRef = useRef<HTMLDivElement | null>(null);

  const dataRef = useRef(data);
  dataRef.current = data;

  const closeAll = useCallback(() => {
    saveAgenda(dataRef.current);
    if (cloud.cloudEnabled) cloud.pushAgendaImmediate(dataRef.current);
    onClose();
  }, [cloud, onClose]);

  const prevOpenRef = useRef(open);
  useEffect(() => {
    if (prevOpenRef.current && !open) {
      saveAgenda(dataRef.current);
      if (cloud.cloudEnabled) cloud.pushAgendaImmediate(dataRef.current);
    }
    prevOpenRef.current = open;
  }, [open, cloud]);

  useEffect(() => {
    if (!open) return;
    setData(loadAgenda());
    const now = new Date();
    setCalYear(now.getFullYear());
    setCalMonth(now.getMonth() + 1);
    setSelectedDate(toYMD(now));
    setWeekCursor(now);
    setGoalFormExpanded(false);
    setRoutineFormExpanded(false);
    setRoutineTitle("");
    setRoutineTimeInput(formatTime24hLabel("09:00"));
    setRoutineDays([false, false, false, false, false, false, false]);
    setRoutineNotes("");
    setRoutineResponsibles([]);
    setRoutineOneShotYmd(null);
    setRoutineDatePickerOpen(false);
    setWeekSlotDetailModal(null);
  }, [open]);

  useEffect(() => {
    setReminderFormExpanded(false);
  }, [selectedDate]);

  useEffect(() => {
    if (tab !== "goals") setGoalFormExpanded(false);
  }, [tab]);

  useEffect(() => {
    if (tab !== "week") {
      setRoutineFormExpanded(false);
      setRoutineTitle("");
      setRoutineTimeInput(formatTime24hLabel("09:00"));
      setRoutineDays([false, false, false, false, false, false, false]);
      setRoutineNotes("");
      setRoutineResponsibles([]);
      setRoutineOneShotYmd(null);
      setRoutineDatePickerOpen(false);
      setWeekSlotDetailModal(null);
    }
  }, [tab]);

  useEffect(() => {
    setWeekSlotDetailModal(null);
  }, [weekCursor]);

  useEffect(() => {
    const syncUsers = () => setUsers(loadUsers());
    window.addEventListener(USERS_SYNC_EVENT, syncUsers);
    return () => window.removeEventListener(USERS_SYNC_EVENT, syncUsers);
  }, []);

  useEffect(() => {
    setRoutineResponsibles((prev) =>
      prev.filter((n) => n !== USERS_ALL_OPTION && users.includes(n)),
    );
  }, [users]);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => {
      saveAgenda(data);
      cloud.scheduleAgendaPush(data);
    }, 350);
    return () => window.clearTimeout(t);
  }, [data, open, cloud]);

  useEffect(() => {
    const onCloud = () => setData(loadAgenda());
    window.addEventListener(AGENDA_CLOUD_SYNC_EVENT, onCloud);
    return () => window.removeEventListener(AGENDA_CLOUD_SYNC_EVENT, onCloud);
  }, []);

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
      if (e.key !== "Escape") return;
      if (routineDeleteDraft) {
        setRoutineDeleteDraft(null);
        return;
      }
      if (weekSlotDetailModal) {
        setWeekSlotDetailModal(null);
        return;
      }
      closeAll();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, closeAll, routineDeleteDraft, weekSlotDetailModal]);

  const confirmRemoveRecurringFromSingleWeekday = useCallback(() => {
    const d = routineDeleteDraft;
    if (!d) return;
    setData((s) => ({
      ...s,
      familyWeekTasks: s.familyWeekTasks.flatMap((x) => {
        if (x.id !== d.taskId) return [x];
        const prev = x.repeatWeekdays ?? [];
        const next = prev.filter((wd) => wd !== d.dayIndex).sort((a, b) => a - b);
        if (next.length === 0) return [];
        return [{ ...x, repeatWeekdays: next }];
      }),
    }));
    setRoutineDeleteDraft(null);
    setWeekSlotDetailModal(null);
  }, [routineDeleteDraft]);

  const confirmRemoveRecurringEntirely = useCallback(() => {
    const id = routineDeleteDraft?.taskId;
    if (!id) return;
    setData((s) => ({
      ...s,
      familyWeekTasks: s.familyWeekTasks.filter((x) => x.id !== id),
    }));
    setRoutineDeleteDraft(null);
    setWeekSlotDetailModal(null);
  }, [routineDeleteDraft]);

  useEffect(() => {
    if (!weekSlotDetailModal) return;
    const exists = data.familyWeekTasks.some((t) => t.id === weekSlotDetailModal.taskId);
    if (!exists) setWeekSlotDetailModal(null);
  }, [data.familyWeekTasks, weekSlotDetailModal]);

  const cells = useMemo(() => monthGrid(calYear, calMonth), [calYear, calMonth]);

  const remindersByDate = useMemo(() => {
    const m = new Map<string, AgendaReminder[]>();
    for (const r of data.reminders) {
      const list = m.get(r.date) ?? [];
      list.push(r);
      m.set(r.date, list);
    }
    return m;
  }, [data.reminders]);

  const weekStart = useMemo(() => startOfWeekMonday(weekCursor), [weekCursor]);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  const userColorMap = useMemo(() => loadUserColorMap(), [users]);
  const todosMergedBg = useMemo(() => getTodosMergedBackground(), [users]);

  const weekItemsByDayIndex = useMemo(() => {
    const map = new Map<number, { task: AgendaFamilyTask; recurring: boolean }[]>();
    for (let i = 0; i < 7; i++) map.set(i, []);
    const keys = weekDays.map((d) => toYMD(d));
    for (const t of data.familyWeekTasks) {
      if (isRecurringFamilyTask(t)) {
        for (const wd of t.repeatWeekdays ?? []) {
          if (wd >= 0 && wd <= 6) map.get(wd)!.push({ task: t, recurring: true });
        }
      } else if (t.date) {
        const idx = keys.indexOf(t.date);
        if (idx >= 0) map.get(idx)!.push({ task: t, recurring: false });
      }
    }
    for (let i = 0; i < 7; i++) {
      map.get(i)!.sort((a, b) => timeSortKey(a.task.time) - timeSortKey(b.task.time));
    }
    return map;
  }, [data.familyWeekTasks, weekDays]);

  const addReminder = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      if (!selectedDate) return;
      const title = remTitle.trim();
      if (!title) return;
      const time = remTime.trim() || undefined;
      const notes = remNotes.trim() || undefined;
      setData((d) => ({
        ...d,
        reminders: [
          {
            id: newId(),
            date: selectedDate,
            time,
            title,
            notes,
            done: false,
          },
          ...d.reminders,
        ],
      }));
      setRemTitle("");
      setRemTime("");
      setRemNotes("");
      setReminderFormExpanded(false);
    },
    [selectedDate, remTitle, remTime, remNotes],
  );

  const addGoal = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      const title = goalTitle.trim();
      if (!title) return;
      const targetDate = goalTarget.trim() ? parseBRDateToYMD(goalTarget) : undefined;
      const notes = goalNotes.trim() || undefined;
      setData((d) => ({
        ...d,
        goals: [
          {
            id: newId(),
            title,
            notes,
            targetDate,
            done: false,
          },
          ...d.goals,
        ],
      }));
      setGoalTitle("");
      setGoalTarget("");
      setGoalNotes("");
      setGoalFormExpanded(false);
    },
    [goalTitle, goalTarget, goalNotes],
  );

  const addRoutine = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      const title = routineTitle.trim();
      if (!title) return;
      const parsedTime = parseTime24hField(routineTimeInput);
      const time = parsedTime.ok ? parsedTime.value : "09:00";
      const notes = routineNotes.trim() || undefined;
      const picked = routineResponsibles.filter(
        (n) => n !== USERS_ALL_OPTION && users.includes(n),
      );
      const uniqueSorted = [...new Set(picked.map((n) => n.trim()))].sort((a, b) =>
        a.localeCompare(b, "pt"),
      );
      const respFields =
        uniqueSorted.length > 0 ? ({ responsibles: uniqueSorted } as const) : ({} as const);

      if (routineOneShotYmd && /^\d{4}-\d{2}-\d{2}$/.test(routineOneShotYmd)) {
        setData((d) => ({
          ...d,
          familyWeekTasks: [
            {
              id: newId(),
              title,
              time,
              date: routineOneShotYmd,
              notes,
              done: false,
              ...respFields,
            },
            ...d.familyWeekTasks,
          ],
        }));
      } else {
        const weekdays = routineDays.map((on, i) => (on ? i : -1)).filter((i) => i >= 0);
        if (weekdays.length === 0) return;
        setData((d) => ({
          ...d,
          familyWeekTasks: [
            {
              id: newId(),
              title,
              time,
              repeatWeekdays: weekdays.sort((a, b) => a - b),
              notes,
              done: false,
              ...respFields,
            },
            ...d.familyWeekTasks,
          ],
        }));
      }

      setRoutineTitle("");
      setRoutineTimeInput(formatTime24hLabel("09:00"));
      setRoutineDays([false, false, false, false, false, false, false]);
      setRoutineNotes("");
      setRoutineResponsibles([]);
      setRoutineOneShotYmd(null);
      setRoutineDatePickerOpen(false);
      setRoutineFormExpanded(false);
    },
    [routineTitle, routineTimeInput, routineDays, routineNotes, routineResponsibles, routineOneShotYmd, users],
  );

  const toggleRoutineDay = useCallback((i: number) => {
    setRoutineOneShotYmd(null);
    setRoutineDays((prev) => {
      const next = [...prev];
      next[i] = !next[i];
      return next;
    });
  }, []);

  const routinePickCells = useMemo(
    () => monthGrid(routinePickCalYear, routinePickCalMonth),
    [routinePickCalYear, routinePickCalMonth],
  );

  const routinePickMonthLabel = useMemo(
    () =>
      new Date(routinePickCalYear, routinePickCalMonth - 1, 1).toLocaleDateString("pt-BR", {
        month: "long",
        year: "numeric",
      }),
    [routinePickCalYear, routinePickCalMonth],
  );

  useEffect(() => {
    if (!routineDatePickerOpen) return;
    const onDoc = (ev: MouseEvent | TouchEvent) => {
      const el = routineDateWrapRef.current;
      const t = ev.target;
      if (el && t instanceof Node && !el.contains(t)) setRoutineDatePickerOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("touchstart", onDoc, { passive: true });
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("touchstart", onDoc);
    };
  }, [routineDatePickerOpen]);

  useEffect(() => {
    if (!routineDatePickerOpen) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") setRoutineDatePickerOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [routineDatePickerOpen]);

  const monthLabel = useMemo(
    () =>
      new Date(calYear, calMonth - 1, 1).toLocaleDateString("pt-BR", {
        month: "long",
        year: "numeric",
      }),
    [calYear, calMonth],
  );

  const weekRangeLabel = useMemo(() => {
    const a = weekDays[0]!;
    const b = weekDays[6]!;
    const fa = a.toLocaleDateString("pt-BR", { day: "numeric", month: "short" });
    const fb = b.toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: "numeric" });
    return `${fa} – ${fb}`;
  }, [weekDays]);

  const weekSlotDetailTask = useMemo(() => {
    if (!weekSlotDetailModal) return null;
    return data.familyWeekTasks.find((x) => x.id === weekSlotDetailModal.taskId) ?? null;
  }, [data.familyWeekTasks, weekSlotDetailModal]);

  if (!open) return null;

  return (
    <>
    <div className="modal-backdrop modal-backdrop--fullscreen" role="presentation" onClick={closeAll}>
      <div
        className="modal-panel modal-panel--fullscreen agenda-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="agenda-modal-title"
        onClick={(ev) => ev.stopPropagation()}
      >
        <div className="modal-head modal-head--fullscreen agenda-modal__head">
          <div className="modal-head__text">
            <h2 id="agenda-modal-title">Agenda familiar</h2>
            <p>Lembretes, notas, objetivos e afazeres da semana.</p>
          </div>
          <button type="button" className="modal-close modal-close--fullscreen" onClick={closeAll} aria-label="Fechar agenda">
            <IconX aria-hidden />
          </button>
        </div>

        <div className="agenda-tabs" role="tablist" aria-label="Seções da agenda">
          {(
            [
              ["calendar", "Calendário"],
              ["week", "Rotina"],
              ["goals", "Objetivos"],
              ["notes", "Notas"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              className={`agenda-tab${tab === id ? " is-active" : ""}`}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="modal-body agenda-modal__body">
          {tab === "calendar" ? (
            <div className="agenda-panel agenda-panel--scroll agenda-panel--calendar-split">
              <div className="agenda-cal-toolbar">
                <button
                  type="button"
                  className="agenda-icon-btn"
                  aria-label="Mês anterior"
                  onClick={() => {
                    if (calMonth <= 1) {
                      setCalMonth(12);
                      setCalYear((y) => y - 1);
                    } else setCalMonth((m) => m - 1);
                  }}
                >
                  <IconChevronLeft aria-hidden />
                </button>
                <span className="agenda-cal-toolbar__title">{monthLabel}</span>
                <button
                  type="button"
                  className="agenda-icon-btn"
                  aria-label="Próximo mês"
                  onClick={() => {
                    if (calMonth >= 12) {
                      setCalMonth(1);
                      setCalYear((y) => y + 1);
                    } else setCalMonth((m) => m + 1);
                  }}
                >
                  <IconChevronRight aria-hidden />
                </button>
              </div>
              <div className="agenda-cal-weekdays" aria-hidden>
                {WEEKDAY_HEADERS.map((w) => (
                  <span key={w} className="agenda-cal-weekdays__cell">
                    {w}
                  </span>
                ))}
              </div>
              <div className="agenda-cal-grid">
                {cells.map((c) => {
                  const rs = remindersByDate.get(c.date) ?? [];
                  const marks = rs.length;
                  const sel = selectedDate === c.date;
                  return (
                    <button
                      key={c.date}
                      type="button"
                      className={`agenda-cal-day${c.inMonth ? "" : " is-muted"}${sel ? " is-selected" : ""}`}
                      onClick={() => setSelectedDate(c.date)}
                    >
                      <span className="agenda-cal-day__num">{Number(c.date.slice(8))}</span>
                      {marks > 0 ? (
                        <span className="agenda-cal-day__dots" aria-label={`${marks} lembrete${marks === 1 ? "" : "s"}`} />
                      ) : null}
                    </button>
                  );
                })}
              </div>

              <div className="agenda-cal-side">
                <h3 className="agenda-subtitle">
                  {selectedDate
                    ? new Date(selectedDate + "T12:00:00").toLocaleDateString("pt-BR", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                      })
                    : "Escolha um dia"}
                </h3>
                {selectedDate ? (
                  <div className="agenda-reminder-new">
                    <button
                      type="button"
                      className="agenda-reminder-new__toggle"
                      onClick={() => setReminderFormExpanded((v) => !v)}
                      aria-expanded={reminderFormExpanded}
                      aria-controls="agenda-new-reminder-form"
                      id="agenda-new-reminder-toggle"
                    >
                      <span className="agenda-reminder-new__toggle-label">Novo lembrete</span>
                      <span className={`agenda-reminder-new__chev${reminderFormExpanded ? " is-open" : ""}`} aria-hidden>
                        <IconChevronDown />
                      </span>
                    </button>
                    <form
                      id="agenda-new-reminder-form"
                      className="agenda-form agenda-reminder-new__form"
                      hidden={!reminderFormExpanded}
                      onSubmit={addReminder}
                      aria-label="Detalhes do novo lembrete"
                    >
                      <input
                        className="input"
                        value={remTitle}
                        onChange={(e) => setRemTitle(e.target.value)}
                        placeholder="Título"
                        autoComplete="off"
                      />
                      <input className="input" type="time" value={remTime} onChange={(e) => setRemTime(e.target.value)} />
                      <textarea
                        className="input agenda-textarea"
                        value={remNotes}
                        onChange={(e) => setRemNotes(e.target.value)}
                        placeholder="Observações (opcional)"
                        rows={2}
                      />
                      <button type="submit" className="btn btn-primary agenda-form__submit">
                        Marcar lembrete
                      </button>
                    </form>
                  </div>
                ) : null}

                {selectedDate ? (
                  <ul className="agenda-list">
                    {(remindersByDate.get(selectedDate) ?? []).map((r) => (
                      <li key={r.id} className="agenda-list-item">
                        <label className="agenda-check-row agenda-check">
                          <input
                            type="checkbox"
                            className="agenda-check__input"
                            checked={!!r.done}
                            onChange={() =>
                              setData((d) => ({
                                ...d,
                                reminders: d.reminders.map((x) =>
                                  x.id === r.id ? { ...x, done: !x.done } : x,
                                ),
                              }))
                            }
                          />
                          <span className={r.done ? "agenda-struck" : ""}>
                            {r.time ? <span className="agenda-time">{r.time}</span> : null}
                            {r.title}
                          </span>
                        </label>
                        <button
                          type="button"
                          className="agenda-trash"
                          aria-label="Excluir lembrete"
                          onClick={() =>
                            setData((d) => ({
                              ...d,
                              reminders: d.reminders.filter((x) => x.id !== r.id),
                            }))
                          }
                        >
                          <IconTrash aria-hidden />
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>
          ) : null}

          {tab === "week" ? (
            <div className="agenda-panel agenda-week-wrap">
              <div className="agenda-week-toolbar">
                <button
                  type="button"
                  className="agenda-icon-btn"
                  aria-label="Semana anterior"
                  onClick={() => setWeekCursor((d) => addDays(d, -7))}
                >
                  <IconChevronLeft aria-hidden />
                </button>
                <span className="agenda-week-toolbar__title">{weekRangeLabel}</span>
                <button
                  type="button"
                  className="agenda-icon-btn"
                  aria-label="Próxima semana"
                  onClick={() => setWeekCursor((d) => addDays(d, 7))}
                >
                  <IconChevronRight aria-hidden />
                </button>
              </div>

              <div className="agenda-week-routine-block">
                <button
                  type="button"
                  className="agenda-reminder-new__toggle agenda-week-routine-block__toggle"
                  onClick={() => setRoutineFormExpanded((v) => !v)}
                  aria-expanded={routineFormExpanded}
                  aria-controls="agenda-week-routine-form"
                  id="agenda-week-routine-toggle"
                >
                  <span className="agenda-reminder-new__toggle-label">Rotina semanal (repete nos dias)</span>
                  <span className={`agenda-reminder-new__chev${routineFormExpanded ? " is-open" : ""}`} aria-hidden>
                    <IconChevronDown />
                  </span>
                </button>
                <form
                  id="agenda-week-routine-form"
                  className="agenda-form agenda-reminder-new__form agenda-week-routine-form"
                  hidden={!routineFormExpanded}
                  onSubmit={addRoutine}
                  aria-label="Nova rotina semanal"
                >
                  <input
                    className="input"
                    value={routineTitle}
                    onChange={(e) => setRoutineTitle(e.target.value)}
                    placeholder="Atividade (ex.: estudo, mercado, lazer)"
                  />
                  <label className="agenda-label" htmlFor="agenda-routine-time">
                    Horário <span className="agenda-label__hint">(24h, ex.: 14:30h ou 24:00h)</span>
                  </label>
                  <div className="agenda-routine-time-row" ref={routineDateWrapRef}>
                    <input
                      id="agenda-routine-time"
                      className="input agenda-input-time24"
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      spellCheck={false}
                      placeholder="24:00h"
                      value={routineTimeInput}
                      onChange={(e) => setRoutineTimeInput(e.target.value)}
                      onBlur={() => {
                        const parsed = parseTime24hField(routineTimeInput);
                        setRoutineTimeInput(parsed.ok ? formatTime24hLabel(parsed.value) : formatTime24hLabel("09:00"));
                      }}
                    />
                    <div className="agenda-routine-date-anchor">
                      <button
                        type="button"
                        className={`agenda-icon-btn agenda-routine-date-open${routineDatePickerOpen ? " is-active" : ""}`}
                        aria-expanded={routineDatePickerOpen}
                        aria-haspopup="dialog"
                        aria-controls="agenda-routine-date-popover"
                        id="agenda-routine-date-open"
                        title="Dia específico (não repete noutros dias)"
                        onClick={() => {
                          setRoutineDatePickerOpen((was) => {
                            if (!was) {
                              if (routineOneShotYmd && /^\d{4}-\d{2}-\d{2}$/.test(routineOneShotYmd)) {
                                const [y, m] = routineOneShotYmd.split("-").map(Number);
                                setRoutinePickCalYear(y);
                                setRoutinePickCalMonth(m);
                              } else {
                                const d = new Date();
                                setRoutinePickCalYear(d.getFullYear());
                                setRoutinePickCalMonth(d.getMonth() + 1);
                              }
                            }
                            return !was;
                          });
                        }}
                      >
                        <IconCalendar aria-hidden />
                      </button>
                      {routineDatePickerOpen ? (
                        <div
                          id="agenda-routine-date-popover"
                          className="agenda-routine-date-popover"
                          role="dialog"
                          aria-modal="true"
                          aria-labelledby="agenda-routine-date-popover-title"
                        >
                          <div className="agenda-mini-cal-toolbar">
                            <button
                              type="button"
                              className="agenda-icon-btn agenda-icon-btn--compact"
                              aria-label="Mês anterior"
                              onClick={() => {
                                if (routinePickCalMonth <= 1) {
                                  setRoutinePickCalMonth(12);
                                  setRoutinePickCalYear((y) => y - 1);
                                } else setRoutinePickCalMonth((m) => m - 1);
                              }}
                            >
                              <IconChevronLeft aria-hidden />
                            </button>
                            <h4 id="agenda-routine-date-popover-title" className="agenda-mini-cal-toolbar__title">
                              {routinePickMonthLabel}
                            </h4>
                            <button
                              type="button"
                              className="agenda-icon-btn agenda-icon-btn--compact"
                              aria-label="Próximo mês"
                              onClick={() => {
                                if (routinePickCalMonth >= 12) {
                                  setRoutinePickCalMonth(1);
                                  setRoutinePickCalYear((y) => y + 1);
                                } else setRoutinePickCalMonth((m) => m + 1);
                              }}
                            >
                              <IconChevronRight aria-hidden />
                            </button>
                          </div>
                          <div className="agenda-mini-cal-weekdays" aria-hidden>
                            {WEEKDAY_HEADERS.map((w) => (
                              <span key={w} className="agenda-mini-cal-weekdays__cell">
                                {w}
                              </span>
                            ))}
                          </div>
                          <div className="agenda-mini-cal-grid">
                            {routinePickCells.map((c) => {
                              const sel = routineOneShotYmd === c.date;
                              const today = toYMD(new Date()) === c.date;
                              return (
                                <button
                                  key={c.date}
                                  type="button"
                                  className={`agenda-mini-cal-day${c.inMonth ? "" : " is-muted"}${sel ? " is-selected" : ""}${today ? " is-today" : ""}`}
                                  onClick={() => {
                                    setRoutineOneShotYmd(c.date);
                                    setRoutineDays([false, false, false, false, false, false, false]);
                                    setRoutineDatePickerOpen(false);
                                  }}
                                >
                                  <span className="agenda-mini-cal-day__num">{Number(c.date.slice(8))}</span>
                                </button>
                              );
                            })}
                          </div>
                          <p className="agenda-mini-cal-foot">
                            A tarefa aparece só nesta data; não se repete nos restantes dias da semana.
                          </p>
                        </div>
                      ) : null}
                    </div>
                  </div>
                  {routineOneShotYmd ? (
                    <p className="agenda-routine-one-shot-hint">
                      <strong>Dia fixo:</strong> {formatYMDToBR(routineOneShotYmd)} — sem repetição semanal.{" "}
                      <button type="button" className="agenda-text-btn" onClick={() => setRoutineOneShotYmd(null)}>
                        Limpar data
                      </button>
                    </p>
                  ) : null}
                  <p className="agenda-label" style={{ marginBottom: 4 }}>
                    Responsáveis
                  </p>
                  <p className="agenda-hint agenda-hint--tight" style={{ marginTop: 0, marginBottom: 8 }}>
                    Escolha <strong>Todos</strong> ou toque em vários integrantes.
                  </p>
                  <div className="agenda-weekday-chips" role="group" aria-label="Responsáveis pela rotina">
                    {users.map((u) => {
                      const isTodos = u === USERS_ALL_OPTION;
                      const on = isTodos
                        ? routineResponsibles.length === 0
                        : routineResponsibles.includes(u);
                      return (
                        <button
                          key={u}
                          type="button"
                          className={`agenda-weekday-chip${on ? " is-on" : ""} agenda-weekday-chip--resp`}
                          aria-pressed={on}
                          onClick={() => {
                            if (isTodos) {
                              setRoutineResponsibles([]);
                              return;
                            }
                            setRoutineResponsibles((prev) => {
                              if (prev.length === 0) return [u];
                              if (prev.includes(u)) return prev.filter((x) => x !== u);
                              return [...prev, u];
                            });
                          }}
                        >
                          {u}
                        </button>
                      );
                    })}
                  </div>
                  <p className="agenda-label" style={{ marginBottom: 4 }}>
                    Repetir em <span className="agenda-label__hint">(desativado se escolher dia no calendário)</span>
                  </p>
                  <div
                    className={`agenda-weekday-chips${routineOneShotYmd ? " agenda-weekday-chips--dimmed" : ""}`}
                    role="group"
                    aria-label="Dias da semana"
                  >
                    {WEEKDAY_CHIP_LABELS.map((lbl, i) => (
                      <button
                        key={lbl}
                        type="button"
                        className={`agenda-weekday-chip${routineDays[i] ? " is-on" : ""}`}
                        onClick={() => toggleRoutineDay(i)}
                        aria-pressed={routineDays[i]}
                      >
                        {lbl}
                      </button>
                    ))}
                  </div>
                  <textarea
                    className="input agenda-textarea"
                    value={routineNotes}
                    onChange={(e) => setRoutineNotes(e.target.value)}
                    placeholder="Notas (opcional)"
                    rows={2}
                  />
                  <button type="submit" className="btn btn-primary agenda-form__submit">
                    Salvar rotina
                  </button>
                </form>
              </div>

              <p className="agenda-week-board-hint">
                Em cada dia vê-se só o <strong>horário</strong> e o <strong>integrante</strong>. Toque no horário para abrir
                um painel com a atividade, notas e ações. Depois de salvar uma rotina, ela aparece nas colunas dos dias marcados.
              </p>

              <div className="agenda-week-board">
                {weekDays.map((d, dayIndex) => {
                  const key = toYMD(d);
                  const items = weekItemsByDayIndex.get(dayIndex) ?? [];
                  const label = d.toLocaleDateString("pt-BR", { weekday: "short", day: "numeric" });
                  return (
                    <div key={key} className="agenda-week-col">
                      <div className="agenda-week-col__head">{label}</div>
                      <ul className="agenda-week-tasks">
                        {items.map(({ task, recurring }) => {
                          const slotKey = `${task.id}-${recurring ? "r" : "o"}-${dayIndex}`;
                          const detailOpen = weekSlotDetailModal?.slotKey === slotKey;
                          const respNames = getFamilyTaskResponsibles(task);
                          const respLabel = getFamilyTaskResponsibleLabel(task);
                          const isTodosResp = respNames.length === 0;
                          const respColorHex =
                            respNames.length === 1 ? userColorMap[respNames[0]!.toLowerCase()] : undefined;
                          const swatchBg = isTodosResp
                            ? todosMergedBg
                            : getMergedBackgroundForUserSubset(respNames);
                          const swatchMerged = isTodosResp || respNames.length > 1;
                          return (
                          <li
                            key={slotKey}
                            className={`agenda-week-slot${recurring ? " agenda-week-slot--recurring" : " agenda-week-slot--once"} is-collapsed`}
                          >
                            <div className="agenda-week-slot__summary">
                              <button
                                type="button"
                                className="agenda-week-slot__time-hit"
                                id={`week-slot-trigger-${slotKey}`}
                                aria-haspopup="dialog"
                                aria-expanded={detailOpen}
                                aria-label={`Ver detalhes da programação (${formatTime24hLabel(task.time)})`}
                                onClick={() =>
                                  setWeekSlotDetailModal((cur) =>
                                    cur?.slotKey === slotKey ? null : { slotKey, taskId: task.id, dayIndex },
                                  )
                                }
                              >
                                <span className="agenda-week-slot__value agenda-week-slot__value--time">
                                  {formatTime24hLabel(task.time)}
                                </span>
                              </button>
                              <div className="agenda-week-slot__owner-line">
                                {swatchBg ? (
                                  <span
                                    className={`agenda-week-slot__user-swatch${swatchMerged ? " agenda-week-slot__user-swatch--merged" : ""}`}
                                    style={{ background: swatchBg }}
                                    title={
                                      isTodosResp
                                        ? "Combinação das cores de todos os utilizadores"
                                        : respNames.length > 1
                                          ? respNames.join(", ")
                                          : undefined
                                    }
                                    aria-hidden
                                  />
                                ) : null}
                                <span
                                  className="agenda-week-slot__value agenda-week-slot__value--owner"
                                  style={respColorHex ? { color: respColorHex } : undefined}
                                >
                                  {respLabel}
                                </span>
                              </div>
                            </div>
                          </li>
                          );
                        })}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          {tab === "goals" ? (
            <div className="agenda-panel agenda-panel--scroll">
              <h3 className="agenda-subtitle">Objetivos futuros</h3>
              <div className="agenda-reminder-new">
                <button
                  type="button"
                  className="agenda-reminder-new__toggle"
                  onClick={() => setGoalFormExpanded((v) => !v)}
                  aria-expanded={goalFormExpanded}
                  aria-controls="agenda-new-goal-form"
                  id="agenda-new-goal-toggle"
                >
                  <span className="agenda-reminder-new__toggle-label">Novo objetivo</span>
                  <span className={`agenda-reminder-new__chev${goalFormExpanded ? " is-open" : ""}`} aria-hidden>
                    <IconChevronDown />
                  </span>
                </button>
                <form
                  id="agenda-new-goal-form"
                  className="agenda-form agenda-reminder-new__form"
                  hidden={!goalFormExpanded}
                  onSubmit={addGoal}
                  aria-label="Formulário de novo objetivo"
                >
                  <input
                    className="input"
                    value={goalTitle}
                    onChange={(e) => setGoalTitle(e.target.value)}
                    placeholder="Objetivo"
                  />
                  <label className="agenda-label" htmlFor="agenda-goal-date">
                    Data meta (opcional)
                  </label>
                  <input
                    id="agenda-goal-date"
                    className="input"
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="dd/mm/aaaa"
                    maxLength={10}
                    value={goalTarget}
                    onChange={(e) => setGoalTarget(formatGoalDateDigits(e.target.value))}
                  />
                  <p className="agenda-hint agenda-hint--tight">Formato: dd/mm/aaaa</p>
                  <textarea
                    className="input agenda-textarea"
                    value={goalNotes}
                    onChange={(e) => setGoalNotes(e.target.value)}
                    placeholder="Detalhes (opcional)"
                    rows={2}
                  />
                  <button type="submit" className="btn btn-primary agenda-form__submit">
                    Adicionar objetivo
                  </button>
                </form>
              </div>
              <ul className="agenda-goals">
                {data.goals.map((g) => (
                  <li key={g.id} className="agenda-goal-card">
                    <div className="agenda-goal-card__row">
                      <label className="agenda-check-row agenda-check-row--grow agenda-check">
                        <input
                          type="checkbox"
                          className="agenda-check__input"
                          checked={!!g.done}
                          onChange={() =>
                            setData((d) => ({
                              ...d,
                              goals: d.goals.map((x) => (x.id === g.id ? { ...x, done: !x.done } : x)),
                            }))
                          }
                        />
                        <span className={g.done ? "agenda-struck" : ""}>{g.title}</span>
                      </label>
                      <button
                        type="button"
                        className="agenda-trash"
                        aria-label="Excluir objetivo"
                        onClick={() =>
                          setData((d) => ({
                            ...d,
                            goals: d.goals.filter((x) => x.id !== g.id),
                          }))
                        }
                      >
                        <IconTrash aria-hidden />
                      </button>
                    </div>
                    {g.targetDate ? (
                      <p className="agenda-goal-meta">Meta: {formatYMDToBR(g.targetDate)}</p>
                    ) : null}
                    {g.notes ? <p className="agenda-goal-notes">{g.notes}</p> : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {tab === "notes" ? (
            <div className="agenda-panel agenda-panel--scroll">
              <h3 className="agenda-subtitle">Anotações gerais</h3>
              <p className="agenda-hint">Texto livre para a família; salva automaticamente.</p>
              <textarea
                className="input agenda-notes"
                value={data.generalNotes}
                onChange={(e) => setData((d) => ({ ...d, generalNotes: e.target.value }))}
                placeholder="Listas, ideias, contatos…"
                rows={14}
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>

    {weekSlotDetailModal && weekSlotDetailTask ? (
      <div
        className="modal-backdrop agenda-week-slot-detail-backdrop"
        role="presentation"
        onClick={() => setWeekSlotDetailModal(null)}
      >
        <div
          className="modal-panel agenda-week-slot-detail-panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="agenda-week-slot-detail-title"
          onClick={(ev) => ev.stopPropagation()}
        >
          <div className="agenda-week-slot-detail-panel__head">
            <div>
              <h3 id="agenda-week-slot-detail-title" className="agenda-week-slot-detail-panel__title">
                Programação
              </h3>
              <p className="agenda-week-slot-detail-panel__meta">
                {weekDays[weekSlotDetailModal.dayIndex]!.toLocaleDateString("pt-BR", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
              </p>
            </div>
            <button
              type="button"
              className="modal-close agenda-week-slot-detail-panel__close"
              onClick={() => setWeekSlotDetailModal(null)}
              aria-label="Fechar detalhes"
            >
              <IconX aria-hidden />
            </button>
          </div>
          <div className="agenda-week-slot-detail-panel__body">
            <div className="agenda-week-slot__field">
              <span className="agenda-week-slot__label">Horário</span>
              <span className="agenda-week-slot__value agenda-week-slot__value--time">
                {formatTime24hLabel(weekSlotDetailTask.time)}
              </span>
            </div>
            <div className="agenda-week-slot__field">
              <span className="agenda-week-slot__label">Integrante</span>
              <span className="agenda-week-slot__value agenda-week-slot__value--owner">
                {getFamilyTaskResponsibleLabel(weekSlotDetailTask)}
              </span>
            </div>
            <div className="agenda-week-slot__field">
              <span className="agenda-week-slot__label">Atividade</span>
              <span
                className={`agenda-week-slot__value${
                  weekSlotDetailTask.done && !isRecurringFamilyTask(weekSlotDetailTask) ? " agenda-struck" : ""
                }`}
              >
                {weekSlotDetailTask.title}
                {isRecurringFamilyTask(weekSlotDetailTask) ? (
                  <span className="agenda-week-slot__recurring-tag" title="Repete nestes dias da semana">
                    {" "}
                    (rotina)
                  </span>
                ) : null}
              </span>
            </div>
            {!isRecurringFamilyTask(weekSlotDetailTask) && weekSlotDetailTask.date ? (
              <div className="agenda-week-slot__field">
                <span className="agenda-week-slot__label">Data</span>
                <span className="agenda-week-slot__value agenda-week-slot__value--notes">
                  {formatYMDToBR(weekSlotDetailTask.date)}
                </span>
              </div>
            ) : null}
            {weekSlotDetailTask.notes ? (
              <div className="agenda-week-slot__field">
                <span className="agenda-week-slot__label">Notas</span>
                <span className="agenda-week-slot__value agenda-week-slot__value--notes">
                  {weekSlotDetailTask.notes}
                </span>
              </div>
            ) : null}
            <div className="agenda-week-slot__footer agenda-week-slot-detail-panel__footer">
              {isRecurringFamilyTask(weekSlotDetailTask) ? (
                <label className="agenda-week-slot__check agenda-check agenda-week-slot__check--static">
                  <input
                    type="checkbox"
                    className="agenda-check__input"
                    disabled
                    checked={false}
                    aria-label="Rotina semanal (concluir não se aplica por dia)"
                  />
                </label>
              ) : (
                <label className="agenda-week-slot__check agenda-check">
                  <input
                    type="checkbox"
                    className="agenda-check__input"
                    checked={weekSlotDetailTask.done}
                    onChange={() =>
                      setData((s) => ({
                        ...s,
                        familyWeekTasks: s.familyWeekTasks.map((x) =>
                          x.id === weekSlotDetailTask.id ? { ...x, done: !x.done } : x,
                        ),
                      }))
                    }
                    aria-label="Marcar tarefa como concluída"
                  />
                </label>
              )}
              <button
                type="button"
                className="agenda-trash agenda-trash--small agenda-week-slot__trash"
                aria-label={
                  isRecurringFamilyTask(weekSlotDetailTask) ? "Excluir rotina" : "Excluir tarefa"
                }
                onClick={() => {
                  const t = weekSlotDetailTask;
                  const dayIdx = weekSlotDetailModal.dayIndex;
                  const recurring = isRecurringFamilyTask(t);
                  const closeDetail = () => setWeekSlotDetailModal(null);
                  if (!recurring) {
                    setData((s) => ({
                      ...s,
                      familyWeekTasks: s.familyWeekTasks.filter((x) => x.id !== t.id),
                    }));
                    closeDetail();
                    return;
                  }
                  const wds = t.repeatWeekdays ?? [];
                  if (wds.length > 1 && wds.includes(dayIdx)) {
                    setRoutineDeleteDraft({
                      taskId: t.id,
                      dayIndex: dayIdx,
                      title: t.title,
                      dayLabel: weekDays[dayIdx]!.toLocaleDateString("pt-BR", { weekday: "long" }),
                    });
                    closeDetail();
                    return;
                  }
                  setData((s) => ({
                    ...s,
                    familyWeekTasks: s.familyWeekTasks.filter((x) => x.id !== t.id),
                  }));
                  closeDetail();
                }}
              >
                <IconTrash aria-hidden />
              </button>
            </div>
          </div>
        </div>
      </div>
    ) : null}

    {routineDeleteDraft ? (
      <div
        className="modal-backdrop agenda-routine-delete-backdrop"
        role="presentation"
        onClick={() => setRoutineDeleteDraft(null)}
      >
        <div
          className="modal-panel agenda-routine-delete-panel"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="agenda-delete-routine-title"
          onClick={(ev) => ev.stopPropagation()}
        >
          <h3 id="agenda-delete-routine-title" className="agenda-routine-delete-panel__title">
            Excluir rotina
          </h3>
          <p className="agenda-routine-delete-panel__text">
            A rotina <strong>{`"${routineDeleteDraft.title}"`}</strong> está marcada para mais de um dia da semana. O que
            deseja fazer?
          </p>
          <ul className="agenda-routine-delete-panel__list">
            <li>
              <strong>Só {routineDeleteDraft.dayLabel}</strong> — deixa de aparecer neste dia; mantém-se nos outros
              dias em que a rotina está definida.
            </li>
            <li>
              <strong>Todas as repetições</strong> — remove por completo esta rotina (todos os dias).
            </li>
          </ul>
          <div className="agenda-routine-delete-panel__actions">
            <button type="button" className="btn btn-primary" onClick={confirmRemoveRecurringFromSingleWeekday}>
              Só este dia
            </button>
            <button type="button" className="btn btn-danger" onClick={confirmRemoveRecurringEntirely}>
              Todas as repetições
            </button>
            <button type="button" className="btn btn-ghost agenda-routine-delete-panel__cancel" onClick={() => setRoutineDeleteDraft(null)}>
              Cancelar
            </button>
          </div>
        </div>
      </div>
    ) : null}
    </>
  );
}
