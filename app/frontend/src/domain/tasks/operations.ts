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
  // Scheduling deferred work brings it back into the active plan. Text edits
  // alone must keep its review flag.
  if (
    task.status === 'deferred' &&
    changes.status === undefined &&
    changes.plannedCompletionDate !== undefined &&
    changes.plannedCompletionDate !== null &&
    changes.plannedCompletionDate !== task.plannedCompletionDate
  )
    next.status = 'pending';
  validateTask(next);
  return next;
}
