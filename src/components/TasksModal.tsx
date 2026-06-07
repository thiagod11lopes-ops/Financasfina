import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { monthGrid, WEEKDAY_HEADERS } from "../tasks/calendarUtils";
import { todayYMD } from "../tasks/persist";
import { useTasks } from "../tasks/TasksContext";
import { formatMonthLabelPt } from "../utils/format";
import {
  IconCalendar,
  IconCart,
  IconChevronLeft,
  IconChevronRight,
  IconChevronUp,
  IconTrash,
  IconX,
} from "./Icons";

type TabId = "tasks" | "calendar" | "shopping";

function formatDueLabel(ymd?: string): string {
  if (!ymd) return "Sem data";
  const [y, m, d] = ymd.split("-");
  return `${d}/${m}/${y}`;
}

export function TasksModal() {
  const {
    data,
    modalOpen,
    closeModal,
    addTask,
    toggleTaskComplete,
    deleteTask,
    addShoppingItem,
    removeShoppingItem,
    moveShoppingItem,
  } = useTasks();

  const [tab, setTab] = useState<TabId>("tasks");
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [taskDatePickerOpen, setTaskDatePickerOpen] = useState(false);
  const [pickerCalYear, setPickerCalYear] = useState(() => new Date().getFullYear());
  const [pickerCalMonth, setPickerCalMonth] = useState(() => new Date().getMonth() + 1);
  const [shopText, setShopText] = useState("");
  const [calYear, setCalYear] = useState(() => new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(() => new Date().getMonth() + 1);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const taskDateAnchorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!modalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeModal();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modalOpen, closeModal]);

  const taskDates = useMemo(() => {
    const set = new Set<string>();
    for (const t of data.tasks) {
      if (t.dueDate) set.add(t.dueDate);
    }
    return set;
  }, [data.tasks]);

  const tasksByDate = useMemo(() => {
    const map = new Map<string, typeof data.tasks>();
    for (const t of data.tasks) {
      if (!t.dueDate) continue;
      const list = map.get(t.dueDate) ?? [];
      list.push(t);
      map.set(t.dueDate, list);
    }
    return map;
  }, [data.tasks]);

  const sortedTasks = useMemo(() => {
    const list = [...data.tasks];
    list.sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      const da = a.dueDate ?? "9999-99-99";
      const db = b.dueDate ?? "9999-99-99";
      if (da !== db) return da.localeCompare(db);
      return b.createdAt.localeCompare(a.createdAt);
    });
    return list;
  }, [data.tasks]);

  const filteredTasks = useMemo(() => {
    if (!selectedDate) return sortedTasks;
    return sortedTasks.filter((t) => t.dueDate === selectedDate);
  }, [sortedTasks, selectedDate]);

  const shoppingList = useMemo(
    () => [...data.shoppingPriority].sort((a, b) => a.order - b.order),
    [data.shoppingPriority],
  );

  const monthLabel = formatMonthLabelPt(`${calYear}-${String(calMonth).padStart(2, "0")}`);
  const pickerMonthLabel = formatMonthLabelPt(
    `${pickerCalYear}-${String(pickerCalMonth).padStart(2, "0")}`,
  );
  const pickerCells = useMemo(
    () => monthGrid(pickerCalYear, pickerCalMonth),
    [pickerCalYear, pickerCalMonth],
  );
  const grid = monthGrid(calYear, calMonth);
  const today = todayYMD();

  useEffect(() => {
    if (!taskDatePickerOpen) return;
    const onDoc = (ev: MouseEvent | TouchEvent) => {
      const el = taskDateAnchorRef.current;
      const t = ev.target;
      if (el && t instanceof Node && !el.contains(t)) setTaskDatePickerOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("touchstart", onDoc, { passive: true });
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("touchstart", onDoc);
    };
  }, [taskDatePickerOpen]);

  useEffect(() => {
    if (!taskDatePickerOpen) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") setTaskDatePickerOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [taskDatePickerOpen]);

  const openTaskDatePicker = useCallback(() => {
    setTaskDatePickerOpen((was) => {
      if (!was) {
        if (dueDate && /^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
          const [y, m] = dueDate.split("-").map(Number);
          setPickerCalYear(y);
          setPickerCalMonth(m);
        } else {
          const d = new Date();
          setPickerCalYear(d.getFullYear());
          setPickerCalMonth(d.getMonth() + 1);
        }
      }
      return !was;
    });
  }, [dueDate]);

  const submitTask = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      addTask(title, dueDate || undefined);
      setTitle("");
      setDueDate("");
      setTaskDatePickerOpen(false);
    },
    [addTask, title, dueDate],
  );

  const submitShopping = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      addShoppingItem(shopText);
      setShopText("");
    },
    [addShoppingItem, shopText],
  );

  if (!modalOpen) return null;

  return (
    <div className="modal-backdrop modal-backdrop--fullscreen tasks-modal-backdrop" role="presentation">
      <div
        className="modal-panel modal-panel--fullscreen tasks-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tasks-modal-title"
      >
        <div className="modal-head modal-head--fullscreen tasks-modal__head">
          <div className="modal-head__text">
            <h2 id="tasks-modal-title">Tarefas</h2>
            <p className="tasks-modal__lead">Organize pendências, calendário e prioridade de compras.</p>
          </div>
          <button type="button" className="modal-close modal-close--fullscreen" onClick={closeModal} aria-label="Fechar">
            <IconX aria-hidden />
          </button>
        </div>

        <div className="tasks-modal__tabs" role="tablist" aria-label="Secções de tarefas">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "tasks"}
            className={`tasks-modal__tab${tab === "tasks" ? " is-active" : ""}`}
            onClick={() => setTab("tasks")}
          >
            Tarefas
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "calendar"}
            className={`tasks-modal__tab${tab === "calendar" ? " is-active" : ""}`}
            onClick={() => setTab("calendar")}
          >
            Calendário
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "shopping"}
            className={`tasks-modal__tab tasks-modal__tab--shopping${tab === "shopping" ? " is-active" : ""}`}
            onClick={() => setTab("shopping")}
          >
            <IconCart aria-hidden />
            Prioridade de compras
          </button>
        </div>

        <div className="modal-body tasks-modal__body">
          {tab === "tasks" ? (
            <div className="tasks-panel">
              <form className="tasks-form" onSubmit={submitTask}>
                <label className="tasks-form__label" htmlFor="task-title">
                  Nova tarefa
                </label>
                <div className="tasks-form__input-row">
                  <input
                    id="task-title"
                    className="input tasks-form__input"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="O que precisa resolver?"
                    autoComplete="off"
                  />
                  <div className="tasks-form__date-anchor" ref={taskDateAnchorRef}>
                    <button
                      type="button"
                      className={`tasks-form__date-btn${taskDatePickerOpen ? " is-active" : ""}${dueDate ? " has-date" : ""}`}
                      aria-expanded={taskDatePickerOpen}
                      aria-haspopup="dialog"
                      aria-controls="tasks-form-date-popover"
                      title={dueDate ? `Data: ${formatDueLabel(dueDate)}` : "Escolher data (opcional)"}
                      onClick={openTaskDatePicker}
                    >
                      <IconCalendar aria-hidden />
                    </button>
                    {taskDatePickerOpen ? (
                      <div
                        id="tasks-form-date-popover"
                        className="tasks-form__date-popover"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="tasks-form-date-popover-title"
                      >
                        <div className="tasks-form__date-popover-glow" aria-hidden />
                        <div className="tasks-form-mini-cal-toolbar">
                          <button
                            type="button"
                            className="tasks-icon-btn tasks-icon-btn--compact"
                            aria-label="Mês anterior"
                            onClick={() => {
                              if (pickerCalMonth <= 1) {
                                setPickerCalMonth(12);
                                setPickerCalYear((y) => y - 1);
                              } else setPickerCalMonth((m) => m - 1);
                            }}
                          >
                            <IconChevronLeft aria-hidden />
                          </button>
                          <h4 id="tasks-form-date-popover-title" className="tasks-form-mini-cal-toolbar__title">
                            {pickerMonthLabel}
                          </h4>
                          <button
                            type="button"
                            className="tasks-icon-btn tasks-icon-btn--compact"
                            aria-label="Próximo mês"
                            onClick={() => {
                              if (pickerCalMonth >= 12) {
                                setPickerCalMonth(1);
                                setPickerCalYear((y) => y + 1);
                              } else setPickerCalMonth((m) => m + 1);
                            }}
                          >
                            <IconChevronRight aria-hidden />
                          </button>
                        </div>
                        <div className="tasks-form-mini-cal-weekdays" aria-hidden>
                          {WEEKDAY_HEADERS.map((w) => (
                            <span key={w} className="tasks-form-mini-cal-weekdays__cell">
                              {w}
                            </span>
                          ))}
                        </div>
                        <div className="tasks-form-mini-cal-grid">
                          {pickerCells.map((c) => {
                            const sel = dueDate === c.date;
                            const isToday = today === c.date;
                            const hasTasks = taskDates.has(c.date);
                            return (
                              <button
                                key={c.date}
                                type="button"
                                className={`tasks-form-mini-cal-day${c.inMonth ? "" : " is-muted"}${sel ? " is-selected" : ""}${isToday ? " is-today" : ""}${hasTasks ? " has-tasks" : ""}`}
                                onClick={() => {
                                  setDueDate(c.date);
                                  setTaskDatePickerOpen(false);
                                }}
                              >
                                <span className="tasks-form-mini-cal-day__num">{Number(c.date.slice(8))}</span>
                                {hasTasks ? <span className="tasks-form-mini-cal-day__dot" aria-hidden /> : null}
                              </button>
                            );
                          })}
                        </div>
                        <button
                          type="button"
                          className="tasks-form__date-clear"
                          onClick={() => {
                            setDueDate("");
                            setTaskDatePickerOpen(false);
                          }}
                        >
                          Sem data
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
                {dueDate ? (
                  <p className="tasks-form__date-hint">
                    <strong>Data:</strong> {formatDueLabel(dueDate)}{" "}
                    <button
                      type="button"
                      className="tasks-text-btn"
                      onClick={() => setDueDate("")}
                    >
                      Limpar
                    </button>
                  </p>
                ) : null}
                <button type="submit" className="btn btn-primary tasks-form__submit">
                  Adicionar tarefa
                </button>
              </form>

              <ul className="tasks-list">
                {filteredTasks.length === 0 ? (
                  <li className="tasks-empty">Nenhuma tarefa{selectedDate ? " neste dia" : ""}.</li>
                ) : (
                  filteredTasks.map((task) => (
                    <li key={task.id} className={`tasks-list-item${task.completed ? " is-done" : ""}`}>
                      <label className="tasks-check">
                        <input
                          type="checkbox"
                          checked={task.completed}
                          onChange={() => toggleTaskComplete(task.id)}
                        />
                        <span className="tasks-check__box" aria-hidden />
                      </label>
                      <div className="tasks-list-item__body">
                        <span className="tasks-list-item__title">{task.title}</span>
                        <span className="tasks-list-item__meta">{formatDueLabel(task.dueDate)}</span>
                      </div>
                      <button
                        type="button"
                        className="tasks-list-item__delete"
                        onClick={() => deleteTask(task.id)}
                        aria-label={`Excluir tarefa ${task.title}`}
                      >
                        <IconTrash aria-hidden />
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </div>
          ) : null}

          {tab === "calendar" ? (
            <div className="tasks-cal-panel">
              <div className="tasks-cal-toolbar">
                <button
                  type="button"
                  className="tasks-icon-btn"
                  onClick={() => {
                    if (calMonth === 1) {
                      setCalMonth(12);
                      setCalYear((y) => y - 1);
                    } else setCalMonth((m) => m - 1);
                  }}
                  aria-label="Mês anterior"
                >
                  <IconChevronLeft aria-hidden />
                </button>
                <span className="tasks-cal-toolbar__title">{monthLabel}</span>
                <button
                  type="button"
                  className="tasks-icon-btn"
                  onClick={() => {
                    if (calMonth === 12) {
                      setCalMonth(1);
                      setCalYear((y) => y + 1);
                    } else setCalMonth((m) => m + 1);
                  }}
                  aria-label="Próximo mês"
                >
                  <IconChevronRight aria-hidden />
                </button>
              </div>
              <div className="tasks-cal-weekdays" aria-hidden>
                {WEEKDAY_HEADERS.map((w) => (
                  <span key={w} className="tasks-cal-weekdays__cell">
                    {w}
                  </span>
                ))}
              </div>
              <div className="tasks-cal-grid">
                {grid.map((c) => {
                  const hasTasks = taskDates.has(c.date);
                  const isToday = c.date === today;
                  const isSelected = selectedDate === c.date;
                  return (
                    <button
                      key={c.date}
                      type="button"
                      className={`tasks-cal-day${c.inMonth ? "" : " is-muted"}${isToday ? " is-today" : ""}${isSelected ? " is-selected" : ""}${hasTasks ? " has-tasks" : ""}`}
                      onClick={() => setSelectedDate(isSelected ? null : c.date)}
                      aria-label={`${c.date}${hasTasks ? ", com tarefas" : ""}`}
                    >
                      <span className="tasks-cal-day__num">{Number(c.date.slice(8))}</span>
                      {hasTasks ? <span className="tasks-cal-day__dot" aria-hidden /> : null}
                    </button>
                  );
                })}
              </div>
              {selectedDate ? (
                <div className="tasks-cal-side">
                  <h3 className="tasks-cal-side__title">Tarefas em {formatDueLabel(selectedDate)}</h3>
                  <ul className="tasks-cal-side__list">
                    {(tasksByDate.get(selectedDate) ?? []).map((t) => (
                      <li key={t.id} className={t.completed ? "is-done" : ""}>
                        {t.title}
                      </li>
                    ))}
                  </ul>
                  <button type="button" className="tasks-text-btn" onClick={() => setTab("tasks")}>
                    Ver na lista de tarefas
                  </button>
                </div>
              ) : (
                <p className="tasks-cal-hint">Toque num dia com ponto laranja para ver as tarefas.</p>
              )}
            </div>
          ) : null}

          {tab === "shopping" ? (
            <div className="tasks-shop-panel">
              <p className="tasks-shop-panel__lead">
                Lista de compras por prioridade — use as setas para alterar a ordem.
              </p>
              <form className="tasks-shop-form" onSubmit={submitShopping}>
                <div className="tasks-shop-form__field">
                  <label className="tasks-shop-form__label" htmlFor="shop-priority-input">
                    Novo item
                  </label>
                  <input
                    id="shop-priority-input"
                    className="input tasks-shop-form__input"
                    value={shopText}
                    onChange={(e) => setShopText(e.target.value)}
                    placeholder="Ex.: Leite, pão, detergente…"
                    autoComplete="off"
                  />
                </div>
                <button type="submit" className="btn btn-primary tasks-shop-form__submit">
                  Adicionar
                </button>
              </form>
              <ol className="tasks-shop-list">
                {shoppingList.length === 0 ? (
                  <li className="tasks-empty">Nenhum item na lista.</li>
                ) : (
                  shoppingList.map((item, index) => (
                    <li key={item.id} className="tasks-shop-item">
                      <span className="tasks-shop-item__rank">{index + 1}</span>
                      <span className="tasks-shop-item__text">{item.text}</span>
                      <div className="tasks-shop-item__actions">
                        <button
                          type="button"
                          className="tasks-shop-move"
                          disabled={index === 0}
                          onClick={() => moveShoppingItem(item.id, -1)}
                          aria-label={`Subir ${item.text}`}
                        >
                          <IconChevronUp aria-hidden />
                        </button>
                        <button
                          type="button"
                          className="tasks-shop-move tasks-shop-move--down"
                          disabled={index === shoppingList.length - 1}
                          onClick={() => moveShoppingItem(item.id, 1)}
                          aria-label={`Descer ${item.text}`}
                        >
                          <IconChevronUp aria-hidden />
                        </button>
                        <button
                          type="button"
                          className="tasks-shop-delete"
                          onClick={() => removeShoppingItem(item.id)}
                          aria-label={`Remover ${item.text}`}
                        >
                          <IconTrash aria-hidden />
                        </button>
                      </div>
                    </li>
                  ))
                )}
              </ol>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
