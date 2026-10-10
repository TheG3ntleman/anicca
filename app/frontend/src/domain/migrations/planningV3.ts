import type { Log, LogLink } from '../logs/types';
import { validateLog, validateLogLink } from '../logs/validation';
import { assertId } from '../validation';

export function migrateNoteV2(value: unknown): { log: Log; link: LogLink } {
  if (!value || typeof value !== 'object')
    throw new Error('Invalid legacy note.');
  const note = value as Record<string, unknown>;
  assertId(note.taskId);
  const log: Log = {
    id: note.id as string,
    text: note.text as string,
    attachmentIds: [],
    createdAt: note.createdAt as string,
    updatedAt: note.updatedAt as string,
  };
  const link: LogLink = {
    id: log.id,
    logId: log.id,
    targetType: 'task',
    targetId: note.taskId,
    createdAt: log.createdAt,
  };
  validateLog(log);
  validateLogLink(link);
  return { log, link };
}
export function migratePlanningExportV2(value: unknown): unknown {
  const data = value as Record<string, unknown>;
  if (
    !data ||
    data.format !== 'anicca-planning' ||
    data.schemaVersion !== 2 ||
    !Array.isArray(data.notes) ||
    data.notes.length > 100000
  )
    throw new Error('Invalid version 2 planning export.');
  const records = data.notes.map(migrateNoteV2);
  return {
    format: data.format,
    schemaVersion: 3,
    exportedAt: data.exportedAt,
    tasks: data.tasks,
    logs: records.map((record) => record.log),
    logLinks: records.map((record) => record.link),
    attachments: [],
    media: [],
    events: data.events,
    reviews: data.reviews,
  };
}
