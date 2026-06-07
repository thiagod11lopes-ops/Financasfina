import type { ShoppingPriorityItem, TaskItem, TasksData } from "./types";

export const TASKS_STORAGE_KEY = "financas-tasks-v1";
export const TASKS_SYNC_EVENT = "financas-tasks-sync";

export function newTaskId(): string {
  return crypto.randomUUID();
}

const defaultData = (): TasksData => ({
  version: 1,
  tasks: [],
  shoppingPriority: [],
});

export function reviveTasksFromUnknown(parsed: unknown): TasksData {
  if (!parsed || typeof parsed !== "object") return defaultData();
  try {
    const p = parsed as Partial<TasksData>;
    const tasks: TaskItem[] = Array.isArray(p.tasks)
      ? p.tasks.flatMap((t) => {
          const raw = t as Partial<TaskItem>;
          const title = typeof raw.title === "string" ? raw.title.trim() : "";
          if (!title) return [];
          const dueDate =
            typeof raw.dueDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.dueDate)
              ? raw.dueDate
              : undefined;
          const item: TaskItem = {
            id: typeof raw.id === "string" ? raw.id : newTaskId(),
            title,
            dueDate,
            completed: !!raw.completed,
            completedAt: typeof raw.completedAt === "string" ? raw.completedAt : undefined,
            alarmDismissed: !!raw.alarmDismissed,
            createdAt: typeof raw.createdAt === "string" ? raw.createdAt : new Date().toISOString(),
          };
          return [item];
        })
      : [];

    const shoppingPriority: ShoppingPriorityItem[] = Array.isArray(p.shoppingPriority)
      ? p.shoppingPriority
          .map((item, index) => {
            const raw = item as Partial<ShoppingPriorityItem>;
            const text = typeof raw.text === "string" ? raw.text.trim() : "";
            if (!text) return null;
            return {
              id: typeof raw.id === "string" ? raw.id : newTaskId(),
              text,
              order: typeof raw.order === "number" ? raw.order : index,
            } satisfies ShoppingPriorityItem;
          })
          .filter((i): i is ShoppingPriorityItem => i != null)
          .sort((a, b) => a.order - b.order)
      : [];

    return { version: 1, tasks, shoppingPriority };
  } catch {
    return defaultData();
  }
}

export function loadTasks(): TasksData {
  try {
    const raw = localStorage.getItem(TASKS_STORAGE_KEY);
    if (!raw) return defaultData();
    return reviveTasksFromUnknown(JSON.parse(raw));
  } catch {
    return defaultData();
  }
}

export function saveTasks(data: TasksData): void {
  try {
    localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(data));
    window.dispatchEvent(new Event(TASKS_SYNC_EVENT));
  } catch {
    /* quota */
  }
}

export function todayYMD(): string {
  return new Date().toISOString().slice(0, 10);
}
