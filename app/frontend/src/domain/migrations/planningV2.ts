import type { Task } from '../tasks/types';
import type { TaskEvent } from '../reviews/types';
import { validateTask } from '../tasks/validation';

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Invalid version 1 planning record.');
  return value as Record<string, unknown>;
}

/** Shared by the IndexedDB upgrade and old-file import. Dates win over layers. */
export function migrateTaskV1(value: unknown): Task {
  const { horizon, ...fields } = record(value);
  if (!['short', 'medium', 'long'].includes(horizon as string))
    throw new Error('Invalid version 1 planning layer.');
  if (horizon === 'long' && fields.plannedCompletionDate !== null)
    throw new Error('Invalid version 1 long-term task.');
  const task = fields as unknown as Task;
  validateTask(task);
  return task;
}

export function migrateTaskEventV1(value: unknown): TaskEvent {
  const event = record(value);
  return {
    ...event,
    before: event.before === null ? null : migrateTaskV1(event.before),
    after: migrateTaskV1(event.after),
  } as TaskEvent;
}

export function migratePlanningExportV1(value: unknown): unknown {
  const data = record(value);
  if (data.format !== 'anicca-planning' || data.schemaVersion !== 1)
    throw new Error('This is not a version 1 Anicca planning export.');
  if (
    !Array.isArray(data.tasks) ||
    data.tasks.length > 100000 ||
    !Array.isArray(data.events) ||
    data.events.length > 100000
  )
    throw new Error('Invalid version 1 planning collections.');
  return {
    ...data,
    schemaVersion: 2,
    tasks: data.tasks.map(migrateTaskV1),
    events: data.events.map(migrateTaskEventV1),
  };
}
