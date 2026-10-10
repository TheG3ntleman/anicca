import type { Task } from '../tasks/types';
import { editTask } from '../tasks/operations';
export type ReviewDecision =
  | { kind: 'complete' | 'cancel' | 'defer' | 'leave' }
  | { kind: 'plan'; date: string }
  | { kind: 'unschedule' };
export function applyReviewDecision(
  task: Task,
  decision: ReviewDecision,
): Task {
  if (decision.kind === 'complete')
    return editTask(task, { status: 'completed' });
  if (decision.kind === 'cancel')
    return editTask(task, { status: 'cancelled' });
  if (decision.kind === 'defer')
    return editTask(task, { status: 'deferred', plannedCompletionDate: null });
  if (decision.kind === 'unschedule')
    return editTask(task, {
      status: 'pending',
      plannedCompletionDate: null,
    });
  if (decision.kind === 'plan') {
    return editTask(task, {
      status: 'pending',
      plannedCompletionDate: decision.date,
    });
  }
  return editTask(task, {});
}
