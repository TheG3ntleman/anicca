import type { Task, TaskInput, TaskStatus } from './types';
import { validateTask, validateTaskInput } from './validation';
export function createTask(
  input: TaskInput,
  now = new Date().toISOString(),
): Task {
  validateTaskInput(input);
  const task: Task = {
    ...input,
    title: input.title.trim(),
    finishCriteria: input.finishCriteria.trim(),
    id: crypto.randomUUID(),
    status: 'pending',
    archived: false,
    createdAt: now,
    updatedAt: now,
    completedAt: null,
  };
  validateTask(task);
  return task;
}
export function editTask(
  task: Task,
  changes: Partial<TaskInput> & { status?: TaskStatus; archived?: boolean },
  now = new Date().toISOString(),
): Task {
  const next = {
    ...task,
    ...changes,
    updatedAt: new Date(
      Math.max(Date.parse(now), Date.parse(task.updatedAt) + 1),
    ).toISOString(),
  };
  next.title = next.title.trim();
  next.finishCriteria = next.finishCriteria.trim();
  next.completedAt =
    next.status === 'completed' ? (task.completedAt ?? now) : null;
  if (next.horizon === 'long') next.plannedCompletionDate = null;
  validateTask(next);
  return next;
}
