# Primary entry state

`EntrySession` owns an immutable partial-entry AST, revision, definition registry,
and validation issues. It accepts engine-independent document operations and
notifies subscribers after an atomic commit. Structural failures leave the
previous snapshot untouched. Incomplete fields and invalid ranges/choices are
retained with issues, allowing drafts to be serialized and restored.

There are no React, DOM, or ProseMirror imports in `EntrySession` or its document
dependencies. `useEntrySession` is the optional React subscription wrapper.
AppShell creates the active session and passes it through Composer, so changing
layouts or remounting the editor does not discard the entry.

To modify an entry outside the editor, call `session.apply(operation)`.
To serialize it, use `serializeDocument(session.getSnapshot().document)`.
Definition additions use `session.addDefinitions`; existing versions cannot be
silently rewritten. The editor subscribes to session updates through its adapter.
Persistence is not implemented yet; the session survives editor destruction but
not a page reload.
