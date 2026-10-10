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

## Tasks

Tasks and habits are separate. One-off tasks have title, finish criteria,
optional text description, planning layer, and optional **planned completion
date**. There are no deadlines or priorities. Short term is intended for
today/tomorrow, medium term for a later chosen date, and long term is unscheduled.
Dates are date-only with no artificial month limit. Lists sort alphabetically.

States are pending, completed, cancelled, and deferred. Archive is a separate
flag preserving the underlying state. No subtasks, dependencies, or attachments
initially. Tasks can be added and rescheduled during the day. Tapping opens
editing, notes, history, and individual review. List completion offers Undo.
Browse all tasks includes completed/cancelled/archived work.

Today shows items deliberately planned for that date, including completed ones
for progress. Prior review typically creates tomorrow's plan; manual additions
work too. Older unresolved items do not roll into Today; they remain accessible
and are marked for review. Tomorrow's selections can be inspected separately.

## Review

Finish day is a guided version of individual review. It checks all unresolved
short/medium tasks, including older and deferred work. Long-term objectives
can be reviewed individually. Choices are today, tomorrow, another date,
complete, cancel, defer, move to long term, or leave unresolved. Deferring clears
the date and marks the item for review. Review concerns items, not missed days.

Each decision persists immediately; no review draft is needed. Closing a partial
review retains decisions. Finishing records completion and plays one short,
non-skippable encouraging animation. This rewards review without requiring all
tasks to be completed. Celebrations do not replay automatically on relaunch;
reduced-motion users see the message without animated movement.

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
silently overwriting it. Attachments/richer notes need an export format carrying
both their content and relationships.

## Initial scope and persistence

The first milestone implements tasks, three layers, navigation, creation,
details/editing/notes, completion/Undo, review/celebration, local persistence,
and complete export/import. Habits remain an explicit placeholder; their schemas
and Deep Work come next.

Versioned JSON exports include all tasks, notes, task-change history, and
completed reviews. Imports validate and merge by ID with conflict choices;
transactions prevent partial writes. Database/export changes require explicit
migrations. Personal records remain local initially.
