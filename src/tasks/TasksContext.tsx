import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { TasksData } from "./types";
import { loadTasks, newTaskId, saveTasks, TASKS_SYNC_EVENT, todayYMD } from "./persist";

type TasksContextValue = {
  data: TasksData;
  modalOpen: boolean;
  openModal: () => void;
  closeModal: () => void;
  activeAlarms: TasksData["tasks"];
  addTask: (title: string, dueDate?: string) => void;
  toggleTaskComplete: (id: string) => void;
  deleteTask: (id: string) => void;
  dismissTaskAlarm: (id: string) => void;
  addShoppingItem: (text: string) => void;
  removeShoppingItem: (id: string) => void;
  moveShoppingItem: (id: string, direction: -1 | 1) => void;
};

const TasksContext = createContext<TasksContextValue | null>(null);

function persist(next: TasksData) {
  saveTasks(next);
}

export function TasksProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<TasksData>(() => loadTasks());
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    const sync = () => setData(loadTasks());
    window.addEventListener(TASKS_SYNC_EVENT, sync);
    return () => window.removeEventListener(TASKS_SYNC_EVENT, sync);
  }, []);

  const update = useCallback((fn: (prev: TasksData) => TasksData) => {
    setData((prev) => {
      const next = fn(prev);
      persist(next);
      return next;
    });
  }, []);

  const activeAlarms = useMemo(() => {
    const today = todayYMD();
    return data.tasks.filter(
      (t) => t.dueDate === today && !t.completed && !t.alarmDismissed,
    );
  }, [data.tasks]);

  const addTask = useCallback((title: string, dueDate?: string) => {
    const trimmed = title.trim();
    if (!trimmed) return;
    update((prev) => ({
      ...prev,
      tasks: [
        {
          id: newTaskId(),
          title: trimmed,
          dueDate,
          completed: false,
          alarmDismissed: false,
          createdAt: new Date().toISOString(),
        },
        ...prev.tasks,
      ],
    }));
  }, [update]);

  const toggleTaskComplete = useCallback((id: string) => {
    update((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) =>
        t.id === id
          ? {
              ...t,
              completed: !t.completed,
              completedAt: !t.completed ? new Date().toISOString() : undefined,
            }
          : t,
      ),
    }));
  }, [update]);

  const deleteTask = useCallback((id: string) => {
    update((prev) => ({
      ...prev,
      tasks: prev.tasks.filter((t) => t.id !== id),
    }));
  }, [update]);

  const dismissTaskAlarm = useCallback((id: string) => {
    update((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) => (t.id === id ? { ...t, alarmDismissed: true } : t)),
    }));
  }, [update]);

  const addShoppingItem = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    update((prev) => {
      const maxOrder = prev.shoppingPriority.reduce((m, i) => Math.max(m, i.order), -1);
      return {
        ...prev,
        shoppingPriority: [
          ...prev.shoppingPriority,
          { id: newTaskId(), text: trimmed, order: maxOrder + 1 },
        ],
      };
    });
  }, [update]);

  const removeShoppingItem = useCallback((id: string) => {
    update((prev) => ({
      ...prev,
      shoppingPriority: prev.shoppingPriority
        .filter((i) => i.id !== id)
        .map((item, index) => ({ ...item, order: index })),
    }));
  }, [update]);

  const moveShoppingItem = useCallback((id: string, direction: -1 | 1) => {
    update((prev) => {
      const list = [...prev.shoppingPriority].sort((a, b) => a.order - b.order);
      const idx = list.findIndex((i) => i.id === id);
      if (idx < 0) return prev;
      const swap = idx + direction;
      if (swap < 0 || swap >= list.length) return prev;
      const a = list[idx]!;
      const b = list[swap]!;
      list[idx] = { ...b, order: a.order };
      list[swap] = { ...a, order: b.order };
      return { ...prev, shoppingPriority: list.sort((x, y) => x.order - y.order) };
    });
  }, [update]);

  const value = useMemo(
    () => ({
      data,
      modalOpen,
      openModal: () => setModalOpen(true),
      closeModal: () => setModalOpen(false),
      activeAlarms,
      addTask,
      toggleTaskComplete,
      deleteTask,
      dismissTaskAlarm,
      addShoppingItem,
      removeShoppingItem,
      moveShoppingItem,
    }),
    [
      data,
      modalOpen,
      activeAlarms,
      addTask,
      toggleTaskComplete,
      deleteTask,
      dismissTaskAlarm,
      addShoppingItem,
      removeShoppingItem,
      moveShoppingItem,
    ],
  );

  return <TasksContext.Provider value={value}>{children}</TasksContext.Provider>;
}

export function useTasks(): TasksContextValue {
  const ctx = useContext(TasksContext);
  if (!ctx) throw new Error("useTasks must be used within TasksProvider");
  return ctx;
}
