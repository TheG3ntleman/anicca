import type { Task, TaskHorizon } from '../tasks/types';
import { editTask } from '../tasks/operations';
import { addDays } from '../tasks/dates';
export type ReviewDecision =
  | { kind: 'complete' | 'cancel' | 'defer' | 'leave' }
  | { kind: 'plan'; date: string }
  | { kind: 'long' };
export function applyReviewDecision(
  task: Task,
  decision: ReviewDecision,
  today: string,
): Task {
  if (decision.kind === 'complete')
    return editTask(task, { status: 'completed' });
  if (decision.kind === 'cancel')
    return editTask(task, { status: 'cancelled' });
  if (decision.kind === 'defer')
    return editTask(task, { status: 'deferred', plannedCompletionDate: null });
  if (decision.kind === 'long')
    return editTask(task, {
      horizon: 'long',
      status: 'pending',
      plannedCompletionDate: null,
    });
  if (decision.kind === 'plan') {
    const horizon: TaskHorizon =
      decision.date <= addDays(today, 1) ? 'short' : 'medium';
    return editTask(task, {
      status: 'pending',
      horizon,
      plannedCompletionDate: decision.date,
    });
  }
  return editTask(task, {});
}
