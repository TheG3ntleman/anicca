import type { Attachment } from '../domain/logs/types';
export interface PendingAttachment {
  metadata: Attachment;
  blob: Blob;
}
export interface LogDraft {
  text: string;
  attachments: PendingAttachment[];
}
export interface StoredMedia {
  id: string;
  blob: Blob;
}
