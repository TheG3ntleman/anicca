# Objectives

Version `0.0.1` of Anicca is scoped narrowly.

This document defines only:

1. The database schema.
2. The database write functions.
3. The database read and query functions.

This document does not define:

1. LLM systems.
2. Ingestion pipelines.
3. Insight generation.
4. UI design.

# Design goals

The storage layer should:

1. Preserve authorship and history.
2. Keep the ontology small and explicit.
3. Make user customization first-class for tags and references.
4. Keep all user data isolated by owner.
5. Support straightforward reads/writes and richer derived queries later.

# Core model

## Artifact-first ontology

Anicca has one primary identity space: `artifact`.

Everything referenceable in the graph is an artifact.

There are two broad kinds of artifacts:

1. Plain artifacts.
2. Record-backed artifacts.

Plain artifacts are things like:

- people
- places
- projects
- relationships-as-objects
- encounter/event anchors

Record-backed artifacts are artifacts that also have a row in the `records` table.

These represent process entries such as:

- thoughts
- emotions
- behaviours
- body states

So:

- all records are artifacts
- not all artifacts are records

This removes the need for pseudo-artifacts entirely.

## Artifact kinds

Every artifact has an `artifact_kind`.

For `v0.0.1`, the core kinds are:

- `object`
- `encounter`
- `record`

Interpretation:

- `object`: a relatively persistent thing
- `encounter`: an event-like anchor
- `record`: the graph identity for a process record

## Records

`records` is a specialized extension table keyed by the same `id` as the parent artifact row.

Records carry:

- `process_type`
- authored/occurred timestamps through the parent artifact row
- source through the parent artifact row
- `raw_text`
- `confidence`
- `wholesomeness`

The process types are:

- `thought`
- `emotion`
- `behaviour`
- `body`

## Neutral artifacts and changing understanding

Artifacts should stay relatively neutral and stable.

If the user's understanding of an artifact changes, that should usually be modeled as a new `thought` record referencing that artifact, rather than by mutating the artifact itself.

Examples:

- artifact: `Rahul`
- thought: `I now think Rahul is emotionally distant`
- later thought: `I may have misread Rahul`

Direct artifact updates should be reserved mainly for clerical changes such as:

- fixing a typo
- improving a neutral description
- merging duplicate artifacts if that is later supported

## Append-only philosophy

Meaning-bearing historical data should be append-only where practical.

That mainly applies to:

- records
- references

It matters less for clerical artifact maintenance.

For example:

- `friend_of(self, Rahul)` is authored once
- later `no_longer_friend_of(self, Rahul)` is authored as a new reference

The later reference changes the current interpretation of the relation without deleting the earlier one.

# Schema

## Users and auth

### `users`

Represents the owner of all user-owned data.

Fields:

- `id`
- `username`
- `display_name`
- `created_at`

### `authentication`

Stores credentials separately from the user profile.

Fields:

- `id`
- `user_id`
- `authentication_type`
- `password_hash`
- `created_at`

Notes:

- Store only `password_hash`, never the raw password.

### `sessions`

Stores active or recent authenticated sessions.

Fields:

- `id`
- `user_id`
- `session_token_hash`
- `expires_at`
- `created_at`

Notes:

- Store only `session_token_hash`, never the raw session token.

## Artifacts

### `artifacts`

The universal artifact table and the universal graph-node identity space.

Fields:

- `id`
- `user_id`
- `artifact_kind`
- `name`
- `description`
- `authored_at`
- `occurred_at`
- `source`
- `is_locked`
- `created_at`

Suggested enums:

- `artifact_kind`
  - `object`
  - `encounter`
  - `record`
- `source`
  - `human_entry`
  - `import`
  - `migration`
  - `function`

Notes:

- `name` and `description` may be null for some record-backed artifacts.
- `description` is the main artifact-level free-form text field.
- Plain artifact classification such as `person`, `place`, `project`, `meeting`, or `exam` should be expressed through artifact tags, not fixed columns.
- Artifact wholesomeness and artifact confidence are not mandatory core fields. They may be computed later from associated records and references.
- Every user should have one primitive `self` artifact created automatically.
- The primitive `self` artifact must be non-deletable.
- The primitive `self` artifact does not need initial tags at bootstrap time.

## Records

### `records`

Specialized extension rows for artifacts whose `artifact_kind = record`.

Fields:

- `id`
- `process_type`
- `raw_text`
- `confidence`
- `wholesomeness`

Suggested enums:

- `process_type`
  - `thought`
  - `emotion`
  - `behaviour`
  - `body`
- `wholesomeness`
  - `wholesome`
  - `unwholesome`
  - `mixed`
  - `unknown`
  - `not_applicable`

Notes:

- `id` is the same identifier as the parent row in `artifacts`.
- `authored_at`, `occurred_at`, and `source` live on the parent artifact row.
- `raw_text` is the main record-level free-form text field.
- `confidence` is mandatory for all records.
- `wholesomeness` is mandatory for all records.
- Behaviours are modeled as point-in-time records in `v0.0.1`.

## Tags

Tags attach to artifacts only.

Since all records are also artifacts, there is no separate tag-attachment path for records.

The tag system has two layers:

1. `tag_types`
2. `tags`

### `tag_types`

Reusable tag definitions owned by a user.

Fields:

- `id`
- `user_id`
- `name`
- `description`
- `category`
- `value_schema_json`
- `created_at`

Suggested categories:

- `thought`
- `emotion`
- `behaviour`
- `body`
- `artifact`
- `generic`

Rules:

- Every tag type belongs to exactly one user.
- `name` should be unique per user.
- `category` is required.

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
- Tag payloads may include custom string fields, including free-form text where useful.
- `v0.0.1` intentionally drops the older `tag_group_categories` and `tag_groups` layers in favor of a flatter design.
- A future version may reintroduce those layers if users need:
  - large tag vocabularies that benefit from grouping
  - shared validation rules across related tag types
  - cleaner ontology management in the UI
- If those layers return later, the current `tag_types.category` field is the natural seed from which a group/category hierarchy can be reconstructed or migrated.

### `tags`

Actual tag instances attached to artifacts.

Fields:

- `id`
- `user_id`
- `artifact_id`
- `tag_type_id`
- `value_json`
- `authored_at`

Rules:

- A given artifact may not receive the same `tag_type_id` more than once in `v0.0.1`.
- `value_json` must validate against the corresponding `tag_types.value_schema_json`.

## Tag category requirements

These are the baseline category-level rules for `v0.0.1`.

### `thought`

- A thought record must have at least one tag whose `tag_type.category = thought`.
- Thought identity should usually come from the tag type name or an optional `thought_name` field.
- No universal mandatory payload fields are required yet.

### `emotion`

- An emotion record must have at least one tag whose `tag_type.category = emotion`.
- Every emotion tag type must support:
  - `intensity: number`
  - `confidence: number`
- Emotional identity should usually come from the tag type name or an optional `emotion_name` field.

### `behaviour`

- A behaviour record must have at least one tag whose `tag_type.category = behaviour`.
- Behaviour identity should usually come from the tag type name or an optional `behaviour_name` field.
- No universal mandatory payload fields are required yet.
- If a behaviour tag is uncertain or inferred, it should include `confidence: number`.

### `body`

- A body record must have at least one tag whose `tag_type.category = body`.
- Body-state identity should usually come from the tag type name or an optional `body_name` field.
- No universal mandatory payload fields are required yet.
- If a body tag is uncertain or inferred, it should include `confidence: number`.

### `artifact`

- A plain artifact should have at least one tag whose `tag_type.category = artifact`.
- Artifact identity or role should usually be expressed through tags such as `person`, `place`, `project`, `relationship`, `meeting`, `exam`, or `conversation`.
- No universal mandatory payload fields are required yet.
- The automatically created `self` artifact is the one bootstrap exception to the initial tag requirement.

## References

References connect artifacts only.

The reference system has two layers:

1. `reference_types`
2. `references`

### `reference_types`

Reusable reference definitions owned by a user.

Fields:

- `id`
- `user_id`
- `name`
- `description`
- `category`
- `directionality`
- `inverse_reference_type_id`
- `terminates_reference_type_id`
- `value_schema_json`
- `created_at`

Suggested categories:

- `relational`
- `causal`
- `temporal`
- `identity`
- `family`
- `generic`

Rules:

- Every reference type belongs to exactly one user.
- `name` should be unique per user.
- `category` is required.
- `directionality` must be either `directed` or `undirected`.
- If `directionality = directed`, `inverse_reference_type_id` is required.
- If `directionality = undirected`, `inverse_reference_type_id` should be null.
- `terminates_reference_type_id` is optional and may be linked later.

Interpretation:

- `inverse_reference_type_id` captures direction reversal:
  - `mother_of` -> `child_of`
- `terminates_reference_type_id` captures append-only lifecycle ending:
  - `no_longer_friend_of` -> `friend_of`

Future-version note:

- `v0.0.1` intentionally drops the older `reference_group_categories` and `reference_groups` layers in favor of a flatter design.
- A future version may reintroduce those layers if users need:
  - large relation vocabularies that benefit from grouping
  - shared validation or UI behavior across related reference types
  - more curated ontology browsing and editing
- If those layers return later, the current `reference_types.category` field is the natural seed from which a group/category hierarchy can be reconstructed or migrated.

### `references`

Actual reference instances between artifacts.

Fields:

- `id`
- `user_id`
- `from_artifact_id`
- `to_artifact_id`
- `reference_type_id`
- `reference_origin`
- `counterpart_reference_id`
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

- References are always binary.
- References connect artifacts only.
- Higher-arity relations should be modeled by introducing an artifact, usually an encounter artifact, and connecting ordinary binary references to it.

Materialization rules:

- User-authored references are the primary source data.
- Materialized references are generated from authored references and type-level rules.
- For directed reference types, the inverse type defines the materialized reverse edge.
- If a materialized inverse row exists, the authored reference and the materialized reference should point to each other through `counterpart_reference_id`.
- For undirected reference types, one authored edge is sufficient; query functions should treat it as traversable from either side even if no second row is materialized.
- Reverse lookup should always be available through queries and indexes, even when no reverse row is user-authored.

Append-only lifecycle rules:

- A relation does not normally end by mutating the original reference row.
- Instead, the user may later author a new reference whose `reference_type` has `terminates_reference_type_id` pointing to the earlier positive type.
- Current relation state is derived from the ordered history of authored references.

Examples:

- `mother_of(mother, self)` can materialize `child_of(self, mother)`.
- `friend_of(self, Rahul)` can later be ended by `no_longer_friend_of(self, Rahul)`.

## Free-form text

Free-form text should live in only a few deliberate places:

- `records.raw_text` for record-level process text
- `artifacts.description` for artifact-level neutral description
- custom string fields inside `tags.value_json` where the tag schema calls for it
- custom string fields inside `references.metadata_json` where the reference schema calls for it

There is no separate `raw_entries` table in `v0.0.1`.

# Invariants

The following must hold:

1. Every user-owned row belongs to exactly one user.
2. Joined user-owned rows must share the same `user_id`.
3. No cross-user read, write, tag, or reference operation is allowed.
4. Every record row must have a parent artifact row with the same `id`.
5. Every record parent artifact must have `artifact_kind = record`.
6. Plain artifacts do not need a record row.
7. Every record must have `process_type = thought | emotion | behaviour | body`.
8. Every record must have non-null `confidence`.
9. Every record must have non-null `wholesomeness`.
10. Records should not be hard-deleted in normal operation.
11. Every thought record must have at least one valid tag whose `tag_type.category = thought`.
12. Every emotion record must have at least one valid tag whose `tag_type.category = emotion`.
13. Every behaviour record must have at least one valid tag whose `tag_type.category = behaviour`.
14. Every body record must have at least one valid tag whose `tag_type.category = body`.
15. Every plain stored artifact should have at least one valid tag whose `tag_type.category = artifact`, except the bootstrap `self` artifact.
16. Record creation must fail unless the required tags can be attached in the same transaction.
17. A given artifact may not receive the same `tag_type_id` more than once in `v0.0.1`.
18. Every directed reference type must define an inverse reference type.
19. Reference instances are always binary.
20. References always target artifacts, never records directly.
21. Every user must have exactly one primitive `self` artifact.
22. The primitive `self` artifact must be non-deletable.
23. A tag may only attach an artifact and a tag type owned by the same user.
24. A reference may only connect artifacts owned by the same user and use a reference type owned by the same user.

# Database functions

## Write functions

The database layer should support:

- creating users
- creating authentication rows
- creating sessions
- creating the primitive `self` artifact for each user
- creating plain artifacts
- creating record-backed artifacts
- creating record extension rows
- creating a record-backed artifact and its record row in one transaction
- updating artifact `name` and `description` for clerical maintenance
- creating tag types
- attaching tags to artifacts
- creating reference types
- linking a termination reference type to an existing positive reference type later
- creating authored references
- materializing inverse references
- deleting or updating a reference type and synchronizing its materialized counterparts

## Read functions

The database layer should support:

- fetching an artifact by `id`
- fetching an artifact with its tags
- fetching a record by `id`
- fetching a record with its parent artifact row
- fetching a record-backed artifact with its record row
- fetching all tags attached to an artifact
- fetching all outgoing references from an artifact
- fetching all incoming references to an artifact
- fetching all references attached to an artifact regardless of direction
- fetching the primitive `self` artifact for a user

## Query functions

The database layer should support:

- all records for a user filtered by `process_type`
- all artifacts for a user filtered by `artifact_kind`
- all artifacts with tags from a given category or type
- all records with tags from a given category or type
- all references touching a given artifact
- all current active references of a given category or type
- all authored references of a given category or type
- all materialized references of a given category or type
- all references that terminate a given positive reference
- all encounters associated with a given object artifact
- the chronological log for an object artifact
- all thoughts about a given artifact
- all emotions associated with a given artifact
- all behaviours associated with a given artifact
- all body records associated with a given artifact
- all tags and references in a given time window

## Derived query views

Useful derived query views include:

- object artifact timeline
- encounter log for an object artifact
- associated-thought log for an artifact
- current effective relation state between two artifacts
- inverse-reference expansion
- derived artifact wholesomeness
- derived artifact confidence

# User functions

This section translates likely user actions into concrete system operations.

## 1. New user bootstraps the system

User intent:

- create an account
- start with a stable notion of self

System steps:

1. Insert a row into `users`.
2. Insert a row into `authentication`.
3. Optionally insert an initial row into `sessions`.
4. Insert a primitive `self` row into `artifacts` with:
   - `artifact_kind = object`
   - `is_locked = true`
   - a neutral `name` like `self`
5. Do not require initial tags on `self` at bootstrap time.

## 2. User defines the tag vocabulary needed before recording data

User intent:

- prepare the system so records can be created validly

System steps:

1. User creates one or more `tag_types`, such as:
   - `belief` with `category = thought`
   - `anxiety` with `category = emotion`
   - `walking` with `category = behaviour`
2. The system validates each `tag_type.value_schema_json`.
3. Record creation remains blocked until at least one valid tag can be attached in the same transaction.

## 3. User creates a plain object artifact such as Rahul

User intent:

- introduce a stable person/object into the graph

System steps:

1. Insert an `artifacts` row with:
   - `artifact_kind = object`
   - `name = Rahul`
   - optional neutral `description`
2. Attach at least one artifact-category tag, such as `person`.

Notes:

- The artifact should stay relatively neutral.
- Interpretive change should be stored later through thought records, not by constantly rewriting the artifact.

## 4. User creates an encounter artifact

User intent:

- represent a specific event or situation

System steps:

1. Insert an `artifacts` row with:
   - `artifact_kind = encounter`
   - a neutral name or description
   - `occurred_at`
2. Attach at least one artifact-category tag, such as `meeting`, `argument`, or `exam`.
3. Create ordinary references from the encounter to the involved artifacts as needed.

## 5. User records a thought, emotion, behaviour, or body state

User intent:

- store a process entry and make it referenceable in the graph

System steps:

1. Insert a parent row into `artifacts` with:
   - `artifact_kind = record`
   - optional `name`
   - optional `description`
   - timestamps/source
2. Insert a child row into `records` with the same `id`, including:
   - `process_type`
   - `raw_text`
   - `confidence`
   - `wholesomeness`
3. Attach at least one valid tag from the category matching the `process_type`.
4. Optionally create references from this record-backed artifact to other artifacts.

Examples:

- a thought about Rahul
- anxiety after a meeting
- a behaviour of avoiding a call
- a body state of chest tightness

## 6. User changes their understanding of an artifact

User intent:

- express a new interpretation of a person, place, project, or encounter

System steps:

1. Create a new `thought` record-backed artifact.
2. Attach the appropriate thought tag(s).
3. Create a reference from that thought artifact to the target artifact.

Example:

1. Plain artifact: `Rahul`
2. Thought record: `I now think Rahul is unreliable`
3. Reference from the thought artifact to the Rahul artifact

Why this is preferred:

- the artifact stays stable
- the interpretation changes over time
- conflicting or revised understandings can coexist historically

## 7. User says "Rahul is a friend"

User intent:

- express a relationship between `self` and Rahul

System steps:

1. Ensure the Rahul artifact exists.
2. Ensure the user has a `friend_of` reference type.
3. Create an authored `references` row:
   - `from_artifact_id = self`
   - `to_artifact_id = Rahul`
   - `reference_type_id = friend_of`
   - `reference_origin = authored`
4. If `friend_of` is undirected, query functions should treat it as traversable from both sides.
5. If `friend_of` is modeled as directed with an inverse, the inverse may be materialized automatically.

## 8. User later says "Rahul is no longer a friend"

User intent:

- end a previously asserted relationship without deleting history

System steps:

1. Ensure a terminating reference type exists, such as `no_longer_friend_of`.
2. Link its `terminates_reference_type_id` to `friend_of`.
3. Create a new authored `references` row:
   - `from_artifact_id = self`
   - `to_artifact_id = Rahul`
   - `reference_type_id = no_longer_friend_of`
4. Query logic derives that the earlier `friend_of(self, Rahul)` relation is no longer current after this point.

Notes:

- The original friendship reference remains stored.
- The ending is represented append-only, not by overwriting or deleting the original row.

## 9. User defines a directed relation with an implied reverse relation

User intent:

- model family or causal structure cleanly

System steps:

1. User creates `mother_of`.
2. User also creates `child_of`.
3. The system links:
   - `mother_of.inverse_reference_type_id = child_of`
4. User authors:
   - `mother_of(mother, self)`
5. The system may materialize:
   - `child_of(self, mother)`
6. If materialized, each row links to its counterpart through `counterpart_reference_id`.

## 10. User wants to talk about a past behaviour no longer being true

User intent:

- express that a past behaviour has stopped

Preferred `v0.0.1` pattern:

1. Keep the earlier behaviour record unchanged.
2. Create a new `thought` record such as:
   - `I no longer do this`
3. Reference the earlier behaviour's artifact identity from the new thought.
4. Optionally validate this further through later absence of similar behaviour records in queries.

This is preferred over a special modifier mechanism in `v0.0.1`.

## 11. User wants an artifact timeline

User intent:

- see how a person, project, or relationship has evolved in experience

System steps:

1. Fetch the target artifact.
2. Fetch encounters connected to it.
3. Fetch thought record-backed artifacts that reference it.
4. Fetch relevant emotion, behaviour, and body records that reference it.
5. Fetch authored and materialized references touching it.
6. Order the results by `occurred_at`, then `authored_at`.

## 12. User wants the current state of a relation

User intent:

- know whether a relation currently holds

System steps:

1. Gather all authored references between the relevant endpoints and relation family.
2. Order them by time.
3. Apply inverse and termination rules from `reference_types`.
4. Optionally incorporate materialized inverse rows for convenience.
5. Return the current effective state plus the supporting history.

# Current exclusions

These are intentionally not modeled directly in `v0.0.1`:

- LLM ingestion
- general parser pipelines
- a separate modifier subsystem
- pseudo-artifacts
- n-ary references
- references targeting references as first-class endpoints

If later needed, the most likely expansion points are:

- richer artifact maintenance workflows
- relation-to-relation commentary
- more advanced materialization rules
- deduplication and merge policies
