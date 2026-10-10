import type { PlanningExport, PlanningData } from './types';
import { COLLECTIONS } from './types';
import { validateTask, assertId, assertTimestamp } from '../tasks/validation';
import { validDate } from '../tasks/dates';
import { migratePlanningExportV1 } from '../migrations/planningV2';
import { migratePlanningExportV2 } from '../migrations/planningV3';
import {
  validateLog,
  validateLogLink,
  validateAttachment,
  MAX_LOG_BYTES,
} from '../logs/validation';
import { MAX_EXPORT_BYTES, encodedByteLength } from './encoding';
export function validatePlanningData(data: PlanningData): void {
  if (!data) throw new Error('Missing planning records.');
  for (const key of COLLECTIONS) {
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
  data.logs.forEach(validateLog);
  data.logLinks.forEach(validateLogLink);
  data.attachments.forEach(validateAttachment);
  const taskIds = new Set(data.tasks.map((task) => task.id));
  const logs = new Set(data.logs.map((log) => log.id));
  const attachments = new Map(
    data.attachments.map((attachment) => [attachment.id, attachment]),
  );
  const targets = new Set<string>();
  for (const link of data.logLinks) {
    if (!logs.has(link.logId) || !taskIds.has(link.targetId))
      throw new Error(
        'A log association refers to a missing log or missing task.',
      );
    const key = `${link.logId}:${link.targetType}:${link.targetId}`;
    if (targets.has(key)) throw new Error('Duplicate log association.');
    targets.add(key);
  }
  for (const log of data.logs) {
    let size = 0;
    for (const id of log.attachmentIds) {
      const attachment = attachments.get(id);
      if (!attachment) throw new Error('A log refers to a missing attachment.');
      size += attachment.size;
    }
    if (size > MAX_LOG_BYTES)
      throw new Error('A log can contain up to 50 MB of media.');
  }
  const byHash = new Map<string, (typeof data.attachments)[number]>();
  for (const attachment of data.attachments) {
    const existing = byHash.get(attachment.sha256);
    if (existing && existing.size !== attachment.size)
      throw new Error('Attachments sharing media must agree on size.');
    byHash.set(attachment.sha256, attachment);
  }
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
export function validateExport(data: PlanningExport): void {
  if (!data || data.format !== 'anicca-planning' || data.schemaVersion !== 3)
    throw new Error('This is not a supported Anicca planning export.');
  assertTimestamp(data.exportedAt);
  validatePlanningData(data);
  if (!Array.isArray(data.media) || data.media.length > 100000)
    throw new Error('Invalid media collection.');
  const byHash = new Map(
    data.attachments.map((attachment) => [attachment.sha256, attachment]),
  );
  const hashes = new Set<string>();
  for (const file of data.media) {
    const attachment = byHash.get(file?.id);
    if (
      !attachment ||
      hashes.has(file.id) ||
      encodedByteLength(file.dataBase64) !== attachment.size
    )
      throw new Error('Invalid or duplicate media payload.');
    hashes.add(file.id);
  }
  for (const hash of byHash.keys())
    if (!hashes.has(hash))
      throw new Error('An attachment is missing its media payload.');
}
export function parseExport(text: string): PlanningExport {
  if (text.length > MAX_EXPORT_BYTES)
    throw new Error('This export is too large (maximum 250 MB).');
  let data: PlanningExport;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('The file is not valid JSON.');
  }
  if ((data as unknown as { schemaVersion?: number })?.schemaVersion === 1)
    data = migratePlanningExportV1(data) as PlanningExport;
  if ((data as unknown as { schemaVersion?: number })?.schemaVersion === 2)
    data = migratePlanningExportV2(data) as PlanningExport;
  validateExport(data);
  return data;
}
