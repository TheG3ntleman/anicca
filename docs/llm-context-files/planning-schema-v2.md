# Planning schema v2

Historical contract. Current logs/media use [schema v3](planning-schema-v3.md).
Task fields and scheduling rules remain; old notes migrate to logs and links.

The independent model lives in `app/frontend/src/domain`. React renders and edits
it; the `anicca-planning` IndexedDB database and JSON export envelope are version 2.
Old journaling storage is separate and is not changed.

## Collections

| Collection | Fields | Purpose |
| --- | --- | --- |
| tasks | id, title, finishCriteria, description, plannedCompletionDate, status, archived, createdAt, updatedAt, completedAt | Current task state |
| notes | id, taskId, text, createdAt, updatedAt | Dated text notes |
| events | id, taskId, action, at, before, after, reviewId | Changes with full task snapshots |
| reviews | id, date, completedAt, taskIds, message | Finished guided reviews |

IDs survive transfer. Calendar dates are local `YYYY-MM-DD`, timestamps are ISO
instants, and lists sort alphabetically. Title and finish criteria are required;
description defaults empty. Their length limits are 500, 10,000, and 100,000.
The task form exposes title, finish criteria, and date only. Existing descriptions
remain readable and are retained when editing; new tasks store an empty description.
Statuses are pending/completed/cancelled/deferred. Archive is separate.
`completedAt` is present exactly when completed and clears on reopening.

```json
{
  "title": "Prepare a presentation",
  "finishCriteria": "A complete draft of the slides is ready to review.",
  "description": "Start with the outline.",
  "plannedCompletionDate": "2026-10-18"
}
```

## Date-driven planning

There is no stored planning layer. The form offers Today, Tomorrow, Choose a
date, and Not scheduled yet. Any valid calendar date is allowed; null means
unscheduled. Dates express intentions and can be changed freely.

For unresolved, unarchived tasks, selection uses the current local day:

| Condition | Display |
| --- | --- |
| Deferred, or planned date before today | Needs review |
| Planned date today/tomorrow | Short term (Today and Tomorrow's plan) |
| Planned date after tomorrow | Medium term |
| No planned date, pending | Long term |

Classification is derived on display and updates across midnight without
rewriting tasks/history. Completed items remain in Today's progress on their
planned day. Cancelled/archived items remain accessible in All tasks. Nothing
silently rolls forward from an earlier day.

Guided review includes all unresolved dated tasks and all deferred tasks.
Undated pending objectives are reviewed individually. Defer clears the date
and sets deferred. Plan sets pending and the chosen date. Not scheduled yet
sets pending with null date. Text edits keep deferral; editing a deferred task
to give it a date brings it back into the active plan. Leave unresolved records
a review action without changing its schedule/status.

## Persistence and transfer

Task changes and their history events write atomically. Stale edits, status
changes, and reviews are guarded by `updatedAt`. Notes append separately.
Each review decision persists immediately; a unique finished-review record is
added only when the guided review finishes.

Exports contain format `anicca-planning`, schemaVersion 2, exportedAt, and all
four collections, including inactive tasks and full history. There are no habit
or attachment records yet. Imports validate IDs, field/date/status rules,
history/notes/review references, and merge by ID without deleting local records.
Differing records require explicit conflict choices. Files over 50 MB and
collections over 100,000 records are rejected. Unknown versions are rejected.

## Upgrade from v1

`src/domain/migrations/planningV2.ts` is shared by the IndexedDB upgrade and
old-file import. It removes `horizon` from each task and every before/after
history snapshot. All other fields, IDs, timestamps, relationships, notes, and
reviews stay unchanged. Dates take precedence over stale stored layers. Undated
pending tasks become Long term; deferred tasks remain reviewable.

The database upgrade runs in a single version-change transaction. A migration
failure rolls back to v1 instead of leaving partially transformed records.
Version 1 exports are migrated in memory, then validated under v2 before merge;
the original file is unchanged. Reimporting the same old backup deduplicates
records. New exports are v2 and require the updated app to import.
