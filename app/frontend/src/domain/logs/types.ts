export interface Log {
  id: string;
  text: string;
  attachmentIds: string[];
  createdAt: string;
  updatedAt: string;
}
export type LogInput = Pick<Log, 'text' | 'attachmentIds'>;
// New target kinds can be added here without changing a log or its composer.
export interface LogTarget {
  type: 'task';
  id: string;
}
export interface LogLink {
  id: string;
  logId: string;
  targetType: LogTarget['type'];
  targetId: string;
  createdAt: string;
}
export interface Attachment {
  id: string;
  kind: 'image' | 'audio';
  name: string;
  mimeType: string;
  size: number;
  sha256: string;
  createdAt: string;
}
/** Binary payloads are separate from ordinary state and addressed by content hash. */
export interface ExportMedia {
  id: string;
  dataBase64: string;
}
