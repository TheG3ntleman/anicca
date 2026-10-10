import type { PlanningExport } from './types';
import {
  validateTask,
  validateNote,
  assertId,
  assertTimestamp,
} from '../tasks/validation';
import { validDate } from '../tasks/dates';
export function validateExport(data: PlanningExport): void {
  if (!data || data.format !== 'anicca-planning' || data.schemaVersion !== 1)
    throw new Error('This is not a supported Anicca planning export.');
  assertTimestamp(data.exportedAt);
  for (const key of ['tasks', 'notes', 'events', 'reviews'] as const) {
    if (!Array.isArray(data[key]) || data[key].length > 100000)
      throw new Error(`Invalid ${key} collection.`);
    const ids = new Set<string>();
    for (const record of data[key]) {
      assertId(record?.id);
      if (ids.has(record.id)) throw new Error(`Duplicate ${key} ID.`);
      ids.add(record.id);
    }
  }
  data.tasks.forEach(validateTask);
  data.notes.forEach(validateNote);
  const taskIds = new Set(data.tasks.map((task) => task.id));
  for (const note of data.notes)
    if (!taskIds.has(note.taskId))
      throw new Error('A note refers to a missing task.');
  for (const event of data.events) {
    assertId(event.taskId);
    assertTimestamp(event.at);
    if (
      ![
        'created',
        'edited',
        'complete',
        'reopen',
        'cancel',
        'defer',
        'reschedule',
        'archive',
        'review',
      ].includes(event.action)
    )
      throw new Error('Unknown review action.');
    if (event.reviewId !== null) assertId(event.reviewId);
    validateTask(event.after);
    if (event.before !== null) validateTask(event.before);
    if (
      !taskIds.has(event.taskId) ||
      event.after.id !== event.taskId ||
      (event.before && event.before.id !== event.taskId)
    )
      throw new Error('Invalid task history reference.');
  }
  for (const review of data.reviews) {
    assertTimestamp(review.completedAt);
    if (
      !validDate(review.date) ||
      !Array.isArray(review.taskIds) ||
      review.taskIds.some((id) => !taskIds.has(id)) ||
      typeof review.message !== 'string'
    )
      throw new Error('Invalid completed review.');
  }
}
export function parseExport(text: string): PlanningExport {
  if (text.length > 50 * 1024 * 1024)
    throw new Error('This export is too large (maximum 50 MB).');
  let data: PlanningExport;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('The file is not valid JSON.');
  }
  validateExport(data);
  return data;
}
