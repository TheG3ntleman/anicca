# Objectives

Version `0.0.1` of Anicca is now scoped narrowly.

The goal of this document is only to define:

1. The database schema.
2. The related write functions for creating and modifying data.
3. The related read functions and more sophisticated query functions.

This plan is not currently about:

1. LLM systems.
2. Insight generation.
3. Automated analysis pipelines.
4. UI design.

# Planning out the database layer

## Goal

At a high level, Anicca wants to store enough structured information to later reason about wholesome and unwholesome patterns.

For `v0.0.1`, the only job of this layer is:

- to store the data cleanly
- to preserve authorship and history
- to support reliable read/write/query operations

## Scope

This document specifies:

- what tables exist
- what fields they contain
- what invariants they obey
- what database functions should exist

This document does not specify:

- ingestion pipelines
- parsing pipelines
- inference logic beyond explicit materialization rules
- insight logic above the database layer

## Design principles

The first version should optimize for the following:

1. Record things in a way that is natural enough that data collection actually happens.
2. Preserve raw data so that later layers can reinterpret or re-query it without data loss.
3. Keep the ontology small and explicit.
4. Preserve history instead of mutating it away.
5. Make customization first-class for tags and references.
6. Keep user data isolated from other users at every layer.

## Core ontology

There are two main identity spaces:

1. `record` space
2. `artifact` space

These are intentionally distinct.

### Record space

Records are not graph nodes.

Records are the stored units of authored or imported process data. They carry:

- timestamps
- ownership
- source/provenance
- direct wholesomeness/confidence where applicable
- tags

The core record process types are:

- `thought`
- `emotion`
- `behaviour`
- `body`
- `modifier`

### Artifact space

Artifacts are graph nodes.

Artifacts are distinct from records. They occupy their own table and their own identity space.

Artifacts come in two main kinds:

- `object`
- `encounter`

Examples:

- object artifact: mother, workplace, project, exam-as-object, self
- encounter artifact: a conversation, a meeting, a specific exam sitting, a setback

### Pseudo-artifacts

Records are not themselves graph nodes, but every record may be represented by a generated pseudo-artifact.

Pseudo-artifacts:

- are generated automatically on request
- are not stored as rows in `artifacts`
- live in artifact space
- deterministically reference exactly one source record

This means the graph is built over:

- stored artifacts
- generated pseudo-artifacts

not over records directly.

### Modifiers

Modifiers are records that amend other records without deleting history.

Examples:

- retraction
- correction
- edit
- ended
- superseded

Modifier kind is carried by tags, not by a fixed enum column.

# Schema

## Users and auth

### `users`

Represents the owner of all user-owned data.

Fields:

- `user_id`
- `username`
- `display_name`
- `created_at`

### `authentication`

Stores credentials separately from the user profile.

Fields:

- `authentication_id`
- `user_id`
- `authentication_type`
- `password_hash`
- `created_at`

Suggested values:

- `authentication_type`
  - `password`

Notes:

- Store only `password_hash`, never the raw password.

### `sessions`

Stores active or recent authenticated sessions.

Fields:

- `session_id`
- `user_id`
- `session_token_hash`
- `expires_at`
- `created_at`

Notes:

- Store only `session_token_hash`, never the raw session token.

## Records

### `records`

The parent table for process records.

Fields:

- `id`
- `user_id`
- `process_type`
- `authored_at`
- `occurred_at`
- `source`
- `raw_text`
- `confidence`
- `wholesomeness`

Suggested enums:

- `process_type`
  - `thought`
  - `emotion`
  - `behaviour`
  - `body`
  - `modifier`
- `wholesomeness`
  - `wholesome`
  - `unwholesome`
  - `mixed`
  - `unknown`
  - `not_applicable`
- `source`
  - `human_entry`
  - `import`
  - `migration`
  - `function`

Notes:

- `confidence` is a direct property of records.
- For concrete authored behavioural assertions, `confidence` will often collapse to something effectively binary.
- Behaviours are modeled as point-in-time records in `v0.0.1`.
- `raw_text` is the main record-level free-form text field.

### `modifiers`

Stores the extension fields for records whose `process_type` is `modifier`.

Fields:

- `id`
- `target_record_id`
- `effective_at`
- `metadata_json`

Notes:

- `id` is the same identifier as the parent row in `records`.
- Modifier meaning is carried by tags.
- No separate `reason` field is kept in the core schema.

## Artifacts

### `artifacts`

Artifacts occupy their own table and their own identity space.

Fields:

- `artifact_id`
- `user_id`
- `artifact_type`
- `name`
- `description`
- `authored_at`
- `occurred_at`
- `source`

Suggested enums:

- `artifact_type`
  - `object`
  - `encounter`
- `source`
  - `human_entry`
  - `import`
  - `migration`
  - `function`

Notes:

- Artifacts are graph nodes.
- Object artifacts persist.
- Encounter artifacts occur.
- Artifact classification such as `person`, `place`, `project`, `meeting`, or `exam` should be expressed through artifact tags rather than fixed columns.
- Artifact `description` is the main artifact-level free-form text field.
- Artifact wholesomeness is usually implied or derived from associated records and references, not stored directly.
- Artifact confidence is usually extraction or resolution confidence, not phenomenological confidence.
- Every user should have one primitive `self` object artifact created automatically.

## Tags

The tag system has four layers:

1. `tag_group_categories`
2. `tag_groups`
3. `tag_types`
4. `tags`

### `tag_group_categories`

Defines the fixed structural categories that tag groups must belong to.

Fields:

- `tag_group_category_id`
- `name`
- `description`
- `required_tag_type_schema_json`
- `created_at`

Notes:

- `tag_group_categories` are system-level.
- Example categories include `thought`, `emotion`, `behaviour`, `body`, `artifact`, `modifier`, and `generic`.

### `tag_groups`

Defines user-customizable groups of related tag types.

Fields:

- `tag_group_id`
- `user_id`
- `name`
- `description`
- `tag_group_category_id`
- `required_tag_type_schema_json`
- `created_at`

Rules:

- Every tag group belongs to exactly one user.
- `name` should be unique per user.
- Every tag group belongs to exactly one `tag_group_category`.
- `required_tag_type_schema_json` may be empty for full flexibility.

Notes:

- Tag groups are user-owned and editable.
- A tag group inherits the norms of its category and may add stricter mandatory sub-field requirements for member tag types.

### `tag_types`

Defines the reusable tag types available to a given user.

Fields:

- `tag_type_id`
- `user_id`
- `name`
- `description`
- `tag_group_id`
- `applies_to_entity_type`
- `applies_to_process_type`
- `value_schema_json`
- `created_at`

Rules:

- Every tag type belongs to exactly one user.
- `name` should be unique per user.
- Every tag type belongs to exactly one `tag_group`.
- `applies_to_entity_type` should be one of:
  - `record`
  - `artifact`
  - `both`
- `applies_to_process_type` may be null.
- Tag types must conform to:
  - their category's `required_tag_type_schema_json`
  - their group's `required_tag_type_schema_json`

Minimal `value_schema_json` shape:

```json
{
  "fields": {
    "field_a": "number|string|boolean|string_list"
  }
}
```

Notes:

- The schema is strict.
- Union-like field types may be expressed using `|`.
- Tags may contain custom string fields, including free-form text where useful.

### Category requirements

This section captures the current baseline expectations for tag categories. These are still intended to be iterated on.

#### `thought`

- A `thought` record must have at least one tag from a tag group in the `thought` category.
- Thought identity should usually be carried by the tag type name or an optional `thought_name` field.
- No universal mandatory payload fields are required yet.

#### `emotion`

- An `emotion` record must have at least one tag from a tag group in the `emotion` category.
- Every emotion tag type must support:
  - `intensity: number`
  - `confidence: number`
- Emotional identity should be carried by the tag type name or an optional `emotion_name` field.

#### `behaviour`

- A `behaviour` record must have at least one tag from a tag group in the `behaviour` category.
- Behaviour identity should usually be carried by the tag type name or an optional `behaviour_name` field.
- No universal mandatory payload fields are required yet.
- If a behaviour tag is uncertain or inferred, it should include `confidence: number`.

#### `body`

- A `body` record must have at least one tag from a tag group in the `body` category.
- Body-state identity should usually be carried by the tag type name or an optional `body_name` field.
- No universal mandatory payload fields are required yet.
- If a body tag is uncertain or inferred, it should include `confidence: number`.

#### `artifact`

- An artifact must have at least one tag from a tag group in the `artifact` category.
- Artifact identity or role should usually be expressed through tag types such as person, place, relationship, project, meeting, exam, conversation, or idea.
- No universal mandatory payload fields are required yet.

#### `modifier`

- A modifier record must have at least one tag from a tag group in the `modifier` category.
- Modifier identity should usually be carried by the tag type name.
- No universal mandatory payload fields are required yet.

### `tags`

Stores the actual tag instances attached to records or artifacts.

Fields:

- `tag_id`
- `user_id`
- `entity_type`
- `entity_id`
- `tag_type_id`
- `value_json`
- `authored_at`

Rules:

- `entity_type` must be either `record` or `artifact`.
- A target entity may not have the same `tag_type_id` attached more than once in `v0.0.1`.
- `value_json` must validate against the corresponding `tag_types.value_schema_json`.

## References

The reference system mirrors the tag system:

1. `reference_group_categories`
2. `reference_groups`
3. `reference_types`
4. `references`

### `reference_group_categories`

Defines the fixed structural categories that reference groups must belong to.

Fields:

- `reference_group_category_id`
- `name`
- `description`
- `required_reference_type_schema_json`
- `created_at`

Notes:

- `reference_group_categories` are system-level.
- Example categories might include `causal`, `relational`, `temporal`, `identity`, `family`, and `generic`.

### `reference_groups`

Defines user-customizable groups of related reference types.

Fields:

- `reference_group_id`
- `user_id`
- `name`
- `description`
- `reference_group_category_id`
- `required_reference_type_schema_json`
- `created_at`

Rules:

- Every reference group belongs to exactly one user.
- `name` should be unique per user.
- Every reference group belongs to exactly one `reference_group_category`.
- `required_reference_type_schema_json` may be empty for full flexibility.

### `reference_types`

Defines the reusable reference types available to a given user.

Fields:

- `reference_type_id`
- `user_id`
- `name`
- `description`
- `reference_group_id`
- `directionality`
- `inverse_reference_type_id`
- `value_schema_json`
- `created_at`

Rules:

- Every reference type belongs to exactly one user.
- `name` should be unique per user.
- Every reference type belongs to exactly one `reference_group`.
- `directionality` must be either `directed` or `undirected`.
- Directionality is defined at the type level, not on each reference instance.
- If `directionality = directed`, the user must define an `inverse_reference_type_id`.
- If `directionality = undirected`, `inverse_reference_type_id` should be null.
- Reference types must conform to:
  - their category's `required_reference_type_schema_json`
  - their group's `required_reference_type_schema_json`

Notes:

- Only user-authored references are primary source data.
- Implied references are derived from type-level rules and may be materialized.
- Examples of directed types: `mother_of`, `caused_by`, `part_of`.
- Examples of undirected types: `friend_of`, `associated_with`.

### `references`

Stores the actual reference instances between artifacts in artifact space.

Fields:

- `reference_id`
- `user_id`
- `from_artifact_id`
- `to_artifact_id`
- `reference_type_id`
- `reference_origin`
- `weight`
- `confidence`
- `authored_at`
- `occurred_at`
- `source`
- `metadata_json`

Suggested enums:

- `reference_origin`
  - `authored`
  - `materialized`
- `source`
  - `human_entry`
  - `import`
  - `migration`
  - `function`

Rules:

- References are always binary edges between exactly two artifact-space nodes.
- Higher-arity relations should be modeled by introducing an artifact, usually an encounter artifact, and connecting ordinary binary references to it.

Materialization rules:

- Authored references are source-of-truth reference data.
- Materialized references are generated from authored references and reference-type rules.
- For directed reference types, the inverse reference type defines the implied reverse edge.
- For undirected reference types, one authored edge is sufficient; query functions should treat it as bidirectional even if no second row is materialized.

Notes:

- Endpoints are artifact-space identifiers.
- That means endpoints may refer either to stored artifacts or to generated pseudo-artifacts.

# Invariants

The following constraints should hold:

1. Every user-owned row belongs to exactly one user.
2. Joined user-owned rows must share the same `user_id`.
3. No cross-user read, write, tag, or reference operation is allowed in `v0.0.1`.
4. Records are never graph nodes directly.
5. Artifacts and pseudo-artifacts are graph nodes.
6. Every modifier must target a valid record.
7. Records should not be hard-deleted in normal operation.
8. Modifiers preserve history rather than overwriting prior records.
9. Every stored record should be traceable back to a generating source.
10. Every `thought` record must have at least one valid tag from a tag group in the `thought` category.
11. Every `emotion` record must have at least one valid tag from a tag group in the `emotion` category.
12. Every `behaviour` record must have at least one valid tag from a tag group in the `behaviour` category.
13. Every `body` record must have at least one valid tag from a tag group in the `body` category.
14. Every `modifier` record must have at least one valid tag from a tag group in the `modifier` category.
15. Every stored artifact must have at least one valid tag from a tag group in the `artifact` category.
16. Record creation must fail unless the required tags can be attached in the same operation.
17. A target entity may not receive the same `tag_type_id` more than once in `v0.0.1`.
18. Every row in `modifiers` must correspond to a parent `records` row whose `process_type` is `modifier`.
19. Every row in `artifacts` belongs to artifact space, not record space.
20. Every artifact must have `artifact_type = object` or `artifact_type = encounter`.
21. Every user must have exactly one primitive `self` artifact.
22. Every reference type belongs to exactly one reference group.
23. Every reference group belongs to exactly one reference group category.
24. Every directed reference type must define an inverse reference type.
25. Reference instances are always binary, never n-ary.

# Database functions

The goal of the first implementation is to provide a solid storage layer with well-defined write, read, and query functions.

## Write functions

The database layer should support functions for:

- creating users
- creating the primitive `self` artifact for each user
- creating records
- creating modifier extension rows
- creating stored artifacts
- creating tag group categories only through migrations/system setup
- creating tag groups, tag types, and tags
- creating reference group categories only through migrations/system setup
- creating reference groups, reference types, and authored references
- materializing implied references
- writing modifiers without mutating prior records

## Read functions

The database layer should support functions for:

- fetching a record by `id`
- fetching a record together with its tags
- fetching an artifact by `artifact_id`
- fetching an artifact together with its tags
- fetching a modifier together with its target record
- fetching all tags attached to an entity
- fetching all references attached to an artifact-space node
- fetching the primitive `self` artifact for a user
- generating the pseudo-artifact for a given record

## Query functions

The database layer should support more sophisticated queries such as:

- all records for a user filtered by `process_type`
- all records with tags from a given category, group, or type
- all artifacts with tags from a given category, group, or type
- all references touching a given artifact or pseudo-artifact
- all encounters associated with a given object artifact
- the chronological log for an object artifact
- all modifiers affecting a given record
- all authored references for an artifact-space node
- all materialized references for an artifact-space node
- all implied references derivable from authored references
- all tags and references in a given time window

## Derived query views

Some useful higher-level queries should be implemented as derived query functions rather than as stored tables.

Examples:

- object artifact timeline
- object artifact encounter log
- object artifact associated-thought log
- current effective state of a record after modifiers
- implied inverse references
- derived artifact wholesomeness
- pseudo-artifact expansion for a record

# Minimal implementation recommendation

For the first build, the practical minimum is:

1. `users`
2. `authentication`
3. `sessions`
4. `records`
5. `modifiers`
6. `artifacts`
7. `tag_group_categories`
8. `tag_groups`
9. `tag_types`
10. `tags`
11. `reference_group_categories`
12. `reference_groups`
13. `reference_types`
14. `references`

This is the intended shape of the storage layer:

- `records` store process records
- `artifacts` store graph nodes
- pseudo-artifacts give records a graph representation without making records themselves graph nodes
- `modifiers` preserve history
- tags carry semantic detail
- references connect artifact-space nodes
- `self` provides a stable personal anchor

# Open questions for iteration

The first things to review and tighten are probably:

1. Whether modifiers need any more core fields beyond `target_record_id`, `effective_at`, and `metadata_json`.
2. How strict the initial category-level and group-level tag-schema enforcement should be.
3. How much artifact identity should live in `artifacts` fields versus artifact tags.
4. What initial reference group categories should be pre-made.
5. Which directed reference types should ship with obvious inverse pairs by default.
6. Whether record-level `wholesomeness` and `confidence` should become nullable for some process types.
