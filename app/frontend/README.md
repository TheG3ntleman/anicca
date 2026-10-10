# Anicca planning pilot

A local-first planning PWA on `executive-function`. The former journaling editor
is preserved on `archive/journaling`.

## First milestone

- Today, Medium term, and Long term with independent scrolling and bottom arrows.
- Drag left to reveal task creation. The panel follows your finger, opens after
  a longer drag/quick flick, and returns closed after a short or cancelled drag.
  Vertical scrolling stays available; + opens the same panel without a gesture.
- Title, finish criteria, optional description, and planned completion date.
  Dates express intentions; there are no deadlines or priorities.
- Details, editing, dated notes, completion/Undo, individual review, archive,
  and a searchable browser (Data → All tasks) including completed and cancelled work.
- Finish day reviews unresolved short/medium tasks. Each decision saves
  immediately; finishing records a review and plays a short celebration.
- IndexedDB persistence and complete JSON export/import. Imports merge by ID
  with explicit conflict choices and transactional validation.
- Bundled Iosevka Term Slab Nerd Font, fixed phone viewport, keyboard handling,
  safe areas, capability-based layouts, and offline PWA caching.

Habits are a clearly marked placeholder. Habit logs, attachments, streaks,
custom schemas, and Deep Work are subsequent features. Test fixtures do not seed
records into the user's database.

## Source organization

`src/domain/` contains independent TypeScript models, validation, date/selection
rules, review decisions, and transfer logic. `src/storage/` owns database upgrades
and atomic repository operations. `src/state/` connects storage to reactive
snapshots and cross-tab refreshes. `src/hooks/` owns local-day/gesture behavior.

`src/components/` separates the planning screen, task forms/details, reviews,
transfer tools, dialogs, and celebration. Each component owns a CSS module.
`src/styles/` contains theme/font tokens, shared controls, and document defaults.
Phone/desktop layout wrappers remain reusable; desktop processing is future work.

See [schema v1](../../docs/llm-context-files/planning-schema-v1.md).

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

Records stay in this browser/PWA's IndexedDB. Use **Data** to export backups
and save them to Files. JSON exports are plaintext; clearing browser data can
remove local records. No sync or export encryption is implemented. Import into
an empty database to restore, or merge into an existing database after checking
conflict choices.
