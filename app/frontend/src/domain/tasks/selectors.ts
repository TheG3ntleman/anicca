import type { Task, PlanningLayer } from './types';
import { addDays } from './dates';
export function unresolved(task: Task): boolean {
  return !task.archived && ['pending', 'deferred'].includes(task.status);
}
export function needsReview(task: Task, today: string): boolean {
  return (
    unresolved(task) &&
    ((task.status === 'deferred' &&
      (task.plannedCompletionDate === null ||
        task.plannedCompletionDate <= today)) ||
      Boolean(task.plannedCompletionDate && task.plannedCompletionDate < today))
  );
}
/** Computed at display time, so crossing midnight never needs a database write. */
export function planningLayer(
  task: Task,
  today: string,
): PlanningLayer | 'review' {
  if (needsReview(task, today)) return 'review';
  if (task.plannedCompletionDate === null) return 'long';
  return task.plannedCompletionDate <= addDays(today, 1) ? 'short' : 'medium';
}
export function alphabetical(tasks: Task[]): Task[] {
  return [...tasks].sort(
    (a, b) =>
      a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }) ||
      a.id.localeCompare(b.id),
  );
}
export function todayTasks(tasks: Task[], today: string): Task[] {
  return alphabetical(
    tasks.filter(
      (task) =>
        !task.archived &&
        task.plannedCompletionDate === today &&
        ['pending', 'completed'].includes(task.status),
    ),
  );
}
export function tomorrowTasks(tasks: Task[], today: string): Task[] {
  return alphabetical(
    tasks.filter(
      (task) =>
        unresolved(task) &&
        !needsReview(task, today) &&
        task.plannedCompletionDate === addDays(today, 1),
    ),
  );
}
export function layerTasks(
  tasks: Task[],
  layer: PlanningLayer,
  today: string,
): Task[] {
  return alphabetical(
    tasks.filter(
      (task) => unresolved(task) && planningLayer(task, today) === layer,
    ),
  );
}
/** Daily review covers today's/older intentions, plus undated deferred work. */
export function isDailyReviewTask(task: Task, today: string): boolean {
  return (
    unresolved(task) &&
    (task.plannedCompletionDate !== null
      ? task.plannedCompletionDate <= today
      : task.status === 'deferred')
  );
}
export function reviewTasks(tasks: Task[], today: string): Task[] {
  return alphabetical(tasks.filter((task) => isDailyReviewTask(task, today)));
}
