import type { Task } from '../tasks/types';
export type ReviewAction =
  | 'created'
  | 'edited'
  | 'complete'
  | 'reopen'
  | 'cancel'
  | 'defer'
  | 'reschedule'
  | 'archive'
  | 'review';
export interface TaskEvent {
  id: string;
  taskId: string;
  action: ReviewAction;
  at: string;
  before: Task | null;
  after: Task;
  reviewId: string | null;
}
export interface DayReview {
  id: string;
  date: string;
  completedAt: string;
  taskIds: string[];
  message: string;
}
