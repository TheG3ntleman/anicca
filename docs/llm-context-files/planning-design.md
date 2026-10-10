# Anicca planning design

Agreed decisions through October 10, 2026. This supersedes earlier journaling
plans; the old implementation is preserved on `archive/journaling`.

## Direction and navigation

Anicca supports executive function and, later, Deep Work. Planning opens on
Today; bottom arrows advance through Medium term and Long term. Each layer
scrolls independently, an up arrow returns to the previous layer, and the last
arrow returns to Today. A right-to-left gesture opens creation, with a small +
button as a fallback. The dark blue theme, fixed viewport, PWA setup, reusable
phone/desktop wrappers, and bundled Iosevka Term Slab Nerd Font remain.

A small hollow circle opens a full-screen tools overlay, immediately without an
opening/closing transition. × returns to planning. Its default page is Tasks,
containing every task including completed, cancelled, deferred, and archived
work; Import/export is the second page. A horizontal label ring highlights the
current page and supports tapping and left/right dragging. Both labels and
pages follow the finger, wrap around at either end, and switch on release
without transition animations for now. Each page scrolls vertically. Page
changes retain search, scroll position, and import previews. Task details return
to the browser on close. The overlay navigation remains reusable for future pages.

## Tasks

Tasks and habits are separate. One-off tasks have title, finish criteria, and
an optional **planned completion date**. The form has no description field;
older descriptions stay in records, remain readable, and survive edits. There are
no deadlines or priorities. The date is the only scheduling input: Today,
Tomorrow, Choose a date, or Not scheduled yet. Layers are calculated when displayed:
today/tomorrow is short term, later dates are medium term, and no date is long term.
They automatically change as the local calendar advances without editing records.
Dates are date-only with no artificial month limit. Lists sort alphabetically.

States are pending, completed, cancelled, and deferred. Archive is a separate
flag preserving the underlying state. No subtasks or dependencies initially.
Tasks can be added and rescheduled during the day. Tapping opens editing,
logs, history, and individual review. List completion offers Undo.
Browse all tasks includes completed/cancelled/archived work.

Today shows items deliberately planned for that date, including completed ones
for progress. Prior review typically creates tomorrow's plan; manual additions
work too. Older unresolved items do not roll into Today; they remain accessible
and are marked for review. Tomorrow's selections can be inspected separately.
Older unresolved dates and deferred tasks appear in review rather than a planning
layer. Completed tasks stay in Today's progress on their planned day. A date
months away still belongs to medium term; long term means unscheduled.

## Review

Finish day is a guided version of individual review. It checks unresolved tasks
planned for today or earlier, plus undated deferred work. Tomorrow and later
plans are excluded; planning an item for tomorrow during review does not put it
back into today's queue. Long-term objectives
can be reviewed individually. Choices are today, tomorrow, another date,
complete, cancel, defer, not scheduled yet, or leave unresolved. Deferring clears
the date and marks the item for review. Review concerns items, not missed days.
Deferred work keeps its review flag after text edits. Scheduling it during review sets
it pending; explicitly choosing Not scheduled yet during review sets it pending
with no date, so it appears in Long term.

Each decision persists immediately; no review draft is needed. Closing a partial
review retains decisions. Finishing records completion and plays one short,
non-skippable encouraging animation. This rewards review without requiring all
tasks to be completed. Celebrations do not replay automatically on relaunch;
reduced-motion users see the message without animated movement.

Task details have one Edit path for text, status, and scheduling, rather than
separate Edit and Review actions. Reopening completed/cancelled work requires an
explicit timeline choice in Edit: Today, Tomorrow, another date, or Not scheduled
yet. Past dates cannot be chosen for reopening. A completed list checkbox opens
that editor instead of silently reopening; Undo remains for accidental completion.
Reopening also restores an archived task to the active plan.

The guided Finish day review separates selecting an outcome from saving it and
shares the scheduling picker with task forms. Its final screen includes a
scrollable list of saved outcomes and prior status/date, read from this review's
persisted task events. Tasks that no longer need review are skipped, not counted
as reviewed. Finishing plays a 1.9-second CSS hollow-ring orbit, checkmark reveal, ripple,
and particle burst, followed by a soft exit; reduced motion stays static.

## Habits and future records

Today reserves space for habits, which are monitored instead of ticked off.
We will design each schema while using the product: weight, food/meals, sleep,
water, medication, diet, and exercise. Numeric goals need current value, target,
daily observations, graphs/history, and notes. Weight trends differ from daily
accumulation goals. Multiple meals per day may contain multiple items, quantity,
calories, photos, locations, and other manually recorded details. Appropriate
automatic capture can follow with permission.

Custom habit schemas, nested records, and habit streaks are later features.
Schema changes must preserve prior information through versioning, rather than
silently overwriting it. Reusable logs now support text, image attachments, audio
files, and microphone recording. Logs are independent records; task associations
are separate links. The composer/viewer can later serve habits and other contexts.
Existing text notes migrate without losing IDs, timestamps, text, or associations.

## Initial scope and persistence

The first milestone implements tasks, three layers, navigation, creation,
details/editing/logs, completion/Undo, review/celebration, local persistence,
and complete export/import. Habits remain an explicit placeholder; their schemas
and Deep Work come next.

Versioned JSON exports include all tasks, logs, associations, attachment metadata,
actual image/audio bytes, task-change history, and completed reviews. Imports
validate and merge by ID with conflict choices;
transactions prevent partial writes. Database/export changes require explicit
migrations. Personal records remain local initially.
Database/export v2 removes the stored layer. The automatic v1 upgrade and v1
export import preserve dates, task states, IDs, notes, reviews, and history
snapshots while dropping their redundant `horizon` fields.
Database/export v3 replaces notes with logs and associations, and adds metadata
and separate binary storage. Images/audio preserve their original bytes, remain
local, and are included in backups. Identical media shares binary storage.
The composer offers Photos, Camera, Audio, and Record, with pending previews,
removal, playback, and original-file download. Text is optional with attachments.
Recording is foreground-only; camera/microphone behavior still needs device QA.
