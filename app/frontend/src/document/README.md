# Anicca document model

- `types.ts`: engine-independent definitions, field values, box instances, and AST.
- `boxDefinitions.ts`: predefined box data and the default nesting limit.
- `boxRegistry.ts`: definition validation, selector lookup, and version management.
- `boxInstances.ts`: instance creation and field defaults.
- `validation.ts`: structural/value validation and missing-required-field reporting.
- `serialization.ts`: versioned raw text and migration from the original format.
- `legacy/`: the v1 parser, kept solely for existing serialized records.

Box definitions are plain data, not executable code. Supported field kinds are
text, number, choice, and recursively editable freeform content. Definitions
specify ordered fields, labels (or null for no visible label), required flags,
defaults, and constraints. Every declared field appears when a box is created.
Required fields may remain empty in drafts; the validation helper reports them.

Instances reference an immutable definition ID/version. Schema v2 documents
include definition snapshots so custom types remain self-contained. Updating a
definition requires a new version; older instances retain their original fields.
The registry selects the latest version for new insertions. Multiple freeform
fields in one box are supported. Boxes without a freeform field are leaves.

Raw output is a plain-text `@anicca/2` envelope followed by JSON, preserving all
fields and definition snapshots. The original tagged v1 raw format still parses
and migrates into v2. Root depth is zero; fields themselves do not add depth.

A future designer can produce definitions and supply them to `AniccaEditor` via
its `definitions` prop. New box types using existing field kinds require no
new editor node, command, renderer, or serializer. New field kinds require a
field renderer and value validation. Media/reference fields are not yet built.

## Ownership and partial entries

`operations.ts` is the engine-independent update API: replace content, insert or
unwrap a box, update a field, or propose a replacement document. It validates
structure, normalizes adjacent text and field order, and shares copied-ID and
unwrap behaviour with editor adapters. EntrySession owns the resulting AST.

`validateDocument` checks structural integrity and nesting. `getValidationIssues`
and `fieldValueIssues` report missing required values and invalid ranges/choices
without rejecting the draft. Serialization preserves such partial entries.
