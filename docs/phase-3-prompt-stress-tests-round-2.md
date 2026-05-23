# Phase 3 Prompt Stress Tests: Round 2

This document performs 10 additional prompt-design iterations for ingestion phase 3.

Baseline used at the start of this round:

- the final phase-3 prompt from [phase-3-prompt-iteration.md](/home/abhirath/Art/anicca/docs/phase-3-prompt-iteration.md)

Method:

- each iteration uses a new journal entry
- each entry is designed to exploit a specific pain point of the current prompt
- each entry gets a fresh phase-2 output
- phase 3 is run using the current prompt as it exists at that point in the round
- the output is criticized
- the prompt is revised only if the case exposes a real weakness

Scope reminder:

- phase 2 only extracts unresolved candidate records and candidate artifacts
- phase 3 only adds unresolved candidate references
- no identities are resolved
- no tags are added
- no outside context is introduced

## Iteration 1

Pain point:

- ambiguous pronoun antecedent with multiple plausible people

Journal entry:

```text
After the meeting with Ava, I reread Elena's note and felt more nervous. On the bus home I kept wondering whether she meant it kindly. I didn't answer the note.
```

Phase 2 output:

```json
{
  "candidate_records": [
    { "process_type": "behaviour", "source_text": "I reread Elena's note", "notes": "" },
    { "process_type": "emotion", "source_text": "felt more nervous", "notes": "" },
    { "process_type": "thought", "source_text": "I kept wondering whether she meant it kindly", "notes": "" },
    { "process_type": "behaviour", "source_text": "I didn't answer the note", "notes": "" }
  ],
  "candidate_artifacts": [
    { "artifact_kind": "encounter", "source_texts": ["the meeting with Ava"], "notes": "" },
    { "artifact_kind": "object", "source_text": "Ava", "notes": "" },
    { "artifact_kind": "object", "source_text": "Elena's note", "notes": "" },
    { "artifact_kind": "object", "source_text": "Elena", "notes": "" },
    { "artifact_kind": "encounter", "source_texts": ["the bus home"], "notes": "" }
  ],
  "uncertainties": []
}
```

Phase 3 output:

```json
{
  "candidate_references": [
    {
      "reference_type": "about",
      "from_source_text": "I reread Elena's note",
      "to_source_text": "Elena's note",
      "supporting_text": "I reread Elena's note",
      "notes": ""
    },
    {
      "reference_type": "about",
      "from_source_text": "felt more nervous",
      "to_source_text": "Elena's note",
      "supporting_text": "I reread Elena's note and felt more nervous",
      "notes": "Local coordination supports the note as the nearest explicit object of attention."
    },
    {
      "reference_type": "occurs_in",
      "from_source_text": "I kept wondering whether she meant it kindly",
      "to_source_text": "the bus home",
      "supporting_text": "On the bus home I kept wondering whether she meant it kindly",
      "notes": ""
    },
    {
      "reference_type": "about",
      "from_source_text": "I kept wondering whether she meant it kindly",
      "to_source_text": "Elena",
      "supporting_text": "I kept wondering whether she meant it kindly",
      "notes": ""
    },
    {
      "reference_type": "about",
      "from_source_text": "I didn't answer the note",
      "to_source_text": "Elena's note",
      "supporting_text": "I didn't answer the note",
      "notes": ""
    }
  ],
  "uncertainties": []
}
```

Critique:

- The prompt still allows an unsupported pronoun resolution.
- `she` could refer to Ava or Elena.
- Phase 3 should not pick one person here.
- The `bus home` scoping is fine.

Prompt delta:

- add a strict antecedent rule:
  - resolve a pronoun target only when there is exactly one locally plausible explicit antecedent in the same sentence or the immediately preceding sentence
  - if two or more plausible antecedents remain, do not emit the pronoun-based candidate reference
  - record the ambiguity in `uncertainties`

## Iteration 2

Pain point:

- active encounter plus recalled encounter in the same sentence

Journal entry:

```text
While I was waiting at the dentist appointment, I kept replaying the fight with Noor from last winter. When the hygienist called my name, I said I was fine, but I was still hearing Noor say, "then leave."
```

Phase 2 output:

```json
{
  "candidate_records": [
    { "process_type": "thought", "source_text": "I kept replaying the fight with Noor from last winter", "notes": "" },
    { "process_type": "behaviour", "source_text": "I said I was fine", "notes": "" },
    { "process_type": "thought", "source_text": "I was still hearing Noor say, \"then leave.\"", "notes": "" }
  ],
  "candidate_artifacts": [
    { "artifact_kind": "encounter", "source_texts": ["the dentist appointment"], "notes": "" },
    { "artifact_kind": "encounter", "source_texts": ["the fight with Noor from last winter"], "notes": "" },
    { "artifact_kind": "object", "source_text": "Noor", "notes": "" }
  ],
  "uncertainties": []
}
```

Phase 3 output:

```json
{
  "candidate_references": [
    {
      "reference_type": "occurs_in",
      "from_source_text": "I kept replaying the fight with Noor from last winter",
      "to_source_text": "the dentist appointment",
      "supporting_text": "While I was waiting at the dentist appointment, I kept replaying the fight with Noor from last winter",
      "notes": ""
    },
    {
      "reference_type": "about",
      "from_source_text": "I kept replaying the fight with Noor from last winter",
      "to_source_text": "the fight with Noor from last winter",
      "supporting_text": "I kept replaying the fight with Noor from last winter",
      "notes": ""
    },
    {
      "reference_type": "occurs_in",
      "from_source_text": "I said I was fine",
      "to_source_text": "the dentist appointment",
      "supporting_text": "When the hygienist called my name, I said I was fine",
      "notes": ""
    },
    {
      "reference_type": "occurs_in",
      "from_source_text": "I was still hearing Noor say, \"then leave.\"",
      "to_source_text": "the fight with Noor from last winter",
      "supporting_text": "I was still hearing Noor say, \"then leave.\"",
      "notes": ""
    }
  ],
  "uncertainties": []
}
```

Critique:

- The last reference is wrong.
- The author is still at the dentist appointment while remembering the fight.
- The thought should `occurs_in` the current encounter and be `about` the past encounter.

Prompt delta:

- add a memory-layering rule:
  - if a record is a present-moment remembering, replaying, imagining, or hearing-again event, anchor it by `occurs_in` to the current scene when that scene is explicit
  - use `about` for the remembered or replayed encounter
  - do not replace the current-scene anchor with the recalled encounter

## Iteration 3

Pain point:

- speech acts with both an addressee and a quoted topic

Journal entry:

```text
At coffee with Lena, I told her, "I can't do the Berlin trip in June." After that I repeated that I couldn't do it.
```

Phase 2 output:

```json
{
  "candidate_records": [
    { "process_type": "behaviour", "source_text": "I told her, \"I can't do the Berlin trip in June.\"", "notes": "" },
    { "process_type": "behaviour", "source_text": "I repeated that I couldn't do it", "notes": "" }
  ],
  "candidate_artifacts": [
    { "artifact_kind": "encounter", "source_texts": ["coffee with Lena"], "notes": "" },
    { "artifact_kind": "object", "source_text": "Lena", "notes": "" },
    { "artifact_kind": "encounter", "source_texts": ["the Berlin trip in June"], "notes": "" }
  ],
  "uncertainties": []
}
```

Phase 3 output:

```json
{
  "candidate_references": [
    {
      "reference_type": "occurs_in",
      "from_source_text": "I told her, \"I can't do the Berlin trip in June.\"",
      "to_source_text": "coffee with Lena",
      "supporting_text": "At coffee with Lena, I told her, \"I can't do the Berlin trip in June.\"",
      "notes": ""
    },
    {
      "reference_type": "about",
      "from_source_text": "I told her, \"I can't do the Berlin trip in June.\"",
      "to_source_text": "the Berlin trip in June",
      "supporting_text": "I told her, \"I can't do the Berlin trip in June.\"",
      "notes": ""
    },
    {
      "reference_type": "occurs_in",
      "from_source_text": "I repeated that I couldn't do it",
      "to_source_text": "coffee with Lena",
      "supporting_text": "After that I repeated that I couldn't do it",
      "notes": "Coffee remains the active local scene."
    }
  ],
  "uncertainties": []
}
```

Critique:

- It missed the addressee.
- It missed the target of `it`.
- The prompt needs better handling for speech acts plus short-distance discourse anaphora.

Prompt delta:

- add a speech-act rule:
  - for speaking records, use `involves` for the explicit addressee when the text names one
  - if quoted or reported content explicitly names a target artifact, the speech act may also be `about` that target
- add a short-distance anaphora rule:
  - if `it`, `that`, `this`, or similar object pronouns clearly point back to one recently named compatible artifact in the same local scene, linking is allowed

## Iteration 4

Pain point:

- collective participants

Journal entry:

```text
In the lab meeting with Priya and the interns, I presented the budget draft. Later Priya messaged me about the draft, but the interns never did.
```

Phase 2 output:

```json
{
  "candidate_records": [
    { "process_type": "behaviour", "source_text": "I presented the budget draft", "notes": "" }
  ],
  "candidate_artifacts": [
    { "artifact_kind": "encounter", "source_texts": ["the lab meeting with Priya and the interns"], "notes": "" },
    { "artifact_kind": "object", "source_text": "Priya", "notes": "" },
    { "artifact_kind": "object", "source_text": "the interns", "notes": "" },
    { "artifact_kind": "object", "source_text": "the budget draft", "notes": "" }
  ],
  "uncertainties": []
}
```

Phase 3 output:

```json
{
  "candidate_references": [
    {
      "reference_type": "participant_in",
      "from_source_text": "Priya",
      "to_source_text": "the lab meeting with Priya and the interns",
      "supporting_text": "the lab meeting with Priya and the interns",
      "notes": ""
    },
    {
      "reference_type": "participant_in",
      "from_source_text": "the interns",
      "to_source_text": "the lab meeting with Priya and the interns",
      "supporting_text": "the lab meeting with Priya and the interns",
      "notes": ""
    },
    {
      "reference_type": "occurs_in",
      "from_source_text": "I presented the budget draft",
      "to_source_text": "the lab meeting with Priya and the interns",
      "supporting_text": "In the lab meeting with Priya and the interns, I presented the budget draft",
      "notes": ""
    },
    {
      "reference_type": "about",
      "from_source_text": "I presented the budget draft",
      "to_source_text": "the budget draft",
      "supporting_text": "I presented the budget draft",
      "notes": ""
    }
  ],
  "uncertainties": []
}
```

Critique:

- The prompt handled this case well.
- No prompt change needed.

Prompt delta:

- none

## Iteration 5

Pain point:

- pronoun target drift across a short object chain

Journal entry:

```text
I drafted a reply to Jonah's email and then stared at it for an hour. I didn't send it.
```

Phase 2 output:

```json
{
  "candidate_records": [
    { "process_type": "behaviour", "source_text": "I drafted a reply to Jonah's email", "notes": "" },
    { "process_type": "behaviour", "source_text": "I stared at it for an hour", "notes": "" },
    { "process_type": "behaviour", "source_text": "I didn't send it", "notes": "" }
  ],
  "candidate_artifacts": [
    { "artifact_kind": "object", "source_text": "a reply to Jonah's email", "notes": "" },
    { "artifact_kind": "object", "source_text": "Jonah's email", "notes": "" },
    { "artifact_kind": "object", "source_text": "Jonah", "notes": "" }
  ],
  "uncertainties": []
}
```

Phase 3 output:

```json
{
  "candidate_references": [
    {
      "reference_type": "about",
      "from_source_text": "I drafted a reply to Jonah's email",
      "to_source_text": "a reply to Jonah's email",
      "supporting_text": "I drafted a reply to Jonah's email",
      "notes": ""
    },
    {
      "reference_type": "about",
      "from_source_text": "a reply to Jonah's email",
      "to_source_text": "Jonah's email",
      "supporting_text": "a reply to Jonah's email",
      "notes": ""
    },
    {
      "reference_type": "about",
      "from_source_text": "I stared at it for an hour",
      "to_source_text": "Jonah's email",
      "supporting_text": "I stared at it for an hour",
      "notes": ""
    },
    {
      "reference_type": "about",
      "from_source_text": "I didn't send it",
      "to_source_text": "Jonah's email",
      "supporting_text": "I didn't send it",
      "notes": ""
    }
  ],
  "uncertainties": []
}
```

Critique:

- The target should be the reply, not the email.
- The prompt needs a stronger preference rule for short object pronouns.

Prompt delta:

- strengthen the short-distance anaphora rule:
  - when multiple compatible artifacts are nearby, prefer the most recently introduced compatible artifact that the surrounding verb naturally selects
  - if no unique best target exists, emit no pronoun-based reference and record the issue in `uncertainties`

## Iteration 6

Pain point:

- contrastive focus markers like `only`

Journal entry:

```text
I spread out the checklist, the calendar, and the train ticket on the table. Only the ticket made my hands shake. I put the calendar away.
```

Phase 2 output:

```json
{
  "candidate_records": [
    { "process_type": "behaviour", "source_text": "I spread out the checklist, the calendar, and the train ticket on the table", "notes": "" },
    { "process_type": "body", "source_text": "made my hands shake", "notes": "" },
    { "process_type": "behaviour", "source_text": "I put the calendar away", "notes": "" }
  ],
  "candidate_artifacts": [
    { "artifact_kind": "object", "source_text": "the checklist", "notes": "" },
    { "artifact_kind": "object", "source_text": "the calendar", "notes": "" },
    { "artifact_kind": "object", "source_text": "the train ticket", "notes": "" }
  ],
  "uncertainties": []
}
```

Phase 3 output:

```json
{
  "candidate_references": [
    {
      "reference_type": "about",
      "from_source_text": "I spread out the checklist, the calendar, and the train ticket on the table",
      "to_source_text": "the checklist",
      "supporting_text": "I spread out the checklist, the calendar, and the train ticket on the table",
      "notes": ""
    },
    {
      "reference_type": "about",
      "from_source_text": "I spread out the checklist, the calendar, and the train ticket on the table",
      "to_source_text": "the calendar",
      "supporting_text": "I spread out the checklist, the calendar, and the train ticket on the table",
      "notes": ""
    },
    {
      "reference_type": "about",
      "from_source_text": "I spread out the checklist, the calendar, and the train ticket on the table",
      "to_source_text": "the train ticket",
      "supporting_text": "I spread out the checklist, the calendar, and the train ticket on the table",
      "notes": ""
    },
    {
      "reference_type": "about",
      "from_source_text": "made my hands shake",
      "to_source_text": "the checklist",
      "supporting_text": "Only the ticket made my hands shake",
      "notes": ""
    },
    {
      "reference_type": "about",
      "from_source_text": "made my hands shake",
      "to_source_text": "the calendar",
      "supporting_text": "Only the ticket made my hands shake",
      "notes": ""
    },
    {
      "reference_type": "about",
      "from_source_text": "made my hands shake",
      "to_source_text": "the train ticket",
      "supporting_text": "Only the ticket made my hands shake",
      "notes": ""
    },
    {
      "reference_type": "about",
      "from_source_text": "I put the calendar away",
      "to_source_text": "the calendar",
      "supporting_text": "I put the calendar away",
      "notes": ""
    }
  ],
  "uncertainties": []
}
```

Critique:

- The body-state reference exploded onto all listed objects.
- `Only` should sharply restrict the target.

Prompt delta:

- add a contrastive-focus rule:
  - if the supporting text uses markers such as `only`, `just`, `exactly`, or an explicit contrast, link only the focused target
  - do not spread that reference to other items from the nearby list

## Iteration 7

Pain point:

- carrier object versus embedded topic

Journal entry:

```text
I folded the note about the hearing on Tuesday and put it in my bag. I couldn't stop imagining the hearing.
```

Phase 2 output:

```json
{
  "candidate_records": [
    { "process_type": "behaviour", "source_text": "I folded the note about the hearing on Tuesday", "notes": "" },
    { "process_type": "thought", "source_text": "I couldn't stop imagining the hearing", "notes": "" }
  ],
  "candidate_artifacts": [
    { "artifact_kind": "object", "source_text": "the note about the hearing on Tuesday", "notes": "" },
    { "artifact_kind": "encounter", "source_texts": ["the hearing on Tuesday", "the hearing"], "notes": "" }
  ],
  "uncertainties": []
}
```

Phase 3 output:

```json
{
  "candidate_references": [
    {
      "reference_type": "about",
      "from_source_text": "the note about the hearing on Tuesday",
      "to_source_text": "the hearing on Tuesday",
      "supporting_text": "the note about the hearing on Tuesday",
      "notes": ""
    },
    {
      "reference_type": "about",
      "from_source_text": "I folded the note about the hearing on Tuesday",
      "to_source_text": "the hearing on Tuesday",
      "supporting_text": "I folded the note about the hearing on Tuesday",
      "notes": ""
    },
    {
      "reference_type": "about",
      "from_source_text": "I couldn't stop imagining the hearing",
      "to_source_text": "the hearing on Tuesday",
      "supporting_text": "I couldn't stop imagining the hearing",
      "notes": ""
    }
  ],
  "uncertainties": []
}
```

Critique:

- The folded-object record should target the note, not the hearing.
- The note artifact itself can be `about` the hearing.
- The prompt needs a carrier-versus-topic rule.

Prompt delta:

- add a carrier-specificity rule:
  - if a source record acts directly on a carrier object such as a note, message, draft, page, or photo that itself contains an embedded topic, prefer the carrier object as the direct `about` target
  - use artifact-to-artifact `about` for the carrier object's relation to the embedded topic when that topic is explicitly named

## Iteration 8

Pain point:

- explicit alternatives inside uncertainty statements

Journal entry:

```text
All evening I kept wondering whether Maya ignored the invitation or whether the invitation never sent. I reopened the invitation twice.
```

Phase 2 output:

```json
{
  "candidate_records": [
    { "process_type": "thought", "source_text": "I kept wondering whether Maya ignored the invitation or whether the invitation never sent", "notes": "" },
    { "process_type": "behaviour", "source_text": "I reopened the invitation twice", "notes": "" }
  ],
  "candidate_artifacts": [
    { "artifact_kind": "object", "source_text": "Maya", "notes": "" },
    { "artifact_kind": "object", "source_text": "the invitation", "notes": "" }
  ],
  "uncertainties": []
}
```

Phase 3 output:

```json
{
  "candidate_references": [
    {
      "reference_type": "about",
      "from_source_text": "I kept wondering whether Maya ignored the invitation or whether the invitation never sent",
      "to_source_text": "the invitation",
      "supporting_text": "I kept wondering whether Maya ignored the invitation or whether the invitation never sent",
      "notes": ""
    },
    {
      "reference_type": "about",
      "from_source_text": "I reopened the invitation twice",
      "to_source_text": "the invitation",
      "supporting_text": "I reopened the invitation twice",
      "notes": ""
    }
  ],
  "uncertainties": [
    "The wondering record contains alternatives, but the current prompt does not clearly say whether explicit alternative people may also receive about-links."
  ]
}
```

Critique:

- The thought is explicitly about both Maya and the invitation.
- The prompt is too conservative here.
- It should allow `about` links to each explicit alternative target while still preserving proposition-level uncertainty.

Prompt delta:

- add an alternatives rule:
  - if a thought or speech record explicitly names multiple alternative targets, `about` links may be emitted to each named target
  - preserve the unresolved proposition itself in `uncertainties`
  - do not convert the alternatives into resolved event claims

## Iteration 9

Pain point:

- rapid scene shifts in adjacent sentences

Journal entry:

```text
At breakfast with Theo I promised I would call the bank. On the elevator ride up, I decided I wouldn't call today. At therapy I admitted I was relieved to have an excuse.
```

Phase 2 output:

```json
{
  "candidate_records": [
    { "process_type": "behaviour", "source_text": "I promised I would call the bank", "notes": "" },
    { "process_type": "thought", "source_text": "I decided I wouldn't call today", "notes": "" },
    { "process_type": "behaviour", "source_text": "I admitted I was relieved to have an excuse", "notes": "" }
  ],
  "candidate_artifacts": [
    { "artifact_kind": "encounter", "source_texts": ["breakfast with Theo"], "notes": "" },
    { "artifact_kind": "object", "source_text": "Theo", "notes": "" },
    { "artifact_kind": "object", "source_text": "the bank", "notes": "" },
    { "artifact_kind": "encounter", "source_texts": ["the elevator ride up"], "notes": "" },
    { "artifact_kind": "encounter", "source_texts": ["therapy"], "notes": "" }
  ],
  "uncertainties": []
}
```

Phase 3 output:

```json
{
  "candidate_references": [
    {
      "reference_type": "participant_in",
      "from_source_text": "Theo",
      "to_source_text": "breakfast with Theo",
      "supporting_text": "breakfast with Theo",
      "notes": ""
    },
    {
      "reference_type": "occurs_in",
      "from_source_text": "I promised I would call the bank",
      "to_source_text": "breakfast with Theo",
      "supporting_text": "At breakfast with Theo I promised I would call the bank",
      "notes": ""
    },
    {
      "reference_type": "about",
      "from_source_text": "I promised I would call the bank",
      "to_source_text": "the bank",
      "supporting_text": "I promised I would call the bank",
      "notes": ""
    },
    {
      "reference_type": "occurs_in",
      "from_source_text": "I decided I wouldn't call today",
      "to_source_text": "breakfast with Theo",
      "supporting_text": "On the elevator ride up, I decided I wouldn't call today",
      "notes": ""
    },
    {
      "reference_type": "occurs_in",
      "from_source_text": "I admitted I was relieved to have an excuse",
      "to_source_text": "the elevator ride up",
      "supporting_text": "At therapy I admitted I was relieved to have an excuse",
      "notes": ""
    }
  ],
  "uncertainties": []
}
```

Critique:

- The scene anchors bled across sentence boundaries.
- Preposed phrases like `On the elevator ride up` and `At therapy` should reset the active encounter immediately.

Prompt delta:

- strengthen the scene-reset rule:
  - explicit scene-setting phrases such as `at X`, `on X`, `during X`, `later at X`, `after that`, and similar reset the active encounter context immediately
  - once a new explicit encounter anchor appears, do not continue the previous encounter scope

## Iteration 10

Pain point:

- appositive role labels that probably co-refer, but phase 3 must not resolve identity

Journal entry:

```text
During the meeting with Dr. Sen, my supervisor, I asked about the fellowship application. Later I emailed my supervisor again because I couldn't tell if the application was missing the budget page or the signature page.
```

Phase 2 output:

```json
{
  "candidate_records": [
    { "process_type": "behaviour", "source_text": "I asked about the fellowship application", "notes": "" },
    { "process_type": "behaviour", "source_text": "I emailed my supervisor again", "notes": "" },
    { "process_type": "thought", "source_text": "I couldn't tell if the application was missing the budget page or the signature page", "notes": "" }
  ],
  "candidate_artifacts": [
    { "artifact_kind": "encounter", "source_texts": ["the meeting with Dr. Sen"], "notes": "" },
    { "artifact_kind": "object", "source_text": "Dr. Sen", "notes": "" },
    { "artifact_kind": "object", "source_text": "my supervisor", "notes": "" },
    { "artifact_kind": "object", "source_text": "the fellowship application", "notes": "" },
    { "artifact_kind": "object", "source_text": "the budget page", "notes": "" },
    { "artifact_kind": "object", "source_text": "the signature page", "notes": "" }
  ],
  "uncertainties": []
}
```

Phase 3 output:

```json
{
  "candidate_references": [
    {
      "reference_type": "participant_in",
      "from_source_text": "Dr. Sen",
      "to_source_text": "the meeting with Dr. Sen",
      "supporting_text": "the meeting with Dr. Sen",
      "notes": ""
    },
    {
      "reference_type": "occurs_in",
      "from_source_text": "I asked about the fellowship application",
      "to_source_text": "the meeting with Dr. Sen",
      "supporting_text": "During the meeting with Dr. Sen, my supervisor, I asked about the fellowship application",
      "notes": ""
    },
    {
      "reference_type": "about",
      "from_source_text": "I asked about the fellowship application",
      "to_source_text": "the fellowship application",
      "supporting_text": "I asked about the fellowship application",
      "notes": ""
    },
    {
      "reference_type": "involves",
      "from_source_text": "I emailed my supervisor again",
      "to_source_text": "my supervisor",
      "supporting_text": "I emailed my supervisor again",
      "notes": ""
    },
    {
      "reference_type": "about",
      "from_source_text": "I couldn't tell if the application was missing the budget page or the signature page",
      "to_source_text": "the fellowship application",
      "supporting_text": "I couldn't tell if the application was missing the budget page or the signature page",
      "notes": ""
    },
    {
      "reference_type": "about",
      "from_source_text": "I couldn't tell if the application was missing the budget page or the signature page",
      "to_source_text": "the budget page",
      "supporting_text": "I couldn't tell if the application was missing the budget page or the signature page",
      "notes": ""
    },
    {
      "reference_type": "about",
      "from_source_text": "I couldn't tell if the application was missing the budget page or the signature page",
      "to_source_text": "the signature page",
      "supporting_text": "I couldn't tell if the application was missing the budget page or the signature page",
      "notes": ""
    }
  ],
  "uncertainties": [
    "The text suggests that Dr. Sen and my supervisor may co-refer, but phase 3 should not resolve that identity."
  ]
}
```

Critique:

- This is mostly correct.
- The prompt should make the non-resolution behavior explicit for appositive aliases so future outputs do not silently collapse them.

Prompt delta:

- add an appositive non-resolution rule:
  - if two phase-2 artifacts appear in apposition or role-label form and likely co-refer, phase 3 may link each one independently where the text explicitly supports it
  - phase 3 must not merge them, replace one with the other, or invent an identity relation
  - if the likely co-reference matters, note it in `uncertainties`

## Retained Changes From Round 2

These new prompt changes survived the stress tests:

- strict pronoun antecedent rule
- memory-layering rule for present scene versus recalled scene
- speech-act addressee rule
- stronger short-distance anaphora rule for object pronouns
- contrastive-focus rule
- carrier-specificity rule
- alternatives rule for explicit uncertainty statements
- stronger scene-reset rule
- appositive non-resolution rule

The collective-participant case did not require a new rule.

## Final Prompt After Round 2

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

Pronoun and anaphora rules:
1. Resolve a pronoun target only when there is exactly one locally plausible explicit antecedent in the same sentence or the immediately preceding sentence.
2. If two or more plausible antecedents remain, do not emit the pronoun-based reference; record the ambiguity in uncertainties.
3. For short object pronouns such as it, this, that, or them, prefer the most recently introduced compatible artifact that the surrounding verb naturally selects.
4. If no unique best target exists, do not emit the pronoun-based reference.

Encounter-scope rules:
1. Use occurs_in only when the text explicitly places the record in the encounter, or when the immediately following sentence clearly continues the same local scene without introducing a competing encounter.
2. Explicit scene-setting phrases such as at X, on X, during X, later at X, and after that reset the active encounter context immediately.
3. Do not carry encounter scope across a clear scene shift.
4. Do not assume that a remembered sub-episode is part of a larger encounter unless the text directly supports that relation.

Memory-layering rules:
1. If a record is a present-moment remembering, replaying, imagining, or hearing-again event, anchor it by occurs_in to the current explicit scene when one is present.
2. Use about for the remembered or replayed encounter, object, or person.
3. Do not replace the current-scene anchor with the recalled encounter.

Speech-act rules:
1. For speaking records, use involves for the explicit addressee when the text names one.
2. If quoted or reported content explicitly names a target artifact, the speaking record may also be about that target.

Local-adjacency rules:
1. A record may link by about to an artifact when they are in the same clause or tightly coordinated phrase and the artifact is the most local explicit object of attention.
2. Do not use local adjacency to infer stronger causal claims.

Contrastive-focus rules:
1. If the supporting text uses markers such as only, just, exactly, or an explicit contrast, link only the focused target.
2. Do not spread that reference to other items from a nearby list.

Carrier-specificity rules:
1. If a source record acts directly on a carrier object such as a note, message, draft, page, or photo that itself contains an embedded topic, prefer the carrier object as the direct about target.
2. Use artifact-to-artifact about for the carrier object's relation to the embedded topic when that topic is explicitly named.

Alternatives rules:
1. If a thought or speech record explicitly names multiple alternative targets, about links may be emitted to each named target.
2. Preserve the unresolved proposition itself in uncertainties.
3. Do not convert alternatives into resolved event claims.

Appositive non-resolution rules:
1. If two phase-2 artifacts appear in apposition or role-label form and likely co-refer, phase 3 may link each one independently where the text explicitly supports it.
2. Phase 3 must not merge them, replace one with the other, or invent an identity relation.
3. If the likely co-reference matters, note it in uncertainties.

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

## Bottom Line

After this second stress-test round, the prompt is in a better place than after the first 10 iterations.

The largest improvements came from forcing clearer behavior around:

- ambiguous pronouns
- current scene versus remembered scene
- speech acts with addressees and quoted topics
- short pronoun chains
- contrastive focus
- carrier objects versus embedded topics
- explicit alternatives
- rapid scene resets
- likely co-referring appositives that phase 3 still must not resolve

If we continue iterating after this, the best next step is not more hand-designed prompt changes.
The best next step is a small evaluation set with success and failure counts.
