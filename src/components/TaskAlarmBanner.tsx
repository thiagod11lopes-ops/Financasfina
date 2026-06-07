import { IconTrash } from "./Icons";
import { useTasks } from "../tasks/TasksContext";

export function TaskAlarmBanner() {
  const { activeAlarms, dismissTaskAlarm } = useTasks();
  if (activeAlarms.length === 0) return null;

  return (
    <div className="task-alarm-stack" role="region" aria-label="Tarefas para hoje">
      {activeAlarms.map((task) => (
        <div key={task.id} className="task-alarm-banner">
          <div className="task-alarm-banner__pulse" aria-hidden />
          <div className="task-alarm-banner__content">
            <span className="task-alarm-banner__icon" aria-hidden>
              ⏰
            </span>
            <div className="task-alarm-banner__text">
              <strong>Tarefa para hoje</strong>
              <span>{task.title}</span>
            </div>
          </div>
          <button
            type="button"
            className="task-alarm-banner__dismiss"
            onClick={() => dismissTaskAlarm(task.id)}
            aria-label={`Remover alarme da tarefa ${task.title}`}
            title="Remover alarme"
          >
            <IconTrash aria-hidden />
          </button>
        </div>
      ))}
    </div>
  );
}
