import type { TaskEvent } from './types';
import { formatDate } from '../tasks/dates';

/** Describe the saved event, rather than a task that may have changed since. */
export function reviewOutcome(event: TaskEvent, today: string): string {
  if (event.action === 'review') return 'Left unresolved';
  if (event.action === 'complete') return 'Completed';
  if (event.action === 'cancel') return 'Cancelled';
  if (event.action === 'defer') return 'Deferred · Needs review';
  return event.after.plannedCompletionDate === null
    ? 'Not scheduled yet · Long term'
    : `Planned for ${formatDate(event.after.plannedCompletionDate, today)}`;
}
