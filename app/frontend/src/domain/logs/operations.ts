import type { Log, LogInput, LogLink, LogTarget } from './types';
import { validateLog, validateLogLink } from './validation';
export function createLog(
  input: LogInput,
  now = new Date().toISOString(),
): Log {
  const log = {
    ...input,
    text: input.text.trim(),
    attachmentIds: [...input.attachmentIds],
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
  };
  validateLog(log);
  return log;
}
export function linkLog(log: Log, target: LogTarget): LogLink {
  // Using the log's ID makes conversion of old task notes deterministic.
  const link = {
    id: log.id,
    logId: log.id,
    targetType: target.type,
    targetId: target.id,
    createdAt: log.createdAt,
  };
  validateLogLink(link);
  return link;
}
