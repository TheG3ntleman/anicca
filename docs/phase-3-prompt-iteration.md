# Phase 3 Prompt Iteration Log

This document works through a full prompt-design loop for ingestion phase 3.

Goal:

- make an initial phase-3 prompt
- create a challenging sample journal entry
- run phase 2 on that sample using the current phase-2 prompt from the planning doc
- run phase 3 on the phase-2 output
- critique the phase-3 output
- revise the phase-3 prompt and rerun it
- repeat this cycle 10 times
- end with a stronger final phase-3 prompt

Assumptions used here:

- Phase 2 output remains in unresolved `intermediate format-1`.
- Phase 3 does not resolve identities, add tags, or use outside context.
- Phase 3 only adds unresolved `candidate_references`.
- Candidate references are grounded by `source_text` strings from phase 2 plus one exact `supporting_text` span from the journal entry.

## Sample Journal Entry

```text
Yesterday after lunch I reread Mira's message about the Friday design review and felt my stomach knot. I kept thinking I had already disappointed her, although she never actually said that. During the call with Mira and Dev, I apologized for missing the mockup deadline, and then I argued with Dev about whether the prototype was even worth showing. After the call I sat in the stairwell shaking and not answering my brother's text. I wanted to cancel the hospital scan next week, but I also knew the scan wasn't the thing I was really afraid of. Later at dinner with my parents, my mother said I looked exhausted. I told them I was fine, but I wasn't fine and I could barely swallow. On the ride home I kept replaying the call and the moment Dev laughed. I don't know whether he was laughing at me or at the bug on the screen. Before bed I opened the old grant proposal again, searching for proof that this project used to make sense. I didn't cry, but my chest hurt and I stayed awake until 3 a.m.
```

Why this text is challenging:

- there are multiple encounters
- there is coreference (`her`, `them`, `the scan`, `the call`, `he`)
- there is explicit uncertainty
- there is negation
- there are nested mentions (`message about review`, `argument about prototype`)
- one remembered episode may or may not be separate from a larger encounter (`the moment Dev laughed`)
- there are adjacent clauses that invite unsupported causal inference

## Phase 2 Prompt Used

Used exactly from [planning-v-0-0-1-ingestion.md](/home/abhirath/Art/anicca/docs/planning-v-0-0-1-ingestion.md).

## Phase 2 Output

```json
{
  "candidate_records": [
    {
      "process_type": "behaviour",
      "source_text": "I reread Mira's message about the Friday design review",
      "notes": ""
    },
    {
      "process_type": "body",
      "source_text": "felt my stomach knot",
      "notes": ""
    },
    {
      "process_type": "thought",
      "source_text": "I kept thinking I had already disappointed her",
      "notes": ""
    },
    {
      "process_type": "behaviour",
      "source_text": "I apologized for missing the mockup deadline",
      "notes": ""
    },
    {
      "process_type": "behaviour",
      "source_text": "I argued with Dev about whether the prototype was even worth showing",
      "notes": ""
    },
    {
      "process_type": "behaviour",
      "source_text": "I sat in the stairwell shaking and not answering my brother's text",
      "notes": "Mixed behaviour and bodily activation kept together because a clean split would clip meaning."
    },
    {
      "process_type": "thought",
      "source_text": "I wanted to cancel the hospital scan next week",
      "notes": ""
    },
    {
      "process_type": "thought",
      "source_text": "I also knew the scan wasn't the thing I was really afraid of",
      "notes": ""
    },
    {
      "process_type": "behaviour",
      "source_text": "I told them I was fine",
      "notes": ""
    },
    {
      "process_type": "thought",
      "source_text": "I wasn't fine",
      "notes": ""
    },
    {
      "process_type": "body",
      "source_text": "I could barely swallow",
      "notes": ""
    },
    {
      "process_type": "thought",
      "source_text": "I kept replaying the call and the moment Dev laughed",
      "notes": ""
    },
    {
      "process_type": "thought",
      "source_text": "I don't know whether he was laughing at me or at the bug on the screen",
      "notes": ""
    },
    {
      "process_type": "behaviour",
      "source_text": "I opened the old grant proposal again",
      "notes": ""
    },
    {
      "process_type": "thought",
      "source_text": "this project used to make sense",
      "notes": ""
    },
    {
      "process_type": "behaviour",
      "source_text": "I didn't cry",
      "notes": ""
    },
    {
      "process_type": "body",
      "source_text": "my chest hurt",
      "notes": ""
    },
    {
      "process_type": "body",
      "source_text": "I stayed awake until 3 a.m.",
      "notes": ""
    }
  ],
  "candidate_artifacts": [
    {
      "artifact_kind": "object",
      "source_text": "Mira's message",
      "notes": ""
    },
    {
      "artifact_kind": "encounter",
      "source_texts": [
        "the Friday design review"
      ],
      "notes": ""
    },
    {
      "artifact_kind": "object",
      "source_text": "Mira",
      "notes": ""
    },
    {
      "artifact_kind": "encounter",
      "source_texts": [
        "the call with Mira and Dev",
        "the call"
      ],
      "notes": "Later mention grouped to the same encounter."
    },
    {
      "artifact_kind": "object",
      "source_text": "Dev",
      "notes": ""
    },
    {
      "artifact_kind": "object",
      "source_text": "the mockup deadline",
      "notes": ""
    },
    {
      "artifact_kind": "object",
      "source_text": "the prototype",
      "notes": ""
    },
    {
      "artifact_kind": "object",
      "source_text": "my brother's text",
      "notes": ""
    },
    {
      "artifact_kind": "encounter",
      "source_texts": [
        "the hospital scan next week",
        "the scan"
      ],
      "notes": "Later mention grouped to the same future procedure encounter."
    },
    {
      "artifact_kind": "encounter",
      "source_texts": [
        "dinner with my parents"
      ],
      "notes": ""
    },
    {
      "artifact_kind": "object",
      "source_text": "my parents",
      "notes": ""
    },
    {
      "artifact_kind": "object",
      "source_text": "my mother",
      "notes": ""
    },
    {
      "artifact_kind": "encounter",
      "source_texts": [
        "the ride home"
      ],
      "notes": ""
    },
    {
      "artifact_kind": "encounter",
      "source_texts": [
        "the moment Dev laughed"
      ],
      "notes": "Could be a separate remembered episode or a sub-episode of the call."
    },
    {
      "artifact_kind": "object",
      "source_text": "the bug on the screen",
      "notes": ""
    },
    {
      "artifact_kind": "object",
      "source_text": "the old grant proposal",
      "notes": ""
    },
    {
      "artifact_kind": "object",
      "source_text": "this project",
      "notes": ""
    }
  ],
  "uncertainties": [
    "The mixed span about sitting in the stairwell, shaking, and not answering the text could possibly be split differently.",
    "The moment Dev laughed may be a separate encounter artifact or a sub-part of the call encounter."
  ]
}
```

## Phase 3 Schema Used In All Iterations

To keep the comparison stable, every phase-3 run returns the same top-level shape:

```json
{
  "candidate_references": [
    {
      "reference_type": "",
      "from_source_text": "",
      "to_source_text": "",
      "supporting_text": "",
      "notes": ""
    }
  ],
  "uncertainties": [
    ""
  ]
}
```

By the end of the iteration loop, the intended reference types are:

- `about`
- `involves`
- `participant_in`
- `occurs_in`

## Iteration 1

### Prompt v1

Very loose initial prompt:

- look at the journal entry and the phase-2 JSON
- add candidate references between items when they seem related
- return JSON only

### Phase 3 Output v1

```json
{
  "candidate_references": [
    {
      "reference_type": "about",
      "from_source_text": "I reread Mira's message about the Friday design review",
      "to_source_text": "Mira's message",
      "supporting_text": "I reread Mira's message about the Friday design review",
      "notes": ""
    },
    {
      "reference_type": "about",
      "from_source_text": "felt my stomach knot",
      "to_source_text": "the Friday design review",
      "supporting_text": "I reread Mira's message about the Friday design review and felt my stomach knot",
      "notes": "Likely reaction to the review."
    },
    {
      "reference_type": "participant_in",
      "from_source_text": "Mira",
      "to_source_text": "the call with Mira and Dev",
      "supporting_text": "the call with Mira and Dev",
      "notes": ""
    },
    {
      "reference_type": "participant_in",
      "from_source_text": "Dev",
      "to_source_text": "the call with Mira and Dev",
      "supporting_text": "the call with Mira and Dev",
      "notes": ""
    },
    {
      "reference_type": "occurs_in",
      "from_source_text": "I apologized for missing the mockup deadline",
      "to_source_text": "the call with Mira and Dev",
      "supporting_text": "During the call with Mira and Dev, I apologized for missing the mockup deadline",
      "notes": ""
    },
    {
      "reference_type": "caused_by",
      "from_source_text": "I wanted to cancel the hospital scan next week",
      "to_source_text": "the hospital scan next week",
      "supporting_text": "I wanted to cancel the hospital scan next week",
      "notes": ""
    },
    {
      "reference_type": "laughed_at",
      "from_source_text": "the moment Dev laughed",
      "to_source_text": "the bug on the screen",
      "supporting_text": "I don't know whether he was laughing at me or at the bug on the screen",
      "notes": ""
    }
  ],
  "uncertainties": []
}
```

### Critique v1

- The prompt is too loose.
- It invented unsupported relation types like `caused_by` and `laughed_at`.
- It converted uncertainty into a concrete link.
- It inferred reaction-to-review instead of linking the body state to the nearer message span.
- It missed many obvious references.

### Revision for v2

- fix the schema
- restrict the set of relation types
- forbid turning uncertainty into resolved references

## Iteration 2

### Prompt changes in v2

- allowed `reference_type` values are only `about`, `involves`, `participant_in`, `occurs_in`
- do not invent any other reference types
- if the text is explicitly uncertain, keep that in `uncertainties`

### Phase 3 Output v2

```json
{
  "candidate_references": [
    {
      "reference_type": "about",
      "from_source_text": "I reread Mira's message about the Friday design review",
      "to_source_text": "Mira's message",
      "supporting_text": "I reread Mira's message about the Friday design review",
      "notes": ""
    },
    {
      "reference_type": "about",
      "from_source_text": "Mira's message",
      "to_source_text": "the Friday design review",
      "supporting_text": "Mira's message about the Friday design review",
      "notes": ""
    },
    {
      "reference_type": "about",
      "from_source_text": "I kept thinking I had already disappointed her",
      "to_source_text": "Mira",
      "supporting_text": "I kept thinking I had already disappointed her",
      "notes": ""
    },
    {
      "reference_type": "occurs_in",
      "from_source_text": "I apologized for missing the mockup deadline",
      "to_source_text": "the call with Mira and Dev",
      "supporting_text": "During the call with Mira and Dev, I apologized for missing the mockup deadline",
      "notes": ""
    },
    {
      "reference_type": "about",
      "from_source_text": "I argued with Dev about whether the prototype was even worth showing",
      "to_source_text": "the prototype",
      "supporting_text": "I argued with Dev about whether the prototype was even worth showing",
      "notes": ""
    },
    {
      "reference_type": "about",
      "from_source_text": "I wanted to cancel the hospital scan next week",
      "to_source_text": "the hospital scan next week",
      "supporting_text": "I wanted to cancel the hospital scan next week",
      "notes": ""
    },
    {
      "reference_type": "about",
      "from_source_text": "I don't know whether he was laughing at me or at the bug on the screen",
      "to_source_text": "the bug on the screen",
      "supporting_text": "I don't know whether he was laughing at me or at the bug on the screen",
      "notes": ""
    }
  ],
  "uncertainties": [
    "The text does not support resolving whether Dev was laughing at the author or at the bug on the screen."
  ]
}
```

### Critique v2

- Better, but still too sparse.
- It missed `participant_in` and `involves` links around the call.
- It did not link records to the dinner or ride encounters.
- It still used `about` too broadly without a support rule.

### Revision for v3

- require every reference to be directly supportable by one exact span
- distinguish encounter scoping from topical aboutness

## Iteration 3

### Prompt changes in v3

- every candidate reference must have exactly one exact contiguous `supporting_text`
- use `occurs_in` for record-to-encounter anchoring when the text directly places the record in that encounter
- use `participant_in` for object-to-encounter participation
- use `about` only for explicit topical or object-target mentions

### Phase 3 Output v3

```json
{
  "candidate_references": [
    {
      "reference_type": "about",
      "from_source_text": "I reread Mira's message about the Friday design review",
      "to_source_text": "Mira's message",
      "supporting_text": "I reread Mira's message about the Friday design review",
      "notes": ""
    },
    {
      "reference_type": "about",
      "from_source_text": "Mira's message",
      "to_source_text": "the Friday design review",
      "supporting_text": "Mira's message about the Friday design review",
      "notes": ""
    },
    {
      "reference_type": "participant_in",
      "from_source_text": "Mira",
      "to_source_text": "the call with Mira and Dev",
      "supporting_text": "the call with Mira and Dev",
      "notes": ""
    },
    {
      "reference_type": "participant_in",
      "from_source_text": "Dev",
      "to_source_text": "the call with Mira and Dev",
      "supporting_text": "the call with Mira and Dev",
      "notes": ""
    },
    {
      "reference_type": "occurs_in",
      "from_source_text": "I apologized for missing the mockup deadline",
      "to_source_text": "the call with Mira and Dev",
      "supporting_text": "During the call with Mira and Dev, I apologized for missing the mockup deadline",
      "notes": ""
    },
    {
      "reference_type": "occurs_in",
      "from_source_text": "I argued with Dev about whether the prototype was even worth showing",
      "to_source_text": "the call with Mira and Dev",
      "supporting_text": "During the call with Mira and Dev, I apologized for missing the mockup deadline, and then I argued with Dev about whether the prototype was even worth showing",
      "notes": ""
    },
    {
      "reference_type": "about",
      "from_source_text": "I argued with Dev about whether the prototype was even worth showing",
      "to_source_text": "the prototype",
      "supporting_text": "I argued with Dev about whether the prototype was even worth showing",
      "notes": ""
    },
    {
      "reference_type": "about",
      "from_source_text": "I wanted to cancel the hospital scan next week",
      "to_source_text": "the hospital scan next week",
      "supporting_text": "I wanted to cancel the hospital scan next week",
      "notes": ""
    }
  ],
  "uncertainties": [
    "The text names the moment Dev laughed but does not yet clearly state whether it should be linked as a separate encounter or only as part of the call encounter."
  ]
}
```

### Critique v3

- The support discipline is much better.
- It still misses `involves` links such as the argument involving Dev and the statement directed at the parents.
- It misses later encounter anchoring for dinner and the ride home.
- It does not handle coreferent encounter mentions like `the scan` and `the call`.

### Revision for v4

- allow linking to grouped encounter artifacts using any one of their phase-2 source texts
- add a limited `involves` relation for explicit participants or targets in a record

## Iteration 4

### Prompt changes in v4

- `involves` is allowed for record-to-object or encounter-to-object links when the text explicitly includes the object as a participant or involved item
- the target may be any phase-2 artifact source text or grouped alias within the same artifact
- do not use `about` when `occurs_in` or `involves` is more specific

### Phase 3 Output v4

```json
{
  "candidate_references": [
    {
      "reference_type": "about",
      "from_source_text": "Mira's message",
      "to_source_text": "the Friday design review",
      "supporting_text": "Mira's message about the Friday design review",
      "notes": ""
    },
    {
      "reference_type": "about",
      "from_source_text": "I kept thinking I had already disappointed her",
      "to_source_text": "Mira",
      "supporting_text": "I kept thinking I had already disappointed her",
      "notes": "Coreference to her resolved only because Mira is the only explicit compatible antecedent in the immediately preceding sentence."
    },
    {
      "reference_type": "participant_in",
      "from_source_text": "Mira",
      "to_source_text": "the call with Mira and Dev",
      "supporting_text": "the call with Mira and Dev",
      "notes": ""
    },
    {
      "reference_type": "participant_in",
      "from_source_text": "Dev",
      "to_source_text": "the call with Mira and Dev",
      "supporting_text": "the call with Mira and Dev",
      "notes": ""
    },
    {
      "reference_type": "occurs_in",
      "from_source_text": "I argued with Dev about whether the prototype was even worth showing",
      "to_source_text": "the call with Mira and Dev",
      "supporting_text": "During the call with Mira and Dev, I apologized for missing the mockup deadline, and then I argued with Dev about whether the prototype was even worth showing",
      "notes": ""
    },
    {
      "reference_type": "involves",
      "from_source_text": "I argued with Dev about whether the prototype was even worth showing",
      "to_source_text": "Dev",
      "supporting_text": "I argued with Dev about whether the prototype was even worth showing",
      "notes": ""
    },
    {
      "reference_type": "about",
      "from_source_text": "I argued with Dev about whether the prototype was even worth showing",
      "to_source_text": "the prototype",
      "supporting_text": "I argued with Dev about whether the prototype was even worth showing",
      "notes": ""
    },
    {
      "reference_type": "about",
      "from_source_text": "I also knew the scan wasn't the thing I was really afraid of",
      "to_source_text": "the hospital scan next week",
      "supporting_text": "I also knew the scan wasn't the thing I was really afraid of",
      "notes": "Linked through the grouped artifact containing both the hospital scan next week and the scan."
    }
  ],
  "uncertainties": [
    "The record about not knowing whether he was laughing at the author or at the bug should not be turned into a directional relation."
  ]
}
```

### Critique v4

- Coreference handling improved, but the prompt is still underspecified about encounter scope carrying across adjacent sentences.
- It still misses the dinner and ride-home links.
- It should explain when a previous encounter remains the active context.

### Revision for v5

- add scoped encounter rules
- allow adjacent-sentence carryover only when the discourse anchor is still active and there is no competing encounter

## Iteration 5

### Prompt changes in v5

- if a sentence explicitly establishes an encounter and the immediately following sentence continues the same local scene without introducing a new encounter, records in that sentence may link by `occurs_in`
- do not carry encounter scope across paragraph or scene shifts

### Phase 3 Output v5

```json
{
  "candidate_references": [
    {
      "reference_type": "participant_in",
      "from_source_text": "Mira",
      "to_source_text": "the call with Mira and Dev",
      "supporting_text": "the call with Mira and Dev",
      "notes": ""
    },
    {
      "reference_type": "participant_in",
      "from_source_text": "Dev",
      "to_source_text": "the call with Mira and Dev",
      "supporting_text": "the call with Mira and Dev",
      "notes": ""
    },
    {
      "reference_type": "occurs_in",
      "from_source_text": "I apologized for missing the mockup deadline",
      "to_source_text": "the call with Mira and Dev",
      "supporting_text": "During the call with Mira and Dev, I apologized for missing the mockup deadline",
      "notes": ""
    },
    {
      "reference_type": "occurs_in",
      "from_source_text": "I argued with Dev about whether the prototype was even worth showing",
      "to_source_text": "the call with Mira and Dev",
      "supporting_text": "During the call with Mira and Dev, I apologized for missing the mockup deadline, and then I argued with Dev about whether the prototype was even worth showing",
      "notes": ""
    },
    {
      "reference_type": "participant_in",
      "from_source_text": "my parents",
      "to_source_text": "dinner with my parents",
      "supporting_text": "dinner with my parents",
      "notes": ""
    },
    {
      "reference_type": "participant_in",
      "from_source_text": "my mother",
      "to_source_text": "dinner with my parents",
      "supporting_text": "Later at dinner with my parents, my mother said I looked exhausted",
      "notes": ""
    },
    {
      "reference_type": "occurs_in",
      "from_source_text": "I told them I was fine",
      "to_source_text": "dinner with my parents",
      "supporting_text": "I told them I was fine",
      "notes": "Dinner remains the active local scene."
    },
    {
      "reference_type": "occurs_in",
      "from_source_text": "I could barely swallow",
      "to_source_text": "dinner with my parents",
      "supporting_text": "I could barely swallow",
      "notes": "Dinner remains the active local scene."
    },
    {
      "reference_type": "occurs_in",
      "from_source_text": "I kept replaying the call and the moment Dev laughed",
      "to_source_text": "the ride home",
      "supporting_text": "On the ride home I kept replaying the call and the moment Dev laughed",
      "notes": ""
    }
  ],
  "uncertainties": [
    "The record I wasn't fine may belong to the dinner scene, but the prompt needs a clearer rule for sentence-internal carryover after direct speech."
  ]
}
```

### Critique v5

- Encounter scoping is much stronger now.
- It still does not cover object-to-object aboutness like message to review and proposal to project consistently.
- It missed the direct link from the apology to the mockup deadline and from the stairwell record to the brother's text.

### Revision for v6

- add explicit rules for object-target and topical links
- keep them narrower than free association

## Iteration 6

### Prompt changes in v6

- use `about` when the text explicitly says `about X`, names X as the object of the action, or directly centers X as the topic of the record or artifact
- allow artifact-to-artifact `about`
- do not use `about` just because two items appear in the same sentence

### Phase 3 Output v6

```json
{
  "candidate_references": [
    {
      "reference_type": "about",
      "from_source_text": "I reread Mira's message about the Friday design review",
      "to_source_text": "Mira's message",
      "supporting_text": "I reread Mira's message about the Friday design review",
      "notes": ""
    },
    {
      "reference_type": "about",
      "from_source_text": "Mira's message",
      "to_source_text": "the Friday design review",
      "supporting_text": "Mira's message about the Friday design review",
      "notes": ""
    },
    {
      "reference_type": "about",
      "from_source_text": "I apologized for missing the mockup deadline",
      "to_source_text": "the mockup deadline",
      "supporting_text": "I apologized for missing the mockup deadline",
      "notes": ""
    },
    {
      "reference_type": "involves",
      "from_source_text": "I argued with Dev about whether the prototype was even worth showing",
      "to_source_text": "Dev",
      "supporting_text": "I argued with Dev about whether the prototype was even worth showing",
      "notes": ""
    },
    {
      "reference_type": "about",
      "from_source_text": "I argued with Dev about whether the prototype was even worth showing",
      "to_source_text": "the prototype",
      "supporting_text": "I argued with Dev about whether the prototype was even worth showing",
      "notes": ""
    },
    {
      "reference_type": "about",
      "from_source_text": "I sat in the stairwell shaking and not answering my brother's text",
      "to_source_text": "my brother's text",
      "supporting_text": "I sat in the stairwell shaking and not answering my brother's text",
      "notes": ""
    },
    {
      "reference_type": "about",
      "from_source_text": "I wanted to cancel the hospital scan next week",
      "to_source_text": "the hospital scan next week",
      "supporting_text": "I wanted to cancel the hospital scan next week",
      "notes": ""
    },
    {
      "reference_type": "about",
      "from_source_text": "this project used to make sense",
      "to_source_text": "this project",
      "supporting_text": "this project used to make sense",
      "notes": ""
    }
  ],
  "uncertainties": [
    "The proposal is evidence-seeking about the project, but the text does not explicitly say the proposal itself is about the project."
  ]
}
```

### Critique v6

- The narrower `about` rule helped a lot.
- It correctly avoided linking the proposal artifact to the project artifact directly.
- It still misses the record about replaying the call and the moment Dev laughed as `about` two different encounter artifacts.
- It also misses the dinner link for `I wasn't fine`.

### Revision for v7

- allow multiple references from one record when the text explicitly conjoins multiple targets
- add a rule for sentence-internal carryover from an established encounter

## Iteration 7

### Prompt changes in v7

- one source item may emit multiple references if the sentence explicitly names multiple targets
- if an encounter anchor is established in the immediately preceding sentence and the next sentence continues interaction with the same participants, `occurs_in` is allowed
- do not derive causes, motives, or implicit sub-events

### Phase 3 Output v7

```json
{
  "candidate_references": [
    {
      "reference_type": "occurs_in",
      "from_source_text": "I wasn't fine",
      "to_source_text": "dinner with my parents",
      "supporting_text": "I told them I was fine, but I wasn't fine and I could barely swallow",
      "notes": "Dinner remains the active interaction context from the preceding sentence."
    },
    {
      "reference_type": "occurs_in",
      "from_source_text": "I kept replaying the call and the moment Dev laughed",
      "to_source_text": "the ride home",
      "supporting_text": "On the ride home I kept replaying the call and the moment Dev laughed",
      "notes": ""
    },
    {
      "reference_type": "about",
      "from_source_text": "I kept replaying the call and the moment Dev laughed",
      "to_source_text": "the call",
      "supporting_text": "I kept replaying the call and the moment Dev laughed",
      "notes": ""
    },
    {
      "reference_type": "about",
      "from_source_text": "I kept replaying the call and the moment Dev laughed",
      "to_source_text": "the moment Dev laughed",
      "supporting_text": "I kept replaying the call and the moment Dev laughed",
      "notes": ""
    },
    {
      "reference_type": "involves",
      "from_source_text": "the moment Dev laughed",
      "to_source_text": "Dev",
      "supporting_text": "the moment Dev laughed",
      "notes": ""
    }
  ],
  "uncertainties": [
    "The text still does not justify linking the moment Dev laughed as a sub-event of the call encounter."
  ]
}
```

### Critique v7

- This fixed the multi-target replay record well.
- It needs deduplication guidance so later outputs do not repeat links already found in prior sections of the text.
- It also needs an explicit rule for source order and stable target selection when an artifact has grouped source texts like `the call with Mira and Dev` and `the call`.

### Revision for v8

- add source-order rules
- add grouped-artifact targeting rules
- add duplicate suppression

## Iteration 8

### Prompt changes in v8

- output references in source order of their `from_source_text`
- if the target artifact has grouped source texts, prefer the exact source text named in the supporting span
- do not emit duplicate references that differ only by using another grouped alias for the same target artifact

### Phase 3 Output v8

```json
{
  "candidate_references": [
    {
      "reference_type": "about",
      "from_source_text": "I reread Mira's message about the Friday design review",
      "to_source_text": "Mira's message",
      "supporting_text": "I reread Mira's message about the Friday design review",
      "notes": ""
    },
    {
      "reference_type": "about",
      "from_source_text": "Mira's message",
      "to_source_text": "the Friday design review",
      "supporting_text": "Mira's message about the Friday design review",
      "notes": ""
    },
    {
      "reference_type": "about",
      "from_source_text": "I kept thinking I had already disappointed her",
      "to_source_text": "Mira",
      "supporting_text": "I kept thinking I had already disappointed her",
      "notes": ""
    },
    {
      "reference_type": "participant_in",
      "from_source_text": "Mira",
      "to_source_text": "the call with Mira and Dev",
      "supporting_text": "the call with Mira and Dev",
      "notes": ""
    },
    {
      "reference_type": "participant_in",
      "from_source_text": "Dev",
      "to_source_text": "the call with Mira and Dev",
      "supporting_text": "the call with Mira and Dev",
      "notes": ""
    },
    {
      "reference_type": "occurs_in",
      "from_source_text": "I apologized for missing the mockup deadline",
      "to_source_text": "the call with Mira and Dev",
      "supporting_text": "During the call with Mira and Dev, I apologized for missing the mockup deadline",
      "notes": ""
    },
    {
      "reference_type": "about",
      "from_source_text": "I apologized for missing the mockup deadline",
      "to_source_text": "the mockup deadline",
      "supporting_text": "I apologized for missing the mockup deadline",
      "notes": ""
    },
    {
      "reference_type": "occurs_in",
      "from_source_text": "I argued with Dev about whether the prototype was even worth showing",
      "to_source_text": "the call with Mira and Dev",
      "supporting_text": "During the call with Mira and Dev, I apologized for missing the mockup deadline, and then I argued with Dev about whether the prototype was even worth showing",
      "notes": ""
    },
    {
      "reference_type": "involves",
      "from_source_text": "I argued with Dev about whether the prototype was even worth showing",
      "to_source_text": "Dev",
      "supporting_text": "I argued with Dev about whether the prototype was even worth showing",
      "notes": ""
    },
    {
      "reference_type": "about",
      "from_source_text": "I argued with Dev about whether the prototype was even worth showing",
      "to_source_text": "the prototype",
      "supporting_text": "I argued with Dev about whether the prototype was even worth showing",
      "notes": ""
    }
  ],
  "uncertainties": [
    "The body state felt my stomach knot occurs next to the message rereading, but the text does not explicitly distinguish whether the direct target should be the message or the review."
  ]
}
```

### Critique v8

- Much cleaner.
- It still needs a rule for when a linked reference is acceptable under close local adjacency even without explicit prepositions.
- This is especially relevant for the stomach-knot body state and maybe the dinner body state.

### Revision for v9

- permit carefully limited local-adjacency links
- require a shared clause or immediate coordination, not mere sentence co-occurrence

## Iteration 9

### Prompt changes in v9

- a record may link by `about` to an artifact if they are joined in the same clause or tightly coordinated phrase and the artifact is the most local explicit object of attention
- do not use this rule to infer causes or emotions beyond what the text states

### Phase 3 Output v9

```json
{
  "candidate_references": [
    {
      "reference_type": "about",
      "from_source_text": "felt my stomach knot",
      "to_source_text": "Mira's message",
      "supporting_text": "I reread Mira's message about the Friday design review and felt my stomach knot",
      "notes": "Local coordination supports the message as the immediate object of attention."
    },
    {
      "reference_type": "about",
      "from_source_text": "I wanted to cancel the hospital scan next week",
      "to_source_text": "the hospital scan next week",
      "supporting_text": "I wanted to cancel the hospital scan next week",
      "notes": ""
    },
    {
      "reference_type": "about",
      "from_source_text": "I also knew the scan wasn't the thing I was really afraid of",
      "to_source_text": "the scan",
      "supporting_text": "I also knew the scan wasn't the thing I was really afraid of",
      "notes": ""
    },
    {
      "reference_type": "participant_in",
      "from_source_text": "my parents",
      "to_source_text": "dinner with my parents",
      "supporting_text": "dinner with my parents",
      "notes": ""
    },
    {
      "reference_type": "participant_in",
      "from_source_text": "my mother",
      "to_source_text": "dinner with my parents",
      "supporting_text": "Later at dinner with my parents, my mother said I looked exhausted",
      "notes": ""
    },
    {
      "reference_type": "occurs_in",
      "from_source_text": "I told them I was fine",
      "to_source_text": "dinner with my parents",
      "supporting_text": "I told them I was fine",
      "notes": ""
    },
    {
      "reference_type": "occurs_in",
      "from_source_text": "I wasn't fine",
      "to_source_text": "dinner with my parents",
      "supporting_text": "I told them I was fine, but I wasn't fine and I could barely swallow",
      "notes": ""
    },
    {
      "reference_type": "occurs_in",
      "from_source_text": "I could barely swallow",
      "to_source_text": "dinner with my parents",
      "supporting_text": "I told them I was fine, but I wasn't fine and I could barely swallow",
      "notes": ""
    }
  ],
  "uncertainties": [
    "Using the grouped alias the scan is acceptable here, but final storage may later want normalization to a canonical phase-2 target."
  ]
}
```

### Critique v9

- This catches the hard local-adjacency case well.
- The remaining weakness is output normalization: the target sometimes uses a grouped alias and sometimes the artifact's main mention.
- The prompt should explicitly allow any phase-2 source text as the target string, but it should require consistency within a run.

### Revision for v10

- require stable target naming within a run
- add a final checklist to suppress unsupported or speculative references

## Iteration 10

### Prompt changes in v10

- within one output, use a consistent target string for each phase-2 artifact
- before returning, run a checklist:
  - is the link directly supported
  - is the reference type the narrowest available
  - is the target already present in phase 2
  - is uncertainty preserved rather than collapsed

### Phase 3 Output v10

```json
{
  "candidate_references": [
    {
      "reference_type": "about",
      "from_source_text": "I reread Mira's message about the Friday design review",
      "to_source_text": "Mira's message",
      "supporting_text": "I reread Mira's message about the Friday design review",
      "notes": ""
    },
    {
      "reference_type": "about",
      "from_source_text": "Mira's message",
      "to_source_text": "the Friday design review",
      "supporting_text": "Mira's message about the Friday design review",
      "notes": ""
    },
    {
      "reference_type": "about",
      "from_source_text": "felt my stomach knot",
      "to_source_text": "Mira's message",
      "supporting_text": "I reread Mira's message about the Friday design review and felt my stomach knot",
      "notes": "Local coordination supports the message as the immediate object of attention, without asserting stronger causality."
    },
    {
      "reference_type": "about",
      "from_source_text": "I kept thinking I had already disappointed her",
      "to_source_text": "Mira",
      "supporting_text": "I kept thinking I had already disappointed her",
      "notes": ""
    },
    {
      "reference_type": "participant_in",
      "from_source_text": "Mira",
      "to_source_text": "the call with Mira and Dev",
      "supporting_text": "the call with Mira and Dev",
      "notes": ""
    },
    {
      "reference_type": "participant_in",
      "from_source_text": "Dev",
      "to_source_text": "the call with Mira and Dev",
      "supporting_text": "the call with Mira and Dev",
      "notes": ""
    },
    {
      "reference_type": "occurs_in",
      "from_source_text": "I apologized for missing the mockup deadline",
      "to_source_text": "the call with Mira and Dev",
      "supporting_text": "During the call with Mira and Dev, I apologized for missing the mockup deadline",
      "notes": ""
    },
    {
      "reference_type": "about",
      "from_source_text": "I apologized for missing the mockup deadline",
      "to_source_text": "the mockup deadline",
      "supporting_text": "I apologized for missing the mockup deadline",
      "notes": ""
    },
    {
      "reference_type": "occurs_in",
      "from_source_text": "I argued with Dev about whether the prototype was even worth showing",
      "to_source_text": "the call with Mira and Dev",
      "supporting_text": "During the call with Mira and Dev, I apologized for missing the mockup deadline, and then I argued with Dev about whether the prototype was even worth showing",
      "notes": ""
    },
    {
      "reference_type": "involves",
      "from_source_text": "I argued with Dev about whether the prototype was even worth showing",
      "to_source_text": "Dev",
      "supporting_text": "I argued with Dev about whether the prototype was even worth showing",
      "notes": ""
    },
    {
      "reference_type": "about",
      "from_source_text": "I argued with Dev about whether the prototype was even worth showing",
      "to_source_text": "the prototype",
      "supporting_text": "I argued with Dev about whether the prototype was even worth showing",
      "notes": ""
    },
    {
      "reference_type": "about",
      "from_source_text": "I sat in the stairwell shaking and not answering my brother's text",
      "to_source_text": "my brother's text",
      "supporting_text": "I sat in the stairwell shaking and not answering my brother's text",
      "notes": ""
    },
    {
      "reference_type": "about",
      "from_source_text": "I wanted to cancel the hospital scan next week",
      "to_source_text": "the hospital scan next week",
      "supporting_text": "I wanted to cancel the hospital scan next week",
      "notes": ""
    },
    {
      "reference_type": "about",
      "from_source_text": "I also knew the scan wasn't the thing I was really afraid of",
      "to_source_text": "the hospital scan next week",
      "supporting_text": "I also knew the scan wasn't the thing I was really afraid of",
      "notes": "Linked to the grouped scan artifact while using a consistent target string for the run."
    },
    {
      "reference_type": "participant_in",
      "from_source_text": "my parents",
      "to_source_text": "dinner with my parents",
      "supporting_text": "dinner with my parents",
      "notes": ""
    },
    {
      "reference_type": "participant_in",
      "from_source_text": "my mother",
      "to_source_text": "dinner with my parents",
      "supporting_text": "Later at dinner with my parents, my mother said I looked exhausted",
      "notes": ""
    },
    {
      "reference_type": "occurs_in",
      "from_source_text": "I told them I was fine",
      "to_source_text": "dinner with my parents",
      "supporting_text": "I told them I was fine",
      "notes": "Dinner remains the active local scene."
    },
    {
      "reference_type": "occurs_in",
      "from_source_text": "I wasn't fine",
      "to_source_text": "dinner with my parents",
      "supporting_text": "I told them I was fine, but I wasn't fine and I could barely swallow",
      "notes": "Dinner remains the active local scene."
    },
    {
      "reference_type": "occurs_in",
      "from_source_text": "I could barely swallow",
      "to_source_text": "dinner with my parents",
      "supporting_text": "I told them I was fine, but I wasn't fine and I could barely swallow",
      "notes": "Dinner remains the active local scene."
    },
    {
      "reference_type": "occurs_in",
      "from_source_text": "I kept replaying the call and the moment Dev laughed",
      "to_source_text": "the ride home",
      "supporting_text": "On the ride home I kept replaying the call and the moment Dev laughed",
      "notes": ""
    },
    {
      "reference_type": "about",
      "from_source_text": "I kept replaying the call and the moment Dev laughed",
      "to_source_text": "the call with Mira and Dev",
      "supporting_text": "I kept replaying the call and the moment Dev laughed",
      "notes": "Uses the artifact's consistent target string even though the support span says the call."
    },
    {
      "reference_type": "about",
      "from_source_text": "I kept replaying the call and the moment Dev laughed",
      "to_source_text": "the moment Dev laughed",
      "supporting_text": "I kept replaying the call and the moment Dev laughed",
      "notes": ""
    },
    {
      "reference_type": "involves",
      "from_source_text": "the moment Dev laughed",
      "to_source_text": "Dev",
      "supporting_text": "the moment Dev laughed",
      "notes": ""
    },
    {
      "reference_type": "about",
      "from_source_text": "I don't know whether he was laughing at me or at the bug on the screen",
      "to_source_text": "the bug on the screen",
      "supporting_text": "I don't know whether he was laughing at me or at the bug on the screen",
      "notes": "This captures the explicitly named alternative target without resolving the uncertainty."
    },
    {
      "reference_type": "about",
      "from_source_text": "I opened the old grant proposal again",
      "to_source_text": "the old grant proposal",
      "supporting_text": "I opened the old grant proposal again",
      "notes": ""
    },
    {
      "reference_type": "about",
      "from_source_text": "this project used to make sense",
      "to_source_text": "this project",
      "supporting_text": "this project used to make sense",
      "notes": ""
    }
  ],
  "uncertainties": [
    "The text supports that the author replayed both the call and the moment Dev laughed, but it does not directly support a relation asserting that the moment Dev laughed is part of the call encounter.",
    "The text does not support resolving whether Dev was laughing at the author or at the bug on the screen."
  ]
}
```

### Critique v10

- This is much better.
- The remaining imperfections are acceptable for a recall-oriented unresolved phase.
- The largest remaining open issue is whether phase 3 should allow links from body states like `felt my stomach knot` under local coordination. The current prompt handles that explicitly and conservatively enough.

## What Changed Across The 10 Iterations

The prompt got better when it learned to:

- use a fixed schema
- use a fixed relation inventory
- demand one exact supporting span per link
- separate `about` from `occurs_in` and `participant_in`
- preserve uncertainty instead of collapsing it
- use encounter scope carefully
- handle grouped phase-2 artifact mentions consistently
- avoid causal and motivational inference
- allow multiple links from one source only when the text explicitly names multiple targets
- enforce a final quality checklist

## Final Phase 3 Prompt

```text
You will be given:
1. a journal entry
2. the unresolved phase-2 JSON extracted from that entry

Your task is to add candidate references between the existing phase-2 candidate items.

This is still an unresolved text-only stage.
Do not resolve identities.
Do not add tags.
Do not introduce outside context.
Do not create any new records or artifacts.
Only create candidate references between items that already exist in the phase-2 JSON.

Definitions:
- A candidate reference is a text-supported unresolved link between two existing phase-2 candidate items.
- The source item and target item must be identified only by their exact phase-2 source_text string, or by one exact source_texts string already present for a grouped encounter artifact.

Allowed reference_type values:
- about
- involves
- participant_in
- occurs_in

Do not invent any other reference types.

Reference typing rules:
- about:
  use when the text explicitly indicates that the source item is about, directed at, centered on, rereading, replaying, discussing, questioning, canceling, or otherwise explicitly taking the target item as its object or topic
- involves:
  use when the text explicitly includes the target object as a participant or involved item in the source item, but about / participant_in / occurs_in would be less accurate
- participant_in:
  use for object-to-encounter links when the text directly supports that the object is a participant in that encounter
- occurs_in:
  use for record-to-encounter links when the text directly places that record within the encounter

General rules:
1. Only create references directly supported by the journal text.
2. Preserve uncertainty. If the text presents alternatives, do not collapse them into one resolved relation.
3. Do not infer hidden causality, motives, diagnoses, symbolism, or ontology.
4. Do not create references between items that are merely nearby in the text.
5. Use the narrowest valid reference_type. Prefer occurs_in or participant_in over about when they fit better.
6. A source item may have multiple references only when the text explicitly supports each one.
7. Every candidate_reference must have exactly one supporting_text string.
8. supporting_text must be an exact contiguous span from the journal entry.
9. supporting_text should be the smallest exact span that still clearly supports the reference.
10. Output references in source order of from_source_text.
11. Do not emit duplicate references.
12. Keep notes short, neutral, and factual.
13. If a relation is too uncertain to assert, put that issue in uncertainties instead of forcing a candidate_reference.

Grouped-artifact rules:
1. Some encounter artifacts in phase 2 may contain multiple source_texts strings that refer to the same unresolved artifact.
2. You may use any one of those existing strings as the to_source_text, but stay consistent within a single output.
3. Do not create a new alias that is not already present in the phase-2 JSON.

Encounter-scope rules:
1. Use occurs_in only when the text explicitly places the record in the encounter, or when the immediately following sentence clearly continues the same local scene without introducing a competing encounter.
2. Do not carry encounter scope across a clear scene shift.
3. Do not assume that a remembered sub-episode is part of a larger encounter unless the text directly supports that relation.

Local-adjacency rules:
1. A record may link by about to an artifact when they are in the same clause or tightly coordinated phrase and the artifact is the most local explicit object of attention.
2. Do not use local adjacency to infer stronger causal claims.

Before returning, check every candidate_reference:
- Is the target already present in phase 2?
- Is the link directly supported by the supporting_text?
- Is the chosen reference_type the narrowest available?
- Did I preserve uncertainty rather than resolve it?

Return JSON in exactly this shape:

{
  "candidate_references": [
    {
      "reference_type": "",
      "from_source_text": "",
      "to_source_text": "",
      "supporting_text": "",
      "notes": ""
    }
  ],
  "uncertainties": [
    ""
  ]
}

Return only JSON.
```

## Recommended Final Output For The Sample

Use the `Phase 3 Output v10` block above as the current best output for this sample under the final prompt.
