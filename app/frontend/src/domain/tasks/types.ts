export type CalendarDate = string; // YYYY-MM-DD, local calendar day; never a UTC timestamp.
export type TaskHorizon = 'short' | 'medium' | 'long';
export type TaskStatus = 'pending' | 'completed' | 'cancelled' | 'deferred';
export interface Task {
  id: string;
  title: string;
  finishCriteria: string;
  description: string;
  horizon: TaskHorizon;
  plannedCompletionDate: CalendarDate | null;
  status: TaskStatus;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}
export type TaskInput = Pick<
  Task,
  | 'title'
  | 'finishCriteria'
  | 'description'
  | 'horizon'
  | 'plannedCompletionDate'
>;
export interface TaskNote {
  id: string;
  taskId: string;
  text: string;
  createdAt: string;
  updatedAt: string;
}
