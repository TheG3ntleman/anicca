# Planning schema v3: reusable logs and media

The current database and export format are version 3. Task fields and date-based
planning remain as described in [v2](planning-schema-v2.md). Task notes have
become independent logs; associations with tasks are separate records.

## Records

| Collection | Fields | Purpose |
| --- | --- | --- |
| tasks | id, title, finishCriteria, description, plannedCompletionDate, status, archived, createdAt, updatedAt, completedAt | Current task state |
| logs | id, text, attachmentIds, createdAt, updatedAt | Independent text/media logs |
| logLinks | id, logId, targetType, targetId, createdAt | Associations with tasks; currently targetType is `task` |
| attachments | id, kind, name, mimeType, size, sha256, createdAt | File metadata; kind is `image` or `audio` |
| events | id, taskId, action, at, before, after, reviewId | Task change history |
| reviews | id, date, completedAt, taskIds, message | Finished guided reviews |

These six collections form ordinary reactive state. A separate IndexedDB `media`
store contains `{ id: sha256, blob: Blob }` records. File bytes are loaded when
needed, rather than included in each state refresh. Matching content hashes
share binary storage even when file names/attachment IDs differ. MIME type is
applied from the requested attachment when reading a shared blob.

## Logs and associations

```ts
interface Log {
  id: string;
  text: string;
  attachmentIds: string[];
  createdAt: string;
  updatedAt: string;
}

interface LogLink {
  id: string;
  logId: string;
  targetType: 'task';
  targetId: string;
  createdAt: string;
}
```

Every field is present. A log can be text-only, media-only, or a combination.
Text is trimmed at its edges, preserves internal line breaks, and has a 100,000
character limit. Whitespace with no attachments is invalid. `attachmentIds`
is ordered and contains unique IDs. A log can have no association; task linkage
does not change its core schema. A link must reference an existing log and task;
duplicate associations are rejected. Logs currently append; editing saved logs
and attaching one existing log to multiple targets have no UI yet.

`LogComposer` depends on a save callback, not a task or storage implementation.
`LogViewer` receives a log, metadata, and a media-loading callback. `TaskDetails`
supplies task association and renders its linked logs. Other contexts can reuse
the composer/viewer without changing the log record. Adding new association
target types will require explicit type and reference-validation support.

## Attachments and UI

```ts
interface Attachment {
  id: string;
  kind: 'image' | 'audio';
  name: string;
  mimeType: string;
  size: number;      // Original byte count.
  sha256: string;    // Lowercase SHA-256 hex, also the binary storage key.
  createdAt: string;
}
```

Names are nonempty and at most 500 characters. Files must be nonempty and at
most 20 MiB each; one log allows 12 attachments and 50 MiB total. The picker
accepts supported raster image and audio formats; video and SVG are not included.
Common JPEG/PNG/WebP/GIF/AVIF/HEIC/HEIF/TIFF/BMP images and MP3/M4A/AAC/WAV/
OGG/WebM/FLAC/AIFF/3GPP/AMR audio types are allowed. Missing file MIME types can
be inferred from known extensions. Original bytes are retained; no image/audio
transcoding strips information. Formats a browser cannot preview remain
downloadable as original files.

The task log composer offers text, Photos, Camera, Audio, and Record. Drafts
show previews, native audio controls, and removal controls. Saving a media-only
log is supported. Success clears the draft; failure retains text/files for retry.
Task editing preserves the composer draft. Image thumbnails open an original
image view; saved attachments can be downloaded. Viewer media loads lazily as
it approaches the visible area. Object URLs are released on replacement/unmount.

Microphone recording checks browser support and selects a supported MIME type
at runtime. It requires a secure origin and user permission. Recording has a
wall-clock timer, Stop and attach, and Discard. It stops at ten minutes, or when
the app receives a hidden visibility event, attaching collected audio. Every
stop/cancel/unmount releases microphone tracks; late permission grants after
cancellation are released too. Background recording is not a supported mode.
Camera/microphone behavior and actual format playback still require iPhone QA.
Media preparation/checksums use Web Crypto, so use HTTPS or localhost.

## Persistence, backups, and migration

Log creation, its optional association, metadata, and binary payloads commit
in one transaction. Missing targets, conflicting IDs, storage failures, or
invalid media abort the write. Standalone logs use the same operation without a
target. Preparation and checksum work occur before the transaction.

```ts
interface PlanningExport {
  format: 'anicca-planning';
  schemaVersion: 3;
  exportedAt: string;
  tasks: Task[];
  logs: Log[];
  logLinks: LogLink[];
  attachments: Attachment[];
  events: TaskEvent[];
  reviews: DayReview[];
  media: { id: string; dataBase64: string }[];
}
```

The JSON backup contains actual file bytes, once per unique content hash. It
does not depend on blob URLs, device file paths, or external hosts. Export reads
a consistent snapshot and verifies payload checksums. Imports validate all
collections/references, payload sizes/encoding, and SHA-256 checksums before
writing. Metadata merges by ID with explicit conflict choices; media never
appears as a giant string in the conflict UI. The final merge and binary writes
are atomic. Repeated imports deduplicate.

Transfer files are limited to 250 MiB; each collection to 100,000 records. JSON
base64 increases backup size; this pilot loads a backup into memory. Larger
archives/streaming transfer can be added later. Records remain local; there is
no upload, sync, or encryption added by this feature.

Version 1 and 2 databases/exports migrate explicitly. Each old note becomes a
log with the same ID, text, and timestamps and an empty attachment list. A
deterministic link preserves its task association. Database conversion runs
inside the version-change transaction and removes the old `notes` store only
as part of that successful upgrade. Failure rolls everything back. Import
migrates old files in memory without changing the original backup. V1 also
retains the existing date-driven planning migration. New v3 exports require
the updated app.

## Browser references

- [Microphone access and secure contexts](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)
- [Runtime recording format detection](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder/isTypeSupported_static)
- [WebKit MediaRecorder implementation](https://webkit.org/blog/11353/mediarecorder-api/)
