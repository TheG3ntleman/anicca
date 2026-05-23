# Objectives

Version `0.0.1` of Anicca needs a high-level ingestion plan that sits beside the storage-layer plan.

This document defines only:

1. The ingestion philosophy.
2. The major system layers involved in ingestion.
3. The high-level multi-stage pipeline from freeform text to structured database delta.
4. The role of LLMs, retrieval, symbolic logic, and human review in each stage.

This document does not define:

1. Exact LLM prompt schemas.
2. Exact LLM input/output JSON schemas.
3. Exact stage input/output types.
4. Exact retrieval algorithms or scoring formulas.
5. Exact UI designs.
6. Exact database schema additions for ingestion/provenance tables.

# Design goals

The ingestion layer should:

1. Accept fully freeform journal text.
2. Preserve raw text and provenance outside the primary mental-map database.
3. Generate structured suggestions rather than directly writing truth into the graph.
4. Keep the primary dataset minimal and durable.
5. Reuse existing artifacts and relations wherever possible.
6. Make ambiguity explicit rather than pretending certainty.
7. Keep the pipeline decomposed into small, inspectable stages.
8. Support local-first execution in `v0.0.1`.

# Core philosophy

## The primary database is not the journal store

The primary Anicca database is a structured mental map.

It should contain:

- accepted artifacts
- accepted records
- accepted tags
- accepted references

It should not contain raw journal entries as first-class source objects in `v0.0.1`.

Instead, journal entries should live in a separate ingestion/provenance layer.

## The journal entry is source material, not truth

A freeform journal entry is the authored source text from which the system proposes structured meaning.

The system should:

1. read the freeform text
2. build a structured draft
3. reconcile that draft against the existing mental map
4. ask for user verification where needed
5. commit only the accepted structured delta

## Minimal dataset principle

The primary database should receive the smallest durable structured update that preserves future usefulness.

This means the system should prefer:

- linking over creating duplicates
- merging paraphrases over storing repeated variants
- stable entities over transient phrasing
- important revisions over noisy restatements
- durable graph nodes over stylistic detail

This also means that some meaningful detail may remain only in the ingestion/provenance layer rather than entering the primary database.

## Text-first, then database-aware

The initial semantic understanding of a journal entry should be text-immanent.

The first semantic draft should only contain things present in, or directly supported by, the journal text itself.

Database context should influence the pipeline only after the initial text-only draft has been built.

This prevents the system from prematurely bending the meaning of the new entry around existing database state.

# High-level architecture

The ingestion system should operate across two separate data planes.

## 1. Primary mental-map database

This is the structured store defined in the storage-layer plan.

It contains:

- `artifacts`
- `records`
- `tags`
- `references`

It should remain relatively small, interpretable, and durable.

## 2. Ingestion and provenance store

This is a separate layer used for journal processing.

It should eventually hold things such as:

- raw journal entries
- stable source offsets and segmentation data
- intermediate extraction results
- placeholder semantic nodes
- candidate resolutions
- user review decisions
- links from journal spans to committed database objects

This layer preserves traceability without polluting the primary mental-map database.

# Pipeline summary

The overall pipeline should be:

1. stage the raw journal entry
2. segment the text deterministically
3. extract significant spans
4. build a verbose text-only semantic draft
5. retrieve candidate resolutions from the existing database
6. score and filter candidate resolutions
7. ask the user to resolve ambiguity where needed
8. rewrite the draft into a resolved semantic draft
9. augment the resolved draft with relevant database context
10. detect ontology gaps
11. materialize a verbose candidate delta
12. reduce it to a minimal commit delta
13. ask the user for final review
14. commit the approved delta transactionally
15. finalize provenance links

The main pattern is:

`freeform text -> text-only semantic draft -> resolved semantic draft -> database-aware candidate delta -> minimal approved commit delta`

# Pipeline stages

## 1. `stage_entry`

Goal:

- create a stable ingestion object for the new journal entry

Inputs:

- raw journal text
- authored timestamp
- optional occurred timestamp or inferred entry date

Outputs:

- staged journal entry in the ingestion/provenance layer

Uses:

- deterministic code only

Notes:

- nothing is written to the primary mental-map database here

## 2. `segment_text`

Goal:

- compute stable structural boundaries for later processing

Outputs may include:

- paragraph boundaries
- sentence boundaries
- clause boundaries
- character offsets
- normalized text variants

Uses:

- deterministic code only

Notes:

- later stages should reference source spans through stable offsets from this stage

## 3. `extract_significant_spans`

Goal:

- identify candidate spans that are worth structuring

Examples:

- possible thoughts
- possible emotions
- possible behaviours
- possible body states
- possible entity mentions
- possible encounter mentions
- possible relation assertions
- possible revision or contradiction signals

Uses:

- atomic LLM call

Notes:

- this stage should optimize for high recall
- it should not yet resolve items against the database

## 4. `build_verbose_text_only_semantic_draft`

Goal:

- build a semantic draft assuming the journal text is the whole world

The draft should contain only:

- placeholder artifacts present in the text
- placeholder encounters present in the text
- candidate records directly supported by the text
- candidate relations directly supported by the text
- links back to supporting spans

Uses:

- atomic LLM call

Notes:

- no database IDs should appear here
- no outside context should be introduced here
- this is intentionally verbose

## 5. `retrieve_resolution_candidates`

Goal:

- gather possible matches from the existing database for placeholder items in the draft

Possible mechanisms:

- exact alias matching
- fuzzy string matching
- full-text search
- embeddings
- graph-neighborhood retrieval

Uses:

- retrieval
- symbolic logic

Notes:

- this stage gathers candidates only
- it should not silently decide difficult identity questions by itself

## 6. `score_resolution_candidates`

Goal:

- rank and filter retrieved candidates

Possible signals:

- lexical similarity
- semantic similarity
- artifact/tag compatibility
- relation compatibility
- graph context
- recency
- prior co-occurrence

Uses:

- deterministic scoring
- symbolic logic
- optional lightweight model assistance later if needed

Notes:

- this stage should produce explicit confidence and ambiguity, not hidden heuristics

## 7. `resolve_ambiguities`

Goal:

- ask the user to resolve cases where identity or linkage is unclear

Typical cases:

- multiple plausible artifacts with the same name
- uncertain create-vs-link decisions
- possible duplicate or revision links
- unresolved relation targets

Uses:

- human in the loop verification

Notes:

- unresolved items may remain unresolved without blocking the entire entry
- the system should prefer deferral over false certainty

## 8. `rewrite_resolved_semantic_draft`

Goal:

- revise the text-only draft using the resolution decisions

Outputs:

- a resolved draft in which some placeholders are replaced by concrete database identities
- unresolved placeholders remain explicit

Uses:

- deterministic rewriting
- optionally a very small atomic LLM call if needed

Notes:

- this stage should preserve the text-grounded meaning of the original draft

## 9. `augment_with_database_context`

Goal:

- propose additional structured consequences that depend on the existing mental map

Examples:

- a new thought may revise an older thought
- a new record may link to an existing encounter
- a resolved artifact may remove the need to create a new artifact
- a new assertion may conflict with a currently active relation

Uses:

- retrieval over the relevant database neighborhood
- symbolic logic
- atomic LLM call

Notes:

- this stage may add database-aware suggestions
- it should not invent unsupported primary facts

## 10. `detect_ontology_gaps`

Goal:

- identify missing vocabulary needed to express the candidate delta

Possible outputs:

- missing `tag_types`
- missing `tag_groups`
- missing `reference_types`
- missing `reference_groups`

Uses:

- deterministic comparison against existing ontology
- atomic LLM call for gap suggestions

Notes:

- this stage should be conservative
- ontology growth should be slower than record growth

## 11. `materialize_verbose_candidate_delta`

Goal:

- convert the resolved and augmented draft into an explicit candidate database patch

This patch may include:

- create artifact operations
- create record-backed artifact operations
- create record operations
- attach tag operations
- create reference operations
- create ontology-item operations if approved

Uses:

- atomic LLM call
- deterministic validators

Notes:

- this stage is still intentionally verbose
- it should preserve candidate detail before pruning

## 12. `reduce_to_minimal_commit_delta`

Goal:

- compress the verbose candidate delta into the smallest durable structured update

Reduction actions may include:

- merging paraphrases
- dropping redundant fragments
- preferring links to existing artifacts over new artifacts
- declining low-value ontology growth
- collapsing overlapping suggestions

Uses:

- atomic LLM call
- deterministic deduplication and validation

Notes:

- this stage operationalizes the minimal dataset principle

## 13. `review_commit_delta`

Goal:

- let the user review the final proposed patch before it enters the mental map

The user should be able to:

- accept
- reject
- relink
- merge
- rename
- mark uncertain
- decline ontology additions

Uses:

- human in the loop verification

Notes:

- the user should review a structured patch, not raw LLM prose
- the primary user-facing surface should usually be reflective synthesis first and structured finalization second
- the structured delta should remain accessible, but it should sit behind or beside a more meaningful interpretation layer

## 14. `commit_delta`

Goal:

- write the approved structured changes into the primary mental-map database

Uses:

- deterministic transactional database writes

Notes:

- this stage should enforce all storage-layer invariants
- partial commits should be avoided where possible

## 15. `finalize_provenance`

Goal:

- preserve traceability from journal text to committed structured data

Examples:

- link committed records to source spans
- link committed artifacts to mention spans
- store review outcomes and rejection decisions

Uses:

- deterministic code only

Notes:

- this stage keeps the ingestion system inspectable and debuggable over time

# Final review presentation

The final review experience should not feel like database administration.

Even though the backend is preparing a commit delta, the user-facing surface should usually present the final stage as a reflective synthesis of the journal entry and its relation to the current mental map.

This means the final review should usually have two layers.

## 1. Reflective synthesis layer

This is the primary surface the user sees first.

It may include things such as:

- themes that seem active in the entry
- important emotions or tensions
- recurring beliefs or fears
- possible links to earlier patterns
- contradictions or revisions worth noticing
- gentle commentary about what may be changing in the user's mental map

This layer should:

- feel meaningful and psychologically relevant
- be careful, tentative, and non-authoritarian
- make the user feel understood rather than processed

It should not:

- claim certainty where the system only has a suggestion
- present itself as diagnosis
- imply that the system knows the user's psyche better than the user does

## 2. Structured finalization layer

This is the layer where the user can inspect and edit the actual candidate delta.

It should include:

- proposed artifacts
- proposed records
- proposed references
- proposed ontology additions
- ambiguity and uncertainty markers

This layer is still necessary, but it should feel like refinement and control rather than the whole product experience.

## Tone requirement

The language used in reflective synthesis should be careful and humble.

Good framing includes:

- `this entry may suggest`
- `one pattern that seems present is`
- `this may connect to`
- `you may be holding both of these views at once`
- `this could be worth revisiting`

The system should avoid stronger framing such as:

- `this is what your psyche really means`
- `the true cause is`
- `you are actually feeling`
- `your mind is telling you`

## Design consequence

This means the ingestion pipeline should eventually support not only:

- semantic drafting
- resolution
- candidate delta generation
- commit review

but also:

- a reflective synthesis output suitable for user presentation

That reflective synthesis should be derived from the same structured understanding that powers the final delta, but it should remain a presentation layer rather than a source of truth in the primary database.

# Roles of each mechanism

## LLMs

LLMs should be used for:

- span extraction
- text-only semantic drafting
- database-context augmentation
- ontology-gap suggestion
- verbose candidate delta materialization
- minimality reduction

LLM calls should be:

- atomic
- schema-bound where possible
- small in scope
- individually inspectable

## Retrieval and symbolic logic

Retrieval and symbolic mechanisms should be used for:

- candidate resolution
- deduplication support
- graph-neighborhood gathering
- ontology lookup
- validation support
- ranking and filtering candidates

They should not be replaced by one monolithic generative prompt.

## Human verification

Human verification should appear in at least two places:

1. during ambiguous resolution
2. during final commit review

This is especially important when:

- multiple existing artifacts are plausible
- a create-vs-link choice is unclear
- a suggested revision or contradiction is uncertain
- ontology growth is being proposed

# Local-first execution

For `v0.0.1`, the ingestion plan should assume a local-first setup.

This means:

- the pipeline may be slow enough to run asynchronously
- progress should be visible stage by stage
- each stage should be resumable where possible
- intermediate results should be persisted in the ingestion/provenance layer

The user experience should therefore support:

- long-running background execution
- progress reporting
- later review of the resulting delta

# Open design constraints

The following constraints should guide later detailed specs:

1. The initial semantic draft must remain text-immanent.
2. Database context must only enter after the text-only draft exists.
3. The primary database should receive the minimal durable delta, not a transcript.
4. Ambiguity should be surfaced explicitly rather than hidden.
5. The ingestion/provenance layer should preserve enough detail to debug and improve the pipeline later.
6. Each LLM stage should remain small enough to be independently testable.

# Next specification layers

Later documents should define:

1. ingestion/provenance schemas
2. exact stage input/output schemas
3. exact LLM prompt and response schemas
4. exact retrieval and reranking algorithms
5. exact ambiguity-resolution UX
6. exact commit-review UX
7. exact failure and retry behavior
