# Editor adapter

The independent EntrySession owns the entry. ProseMirror holds a projection plus
transient selection, composition, and history state. AniccaEditor receives a
session; it does not create the entry or own its definition registry.

`adapter.ts` proposes editor transactions to the primary AST and commits them
before displaying the updated editor state. It suppresses its own subscription
feedback. External session operations update the editor using a document diff,
mapping selection and avoiding a full editor reconstruction on each keystroke.
Loading a different entry resets transient history and node views.

`conversion.ts` translates between representations. `schema.ts` describes the
editor representation. `commands.ts` handles caret/selection mechanics and uses
shared document logic for box reversal. Plugins delegate structural validation,
depth, and copied-ID normalization to document functions. Node views display
boxes and editable fields using definition metadata; scalar changes are editor
transactions accepted by the same primary session.

`@` choices, keyboard navigation, box insertion, and depth-limit messages remain
editor-specific. Required-field and value issues come from the document model.
Drafts may contain missing values and out-of-range numbers. Invalid primitive
fields are marked with aria-invalid and explanatory title text.
