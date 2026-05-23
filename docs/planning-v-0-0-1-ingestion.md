# Objectives

This document is the working specification scaffold for the `v0.0.1` ingestion pipeline.

Its purpose is to make the ingestion pipeline concrete enough to design and implement stage by stage.

This document should define:

1. the high-level input and output of the ingestion pipeline as a whole
2. the ordered phases of the pipeline
3. the objective of each phase
4. the high-level input and output of each phase
5. the procedure each phase uses to convert its input into its output

This document is intended to be filled in iteratively.

# Scope

This document is about the ingestion pipeline from a persisted journal entry to a committed structured delta plus provenance.

This document is not yet about:

1. final UI design
2. exact prompt text
3. exact model selection
4. implementation details of the job runner

# Pipeline boundary

The formal pipeline begins only after the raw journal entry has already been accepted and persisted.

This means `stage_entry` is treated here as a pipeline precondition rather than as a numbered pipeline phase.

## Precondition: entry intake and persistence

Before phase 1 begins, the system must already have:

1. persisted the raw journal entry
2. assigned stable IDs
3. stored authored and occurred timestamps if available
4. created an ingestion run record

This precondition is still required system behavior, even though it is not treated here as one of the semantic processing phases.

# Whole-pipeline input

```txt
journal_entry: str
```

Notes:

- This is intentionally simplified for planning purposes.
- Later phases may read from the existing mental-map database, but the primary authored input is the journal entry text.

# Whole-pipeline output

```txt
finalized_delta: TBD
```

Notes:

- The output we care about in this planning document is the finalized delta.
- This is not the same thing as job status, commit success metadata, or orchestration state.
- The exact structure of the finalized delta is still to be defined.

# Ordered pipeline phases

1. `identify_text_objects`
2. `extract_candidate_references`
3. `cull_and_consolidate_unresolved_candidates`
4. `extract_retrieval_information`
5. `retrieve_resolution_candidates`
6. `score_resolution_candidates`
7. `resolve_ambiguities`
8. `rewrite_resolved_semantic_draft`
9. `augment_with_database_context`
10. `detect_ontology_gaps`
11. `materialize_verbose_candidate_delta`
12. `reduce_to_minimal_commit_delta`
13. `review_commit_delta`
14. `commit_delta`
15. `finalize_provenance`

Note:

- these numbered phases are the minimal semantic anchor points
- the actual runtime may implement a richer super pipeline that contains these phases within it
- any additional substeps must preserve the anchor-point contracts

# Phase template

Each phase should eventually define:

1. objective
2. inputs
3. outputs
4. procedure
5. validation rules
6. persistence rules
7. failure and retry behavior

# Phase 1: `identify_text_objects`

## Objective

Identify the spans in the journal entry that are likely worth structuring, favoring recall over precision.

## Inputs

- journal_entry: text

## Outputs

- json list of relevant text_objects
- all extracted items remain in `intermediate format-1`
- each extracted candidate should receive a stable local `candidate_id`

## Procedure

We write an LLM prompt, we ask it to do the following:
1. Identify, all records in the entry
2. Identify, all artifacts in the entry

The schema, for these here does not need to be so strict, at this stage, we just need to store the source text (from which it was derived), the type of record (if it is a record), and the type of artifact (if it is an artifact). We will get exact schemas in a later stage. These all have a common scheme at this stage and are called text_objects.

We must ask the LLM to be 
  1. exhuastive and verbose
  2. not introduce its own judgement anywhere

This is the prompt:

You will be given a journal entry.

Your task is to extract candidate records and candidate artifacts directly supported by the text.

Definitions:
- A candidate record is a process-like item of the journal author.
- A candidate artifact is something that may deserve its own identity later.

Allowed process_type values:
- thought
- emotion
- behaviour
- body

Do not invent any other process types.

Process typing rules:
- thought:
  beliefs, appraisals, judgments, self-talk, desire, uncertainty-statements, rumination, rehearsal, internal deliberation, interpretation
- emotion:
  explicitly felt emotional states such as fear, shame, grief, anger, loneliness, relief, jealousy, tenderness
- behaviour:
  actions, speech acts, outward conduct, and bodily actions such as calling, saying, crying, leaving, opening, searching, rereading, clenching, apologizing, staying
- body:
  directly described bodily states or physical sensations such as pain, hunger, nausea, numbness, burning, tightness, shakiness, tiredness, lack of sleep

Record rules:
1. Extract only the journal author's processes as candidate_records.
2. Do not extract other people's actions, speech, or emotions as candidate_records.
3. Preserve negation exactly. Do not drop words like "not", "never", "no", "didn't", "couldn't".
4. Do not assume a reported claim is true if the surrounding text undermines it.
5. Do not use body as a fallback category for vague internal experience.
6. If a clause contains both a bodily state and a thought, emotion, or behaviour, split them when possible.
7. If a clause contains both a thought and an emotion, split them when possible.
8. Split long mixed clauses only when each extracted part can stand alone clearly.
9. Do not output clipped fragments that cannot stand on their own as meaningful text.
10. Each candidate_record must have exactly one source_text string.

Allowed artifact_kind values:
- object
- encounter
- unknown

Artifact rules:
1. Use artifact_kind = object for identity-worthy non-event things such as people, places, roles, documents, messages, projects, or recurring non-event items.
2. Use artifact_kind = encounter for substantial event-like episodes such as conversations, calls, meetings, dinners, rides, appointments, consultations, scans, procedures, trips, arguments, incidents, or past events.
3. Past events and procedures usually belong in encounter, not object.
4. Exclude low-value incidental objects unless they seem central.
5. Object artifacts must have exactly one source_text string.
6. Encounter artifacts may have one or more source_texts strings.
7. For every substantial event-like episode in the entry, create at least one candidate_artifact with artifact_kind = encounter.
8. If the same encounter is described across multiple clauses or sentences, group those snippets into one encounter artifact using multiple source_texts in source order.
9. Do not rely only on separate behaviour records when a coherent encounter is clearly being described.

General rules:
1. Be exhaustive and high-recall.
2. Use exact contiguous text from the entry.
3. Do not paraphrase.
4. Do not use ellipses.
5. Output items in source order.
6. Overlap is allowed.
7. Do not deduplicate.
8. Do not create references between items.
9. Do not infer hidden meaning, diagnosis, symbolism, or deeper causes.
10. Use the smallest exact span that can stand on its own.
11. Differentiate behavior from thoughts about behavior.
12. Be cautious of metaphorical statements used, they are perhaps not what they seem at a superficial level.

Notes:
- notes are optional
- use notes only to justify classification or ambiguity
- keep notes short, neutral, and factual
- if not needed, use ""

Return JSON in exactly this shape:

{
  "candidate_records": [
    {
      "candidate_id": "",
      "process_type": "",
      "source_text": "",
      "notes": ""
    }
  ],
  "candidate_artifacts": [
    {
      "candidate_id": "",
      "artifact_kind": "object",
      "source_text": "",
      "notes": ""
    },
    {
      "candidate_id": "",
      "artifact_kind": "encounter",
      "source_texts": [""],
      "notes": ""
    }
  ],
  "uncertainties": [
    ""
  ]
}

Return only JSON.


Describe how the system identifies candidate spans such as:

- thoughts
- emotions
- behaviours
- body states
- artifact mentions
- encounter mentions
- contradiction or revision signals

# Phase 2: `extract_candidate_references`

## Objective

Extract candidate references between unresolved phase-1 candidates, while keeping every candidate item in `intermediate format-1` and without introducing database identities, tags, or outside context.

## Inputs

- Takes in original text and previously generated JSON output from phase 1.

## Outputs

- TODO
- updated `intermediate format-1` objects including unresolved candidate-to-candidate references
- each candidate_reference should receive a stable local `candidate_reference_id`

## Procedure

Describe how the system derives candidate references from the phase-1 unresolved candidates.

This phase should:

- add candidate-to-candidate references only when directly supported by the text
- allow flexible relation labels rather than forcing a prematurely narrow ontology
- label interpretation-dependent references as ambiguous rather than silently resolving them
- preserve explicit links back to supporting spans
- avoid adding tags or resolved ontology
- keep every candidate item unresolved

This is the prompt:

You will be given:
1. a journal entry
2. unresolved phase-1 JSON containing candidate_records and candidate_artifacts with stable candidate_id values

Your task is to add candidate references between the existing phase-1 candidates.

This is still an unresolved text-only stage.
Do not resolve identities.
Do not add tags.
Do not introduce outside context.
Do not create any new records or artifacts.

References connect candidates to candidates, not text to text.
You may link any candidate types to any candidate types if the text directly supports that link.

Definitions:
- A candidate reference is a text-supported unresolved link between two existing phase-1 candidates.
- relation_label is fully flexible. It should be the smallest text-near phrase that captures the relation.
- relation_status says whether the candidate pairing and label are directly explicit or still ambiguous.

Allowed relation_status values:
- explicit
- ambiguous

Rules for relation_label:
1. Prefer the smallest text-near phrase that can stand alone.
2. Prefer exact surface wording from the supporting_text when possible.
3. If you use a more abstract or normalized label than the text itself, mark the reference ambiguous unless the normalization is trivial.
4. Preserve negation when the relation itself is negated.
5. Do not invent hidden causal, diagnostic, symbolic, or identity claims.

Rules for candidate links:
1. Only create references between candidates that already exist in the phase-1 JSON.
2. A candidate may emit multiple references when the text directly supports multiple distinct links.
3. References may connect records to artifacts, artifacts to artifacts, or records to records.
4. When a later candidate explicitly points back to an earlier candidate or event-like item, you may link them directly.

Support rules:
1. Every candidate_reference must have exactly one supporting_text string.
2. supporting_text must be an exact contiguous span from the journal entry.
3. supporting_text should be the smallest exact span that still clearly supports the reference.
4. Output references in source order based on the source candidate's first appearance in phase 1.
5. Do not emit exact duplicates.

Carrier and topic rules:
1. If a record acts directly on a carrier object such as a note, message, draft, page, or photo, prefer the carrier object as the direct target.
2. If the carrier explicitly names an embedded topic, that topic may receive a separate artifact-to-artifact reference.

Pronoun and anaphora rules:
1. If a pronoun has exactly one strong local antecedent, you may use that target.
2. If multiple plausible antecedents remain, you may emit one candidate reference per plausible target, but each such reference must be marked ambiguous.
3. For short object pronouns such as it, this, that, or them, prefer the most recent compatible candidate that the surrounding verb naturally selects.
4. If one target is clearly stronger and local, you may use it explicitly.
5. If the competition remains real, keep the references ambiguous rather than pretending certainty.

Scene and memory rules:
1. If a record happens in a current scene and is also about a remembered or replayed scene, keep both links when both are directly supported.
2. Present-scene links and remembered-scene links should not collapse into one another.

Speech rules:
1. A speaking record may link separately to an addressee, a scene, and a content target if the text supports each one.
2. Prefer the speech verb for the addressee and a content-oriented label for the topic or quoted item.

Alternative-proposition rules:
1. If the text presents alternative propositions, references drawn from those propositions may still be emitted.
2. Any proposition-dependent reference that remains unresolved because of those alternatives must be marked ambiguous.
3. Preserve the unresolved state in notes or uncertainties.

Appositive non-resolution rules:
1. If two candidates likely co-refer through apposition or role-label wording, do not merge them.
2. If the text separately supports links involving each candidate, both may remain at this phase.
3. Any link that depends on the unresolved co-reference should be marked ambiguous.

Before returning, check each candidate_reference:
- Does from_candidate_id already exist in phase 1?
- Does to_candidate_id already exist in phase 1?
- Is the supporting_text exact and contiguous?
- Is the relation_label text-near?
- Did I preserve negation?
- Did I avoid silently resolving ambiguity?

Return JSON in exactly this shape:

{
  "candidate_references": [
    {
      "candidate_reference_id": "",
      "from_candidate_id": "",
      "to_candidate_id": "",
      "relation_label": "",
      "relation_status": "explicit",
      "supporting_text": "",
      "notes": ""
    }
  ],
  "uncertainties": [
    ""
  ]
}

Return only JSON.

# Phase 3: `cull_and_consolidate_unresolved_candidates`

## Objective

Conservatively remove obvious noise and consolidate clearly redundant unresolved candidate items before retrieval, while preserving recall wherever the correct interpretation is uncertain.

## Inputs

- journal entry text
- phase-1 unresolved `intermediate format-1` candidate records and candidate artifacts with stable `candidate_id` values
- phase-2 unresolved `intermediate format-1` candidate references with stable `candidate_reference_id` values

## Outputs

- culled and consolidated unresolved `intermediate format-1` candidate items

## Procedure

Describe how the system:

- removes candidates that are clearly invalid or unsupported
- consolidates obvious duplicates or near-duplicates when doing so is clearly safe
- preserves ambiguous alternatives rather than over-pruning
- keeps source-text provenance for every surviving candidate

This is the prompt:

You will be given:
1. a journal entry
2. phase-1 JSON containing unresolved candidate_records and candidate_artifacts with stable candidate_id values
3. phase-2 JSON containing unresolved candidate_references with stable candidate_reference_id values

Your task is to perform conservative pre-resolution culling and consolidation over all candidate items.

This stage has two jobs:
1. genuine removal
2. consolidation

Definitions:
- genuine removal means removing a candidate item that is clearly unsupported, redundant, structurally wrong, or of no likely lasting mental consequence
- hard consolidation means collapsing multiple clearly overlapping candidates into one surviving representative without resolving external identity
- soft grouping means marking candidates as related, alternative, or possibly-the-same while keeping them separate for later resolution

General rules:
1. Be conservative.
2. Do not resolve identity against outside knowledge or the existing database.
3. Do not use outside context.
4. Do not add tags.
5. Preserve provenance.
6. Preserve negation.
7. Preserve real ambiguity.
8. Prefer soft grouping over hard collapse when uncertainty remains.
9. Prefer keeping meaningful mental structure over making the output smaller.

Removal rules:
1. Remove exact duplicates by hard-consolidating them into one survivor.
2. Remove candidates that are clearly unsupported by their cited text.
3. Remove structurally wrong or clearly mistargeted references when a better directly supported surviving reference exists.
4. Remove dominated variants when a more text-faithful surviving candidate expresses the same structure.
5. Low-consequence artifacts may be removed only when they are merely incidental scene furniture, have no higher-value surviving role, and are unlikely to matter for later retrieval or mental interpretation.
6. If removing an item creates orphaned dependent items, remove or consolidate those dependents as well.

Hard consolidation rules:
1. Hard-consolidate only when sameness is clear enough before resolution.
2. Use one surviving representative candidate or candidate_reference.
3. Record all absorbed IDs on the survivor.
4. For same-entry alias variants, hard-consolidation is allowed when the local text makes the sameness explicit and unambiguous.
5. Records may be hard-consolidated only when they are clearly duplicate or dominated variants of the same mental content.
6. Do not hard-consolidate ambiguous alternatives, likely co-referring role labels, or other unresolved competing candidates.
7. If a candidate is hard-consolidated, redirect surviving references to the consolidated representative.

Soft grouping rules:
1. Use soft groups when items are related enough to track together but not safe to collapse.
2. Use `possible_same_unresolved` for likely co-reference that remains unresolved.
3. Use `alternative_set` for explicit competing alternatives that should survive together.
4. Use `close_variant_family` for closely related unresolved variants that should remain separate for now.
5. Soft groups do not absorb or delete their members.

Reference-specific rules:
1. Candidate references may be culled more aggressively than records or artifacts.
2. If two references share the same source, target, and support, prefer the more text-faithful label.
3. Do not consolidate orthogonal links just because they share a source candidate.
4. When a later reference clearly points to a specific earlier candidate, prefer that target over weaker participant guesses.
5. Preserve ambiguous alternatives by soft-grouping them rather than deleting them.

Record-specific rules:
1. Remove records rarely.
2. Keep separate records whenever they preserve distinct mental content, even if closely related.
3. Hard-consolidate records only when one adds no distinct mental consequence beyond another surviving record.

Artifact-specific rules:
1. Remove artifacts cautiously.
2. Hard-consolidate exact or explicit same-entry alias variants when safe.
3. Soft-group likely-same artifacts when sameness is not yet safe enough to collapse.

Before returning, check:
- does every removed item have a reason?
- does every hard-consolidated survivor list absorbed IDs?
- did I preserve real ambiguity?
- did I avoid premature identity resolution?
- did I preserve provenance and negation?

Return JSON in exactly this shape:

{
  "candidate_records": [
    {
      "candidate_id": "",
      "process_type": "",
      "source_text": "",
      "notes": "",
      "absorbed_candidate_ids": [""]
    }
  ],
  "candidate_artifacts": [
    {
      "candidate_id": "",
      "artifact_kind": "object",
      "source_text": "",
      "notes": "",
      "absorbed_candidate_ids": [""]
    },
    {
      "candidate_id": "",
      "artifact_kind": "encounter",
      "source_texts": [""],
      "notes": "",
      "absorbed_candidate_ids": [""]
    }
  ],
  "candidate_references": [
    {
      "candidate_reference_id": "",
      "from_candidate_id": "",
      "to_candidate_id": "",
      "relation_label": "",
      "relation_status": "explicit",
      "supporting_text": "",
      "notes": "",
      "absorbed_candidate_reference_ids": [""]
    }
  ],
  "removed_items": [
    {
      "item_kind": "candidate_record",
      "item_id": "",
      "removal_kind": "",
      "reason": "",
      "replacement_item_id": ""
    }
  ],
  "soft_groups": [
    {
      "group_id": "",
      "group_type": "possible_same_unresolved",
      "member_item_ids": [""],
      "notes": ""
    }
  ],
  "uncertainties": [
    ""
  ]
}

Return only JSON.

# Super pipeline over anchor points

The minimal pipeline now has three anchor points:

1. phase 1 output: unresolved candidate records and candidate artifacts in `intermediate format-1`
2. phase 2 output: unresolved candidate references added to the same candidate graph
3. phase 3 output: pre-resolution culled and consolidated unresolved candidate graph

The actual implementation may use a super pipeline that contains the minimal pipeline within it.

This means:

- the product plan may still speak in terms of phases 1, 2, and 3
- the runtime may atomize each phase into smaller deterministic and LLM-assisted substeps
- every substep must move toward one of the three anchor points
- deterministic repair and augmentation steps are allowed between LLM calls

## Super phase 1: produce anchor point 1

Objective:
Reach the phase 1 anchor point as robustly as possible on local models, even if multiple narrow passes are required.

Recommended substeps:

1. `1.0 prepare_entry_view`
   Build normalized text variants, stable paragraph and sentence boundaries, and offset maps as implementation details rather than as a user-visible phase.
2. `1.1 segment_into_local_work_units`
   Partition the entry into the smallest local units that preserve meaning without forcing invented structure.
   These units may be scenes, paragraphs, sentences, clauses, list items, or reflective blocks depending on the entry.
3. `1.2 classify_work_unit_kind`
   Label each local work unit conservatively as narrative, reflective, mixed, list-like, or fragmentary so later prompts can stay narrow without assuming everything is a scene.
4. `1.3 extract_author_processes_per_unit`
   Run a high-recall record extractor unit by unit so the model only has to classify local author processes in the relevant local context.
5. `1.4 extract_encounters_per_unit`
   Run a narrower encounter extractor only on units whose local structure appears event-like enough to support encounters.
6. `1.5 extract_identity_worthy_objects`
   Run a separate object extractor focused only on people, documents, roles, projects, and recurring non-event items.
7. `1.6 deterministic_gap_probe`
   Scan the text for missed high-signal patterns such as `printed`, `apologized`, `opened`, `stared`, `told`, `read again`, `deleted`, and `restored`.
8. `1.7 repair_and_normalize_candidates`
   Repair spans, drop obviously bad fragments, normalize IDs, normalize notes, and enforce exact-text support.
9. `1.8 conservative_augmentation`
   Add only exact-text-supported missing candidates that the gap probe can justify deterministically.
10. `1.9 anchor_point_1_validation`
   Verify schema, candidate ID uniqueness, source order, uncertainty extraction, and minimum expected recall before persisting anchor point 1.

Optional bounded refinement loop:

- `1.6 -> 1.7 -> 1.8 -> 1.9` may repeat one or two times if new valid candidates are still being found.
- Stop when no new valid candidates appear or when the configured refinement limit is reached.

## Super phase 2: produce anchor point 2

Objective:
Reach the phase 2 anchor point by building a text-supported unresolved candidate-reference layer over anchor point 1.

Recommended substeps:

1. `2.0 inventory_candidate_graph`
   Build fast lookup tables for candidate IDs, canonicalized spans, work-unit membership, and candidate families.
2. `2.1 propose_direct_record_to_artifact_links`
   Ask the model only for direct acted-on, thought-about, or spoken-about links per record.
3. `2.2 propose_artifact_to_artifact_links`
   Separately derive carrier-topic, document-topic, and encounter-participant links where the text directly supports them.
4. `2.3 propose_local_context_and_memory_links`
   Handle replay, recall, current-context, and remembered-context links in a dedicated pass without assuming the unit is a scene.
5. `2.4 pronoun_and_anaphora_pass`
   Run a narrow ambiguity-aware linking pass for `it`, `them`, `she`, `he`, and explicit alternatives.
6. `2.5 deterministic_reference_backfill`
   Add obvious direct links that can be justified from exact source spans without model interpretation.
7. `2.6 reference_validation_and_downgrade`
   Remove invalid links, enforce support-span checks, and downgrade interpretation-heavy links from `explicit` to `ambiguous`.
8. `2.7 anchor_point_2_validation`
   Verify candidate IDs, reference IDs, exact span support, ambiguity preservation, and deduplication before persisting anchor point 2.

Optional bounded refinement loop:

- `2.4 -> 2.5 -> 2.6 -> 2.7` may repeat one or two times when additional valid references are found.
- Stop when the candidate-reference graph reaches a fixed point or the refinement limit is reached.

## Super phase 3: produce anchor point 3

Objective:
Reach the phase 3 anchor point by conservatively pruning obvious noise and consolidating only what is clearly safe before resolution.

Recommended substeps:

1. `3.0 graph_sanity_pass`
   Remove malformed items, orphaned references, missing IDs, and schema drift.
2. `3.1 duplicate_and_family_detection`
   Detect exact duplicates, obvious dominated variants, and candidate families such as short/long mention variants.
3. `3.2 low_value_noise_filter`
   Remove incidental artifacts and invalid references only when their removal is clearly safe.
4. `3.3 hard_consolidation_pass`
   Collapse only exact duplicates and clearly dominated variants, while preserving absorbed-ID provenance.
5. `3.4 soft_group_construction`
   Build unresolved groups such as `possible_same_unresolved`, `alternative_set`, and `close_variant_family`.
6. `3.5 reference_retarget_and_cleanup`
   Redirect surviving references after hard consolidation and remove newly orphaned or dominated references.
7. `3.6 anchor_point_3_validation`
   Verify that every surviving item still has provenance, every removal is justified, and real ambiguity was not pruned away.

Optional bounded refinement loop:

- `3.1 -> 3.2 -> 3.3 -> 3.4 -> 3.5 -> 3.6` may repeat until no further safe removals or consolidations are found.
- This loop should remain conservative and should stop before doing any identity resolution.

## Design principles for the super pipeline

1. Each anchor point is the contract; the super pipeline is an implementation strategy.
2. Deterministic code is allowed anywhere between substeps if it improves exactness and auditability.
3. Small local models should receive narrow, local-unit, and type-local tasks rather than whole-entry omnibus prompts.
4. Every repair or augmentation must remain exact-text-supported.
5. Every iteration should be monotonic, bounded, and auditable.
6. The runtime may skip optional substeps when earlier validation already passes cleanly.

# Phase 4: `extract_retrieval_information`

## Objective

Derive retrieval-ready information from the post-cull unresolved candidate set, without resolving identities or introducing tags.

## Inputs

- culled unresolved `intermediate format-1` candidate items

## Outputs

- unresolved candidates enriched with retrieval information for later database matching

## Procedure

Describe how the system extracts retrieval cues such as:

- aliases
- quoted names
- role labels
- temporal hints
- encounter descriptors
- other lookup strings useful for later retrieval

# Phase 5: `retrieve_resolution_candidates`

## Objective

Gather possible matches from the existing database for the unresolved candidates produced by the earlier text-only stages.

## Inputs

- TODO

## Outputs

- TODO

## Procedure

Describe how the system retrieves candidate matches using mechanisms such as:

- exact alias matching
- fuzzy string matching
- full-text search
- embeddings if used
- graph-neighborhood retrieval if used

# Phase 6: `score_resolution_candidates`

## Objective

Rank and filter the retrieved candidates while making ambiguity explicit.

## Inputs

- TODO

## Outputs

- TODO

## Procedure

Describe how the system scores and filters candidates using signals such as:

- lexical similarity
- semantic similarity
- artifact or tag compatibility
- relation compatibility
- graph context
- recency
- prior co-occurrence

# Phase 7: `resolve_ambiguities`

## Objective

Obtain user decisions for cases where identity, linkage, or create-vs-link choices are too ambiguous to decide automatically.

## Inputs

- TODO

## Outputs

- TODO

## Procedure

Describe:

- which cases require user review
- which cases may be deferred
- what user actions are allowed
- how decisions are captured and stored

# Phase 8: `rewrite_resolved_semantic_draft`

## Objective

Rewrite the text-only semantic draft using the ambiguity-resolution decisions, replacing placeholders where possible while preserving unresolved placeholders explicitly.

## Inputs

- TODO

## Outputs

- TODO

## Procedure

Describe how the system:

- replaces placeholders with concrete identities
- keeps unresolved placeholders explicit
- preserves the text-grounded meaning of the original draft

# Phase 9: `augment_with_database_context`

## Objective

Add database-aware suggestions that follow from the resolved draft and nearby existing graph context without inventing unsupported primary facts.

## Inputs

- TODO

## Outputs

- TODO

## Procedure

Describe how the system proposes consequences such as:

- linking to an existing encounter
- suggesting that a new record revises an older record
- dropping unnecessary new artifacts
- flagging conflicts with currently active relations

# Phase 10: `detect_ontology_gaps`

## Objective

Identify missing ontology vocabulary needed to express the candidate structured update.

## Inputs

- TODO

## Outputs

- TODO

## Procedure

Describe how the system detects potential missing items such as:

- `tag_types`
- `tag_groups`
- `reference_types`
- `reference_groups`

# Phase 11: `materialize_verbose_candidate_delta`

## Objective

Convert the resolved and augmented semantic understanding into an explicit candidate database patch while preserving detail before pruning.

## Inputs

- TODO

## Outputs

- TODO

## Procedure

Describe how the system materializes operations such as:

- create artifact
- create record
- attach tag
- create reference
- create ontology item

# Phase 12: `reduce_to_minimal_commit_delta`

## Objective

Reduce the verbose candidate patch to the smallest durable structured update that should actually enter the primary database.

## Inputs

- TODO

## Outputs

- TODO

## Procedure

Describe how the system applies rules such as:

- merging paraphrases
- dropping redundant fragments
- preferring links over duplicates
- declining low-value ontology growth
- collapsing overlapping suggestions

# Phase 13: `review_commit_delta`

## Objective

Prepare the final candidate update for user review in a form that is meaningful, editable, and safe to approve.

## Inputs

- TODO

## Outputs

- TODO

## Procedure

Describe:

- what the user sees first
- how reflective synthesis relates to the structured patch
- what edit actions the user can take
- how approvals, rejections, merges, relinks, and uncertainty markings are captured

# Phase 14: `commit_delta`

## Objective

Write the approved minimal commit delta into the primary mental-map database transactionally.

## Inputs

- TODO

## Outputs

- TODO

## Procedure

Describe:

- transaction boundaries
- invariant enforcement
- conflict handling
- idempotency behavior
- what counts as a successful commit result

# Phase 15: `finalize_provenance`

## Objective

Persist the final traceability links between source text, intermediate pipeline artifacts, user decisions, and committed database objects.

## Inputs

- TODO

## Outputs

- TODO

## Procedure

Describe how the system:

- links committed records to source spans
- links committed artifacts to mention spans
- stores user review decisions
- preserves rejected or deferred suggestions where appropriate

# Open questions

These are likely to need answers while filling in the phase sections:

1. What are the canonical IDs and object types used inside the ingestion system?
2. Which intermediate artifacts are persisted after each phase?
3. Which phases are deterministic, and which use LLM calls?
4. Which phases can terminate in "awaiting user action"?
5. What exact patch language should represent the candidate delta?
6. How should the ingestion schema map to the current core database model?
