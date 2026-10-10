import type { Task, TaskHorizon } from './types';
import { addDays } from './dates';
export function unresolved(task: Task): boolean {
  return !task.archived && ['pending', 'deferred'].includes(task.status);
}
export function needsReview(task: Task, today: string): boolean {
  return (
    unresolved(task) &&
    task.horizon !== 'long' &&
    (task.status === 'deferred' ||
      Boolean(task.plannedCompletionDate && task.plannedCompletionDate < today))
  );
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
        unresolved(task) && task.plannedCompletionDate === addDays(today, 1),
    ),
  );
}
export function layerTasks(tasks: Task[], horizon: TaskHorizon): Task[] {
  return alphabetical(
    tasks.filter((task) => unresolved(task) && task.horizon === horizon),
  );
}
export function reviewTasks(tasks: Task[]): Task[] {
  return alphabetical(
    tasks.filter((task) => unresolved(task) && task.horizon !== 'long'),
  );
}
