# Phase 4 Prompt Iteration Log

This document works through a full prompt-design loop for ingestion phase 4.

Goal:

- design a phase-4 prompt for pre-resolution culling and consolidation
- use 10 adversarial iterations to tighten the prompt
- preserve the current phase-2 and phase-3 unresolved candidate model
- end with a stronger final phase-4 prompt and a concrete phase-4 input/output shape

Scope:

- phase 4 happens before resolution
- it receives the journal entry, phase-2 output, and phase-3 output
- it may remove low-value or clearly wrong candidates
- it may hard-consolidate candidates that are clearly safe to collapse
- it may soft-group related unresolved candidates that should stay separate for later resolution

## Core Input Shape

Phase 4 input:

```json
{
  "journal_entry": "",
  "phase_2_output": {
    "candidate_records": [
      {
        "candidate_id": "r1",
        "process_type": "thought",
        "source_text": "",
        "notes": ""
      }
    ],
    "candidate_artifacts": [
      {
        "candidate_id": "a1",
        "artifact_kind": "object",
        "source_text": "",
        "notes": ""
      },
      {
        "candidate_id": "a2",
        "artifact_kind": "encounter",
        "source_texts": [""],
        "notes": ""
      }
    ],
    "uncertainties": [""]
  },
  "phase_3_output": {
    "candidate_references": [
      {
        "candidate_reference_id": "cr1",
        "from_candidate_id": "r1",
        "to_candidate_id": "a1",
        "relation_label": "",
        "relation_status": "explicit",
        "supporting_text": "",
        "notes": ""
      }
    ],
    "uncertainties": [""]
  }
}
```

## Core Output Shape

```json
{
  "candidate_records": [
    {
      "candidate_id": "r1",
      "process_type": "thought",
      "source_text": "",
      "notes": "",
      "absorbed_candidate_ids": [""]
    }
  ],
  "candidate_artifacts": [
    {
      "candidate_id": "a1",
      "artifact_kind": "object",
      "source_text": "",
      "notes": "",
      "absorbed_candidate_ids": [""]
    },
    {
      "candidate_id": "a2",
      "artifact_kind": "encounter",
      "source_texts": [""],
      "notes": "",
      "absorbed_candidate_ids": [""]
    }
  ],
  "candidate_references": [
    {
      "candidate_reference_id": "cr1",
      "from_candidate_id": "r1",
      "to_candidate_id": "a1",
      "relation_label": "",
      "relation_status": "explicit",
      "supporting_text": "",
      "notes": "",
      "absorbed_candidate_reference_ids": [""]
    }
  ],
  "removed_items": [
    {
      "item_kind": "candidate_reference",
      "item_id": "cr9",
      "removal_kind": "",
      "reason": "",
      "replacement_item_id": ""
    }
  ],
  "soft_groups": [
    {
      "group_id": "g1",
      "group_type": "possible_same_unresolved",
      "member_item_ids": [""],
      "notes": ""
    }
  ],
  "uncertainties": [""]
}
```

Definitions:

- `absorbed_candidate_ids` and `absorbed_candidate_reference_ids` are for hard consolidation
- `soft_groups` are for unresolved relatedness that should not be collapsed yet

## Initial Prompt v1

```text
You will be given:
1. a journal entry
2. phase-2 JSON containing unresolved candidate_records and candidate_artifacts with stable candidate_id values
3. phase-3 JSON containing unresolved candidate_references with stable candidate_reference_id values

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
2. Do not resolve identity.
3. Do not use outside context.
4. Preserve provenance.
5. Preserve negation.
6. Preserve real ambiguity.
7. Prefer soft grouping over hard collapse when uncertainty remains.

Return JSON only in the specified shape.
```

## Iteration 1

Pain point:

- exact duplicate references should be consolidated, not merely both kept

Input:

```json
{
  "journal_entry": "Before bed I reread Elena's note about the appeal.",
  "phase_2_output": {
    "candidate_records": [
      { "candidate_id": "r1", "process_type": "behaviour", "source_text": "I reread Elena's note about the appeal", "notes": "" }
    ],
    "candidate_artifacts": [
      { "candidate_id": "a1", "artifact_kind": "object", "source_text": "Elena's note", "notes": "" },
      { "candidate_id": "a2", "artifact_kind": "encounter", "source_texts": ["the appeal"], "notes": "" }
    ],
    "uncertainties": []
  },
  "phase_3_output": {
    "candidate_references": [
      { "candidate_reference_id": "cr1", "from_candidate_id": "r1", "to_candidate_id": "a1", "relation_label": "reread", "relation_status": "explicit", "supporting_text": "I reread Elena's note", "notes": "" },
      { "candidate_reference_id": "cr2", "from_candidate_id": "r1", "to_candidate_id": "a1", "relation_label": "reread", "relation_status": "explicit", "supporting_text": "I reread Elena's note", "notes": "" }
    ],
    "uncertainties": []
  }
}
```

Phase 4 output v1:

```json
{
  "candidate_records": [
    { "candidate_id": "r1", "process_type": "behaviour", "source_text": "I reread Elena's note about the appeal", "notes": "", "absorbed_candidate_ids": [] }
  ],
  "candidate_artifacts": [
    { "candidate_id": "a1", "artifact_kind": "object", "source_text": "Elena's note", "notes": "", "absorbed_candidate_ids": [] },
    { "candidate_id": "a2", "artifact_kind": "encounter", "source_texts": ["the appeal"], "notes": "", "absorbed_candidate_ids": [] }
  ],
  "candidate_references": [
    { "candidate_reference_id": "cr1", "from_candidate_id": "r1", "to_candidate_id": "a1", "relation_label": "reread", "relation_status": "explicit", "supporting_text": "I reread Elena's note", "notes": "", "absorbed_candidate_reference_ids": [] },
    { "candidate_reference_id": "cr2", "from_candidate_id": "r1", "to_candidate_id": "a1", "relation_label": "reread", "relation_status": "explicit", "supporting_text": "I reread Elena's note", "notes": "", "absorbed_candidate_reference_ids": [] }
  ],
  "removed_items": [],
  "soft_groups": [],
  "uncertainties": []
}
```

Critique:

- Exact duplicates should not survive side by side.
- The prompt needs a hard-consolidation rule for exact duplicates and an audit trail.

Prompt delta:

- exact duplicates should be hard-consolidated
- the surviving item should list absorbed IDs
- removed or absorbed items must remain traceable

## Iteration 2

Pain point:

- abstract or less text-faithful duplicates should be dominated by more faithful ones

Input:

```json
{
  "journal_entry": "Before bed I reread Elena's note about the appeal.",
  "phase_2_output": {
    "candidate_records": [
      { "candidate_id": "r1", "process_type": "behaviour", "source_text": "I reread Elena's note about the appeal", "notes": "" }
    ],
    "candidate_artifacts": [
      { "candidate_id": "a1", "artifact_kind": "object", "source_text": "Elena's note", "notes": "" }
    ],
    "uncertainties": []
  },
  "phase_3_output": {
    "candidate_references": [
      { "candidate_reference_id": "cr1", "from_candidate_id": "r1", "to_candidate_id": "a1", "relation_label": "consulted", "relation_status": "ambiguous", "supporting_text": "I reread Elena's note", "notes": "" },
      { "candidate_reference_id": "cr2", "from_candidate_id": "r1", "to_candidate_id": "a1", "relation_label": "reread", "relation_status": "explicit", "supporting_text": "I reread Elena's note", "notes": "" }
    ],
    "uncertainties": []
  }
}
```

Phase 4 output v2:

```json
{
  "candidate_records": [
    { "candidate_id": "r1", "process_type": "behaviour", "source_text": "I reread Elena's note about the appeal", "notes": "", "absorbed_candidate_ids": [] }
  ],
  "candidate_artifacts": [
    { "candidate_id": "a1", "artifact_kind": "object", "source_text": "Elena's note", "notes": "", "absorbed_candidate_ids": [] }
  ],
  "candidate_references": [
    { "candidate_reference_id": "cr1", "from_candidate_id": "r1", "to_candidate_id": "a1", "relation_label": "consulted", "relation_status": "ambiguous", "supporting_text": "I reread Elena's note", "notes": "", "absorbed_candidate_reference_ids": [] },
    { "candidate_reference_id": "cr2", "from_candidate_id": "r1", "to_candidate_id": "a1", "relation_label": "reread", "relation_status": "explicit", "supporting_text": "I reread Elena's note", "notes": "", "absorbed_candidate_reference_ids": [] }
  ],
  "removed_items": [],
  "soft_groups": [],
  "uncertainties": []
}
```

Critique:

- The prompt needs a dominance rule.
- When two references express the same pairing and support, the more text-faithful one should survive.

Prompt delta:

- if two candidates have the same source-target-support structure, prefer the more text-faithful representative
- dominated variants may be removed or absorbed into the survivor

## Iteration 3

Pain point:

- wrong-target references should be removed when a better text-supported target survives

Input:

```json
{
  "journal_entry": "I folded the note about the hearing on Tuesday and put it in my bag.",
  "phase_2_output": {
    "candidate_records": [
      { "candidate_id": "r1", "process_type": "behaviour", "source_text": "I folded the note about the hearing on Tuesday", "notes": "" }
    ],
    "candidate_artifacts": [
      { "candidate_id": "a1", "artifact_kind": "object", "source_text": "the note about the hearing on Tuesday", "notes": "" },
      { "candidate_id": "a2", "artifact_kind": "encounter", "source_texts": ["the hearing on Tuesday"], "notes": "" }
    ],
    "uncertainties": []
  },
  "phase_3_output": {
    "candidate_references": [
      { "candidate_reference_id": "cr1", "from_candidate_id": "r1", "to_candidate_id": "a2", "relation_label": "about", "relation_status": "explicit", "supporting_text": "I folded the note about the hearing on Tuesday", "notes": "" },
      { "candidate_reference_id": "cr2", "from_candidate_id": "r1", "to_candidate_id": "a1", "relation_label": "folded", "relation_status": "explicit", "supporting_text": "I folded the note about the hearing on Tuesday", "notes": "" },
      { "candidate_reference_id": "cr3", "from_candidate_id": "a1", "to_candidate_id": "a2", "relation_label": "about", "relation_status": "explicit", "supporting_text": "the note about the hearing on Tuesday", "notes": "" }
    ],
    "uncertainties": []
  }
}
```

Phase 4 output v3:

```json
{
  "candidate_records": [
    { "candidate_id": "r1", "process_type": "behaviour", "source_text": "I folded the note about the hearing on Tuesday", "notes": "", "absorbed_candidate_ids": [] }
  ],
  "candidate_artifacts": [
    { "candidate_id": "a1", "artifact_kind": "object", "source_text": "the note about the hearing on Tuesday", "notes": "", "absorbed_candidate_ids": [] },
    { "candidate_id": "a2", "artifact_kind": "encounter", "source_texts": ["the hearing on Tuesday"], "notes": "", "absorbed_candidate_ids": [] }
  ],
  "candidate_references": [
    { "candidate_reference_id": "cr2", "from_candidate_id": "r1", "to_candidate_id": "a1", "relation_label": "folded", "relation_status": "explicit", "supporting_text": "I folded the note about the hearing on Tuesday", "notes": "", "absorbed_candidate_reference_ids": [] },
    { "candidate_reference_id": "cr3", "from_candidate_id": "a1", "to_candidate_id": "a2", "relation_label": "about", "relation_status": "explicit", "supporting_text": "the note about the hearing on Tuesday", "notes": "", "absorbed_candidate_reference_ids": [] }
  ],
  "removed_items": [
    { "item_kind": "candidate_reference", "item_id": "cr1", "removal_kind": "wrong_target", "reason": "The record directly acts on the note, not on the hearing.", "replacement_item_id": "cr2" }
  ],
  "soft_groups": [],
  "uncertainties": []
}
```

Critique:

- This is better.
- Phase 4 should explicitly allow wrong-target removal when a better surviving target is directly supported.

Prompt delta:

- remove structurally wrong or clearly mistargeted references when a better directly supported surviving reference exists

## Iteration 4

Pain point:

- ambiguous alternatives should be grouped, not collapsed

Input:

```json
{
  "journal_entry": "On the bus home I kept wondering whether she meant it kindly.",
  "phase_2_output": {
    "candidate_records": [
      { "candidate_id": "r1", "process_type": "thought", "source_text": "I kept wondering whether she meant it kindly", "notes": "" }
    ],
    "candidate_artifacts": [
      { "candidate_id": "a1", "artifact_kind": "object", "source_text": "Ava", "notes": "" },
      { "candidate_id": "a2", "artifact_kind": "object", "source_text": "Elena", "notes": "" },
      { "candidate_id": "a3", "artifact_kind": "encounter", "source_texts": ["the bus home"], "notes": "" }
    ],
    "uncertainties": []
  },
  "phase_3_output": {
    "candidate_references": [
      { "candidate_reference_id": "cr1", "from_candidate_id": "r1", "to_candidate_id": "a1", "relation_label": "wondering whether she meant it kindly", "relation_status": "ambiguous", "supporting_text": "I kept wondering whether she meant it kindly", "notes": "" },
      { "candidate_reference_id": "cr2", "from_candidate_id": "r1", "to_candidate_id": "a2", "relation_label": "wondering whether she meant it kindly", "relation_status": "ambiguous", "supporting_text": "I kept wondering whether she meant it kindly", "notes": "" }
    ],
    "uncertainties": []
  }
}
```

Phase 4 output v4:

```json
{
  "candidate_records": [
    { "candidate_id": "r1", "process_type": "thought", "source_text": "I kept wondering whether she meant it kindly", "notes": "", "absorbed_candidate_ids": [] }
  ],
  "candidate_artifacts": [
    { "candidate_id": "a1", "artifact_kind": "object", "source_text": "Ava", "notes": "", "absorbed_candidate_ids": [] },
    { "candidate_id": "a2", "artifact_kind": "object", "source_text": "Elena", "notes": "", "absorbed_candidate_ids": [] },
    { "candidate_id": "a3", "artifact_kind": "encounter", "source_texts": ["the bus home"], "notes": "", "absorbed_candidate_ids": [] }
  ],
  "candidate_references": [
    { "candidate_reference_id": "cr1", "from_candidate_id": "r1", "to_candidate_id": "a1", "relation_label": "wondering whether she meant it kindly", "relation_status": "ambiguous", "supporting_text": "I kept wondering whether she meant it kindly", "notes": "", "absorbed_candidate_reference_ids": [] }
  ],
  "removed_items": [
    { "item_kind": "candidate_reference", "item_id": "cr2", "removal_kind": "redundant_alternative", "reason": "The ambiguous alternative set should be reduced.", "replacement_item_id": "cr1" }
  ],
  "soft_groups": [],
  "uncertainties": []
}
```

Critique:

- This over-prunes ambiguity.
- Both alternatives should survive, but they should be grouped together.

Prompt delta:

- explicit ambiguous alternatives should not be hard-consolidated
- alternative references may survive together inside a soft group
- use `soft_groups` for unresolved alternative sets

## Iteration 5

Pain point:

- likely same candidates should be soft-grouped, not absorbed

Input:

```json
{
  "journal_entry": "During the meeting with Dr. Sen, my supervisor, I asked about the fellowship application.",
  "phase_2_output": {
    "candidate_records": [
      { "candidate_id": "r1", "process_type": "behaviour", "source_text": "I asked about the fellowship application", "notes": "" }
    ],
    "candidate_artifacts": [
      { "candidate_id": "a1", "artifact_kind": "encounter", "source_texts": ["the meeting with Dr. Sen"], "notes": "" },
      { "candidate_id": "a2", "artifact_kind": "object", "source_text": "Dr. Sen", "notes": "" },
      { "candidate_id": "a3", "artifact_kind": "object", "source_text": "my supervisor", "notes": "" },
      { "candidate_id": "a4", "artifact_kind": "object", "source_text": "the fellowship application", "notes": "" }
    ],
    "uncertainties": []
  },
  "phase_3_output": {
    "candidate_references": [
      { "candidate_reference_id": "cr1", "from_candidate_id": "a2", "to_candidate_id": "a1", "relation_label": "with", "relation_status": "explicit", "supporting_text": "the meeting with Dr. Sen", "notes": "" },
      { "candidate_reference_id": "cr2", "from_candidate_id": "a3", "to_candidate_id": "a1", "relation_label": "with", "relation_status": "ambiguous", "supporting_text": "During the meeting with Dr. Sen, my supervisor, I asked about the fellowship application", "notes": "" }
    ],
    "uncertainties": []
  }
}
```

Phase 4 output v5:

```json
{
  "candidate_records": [
    { "candidate_id": "r1", "process_type": "behaviour", "source_text": "I asked about the fellowship application", "notes": "", "absorbed_candidate_ids": [] }
  ],
  "candidate_artifacts": [
    { "candidate_id": "a1", "artifact_kind": "encounter", "source_texts": ["the meeting with Dr. Sen"], "notes": "", "absorbed_candidate_ids": [] },
    { "candidate_id": "a2", "artifact_kind": "object", "source_text": "Dr. Sen", "notes": "", "absorbed_candidate_ids": ["a3"] },
    { "candidate_id": "a4", "artifact_kind": "object", "source_text": "the fellowship application", "notes": "", "absorbed_candidate_ids": [] }
  ],
  "candidate_references": [
    { "candidate_reference_id": "cr1", "from_candidate_id": "a2", "to_candidate_id": "a1", "relation_label": "with", "relation_status": "explicit", "supporting_text": "the meeting with Dr. Sen", "notes": "", "absorbed_candidate_reference_ids": ["cr2"] }
  ],
  "removed_items": [],
  "soft_groups": [],
  "uncertainties": []
}
```

Critique:

- This resolves likely co-reference too early.
- `Dr. Sen` and `my supervisor` should remain separate and be soft-grouped.

Prompt delta:

- possible same candidates should be soft-grouped as `possible_same_unresolved`
- do not absorb likely co-referring candidates before resolution unless the sameness is already explicit and unambiguous inside the entry

## Iteration 6

Pain point:

- orthogonal links should not be consolidated away

Input:

```json
{
  "journal_entry": "While I was waiting at the dentist appointment, I kept replaying the fight with Noor from last winter.",
  "phase_2_output": {
    "candidate_records": [
      { "candidate_id": "r1", "process_type": "thought", "source_text": "I kept replaying the fight with Noor from last winter", "notes": "" }
    ],
    "candidate_artifacts": [
      { "candidate_id": "a1", "artifact_kind": "encounter", "source_texts": ["the dentist appointment"], "notes": "" },
      { "candidate_id": "a2", "artifact_kind": "encounter", "source_texts": ["the fight with Noor from last winter"], "notes": "" }
    ],
    "uncertainties": []
  },
  "phase_3_output": {
    "candidate_references": [
      { "candidate_reference_id": "cr1", "from_candidate_id": "r1", "to_candidate_id": "a1", "relation_label": "while waiting at", "relation_status": "explicit", "supporting_text": "While I was waiting at the dentist appointment, I kept replaying the fight with Noor from last winter", "notes": "" },
      { "candidate_reference_id": "cr2", "from_candidate_id": "r1", "to_candidate_id": "a2", "relation_label": "replaying", "relation_status": "explicit", "supporting_text": "I kept replaying the fight with Noor from last winter", "notes": "" }
    ],
    "uncertainties": []
  }
}
```

Phase 4 output v6:

```json
{
  "candidate_records": [
    { "candidate_id": "r1", "process_type": "thought", "source_text": "I kept replaying the fight with Noor from last winter", "notes": "", "absorbed_candidate_ids": [] }
  ],
  "candidate_artifacts": [
    { "candidate_id": "a1", "artifact_kind": "encounter", "source_texts": ["the dentist appointment"], "notes": "", "absorbed_candidate_ids": [] },
    { "candidate_id": "a2", "artifact_kind": "encounter", "source_texts": ["the fight with Noor from last winter"], "notes": "", "absorbed_candidate_ids": [] }
  ],
  "candidate_references": [
    { "candidate_reference_id": "cr2", "from_candidate_id": "r1", "to_candidate_id": "a2", "relation_label": "replaying", "relation_status": "explicit", "supporting_text": "I kept replaying the fight with Noor from last winter", "notes": "", "absorbed_candidate_reference_ids": ["cr1"] }
  ],
  "removed_items": [],
  "soft_groups": [],
  "uncertainties": []
}
```

Critique:

- These links are not duplicates.
- One is scene anchoring and one is remembered-content anchoring.
- Phase 4 must preserve orthogonal links.

Prompt delta:

- only consolidate links that are genuinely redundant
- do not consolidate distinct relation roles just because they share a source candidate

## Iteration 7

Pain point:

- later record-to-record reference should dominate looser object target guesses

Input:

```json
{
  "journal_entry": "I snapped at Theo in the kitchen. An hour later I apologized for it.",
  "phase_2_output": {
    "candidate_records": [
      { "candidate_id": "r1", "process_type": "behaviour", "source_text": "I snapped at Theo in the kitchen", "notes": "" },
      { "candidate_id": "r2", "process_type": "behaviour", "source_text": "I apologized for it", "notes": "" }
    ],
    "candidate_artifacts": [
      { "candidate_id": "a1", "artifact_kind": "object", "source_text": "Theo", "notes": "" },
      { "candidate_id": "a2", "artifact_kind": "object", "source_text": "the kitchen", "notes": "" }
    ],
    "uncertainties": []
  },
  "phase_3_output": {
    "candidate_references": [
      { "candidate_reference_id": "cr1", "from_candidate_id": "r1", "to_candidate_id": "a1", "relation_label": "at", "relation_status": "explicit", "supporting_text": "I snapped at Theo in the kitchen", "notes": "" },
      { "candidate_reference_id": "cr2", "from_candidate_id": "r1", "to_candidate_id": "a2", "relation_label": "in", "relation_status": "explicit", "supporting_text": "I snapped at Theo in the kitchen", "notes": "" },
      { "candidate_reference_id": "cr3", "from_candidate_id": "r2", "to_candidate_id": "a1", "relation_label": "apologized to", "relation_status": "ambiguous", "supporting_text": "I apologized for it", "notes": "" },
      { "candidate_reference_id": "cr4", "from_candidate_id": "r2", "to_candidate_id": "r1", "relation_label": "apologized for", "relation_status": "explicit", "supporting_text": "I apologized for it", "notes": "" }
    ],
    "uncertainties": []
  }
}
```

Phase 4 output v7:

```json
{
  "candidate_records": [
    { "candidate_id": "r1", "process_type": "behaviour", "source_text": "I snapped at Theo in the kitchen", "notes": "", "absorbed_candidate_ids": [] },
    { "candidate_id": "r2", "process_type": "behaviour", "source_text": "I apologized for it", "notes": "", "absorbed_candidate_ids": [] }
  ],
  "candidate_artifacts": [
    { "candidate_id": "a1", "artifact_kind": "object", "source_text": "Theo", "notes": "", "absorbed_candidate_ids": [] },
    { "candidate_id": "a2", "artifact_kind": "object", "source_text": "the kitchen", "notes": "", "absorbed_candidate_ids": [] }
  ],
  "candidate_references": [
    { "candidate_reference_id": "cr1", "from_candidate_id": "r1", "to_candidate_id": "a1", "relation_label": "at", "relation_status": "explicit", "supporting_text": "I snapped at Theo in the kitchen", "notes": "", "absorbed_candidate_reference_ids": [] },
    { "candidate_reference_id": "cr2", "from_candidate_id": "r1", "to_candidate_id": "a2", "relation_label": "in", "relation_status": "explicit", "supporting_text": "I snapped at Theo in the kitchen", "notes": "", "absorbed_candidate_reference_ids": [] },
    { "candidate_reference_id": "cr3", "from_candidate_id": "r2", "to_candidate_id": "a1", "relation_label": "apologized to", "relation_status": "ambiguous", "supporting_text": "I apologized for it", "notes": "", "absorbed_candidate_reference_ids": [] },
    { "candidate_reference_id": "cr4", "from_candidate_id": "r2", "to_candidate_id": "r1", "relation_label": "apologized for", "relation_status": "explicit", "supporting_text": "I apologized for it", "notes": "", "absorbed_candidate_reference_ids": [] }
  ],
  "removed_items": [],
  "soft_groups": [],
  "uncertainties": []
}
```

Critique:

- `cr3` is a weaker, looser guess than `cr4`.
- It should be removed when a more specific directly supported record-to-record link survives.

Prompt delta:

- when a later reference clearly points to a specific earlier candidate, prefer that target over weaker participant guesses
- dominated looser target guesses may be removed

## Iteration 8

Pain point:

- low-consequence incidental artifacts can be genuinely removed

Input:

```json
{
  "journal_entry": "I set the mug beside the laptop and reread the email from my lawyer.",
  "phase_2_output": {
    "candidate_records": [
      { "candidate_id": "r1", "process_type": "behaviour", "source_text": "I set the mug beside the laptop", "notes": "" },
      { "candidate_id": "r2", "process_type": "behaviour", "source_text": "I reread the email from my lawyer", "notes": "" }
    ],
    "candidate_artifacts": [
      { "candidate_id": "a1", "artifact_kind": "object", "source_text": "the mug", "notes": "" },
      { "candidate_id": "a2", "artifact_kind": "object", "source_text": "the laptop", "notes": "" },
      { "candidate_id": "a3", "artifact_kind": "object", "source_text": "the email from my lawyer", "notes": "" },
      { "candidate_id": "a4", "artifact_kind": "object", "source_text": "my lawyer", "notes": "" }
    ],
    "uncertainties": []
  },
  "phase_3_output": {
    "candidate_references": [
      { "candidate_reference_id": "cr1", "from_candidate_id": "r1", "to_candidate_id": "a1", "relation_label": "set", "relation_status": "explicit", "supporting_text": "I set the mug beside the laptop", "notes": "" },
      { "candidate_reference_id": "cr2", "from_candidate_id": "r1", "to_candidate_id": "a2", "relation_label": "beside", "relation_status": "explicit", "supporting_text": "I set the mug beside the laptop", "notes": "" },
      { "candidate_reference_id": "cr3", "from_candidate_id": "r2", "to_candidate_id": "a3", "relation_label": "reread", "relation_status": "explicit", "supporting_text": "I reread the email from my lawyer", "notes": "" },
      { "candidate_reference_id": "cr4", "from_candidate_id": "a3", "to_candidate_id": "a4", "relation_label": "from", "relation_status": "explicit", "supporting_text": "the email from my lawyer", "notes": "" }
    ],
    "uncertainties": []
  }
}
```

Phase 4 output v8:

```json
{
  "candidate_records": [
    { "candidate_id": "r1", "process_type": "behaviour", "source_text": "I set the mug beside the laptop", "notes": "", "absorbed_candidate_ids": [] },
    { "candidate_id": "r2", "process_type": "behaviour", "source_text": "I reread the email from my lawyer", "notes": "", "absorbed_candidate_ids": [] }
  ],
  "candidate_artifacts": [
    { "candidate_id": "a1", "artifact_kind": "object", "source_text": "the mug", "notes": "", "absorbed_candidate_ids": [] },
    { "candidate_id": "a2", "artifact_kind": "object", "source_text": "the laptop", "notes": "", "absorbed_candidate_ids": [] },
    { "candidate_id": "a3", "artifact_kind": "object", "source_text": "the email from my lawyer", "notes": "", "absorbed_candidate_ids": [] },
    { "candidate_id": "a4", "artifact_kind": "object", "source_text": "my lawyer", "notes": "", "absorbed_candidate_ids": [] }
  ],
  "candidate_references": [
    { "candidate_reference_id": "cr1", "from_candidate_id": "r1", "to_candidate_id": "a1", "relation_label": "set", "relation_status": "explicit", "supporting_text": "I set the mug beside the laptop", "notes": "", "absorbed_candidate_reference_ids": [] },
    { "candidate_reference_id": "cr2", "from_candidate_id": "r1", "to_candidate_id": "a2", "relation_label": "beside", "relation_status": "explicit", "supporting_text": "I set the mug beside the laptop", "notes": "", "absorbed_candidate_reference_ids": [] },
    { "candidate_reference_id": "cr3", "from_candidate_id": "r2", "to_candidate_id": "a3", "relation_label": "reread", "relation_status": "explicit", "supporting_text": "I reread the email from my lawyer", "notes": "", "absorbed_candidate_reference_ids": [] },
    { "candidate_reference_id": "cr4", "from_candidate_id": "a3", "to_candidate_id": "a4", "relation_label": "from", "relation_status": "explicit", "supporting_text": "the email from my lawyer", "notes": "", "absorbed_candidate_reference_ids": [] }
  ],
  "removed_items": [],
  "soft_groups": [],
  "uncertainties": []
}
```

Critique:

- This keeps obvious incidental setup clutter.
- The mug and laptop are likely low-consequence here if they do not participate in any higher-value surviving mental structure.

Prompt delta:

- low-consequence artifacts may be removed if they are merely incidental scene furniture, have no downstream surviving role, and are unlikely to matter for later retrieval or mental interpretation
- if such artifacts are removed, remove orphans that depend only on them

## Iteration 9

Pain point:

- near-duplicate records can be hard-consolidated when they add no distinct mental content

Input:

```json
{
  "journal_entry": "All night I kept replaying the argument, replaying it again and again.",
  "phase_2_output": {
    "candidate_records": [
      { "candidate_id": "r1", "process_type": "thought", "source_text": "I kept replaying the argument", "notes": "" },
      { "candidate_id": "r2", "process_type": "thought", "source_text": "replaying it again and again", "notes": "" }
    ],
    "candidate_artifacts": [
      { "candidate_id": "a1", "artifact_kind": "encounter", "source_texts": ["the argument"], "notes": "" }
    ],
    "uncertainties": []
  },
  "phase_3_output": {
    "candidate_references": [
      { "candidate_reference_id": "cr1", "from_candidate_id": "r1", "to_candidate_id": "a1", "relation_label": "replaying", "relation_status": "explicit", "supporting_text": "I kept replaying the argument", "notes": "" },
      { "candidate_reference_id": "cr2", "from_candidate_id": "r2", "to_candidate_id": "a1", "relation_label": "replaying", "relation_status": "explicit", "supporting_text": "replaying it again and again", "notes": "" }
    ],
    "uncertainties": []
  }
}
```

Phase 4 output v9:

```json
{
  "candidate_records": [
    { "candidate_id": "r1", "process_type": "thought", "source_text": "I kept replaying the argument", "notes": "", "absorbed_candidate_ids": [] },
    { "candidate_id": "r2", "process_type": "thought", "source_text": "replaying it again and again", "notes": "", "absorbed_candidate_ids": [] }
  ],
  "candidate_artifacts": [
    { "candidate_id": "a1", "artifact_kind": "encounter", "source_texts": ["the argument"], "notes": "", "absorbed_candidate_ids": [] }
  ],
  "candidate_references": [
    { "candidate_reference_id": "cr1", "from_candidate_id": "r1", "to_candidate_id": "a1", "relation_label": "replaying", "relation_status": "explicit", "supporting_text": "I kept replaying the argument", "notes": "", "absorbed_candidate_reference_ids": [] },
    { "candidate_reference_id": "cr2", "from_candidate_id": "r2", "to_candidate_id": "a1", "relation_label": "replaying", "relation_status": "explicit", "supporting_text": "replaying it again and again", "notes": "", "absorbed_candidate_reference_ids": [] }
  ],
  "removed_items": [],
  "soft_groups": [],
  "uncertainties": []
}
```

Critique:

- These are probably over-split variants of the same thought record.
- Phase 4 should allow hard-consolidation of records when one adds no distinct mental content beyond the other.

Prompt delta:

- records may be hard-consolidated only when they are clearly duplicate or dominated variants of the same mental content
- if any distinct nuance remains, keep them separate

## Iteration 10

Pain point:

- clear same-entry alias variants can be hard-consolidated before global resolution

Input:

```json
{
  "journal_entry": "I wanted to cancel the hospital scan next week, but I also knew the scan wasn't the thing I was really afraid of.",
  "phase_2_output": {
    "candidate_records": [
      { "candidate_id": "r1", "process_type": "thought", "source_text": "I wanted to cancel the hospital scan next week", "notes": "" },
      { "candidate_id": "r2", "process_type": "thought", "source_text": "I also knew the scan wasn't the thing I was really afraid of", "notes": "" }
    ],
    "candidate_artifacts": [
      { "candidate_id": "a1", "artifact_kind": "encounter", "source_texts": ["the hospital scan next week"], "notes": "" },
      { "candidate_id": "a2", "artifact_kind": "encounter", "source_texts": ["the scan"], "notes": "" }
    ],
    "uncertainties": []
  },
  "phase_3_output": {
    "candidate_references": [
      { "candidate_reference_id": "cr1", "from_candidate_id": "r1", "to_candidate_id": "a1", "relation_label": "wanted to cancel", "relation_status": "explicit", "supporting_text": "I wanted to cancel the hospital scan next week", "notes": "" },
      { "candidate_reference_id": "cr2", "from_candidate_id": "r2", "to_candidate_id": "a2", "relation_label": "wasn't the thing I was really afraid of", "relation_status": "explicit", "supporting_text": "I also knew the scan wasn't the thing I was really afraid of", "notes": "" }
    ],
    "uncertainties": []
  }
}
```

Phase 4 output v10:

```json
{
  "candidate_records": [
    { "candidate_id": "r1", "process_type": "thought", "source_text": "I wanted to cancel the hospital scan next week", "notes": "", "absorbed_candidate_ids": [] },
    { "candidate_id": "r2", "process_type": "thought", "source_text": "I also knew the scan wasn't the thing I was really afraid of", "notes": "", "absorbed_candidate_ids": [] }
  ],
  "candidate_artifacts": [
    { "candidate_id": "a1", "artifact_kind": "encounter", "source_texts": ["the hospital scan next week", "the scan"], "notes": "", "absorbed_candidate_ids": ["a2"] }
  ],
  "candidate_references": [
    { "candidate_reference_id": "cr1", "from_candidate_id": "r1", "to_candidate_id": "a1", "relation_label": "wanted to cancel", "relation_status": "explicit", "supporting_text": "I wanted to cancel the hospital scan next week", "notes": "", "absorbed_candidate_reference_ids": [] },
    { "candidate_reference_id": "cr2", "from_candidate_id": "r2", "to_candidate_id": "a1", "relation_label": "wasn't the thing I was really afraid of", "relation_status": "explicit", "supporting_text": "I also knew the scan wasn't the thing I was really afraid of", "notes": "", "absorbed_candidate_reference_ids": [] }
  ],
  "removed_items": [],
  "soft_groups": [],
  "uncertainties": []
}
```

Critique:

- This is the kind of hard consolidation phase 4 should absolutely do.
- It reduces noise without resolving against the external database.

Prompt delta:

- same-entry alias variants may be hard-consolidated when the local text makes their sameness explicit and unambiguous
- redirect surviving references to the consolidated representative

## What Survived Across The 10 Iterations

The prompt improved when it learned to:

- hard-consolidate exact duplicates
- prefer more text-faithful representatives over dominated variants
- remove wrong-target references when a better direct target survives
- preserve unresolved alternatives using soft groups rather than deletion
- preserve likely-co-reference using soft groups rather than absorption
- avoid collapsing orthogonal links
- prefer specific record-to-record backreferences over looser target guesses
- remove incidental low-consequence artifacts when they have no surviving role
- hard-consolidate genuinely duplicate records
- hard-consolidate clearly same local alias variants

## Final Phase 4 Prompt

```text
You will be given:
1. a journal entry
2. phase-2 JSON containing unresolved candidate_records and candidate_artifacts with stable candidate_id values
3. phase-3 JSON containing unresolved candidate_references with stable candidate_reference_id values

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
```

## Bottom Line

Phase 4 should be light on deletion, heavier on reference cleanup, and very deliberate about the distinction between:

- hard consolidation through absorbed IDs
- soft grouping for unresolved relatedness

Most safe pre-resolution culling is:

- exact duplicates
- dominated variants
- wrong-target references
- unsupported candidates
- low-consequence incidental clutter

Most safe pre-resolution consolidation is:

- exact or explicit same-entry aliases
- clearly duplicate records
- reference variants with the same structure but worse labeling

Most things that still encode unresolved ambiguity should survive through soft groups rather than be absorbed.
