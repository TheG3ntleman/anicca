import type { Task, TaskNote } from '../tasks/types';
import type { TaskEvent, DayReview } from '../reviews/types';
export interface PlanningData {
  tasks: Task[];
  notes: TaskNote[];
  events: TaskEvent[];
  reviews: DayReview[];
}
export interface PlanningExport extends PlanningData {
  format: 'anicca-planning';
  schemaVersion: 1;
  exportedAt: string;
}
export type Collection = keyof PlanningData;
export interface ImportConflict {
  key: string;
  collection: Collection;
  local: PlanningData[Collection][number];
  incoming: PlanningData[Collection][number];
}
export type ConflictChoices = Record<string, 'local' | 'incoming'>;
