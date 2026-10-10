import type { PendingAttachment } from './types';
import {
  IMAGE_TYPES,
  AUDIO_TYPES,
  MAX_ATTACHMENT_BYTES,
  validateAttachment,
} from '../domain/logs/validation';

const EXTENSIONS: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  avif: 'image/avif',
  heic: 'image/heic',
  heif: 'image/heif',
  tif: 'image/tiff',
  tiff: 'image/tiff',
  bmp: 'image/bmp',
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  mp4: 'audio/mp4',
  aac: 'audio/aac',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  oga: 'audio/ogg',
  webm: 'audio/webm',
  flac: 'audio/flac',
  aiff: 'audio/aiff',
  aif: 'audio/aiff',
  '3gp': 'audio/3gpp',
  amr: 'audio/amr',
};
export function readBlob(blob: Blob): Promise<ArrayBuffer> {
  if (typeof blob.arrayBuffer === 'function') return blob.arrayBuffer();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () =>
      reject(reader.error ?? new Error('Unable to read file.'));
    reader.readAsArrayBuffer(blob);
  });
}
export async function sha256(bytes: ArrayBuffer): Promise<string> {
  if (!crypto.subtle)
    throw new Error('Media attachments need HTTPS or localhost.');
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)]
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
}
export async function prepareAttachment(
  file: Blob & { name?: string },
): Promise<PendingAttachment> {
  if (!file.size || file.size > MAX_ATTACHMENT_BYTES)
    throw new Error('Files must be nonempty and at most 20 MB.');
  const name = file.name?.trim() || 'Attachment';
  const reported = file.type.toLowerCase().split(';')[0].trim();
  const mimeType =
    !reported || reported === 'application/octet-stream'
      ? EXTENSIONS[name.split('.').pop()!.toLowerCase()]
      : reported;
  if (![...IMAGE_TYPES, ...AUDIO_TYPES].includes(mimeType))
    throw new Error(`“${name}” is not a supported image or audio file.`);
  const bytes = await readBlob(file);
  const metadata = {
    id: crypto.randomUUID(),
    kind: IMAGE_TYPES.includes(mimeType)
      ? ('image' as const)
      : ('audio' as const),
    name,
    mimeType,
    size: file.size,
    sha256: await sha256(bytes),
    createdAt: new Date().toISOString(),
  };
  validateAttachment(metadata);
  return { metadata, blob: new Blob([bytes], { type: mimeType }) };
}
export function formatBytes(bytes: number): string {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
