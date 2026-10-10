import type { Attachment, Log, LogInput, LogLink } from './types';
import { assertId, assertTimestamp } from '../validation';
export const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;
export const MAX_LOG_BYTES = 50 * 1024 * 1024;
export const MAX_LOG_ATTACHMENTS = 12;
export const IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
  'image/heic',
  'image/heif',
  'image/tiff',
  'image/bmp',
];
export const AUDIO_TYPES = [
  'audio/mpeg',
  'audio/mp4',
  'audio/aac',
  'audio/wav',
  'audio/x-wav',
  'audio/ogg',
  'audio/webm',
  'audio/flac',
  'audio/x-flac',
  'audio/x-m4a',
  'audio/aiff',
  'audio/x-aiff',
  'audio/3gpp',
  'audio/amr',
];
export function validateLogInput(input: LogInput): void {
  if (!input || typeof input.text !== 'string' || input.text.length > 100000)
    throw new Error('Log text must be at most 100,000 characters.');
  if (
    !Array.isArray(input.attachmentIds) ||
    input.attachmentIds.length > MAX_LOG_ATTACHMENTS ||
    new Set(input.attachmentIds).size !== input.attachmentIds.length
  )
    throw new Error('A log can contain up to 12 different attachments.');
  input.attachmentIds.forEach(assertId);
  if (!input.text.trim() && !input.attachmentIds.length)
    throw new Error('Write something or attach an image or audio.');
}
export function validateLog(log: Log): void {
  validateLogInput(log);
  assertId(log.id);
  assertTimestamp(log.createdAt);
  assertTimestamp(log.updatedAt);
}
export function validateLogLink(link: LogLink): void {
  assertId(link.id);
  assertId(link.logId);
  assertId(link.targetId);
  assertTimestamp(link.createdAt);
  if (link.targetType !== 'task') throw new Error('Unknown log association.');
}
export function validateAttachment(attachment: Attachment): void {
  assertId(attachment.id);
  assertTimestamp(attachment.createdAt);
  if (
    typeof attachment.name !== 'string' ||
    !attachment.name.trim() ||
    attachment.name.length > 500
  )
    throw new Error('Invalid attachment name.');
  if (
    !Number.isSafeInteger(attachment.size) ||
    attachment.size < 1 ||
    attachment.size > MAX_ATTACHMENT_BYTES
  )
    throw new Error('Files must be nonempty and at most 20 MB.');
  if (
    typeof attachment.sha256 !== 'string' ||
    !/^[a-f0-9]{64}$/.test(attachment.sha256)
  )
    throw new Error('Invalid attachment checksum.');
  const types =
    attachment.kind === 'image'
      ? IMAGE_TYPES
      : attachment.kind === 'audio'
        ? AUDIO_TYPES
        : [];
  if (!types.includes(attachment.mimeType))
    throw new Error('Choose an image or audio file in a supported format.');
}
