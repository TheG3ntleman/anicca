# Phase 3 Prompt Stress Tests: Round 3

This document redesigns phase 3 around a more flexible reference model.

New direction for this round:

- phase 3 reference labels are fully flexible
- phase 3 references link candidate objects to candidate objects, not text spans to text spans
- every reference must still be directly supported by exact journal text
- if a reference requires unresolved interpretation, it may still be emitted, but it must be marked `ambiguous`

This round performs 10 new prompt revisions using 10 new texts and 10 new phase-2 outputs.

## Core Schema For This Round

Phase 2 input now includes stable candidate IDs. These are local unresolved IDs inside `intermediate format-1`.

Example shape:

```json
{
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
}
```

Phase 3 output for this round:

```json
{
  "candidate_references": [
    {
      "from_candidate_id": "",
      "to_candidate_id": "",
      "relation_label": "",
      "relation_status": "explicit",
      "supporting_text": "",
      "notes": ""
    }
  ],
  "uncertainties": [""]
}
```

Allowed `relation_status` values:

- `explicit`
- `ambiguous`

Meaning:

- `explicit`: the candidate pairing and relation label are directly supported by the text with minimal or no interpretive leap
- `ambiguous`: the text still directly connects the candidates somehow, but the relation label, target choice, direction, or scope requires unresolved interpretation

## Initial Prompt v1

```text
You will be given:
1. a journal entry
2. unresolved phase-2 JSON containing candidate_records and candidate_artifacts with stable candidate_id values

Your task is to add candidate references between the existing phase-2 candidates.

This is still an unresolved text-only stage.
Do not resolve identities.
Do not add tags.
Do not introduce outside context.
Do not create any new records or artifacts.

References connect candidates to candidates, not text to text.

Use a flexible relation_label.
Do not restrict yourself to a fixed ontology.
Use exact journal text as support.
If the relation requires interpretation beyond what is plainly stated, set relation_status to ambiguous.

Return JSON only in this shape:

{
  "candidate_references": [
    {
      "from_candidate_id": "",
      "to_candidate_id": "",
      "relation_label": "",
      "relation_status": "explicit",
      "supporting_text": "",
      "notes": ""
    }
  ],
  "uncertainties": [""]
}
```

## Iteration 1

Pain point:

- flexible labels drift into abstract ontology words instead of staying text-near

Journal entry:

```text
Before bed I reread Elena's note about the appeal.
```

Phase 2 output:

```json
{
  "candidate_records": [
    { "candidate_id": "r1", "process_type": "behaviour", "source_text": "I reread Elena's note about the appeal", "notes": "" }
  ],
  "candidate_artifacts": [
    { "candidate_id": "a1", "artifact_kind": "object", "source_text": "Elena's note", "notes": "" },
    { "candidate_id": "a2", "artifact_kind": "encounter", "source_texts": ["the appeal"], "notes": "" },
    { "candidate_id": "a3", "artifact_kind": "object", "source_text": "Elena", "notes": "" }
  ],
  "uncertainties": []
}
```

Phase 3 output v1:

```json
{
  "candidate_references": [
    {
      "from_candidate_id": "r1",
      "to_candidate_id": "a1",
      "relation_label": "consulted",
      "relation_status": "explicit",
      "supporting_text": "I reread Elena's note about the appeal",
      "notes": ""
    },
    {
      "from_candidate_id": "a1",
      "to_candidate_id": "a2",
      "relation_label": "topic",
      "relation_status": "explicit",
      "supporting_text": "Elena's note about the appeal",
      "notes": ""
    }
  ],
  "uncertainties": []
}
```

Critique:

- The labels are already drifting away from the text.
- `consulted` and `topic` are ontology-ish abstractions.
- For this phase, labels should stay as close to the wording as possible.

Prompt delta:

- relation_label should be the smallest text-near phrase that can stand alone
- prefer exact surface wording from the supporting text when possible
- if a more abstract label is used, mark the reference `ambiguous`

## Iteration 2

Pain point:

- carrier object versus embedded topic

Journal entry:

```text
I folded the note about the hearing on Tuesday and put it in my bag.
```

Phase 2 output:

```json
{
  "candidate_records": [
    { "candidate_id": "r1", "process_type": "behaviour", "source_text": "I folded the note about the hearing on Tuesday", "notes": "" }
  ],
  "candidate_artifacts": [
    { "candidate_id": "a1", "artifact_kind": "object", "source_text": "the note about the hearing on Tuesday", "notes": "" },
    { "candidate_id": "a2", "artifact_kind": "encounter", "source_texts": ["the hearing on Tuesday"], "notes": "" }
  ],
  "uncertainties": []
}
```

Phase 3 output v2:

```json
{
  "candidate_references": [
    {
      "from_candidate_id": "r1",
      "to_candidate_id": "a2",
      "relation_label": "about",
      "relation_status": "explicit",
      "supporting_text": "I folded the note about the hearing on Tuesday",
      "notes": ""
    },
    {
      "from_candidate_id": "a1",
      "to_candidate_id": "a2",
      "relation_label": "about",
      "relation_status": "explicit",
      "supporting_text": "the note about the hearing on Tuesday",
      "notes": ""
    }
  ],
  "uncertainties": []
}
```

Critique:

- The artifact-to-artifact link is good.
- The record-to-artifact link is wrong.
- The record acts on the carrier object, not directly on the hearing.

Prompt delta:

- when a record acts directly on a carrier object such as a note, message, draft, page, or photo, prefer the carrier object as the direct target
- if the carrier object explicitly names an embedded topic, that topic may receive a separate artifact-to-artifact reference

## Iteration 3

Pain point:

- ambiguous pronoun antecedent should stay ambiguous, not silently resolved

Journal entry:

```text
After the meeting with Ava, I reread Elena's note. On the bus home I kept wondering whether she meant it kindly.
```

Phase 2 output:

```json
{
  "candidate_records": [
    { "candidate_id": "r1", "process_type": "behaviour", "source_text": "I reread Elena's note", "notes": "" },
    { "candidate_id": "r2", "process_type": "thought", "source_text": "I kept wondering whether she meant it kindly", "notes": "" }
  ],
  "candidate_artifacts": [
    { "candidate_id": "a1", "artifact_kind": "encounter", "source_texts": ["the meeting with Ava"], "notes": "" },
    { "candidate_id": "a2", "artifact_kind": "object", "source_text": "Ava", "notes": "" },
    { "candidate_id": "a3", "artifact_kind": "object", "source_text": "Elena's note", "notes": "" },
    { "candidate_id": "a4", "artifact_kind": "object", "source_text": "Elena", "notes": "" },
    { "candidate_id": "a5", "artifact_kind": "encounter", "source_texts": ["the bus home"], "notes": "" }
  ],
  "uncertainties": []
}
```

Phase 3 output v3:

```json
{
  "candidate_references": [
    {
      "from_candidate_id": "r1",
      "to_candidate_id": "a3",
      "relation_label": "reread",
      "relation_status": "explicit",
      "supporting_text": "I reread Elena's note",
      "notes": ""
    },
    {
      "from_candidate_id": "r2",
      "to_candidate_id": "a5",
      "relation_label": "on",
      "relation_status": "explicit",
      "supporting_text": "On the bus home I kept wondering whether she meant it kindly",
      "notes": ""
    },
    {
      "from_candidate_id": "r2",
      "to_candidate_id": "a4",
      "relation_label": "wondering whether she meant it kindly",
      "relation_status": "explicit",
      "supporting_text": "I kept wondering whether she meant it kindly",
      "notes": ""
    }
  ],
  "uncertainties": []
}
```

Critique:

- The link to Elena is too confident.
- `she` could refer to Ava or Elena.
- Suppressing the relation entirely would lose recall, but resolving it is too strong.

Prompt delta:

- if a pronoun has multiple locally plausible antecedents, emit one candidate reference per plausible target and mark each one `ambiguous`
- use notes or uncertainties to state that antecedent resolution remains unresolved

## Iteration 4

Pain point:

- current scene and remembered scene both matter

Journal entry:

```text
While I was waiting at the dentist appointment, I kept replaying the fight with Noor from last winter.
```

Phase 2 output:

```json
{
  "candidate_records": [
    { "candidate_id": "r1", "process_type": "thought", "source_text": "I kept replaying the fight with Noor from last winter", "notes": "" }
  ],
  "candidate_artifacts": [
    { "candidate_id": "a1", "artifact_kind": "encounter", "source_texts": ["the dentist appointment"], "notes": "" },
    { "candidate_id": "a2", "artifact_kind": "encounter", "source_texts": ["the fight with Noor from last winter"], "notes": "" },
    { "candidate_id": "a3", "artifact_kind": "object", "source_text": "Noor", "notes": "" }
  ],
  "uncertainties": []
}
```

Phase 3 output v4:

```json
{
  "candidate_references": [
    {
      "from_candidate_id": "r1",
      "to_candidate_id": "a2",
      "relation_label": "replaying",
      "relation_status": "explicit",
      "supporting_text": "I kept replaying the fight with Noor from last winter",
      "notes": ""
    }
  ],
  "uncertainties": []
}
```

Critique:

- This loses the present scene.
- The record is happening during the dentist appointment and is about the fight.

Prompt delta:

- one source candidate may emit multiple references when the text directly supports multiple distinct links
- for present-moment memory or replay records, keep the current scene link and the remembered target link if both are explicit

## Iteration 5

Pain point:

- record-to-record links are necessary

Journal entry:

```text
I snapped at Theo in the kitchen. An hour later I apologized for it.
```

Phase 2 output:

```json
{
  "candidate_records": [
    { "candidate_id": "r1", "process_type": "behaviour", "source_text": "I snapped at Theo in the kitchen", "notes": "" },
    { "candidate_id": "r2", "process_type": "behaviour", "source_text": "I apologized for it", "notes": "" }
  ],
  "candidate_artifacts": [
    { "candidate_id": "a1", "artifact_kind": "object", "source_text": "Theo", "notes": "" },
    { "candidate_id": "a2", "artifact_kind": "object", "source_text": "the kitchen", "notes": "" }
  ],
  "uncertainties": []
}
```

Phase 3 output v5:

```json
{
  "candidate_references": [
    {
      "from_candidate_id": "r1",
      "to_candidate_id": "a1",
      "relation_label": "at",
      "relation_status": "explicit",
      "supporting_text": "I snapped at Theo in the kitchen",
      "notes": ""
    },
    {
      "from_candidate_id": "r1",
      "to_candidate_id": "a2",
      "relation_label": "in",
      "relation_status": "explicit",
      "supporting_text": "I snapped at Theo in the kitchen",
      "notes": ""
    },
    {
      "from_candidate_id": "r2",
      "to_candidate_id": "a1",
      "relation_label": "apologized to",
      "relation_status": "ambiguous",
      "supporting_text": "I apologized for it",
      "notes": "Theo is a plausible target, but the text explicitly says only for it."
    }
  ],
  "uncertainties": []
}
```

Critique:

- The apology is explicitly linked to the earlier action, not directly to Theo.
- This is where candidate-to-candidate references matter.

Prompt delta:

- references may connect any candidate types, including record-to-record, if the text directly supports the link
- when a later record explicitly points back to an earlier record or event-like candidate, prefer that candidate as the target

## Iteration 6

Pain point:

- relation labels must preserve negation when the relation itself is negated

Journal entry:

```text
I drafted a reply to Jonah's email, but I didn't send it.
```

Phase 2 output:

```json
{
  "candidate_records": [
    { "candidate_id": "r1", "process_type": "behaviour", "source_text": "I drafted a reply to Jonah's email", "notes": "" },
    { "candidate_id": "r2", "process_type": "behaviour", "source_text": "I didn't send it", "notes": "" }
  ],
  "candidate_artifacts": [
    { "candidate_id": "a1", "artifact_kind": "object", "source_text": "a reply to Jonah's email", "notes": "" },
    { "candidate_id": "a2", "artifact_kind": "object", "source_text": "Jonah's email", "notes": "" },
    { "candidate_id": "a3", "artifact_kind": "object", "source_text": "Jonah", "notes": "" }
  ],
  "uncertainties": []
}
```

Phase 3 output v6:

```json
{
  "candidate_references": [
    {
      "from_candidate_id": "r1",
      "to_candidate_id": "a1",
      "relation_label": "drafted",
      "relation_status": "explicit",
      "supporting_text": "I drafted a reply to Jonah's email",
      "notes": ""
    },
    {
      "from_candidate_id": "a1",
      "to_candidate_id": "a2",
      "relation_label": "to",
      "relation_status": "explicit",
      "supporting_text": "a reply to Jonah's email",
      "notes": ""
    },
    {
      "from_candidate_id": "r2",
      "to_candidate_id": "a1",
      "relation_label": "send",
      "relation_status": "explicit",
      "supporting_text": "I didn't send it",
      "notes": ""
    }
  ],
  "uncertainties": []
}
```

Critique:

- The last relation drops the negation.
- That changes the meaning.

Prompt delta:

- preserve negation inside relation_label when the relation itself is negated
- do not silently normalize `didn't send`, `wasn't with`, `never called`, and similar forms into positive labels

## Iteration 7

Pain point:

- short object-pronoun chains need verb-sensitive targeting

Journal entry:

```text
I drafted a reply to Jonah's email and then stared at it for an hour.
```

Phase 2 output:

```json
{
  "candidate_records": [
    { "candidate_id": "r1", "process_type": "behaviour", "source_text": "I drafted a reply to Jonah's email", "notes": "" },
    { "candidate_id": "r2", "process_type": "behaviour", "source_text": "I stared at it for an hour", "notes": "" }
  ],
  "candidate_artifacts": [
    { "candidate_id": "a1", "artifact_kind": "object", "source_text": "a reply to Jonah's email", "notes": "" },
    { "candidate_id": "a2", "artifact_kind": "object", "source_text": "Jonah's email", "notes": "" }
  ],
  "uncertainties": []
}
```

Phase 3 output v7:

```json
{
  "candidate_references": [
    {
      "from_candidate_id": "r2",
      "to_candidate_id": "a2",
      "relation_label": "stared at",
      "relation_status": "ambiguous",
      "supporting_text": "I stared at it for an hour",
      "notes": "It could refer to the email or the drafted reply."
    }
  ],
  "uncertainties": []
}
```

Critique:

- Marking this ambiguous is better than resolving it wrongly.
- But the better local target is the reply, because it is the most recent compatible artifact and the more natural object of `drafted ... then stared at it`.
- The prompt should prefer the strongest local candidate while still allowing ambiguity when necessary.

Prompt delta:

- for short object pronouns, prefer the most recent compatible candidate that the surrounding verb naturally selects
- if another candidate remains plausibly available, either emit both as `ambiguous` or keep the stronger target as `explicit` only when the preference is strong and local

## Iteration 8

Pain point:

- speech acts can support multiple distinct relations at once

Journal entry:

```text
At coffee with Lena, I told her, "I can't do the Berlin trip in June." After that I repeated it.
```

Phase 2 output:

```json
{
  "candidate_records": [
    { "candidate_id": "r1", "process_type": "behaviour", "source_text": "I told her, \"I can't do the Berlin trip in June.\"", "notes": "" },
    { "candidate_id": "r2", "process_type": "behaviour", "source_text": "I repeated it", "notes": "" }
  ],
  "candidate_artifacts": [
    { "candidate_id": "a1", "artifact_kind": "encounter", "source_texts": ["coffee with Lena"], "notes": "" },
    { "candidate_id": "a2", "artifact_kind": "object", "source_text": "Lena", "notes": "" },
    { "candidate_id": "a3", "artifact_kind": "encounter", "source_texts": ["the Berlin trip in June"], "notes": "" }
  ],
  "uncertainties": []
}
```

Phase 3 output v8:

```json
{
  "candidate_references": [
    {
      "from_candidate_id": "r1",
      "to_candidate_id": "a1",
      "relation_label": "at",
      "relation_status": "explicit",
      "supporting_text": "At coffee with Lena, I told her, \"I can't do the Berlin trip in June.\"",
      "notes": ""
    },
    {
      "from_candidate_id": "r1",
      "to_candidate_id": "a3",
      "relation_label": "told",
      "relation_status": "ambiguous",
      "supporting_text": "I told her, \"I can't do the Berlin trip in June.\"",
      "notes": "This collapses addressee and topic too much."
    },
    {
      "from_candidate_id": "r2",
      "to_candidate_id": "a3",
      "relation_label": "repeated",
      "relation_status": "ambiguous",
      "supporting_text": "I repeated it",
      "notes": ""
    }
  ],
  "uncertainties": []
}
```

Critique:

- `told` should point to Lena.
- The trip should get a different content-oriented relation like `about` or the quoted phrase itself.
- The record can support multiple links simultaneously.

Prompt delta:

- one candidate may emit multiple references when the text supports distinct addressee, content, scene, or target links
- for speech acts, prefer the speech verb for the addressee and a separate content-oriented label for the topic or quoted item

## Iteration 9

Pain point:

- explicit alternatives should produce ambiguous proposition-level links without pretending certainty

Journal entry:

```text
I couldn't tell if the application was missing the budget page or the signature page.
```

Phase 2 output:

```json
{
  "candidate_records": [
    { "candidate_id": "r1", "process_type": "thought", "source_text": "I couldn't tell if the application was missing the budget page or the signature page", "notes": "" }
  ],
  "candidate_artifacts": [
    { "candidate_id": "a1", "artifact_kind": "object", "source_text": "the application", "notes": "" },
    { "candidate_id": "a2", "artifact_kind": "object", "source_text": "the budget page", "notes": "" },
    { "candidate_id": "a3", "artifact_kind": "object", "source_text": "the signature page", "notes": "" }
  ],
  "uncertainties": []
}
```

Phase 3 output v9:

```json
{
  "candidate_references": [
    {
      "from_candidate_id": "r1",
      "to_candidate_id": "a1",
      "relation_label": "couldn't tell about",
      "relation_status": "explicit",
      "supporting_text": "I couldn't tell if the application was missing the budget page or the signature page",
      "notes": ""
    },
    {
      "from_candidate_id": "a1",
      "to_candidate_id": "a2",
      "relation_label": "missing",
      "relation_status": "explicit",
      "supporting_text": "the application was missing the budget page",
      "notes": ""
    },
    {
      "from_candidate_id": "a1",
      "to_candidate_id": "a3",
      "relation_label": "missing",
      "relation_status": "explicit",
      "supporting_text": "the signature page",
      "notes": ""
    }
  ],
  "uncertainties": []
}
```

Critique:

- The page links should not be `explicit`.
- They are explicit alternatives under uncertainty.
- This is exactly where `ambiguous` matters.

Prompt delta:

- if the text presents alternative propositions, references drawn from those propositions may be emitted, but they must be marked `ambiguous`
- the ambiguity note should preserve that the alternatives were not resolved

## Iteration 10

Pain point:

- likely co-referring appositives must remain unresolved

Journal entry:

```text
During the meeting with Dr. Sen, my supervisor, I asked about the fellowship application. Later I emailed my supervisor again.
```

Phase 2 output:

```json
{
  "candidate_records": [
    { "candidate_id": "r1", "process_type": "behaviour", "source_text": "I asked about the fellowship application", "notes": "" },
    { "candidate_id": "r2", "process_type": "behaviour", "source_text": "I emailed my supervisor again", "notes": "" }
  ],
  "candidate_artifacts": [
    { "candidate_id": "a1", "artifact_kind": "encounter", "source_texts": ["the meeting with Dr. Sen"], "notes": "" },
    { "candidate_id": "a2", "artifact_kind": "object", "source_text": "Dr. Sen", "notes": "" },
    { "candidate_id": "a3", "artifact_kind": "object", "source_text": "my supervisor", "notes": "" },
    { "candidate_id": "a4", "artifact_kind": "object", "source_text": "the fellowship application", "notes": "" }
  ],
  "uncertainties": []
}
```

Phase 3 output v10:

```json
{
  "candidate_references": [
    {
      "from_candidate_id": "a2",
      "to_candidate_id": "a1",
      "relation_label": "with",
      "relation_status": "explicit",
      "supporting_text": "the meeting with Dr. Sen",
      "notes": ""
    },
    {
      "from_candidate_id": "r1",
      "to_candidate_id": "a1",
      "relation_label": "during",
      "relation_status": "explicit",
      "supporting_text": "During the meeting with Dr. Sen, my supervisor, I asked about the fellowship application",
      "notes": ""
    },
    {
      "from_candidate_id": "r1",
      "to_candidate_id": "a4",
      "relation_label": "about",
      "relation_status": "explicit",
      "supporting_text": "I asked about the fellowship application",
      "notes": ""
    },
    {
      "from_candidate_id": "r2",
      "to_candidate_id": "a3",
      "relation_label": "emailed",
      "relation_status": "explicit",
      "supporting_text": "I emailed my supervisor again",
      "notes": ""
    },
    {
      "from_candidate_id": "a3",
      "to_candidate_id": "a1",
      "relation_label": "with",
      "relation_status": "ambiguous",
      "supporting_text": "During the meeting with Dr. Sen, my supervisor, I asked about the fellowship application",
      "notes": "The appositive suggests a link to the meeting participant, but phase 3 should not resolve whether my supervisor is the same candidate as Dr. Sen."
    }
  ],
  "uncertainties": [
    "Dr. Sen and my supervisor may co-refer, but phase 3 should not merge them or invent an identity relation."
  ]
}
```

Critique:

- This is close to the right behavior.
- The prompt should explicitly say that appositive or role-label co-reference stays unresolved, and ambiguous references may remain duplicated at this stage if the text supports them separately.

Prompt delta:

- if appositive or role-label candidates likely co-refer, do not merge them
- if the text separately supports links involving each candidate, both may remain
- mark any co-reference-dependent link `ambiguous`

## Final Prompt After Round 3

```text
You will be given:
1. a journal entry
2. unresolved phase-2 JSON containing candidate_records and candidate_artifacts with stable candidate_id values

Your task is to add candidate references between the existing phase-2 candidates.

This is still an unresolved text-only stage.
Do not resolve identities.
Do not add tags.
Do not introduce outside context.
Do not create any new records or artifacts.

References connect candidates to candidates, not text to text.
You may link any candidate types to any candidate types if the text directly supports that link.

Definitions:
- A candidate reference is a text-supported unresolved link between two existing phase-2 candidates.
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
1. Only create references between candidates that already exist in the phase-2 JSON.
2. A candidate may emit multiple references when the text directly supports multiple distinct links.
3. References may connect records to artifacts, artifacts to artifacts, or records to records.
4. When a later candidate explicitly points back to an earlier candidate or event-like item, you may link them directly.

Support rules:
1. Every candidate_reference must have exactly one supporting_text string.
2. supporting_text must be an exact contiguous span from the journal entry.
3. supporting_text should be the smallest exact span that still clearly supports the reference.
4. Output references in source order based on the source candidate's first appearance in phase 2.
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
- Does from_candidate_id already exist in phase 2?
- Does to_candidate_id already exist in phase 2?
- Is the supporting_text exact and contiguous?
- Is the relation_label text-near?
- Did I preserve negation?
- Did I avoid silently resolving ambiguity?

Return JSON in exactly this shape:

{
  "candidate_references": [
    {
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
```

## Bottom Line

This round produces a much healthier phase-3 shape.

The biggest improvements are:

- references now point from candidate to candidate instead of text to text
- reference labels are flexible instead of forced into four bins
- ambiguity is preserved at the reference level rather than suppressed or prematurely resolved
- record-to-record links are allowed
- negation and proposition-level uncertainty survive into the intermediate output

I think this is much closer to the right direction for phase 3.
