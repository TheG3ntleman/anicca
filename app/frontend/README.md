# Anicca planning pilot

A local-first planning PWA on `executive-function`. The former journaling editor
is preserved on `archive/journaling`.

## First milestone

- Today, Medium term, and Long term with independent scrolling and bottom arrows.
- Drag left to reveal task creation. The panel follows your finger, opens after
  a longer drag/quick flick, and returns closed after a short or cancelled drag.
  Vertical scrolling stays available; + opens the same panel without a gesture.
- Title, finish criteria, and planned completion date in the task form.
  Older task descriptions remain readable and are preserved when editing.
  Today/Tomorrow/Choose a date/Not scheduled yet automatically determine the
  layer as the local day advances. Dates express intentions; there are no
  deadlines or priorities. Earlier unresolved dates and deferred tasks need review.
- Details, unified status/date editing, reusable dated logs, completion/Undo, archive,
  and a searchable browser including completed, cancelled, and archived work.
- The small hollow circle opens a full-screen tools overlay on Tasks. Swipe
  left/right to browse its circular pages, or tap the labels in the horizontal
  ring. Pages/labels follow the pointer, vertical scrolling stays native, and
  opening/closing or selecting a page has no transition animation. × closes it.
  Import/export is the second page. Search, scroll, and import preview state
  survive page switches; task details close back to the browser.
- Finish day reviews unresolved tasks dated today/earlier and undated deferred work,
  excluding tomorrow and later plans. Each decision saves
  immediately; a scrollable summary lists each saved outcome before finishing.
  Finishing records a review and plays a hollow CSS-ring celebration.
  Reopening completed/cancelled tasks goes through Edit and requires an explicit
  new timeline (including an unscheduled choice); accidental completion still has Undo.
- IndexedDB persistence and complete JSON export/import. Imports merge by ID
  with explicit conflict choices and transactional validation.
- Task logs use an independent composer/viewer: text, photos/camera, audio files,
  and microphone recording. Media-only logs, previews/removal, expanded images,
  audio playback, and original-file download are supported. Original media bytes
  stay local and are included in backups; duplicate files share binary storage.
- Bundled Iosevka Term Slab Nerd Font, fixed phone viewport, keyboard handling,
  safe areas, capability-based layouts, and offline PWA caching.

Habits are a clearly marked placeholder. Habit schemas/tracking, streaks,
custom schemas, and Deep Work are subsequent features. Test fixtures do not seed
records into the user's database.

## Source organization

`src/domain/` contains independent TypeScript models, validation, date/selection
rules, review decisions, and transfer logic. `src/storage/` owns database upgrades
and atomic repository operations. `src/state/` connects storage to reactive
snapshots and cross-tab refreshes. `src/hooks/` owns local-day/gesture behavior.

`src/components/` separates the planning screen, task forms/details, reviews,
transfer tools, dialogs, and celebration. `ViewOverlay` and `useCircularSwipe`
provide reusable circular navigation; `ToolsOverlay` supplies its pages, and
`TaskBrowser`/`DataTools` own their content. Components use CSS modules and
shared controls.
`src/styles/` contains theme/font tokens, shared controls, and document defaults.
Phone/desktop layout wrappers remain reusable; desktop processing is future work.

See [schema v3](../../docs/llm-context-files/planning-schema-v3.md). Existing v1/v2
databases upgrade atomically; old notes become logs and task links, and old exports
remain importable with history intact.

## Development and checks

```sh
cd app/frontend
npm ci
npm run dev
npm test
npm run format:check
npm run build
```

Open the printed URL at `/anicca/`. `npm run format` formats source. Tests cover
persistence after reopening, failed transactions, export/restore, merge conflicts,
stale edits, and actual React interface flows using jsdom/fake IndexedDB.
Device layout, downloads, gestures, and offline launch still need iPhone testing.
Logs have an additional test suite covering original media bytes, deduplication,
migration, corruption rejection, failed-write rollback, preview cleanup, recording
cleanup, and integration. Native camera, microphone, and codec playback need device QA.

## Production and backups

```sh
npm run build
npm run preview
```

Service workers run in production, not on the development server. GitHub Pages
serves built output from `gh-pages` at `https://theg3ntleman.github.io/anicca/`.
Source on `executive-function` needs deliberate build/deployment; the inherited
workflow targets `main`.

On iPhone, open the HTTPS site in Safari and choose Share → Add to Home Screen.
Load online before testing offline launch. Fonts are bundled/precached; the
initial download is approximately 20 MB.

Swipes use native touch tracking with direction locking, and pointer tracking for
pen/mouse input where supported. Horizontal drags prevent native scrolling only
after locking; vertical scrolling and form controls keep their normal behavior.
The planning shell uses bounded grid rows; its footer owns the home-indicator
inset (capped at 34 px), rather than reserving empty space below the app root.
Installed PWAs use `100dvh` at rest, with body/root in normal flow to avoid the
clipping or offsets introduced by a fixed full-screen page. iOS can under-report
visual viewport height ([WebKit issue 254868](https://bugs.webkit.org/show_bug.cgi?id=254868)).
Visual viewport dimensions apply during a substantial keyboard shrink while an
editable field is focused; focus, rotation, and resume also refresh sizing.

Records stay in this browser/PWA's IndexedDB. Use **circle → Import/export** to export backups
and save them to Files. JSON exports are plaintext; clearing browser data can
remove local records. No sync or export encryption is implemented. Import into
an empty database to restore, or merge into an existing database after checking
conflict choices.

Log files are limited to 20 MiB each, 12 attachments and 50 MiB per log. Complete
JSON backups support up to 250 MiB and embed original file bytes as base64.
Recording checks supported formats at runtime, stops at ten minutes or when
visibility becomes hidden, and releases the microphone on stop/discard/unmount.
Use HTTPS or localhost for media/checksums and microphone access; insecure LAN
preview URLs do not provide these APIs. Audio-file selection remains available
when recording is unsupported. No background recording is promised.
