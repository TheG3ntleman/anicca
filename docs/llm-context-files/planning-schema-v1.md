# Planning schema v1

The independent domain model is in `app/frontend/src/domain`. React edits and
renders it; IndexedDB persists it. Database and export versions both begin at 1.
The separate `anicca-planning` database does not modify old journaling records.

## Collections

| Collection | Fields | Purpose |
| --- | --- | --- |
| tasks | id, title, finishCriteria, description, horizon, plannedCompletionDate, status, archived, createdAt, updatedAt, completedAt | Current task state |
| notes | id, taskId, text, createdAt, updatedAt | Dated text notes |
| events | id, taskId, action, at, before, after, reviewId | Changes with full task snapshots |
| reviews | id, date, completedAt, taskIds, message | Finished guided reviews |

IDs are generated UUIDs, preserved on transfer. Calendar dates are local
`YYYY-MM-DD`; timestamps are ISO instants. Daily selection uses local date
components, not UTC date truncation. Lists sort alphabetically, with ID ties.

`horizon` is short/medium/long. `plannedCompletionDate` is a date or null;
long-term tasks always have null. Deferred short/medium tasks can be unscheduled.
`status` is pending/completed/cancelled/deferred. Archive is an independent
boolean. `completedAt` exists exactly when completed and becomes null on reopening.
Title and finish criteria are required nonempty strings; description defaults
empty. Input length limits are 500, 10,000, and 100,000 characters respectively.

```json
{
  "title": "Prepare a presentation",
  "finishCriteria": "A complete draft of the slides is ready to review.",
  "description": "Start with the outline.",
  "horizon": "medium",
  "plannedCompletionDate": "2026-10-18"
}
```

Creation adds IDs/timestamps, pending status, and archive/completion defaults.
Tasks and their events write in one transaction. Editing, completion, Undo,
archive, and review check prior updatedAt to prevent stale writes. Notes append
separately and require an existing task.

## History and reviews

Event actions are created, edited, complete, reopen, cancel, defer, reschedule,
archive, and review. Creation has null before; changes preserve both snapshots.
reviewId is null for individual actions or identifies a guided review. Partial
reviews can have events without a finished-review record. Finished review IDs
are unique, preventing duplicate completion records.

Deferring sets deferred and clears the date. Date selection sets pending, with
today/tomorrow short term and later dates medium term. Moving to long term sets
pending with no date. Leave unresolved still records review. Each decision saves
immediately. The finished review includes the reviewed task IDs and its message.

## Export/import

The envelope contains format `anicca-planning`, schemaVersion 1, exportedAt,
and all four collections. Inactive/archived records and history are included.
Version 1 has no attachment or habit records.

Files above 50 MB and collections above 100,000 records are rejected. Validation
checks required fields, dates/statuses, unique IDs per collection, and task
references in notes/history/reviews. Unknown schema versions are rejected;
a future version needs an explicit import migration and database upgrade.

Import merges without deleting local records. New IDs are added, identical
records deduplicate, and differing records with the same ID require a choice
between current/imported. Validation and writes occur in one transaction against
the latest local database. Invalid references or unresolved conflicts abort
all writes. Retained task events preserve histories from both exports.

`app/frontend/tests/fixtures.ts` covers today, tomorrow, dated medium term,
unscheduled long term, older unresolved work, completion, deferral, cancellation,
and archive. These are test records, not live seeds.
