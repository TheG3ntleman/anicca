import type { Task, TaskInput, TaskNote } from './types';
import { validDate } from './dates';
export function assertTimestamp(value: unknown): asserts value is string {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d\d-\d\dT/.test(value) ||
    !Number.isFinite(Date.parse(value))
  )
    throw new Error('Invalid timestamp.');
}
export function assertId(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !value || value.length > 200)
    throw new Error('Invalid record ID.');
}
export function validateTaskInput(input: TaskInput): void {
  if (
    !input ||
    typeof input.title !== 'string' ||
    !input.title.trim() ||
    input.title.length > 500
  )
    throw new Error('Give the task a title (up to 500 characters).');
  if (
    typeof input.finishCriteria !== 'string' ||
    !input.finishCriteria.trim() ||
    input.finishCriteria.length > 10000
  )
    throw new Error('Describe what finished looks like.');
  if (
    typeof input.description !== 'string' ||
    input.description.length > 100000
  )
    throw new Error('Invalid task description.');
  if (!['short', 'medium', 'long'].includes(input.horizon))
    throw new Error('Invalid planning layer.');
  if (
    input.plannedCompletionDate !== null &&
    !validDate(input.plannedCompletionDate)
  )
    throw new Error('Choose a valid planned completion date.');
  if (input.horizon === 'long' && input.plannedCompletionDate !== null)
    throw new Error('Long-term tasks are not scheduled yet.');
}
export function validateTask(task: Task): void {
  validateTaskInput(task);
  assertId(task.id);
  if (
    !['pending', 'completed', 'cancelled', 'deferred'].includes(task.status) ||
    typeof task.archived !== 'boolean'
  )
    throw new Error('Invalid task status.');
  assertTimestamp(task.createdAt);
  assertTimestamp(task.updatedAt);
  if (task.completedAt !== null) assertTimestamp(task.completedAt);
  if ((task.status === 'completed') !== (task.completedAt !== null))
    throw new Error('Completion date and status do not match.');
}
export function validateNote(note: TaskNote): void {
  assertId(note.id);
  assertId(note.taskId);
  assertTimestamp(note.createdAt);
  assertTimestamp(note.updatedAt);
  if (
    typeof note.text !== 'string' ||
    !note.text.trim() ||
    note.text.length > 100000
  )
    throw new Error('Invalid note.');
}
