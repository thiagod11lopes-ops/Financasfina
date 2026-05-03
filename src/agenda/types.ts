export type AgendaReminder = {
  id: string;
  date: string;
  time?: string;
  title: string;
  notes?: string;
  done?: boolean;
};

export type AgendaGoal = {
  id: string;
  title: string;
  notes?: string;
  targetDate?: string;
  done?: boolean;
};

/**
 * Afazer na semana: pontual (`date`) ou rotina que se repete (`repeatWeekdays`: 0=seg … 6=dom).
 */
export type AgendaFamilyTask = {
  id: string;
  title: string;
  done: boolean;
  /** Legado: um único responsável (preferir `responsibles`). */
  responsible?: string;
  /** Vários responsáveis; ausente ou vazio após migração = toda a família ("Todos"). */
  responsibles?: string[];
  /** Pontual: data YYYY-MM-DD (obrigatória se não houver recorrência). */
  date?: string;
  /** Rotina: dias em que o horário se repete toda a semana. */
  repeatWeekdays?: number[];
  /** HH:mm — ordenação e exibição. */
  time?: string;
  notes?: string;
};

export type AgendaData = {
  version: 1;
  generalNotes: string;
  reminders: AgendaReminder[];
  goals: AgendaGoal[];
  familyWeekTasks: AgendaFamilyTask[];
};
