import type { Task, TaskInput } from './types';
import { assertId, assertTimestamp } from '../validation';
export { assertId, assertTimestamp } from '../validation';
import { validDate } from './dates';
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
  if ('horizon' in input)
    throw new Error('Planning layers are calculated from the date.');
  if (
    input.plannedCompletionDate !== null &&
    !validDate(input.plannedCompletionDate)
  )
    throw new Error('Choose a valid planned completion date.');
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
