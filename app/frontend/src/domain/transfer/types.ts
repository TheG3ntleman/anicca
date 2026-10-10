import type { Task } from '../tasks/types';
import type { Log, LogLink, Attachment, ExportMedia } from '../logs/types';
import type { TaskEvent, DayReview } from '../reviews/types';
export interface PlanningData {
  tasks: Task[];
  logs: Log[];
  logLinks: LogLink[];
  attachments: Attachment[];
  events: TaskEvent[];
  reviews: DayReview[];
}
export interface PlanningExport extends PlanningData {
  format: 'anicca-planning';
  schemaVersion: 3;
  exportedAt: string;
  media: ExportMedia[];
}
export const COLLECTIONS = [
  'tasks',
  'logs',
  'logLinks',
  'attachments',
  'events',
  'reviews',
] as const;
export type Collection = keyof PlanningData;
export interface ImportConflict {
  key: string;
  collection: Collection;
  local: PlanningData[Collection][number];
  incoming: PlanningData[Collection][number];
}
export type ConflictChoices = Record<string, 'local' | 'incoming'>;
