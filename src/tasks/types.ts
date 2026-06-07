export type TaskItem = {
  id: string;
  title: string;
  dueDate?: string;
  completed: boolean;
  completedAt?: string;
  alarmDismissed?: boolean;
  createdAt: string;
};

export type ShoppingPriorityItem = {
  id: string;
  text: string;
  order: number;
};

export type TasksData = {
  version: 1;
  tasks: TaskItem[];
  shoppingPriority: ShoppingPriorityItem[];
};
