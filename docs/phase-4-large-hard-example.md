# Large Hard Example for Phases 2-4

This document runs one deliberately difficult journal entry through the current phase-2, phase-3, and phase-4 design.

The goal is not to prove perfection. The goal is to see how the current prompts behave when many pain points appear at once.

Pain points included here:

- overlapping document-like artifacts
- overlapping encounter-like artifacts
- apposition and likely co-reference
- pronoun resolution
- alternative propositions
- negation
- present-scene links and remembered-scene links
- low-consequence scene furniture
- repeated actions that may or may not deserve consolidation

## Journal Entry

```text
Yesterday morning on the train I reread Maya's message about the appeal hearing and printed the revised budget spreadsheet before the check-in with Dr. Sen, my supervisor. I kept wondering whether she had sent the message to warn me or to push me out, and my stomach tightened even though the message itself only said, "we should talk before Friday." During the check-in with Dr. Sen, my supervisor, I admitted I still hadn't emailed the foundation, and then I apologized for freezing during the donor call on Monday. He said the call had been fine, but I kept replaying the moment Leah laughed and couldn't tell whether she was laughing at me or at the slide with the broken chart. After the meeting I put the mug beside my laptop, opened the email draft to the foundation, and stared at it without sending it. I wanted to cancel the hospital scan next week, but I also knew the scan wasn't the thing I was really afraid of. At dinner with my parents, my mother asked whether Dr. Sen had calmed me down. I told them I was fine, but I wasn't fine and I could barely swallow. On the ride home I read the note about the hearing again, then read it again, and kept hearing Leah say, "just present the numbers." Before bed I deleted one paragraph from the draft reply to Maya's message and then restored it. I don't know whether the reply was for Maya, for the foundation, or just for me.
```

## Why This Is Hard

- `Maya's message`, `the note about the hearing`, and `the draft reply to Maya's message` are related but not trivially the same.
- `the check-in with Dr. Sen, my supervisor` and `the meeting` likely refer to the same encounter, but not with perfect explicitness.
- `Dr. Sen` and `my supervisor` are strongly linked by apposition.
- `the hospital scan next week` and `the scan` are obvious consolidation candidates.
- `she was laughing at me or at the slide with the broken chart` should preserve alternative structure.
- `stared at it without sending it` tests negation handling.
- `put the mug beside my laptop` is probably real but may have little lasting mental consequence.

## Phase 2 Worked Output

This uses the current phase-2 extraction idea: high recall, exact spans, no references yet, unresolved `candidate_*` items only.

```json
{
  "candidate_records": [
    {
      "candidate_id": "r1",
      "process_type": "behaviour",
      "source_text": "I reread Maya's message about the appeal hearing",
      "notes": ""
    },
    {
      "candidate_id": "r2",
      "process_type": "behaviour",
      "source_text": "printed the revised budget spreadsheet",
      "notes": ""
    },
    {
      "candidate_id": "r3",
      "process_type": "thought",
      "source_text": "I kept wondering whether she had sent the message to warn me or to push me out",
      "notes": ""
    },
    {
      "candidate_id": "r4",
      "process_type": "body",
      "source_text": "my stomach tightened",
      "notes": ""
    },
    {
      "candidate_id": "r5",
      "process_type": "behaviour",
      "source_text": "I admitted I still hadn't emailed the foundation",
      "notes": ""
    },
    {
      "candidate_id": "r6",
      "process_type": "behaviour",
      "source_text": "I apologized for freezing during the donor call on Monday",
      "notes": ""
    },
    {
      "candidate_id": "r7",
      "process_type": "thought",
      "source_text": "I kept replaying the moment Leah laughed",
      "notes": ""
    },
    {
      "candidate_id": "r8",
      "process_type": "thought",
      "source_text": "couldn't tell whether she was laughing at me or at the slide with the broken chart",
      "notes": ""
    },
    {
      "candidate_id": "r9",
      "process_type": "behaviour",
      "source_text": "I put the mug beside my laptop",
      "notes": ""
    },
    {
      "candidate_id": "r10",
      "process_type": "behaviour",
      "source_text": "opened the email draft to the foundation",
      "notes": ""
    },
    {
      "candidate_id": "r11",
      "process_type": "behaviour",
      "source_text": "stared at it without sending it",
      "notes": ""
    },
    {
      "candidate_id": "r12",
      "process_type": "thought",
      "source_text": "I wanted to cancel the hospital scan next week",
      "notes": ""
    },
    {
      "candidate_id": "r13",
      "process_type": "thought",
      "source_text": "I also knew the scan wasn't the thing I was really afraid of",
      "notes": ""
    },
    {
      "candidate_id": "r14",
      "process_type": "behaviour",
      "source_text": "I told them I was fine",
      "notes": ""
    },
    {
      "candidate_id": "r15",
      "process_type": "thought",
      "source_text": "I wasn't fine",
      "notes": ""
    },
    {
      "candidate_id": "r16",
      "process_type": "body",
      "source_text": "I could barely swallow",
      "notes": ""
    },
    {
      "candidate_id": "r17",
      "process_type": "behaviour",
      "source_text": "I read the note about the hearing again",
      "notes": ""
    },
    {
      "candidate_id": "r18",
      "process_type": "behaviour",
      "source_text": "read it again",
      "notes": "May be a duplicate reread split."
    },
    {
      "candidate_id": "r19",
      "process_type": "thought",
      "source_text": "kept hearing Leah say, \"just present the numbers.\"",
      "notes": ""
    },
    {
      "candidate_id": "r20",
      "process_type": "behaviour",
      "source_text": "I deleted one paragraph from the draft reply to Maya's message",
      "notes": ""
    },
    {
      "candidate_id": "r21",
      "process_type": "behaviour",
      "source_text": "then restored it",
      "notes": ""
    },
    {
      "candidate_id": "r22",
      "process_type": "thought",
      "source_text": "I don't know whether the reply was for Maya, for the foundation, or just for me",
      "notes": ""
    }
  ],
  "candidate_artifacts": [
    {
      "candidate_id": "a1",
      "artifact_kind": "object",
      "source_text": "Maya",
      "notes": ""
    },
    {
      "candidate_id": "a2",
      "artifact_kind": "object",
      "source_text": "Maya's message",
      "notes": ""
    },
    {
      "candidate_id": "a3",
      "artifact_kind": "encounter",
      "source_texts": [
        "the appeal hearing"
      ],
      "notes": ""
    },
    {
      "candidate_id": "a4",
      "artifact_kind": "object",
      "source_text": "the revised budget spreadsheet",
      "notes": ""
    },
    {
      "candidate_id": "a5",
      "artifact_kind": "encounter",
      "source_texts": [
        "the check-in with Dr. Sen, my supervisor"
      ],
      "notes": ""
    },
    {
      "candidate_id": "a6",
      "artifact_kind": "object",
      "source_text": "Dr. Sen",
      "notes": ""
    },
    {
      "candidate_id": "a7",
      "artifact_kind": "object",
      "source_text": "my supervisor",
      "notes": ""
    },
    {
      "candidate_id": "a8",
      "artifact_kind": "object",
      "source_text": "me",
      "notes": ""
    },
    {
      "candidate_id": "a9",
      "artifact_kind": "object",
      "source_text": "the foundation",
      "notes": ""
    },
    {
      "candidate_id": "a10",
      "artifact_kind": "encounter",
      "source_texts": [
        "the donor call on Monday"
      ],
      "notes": ""
    },
    {
      "candidate_id": "a11",
      "artifact_kind": "encounter",
      "source_texts": [
        "the moment Leah laughed"
      ],
      "notes": ""
    },
    {
      "candidate_id": "a12",
      "artifact_kind": "object",
      "source_text": "Leah",
      "notes": ""
    },
    {
      "candidate_id": "a13",
      "artifact_kind": "object",
      "source_text": "the slide with the broken chart",
      "notes": ""
    },
    {
      "candidate_id": "a14",
      "artifact_kind": "encounter",
      "source_texts": [
        "the meeting"
      ],
      "notes": ""
    },
    {
      "candidate_id": "a15",
      "artifact_kind": "object",
      "source_text": "the mug",
      "notes": ""
    },
    {
      "candidate_id": "a16",
      "artifact_kind": "object",
      "source_text": "my laptop",
      "notes": ""
    },
    {
      "candidate_id": "a17",
      "artifact_kind": "object",
      "source_text": "the email draft to the foundation",
      "notes": ""
    },
    {
      "candidate_id": "a18",
      "artifact_kind": "encounter",
      "source_texts": [
        "the hospital scan next week"
      ],
      "notes": ""
    },
    {
      "candidate_id": "a19",
      "artifact_kind": "encounter",
      "source_texts": [
        "the scan"
      ],
      "notes": ""
    },
    {
      "candidate_id": "a20",
      "artifact_kind": "encounter",
      "source_texts": [
        "dinner with my parents"
      ],
      "notes": ""
    },
    {
      "candidate_id": "a21",
      "artifact_kind": "object",
      "source_text": "my parents",
      "notes": ""
    },
    {
      "candidate_id": "a22",
      "artifact_kind": "object",
      "source_text": "my mother",
      "notes": ""
    },
    {
      "candidate_id": "a23",
      "artifact_kind": "encounter",
      "source_texts": [
        "the ride home"
      ],
      "notes": ""
    },
    {
      "candidate_id": "a24",
      "artifact_kind": "object",
      "source_text": "the note about the hearing",
      "notes": ""
    },
    {
      "candidate_id": "a25",
      "artifact_kind": "object",
      "source_text": "the draft reply to Maya's message",
      "notes": ""
    }
  ],
  "uncertainties": [
    "a6 and a7 may co-refer through apposition.",
    "a5 and a14 may refer to the same encounter.",
    "a2 and a24 may refer to the same document or closely related documents.",
    "a17 and a25 may refer to the same draft or to different drafts.",
    "a18 and a19 likely refer to the same scan encounter.",
    "r18 may be an over-split duplicate of r17."
  ]
}
```

## Phase 3 Worked Output

This uses the current phase-3 idea: flexible candidate-to-candidate references, exact support spans, unresolved links allowed, and ambiguity preserved.

I have left in a few plausible weak references here on purpose. That gives phase 4 something real to clean up.

```json
{
  "candidate_references": [
    {
      "candidate_reference_id": "cr1",
      "from_candidate_id": "r1",
      "to_candidate_id": "a2",
      "relation_label": "reread",
      "relation_status": "explicit",
      "supporting_text": "I reread Maya's message",
      "notes": ""
    },
    {
      "candidate_reference_id": "cr2",
      "from_candidate_id": "a2",
      "to_candidate_id": "a3",
      "relation_label": "about",
      "relation_status": "explicit",
      "supporting_text": "Maya's message about the appeal hearing",
      "notes": ""
    },
    {
      "candidate_reference_id": "cr3",
      "from_candidate_id": "r2",
      "to_candidate_id": "a4",
      "relation_label": "printed",
      "relation_status": "explicit",
      "supporting_text": "printed the revised budget spreadsheet",
      "notes": ""
    },
    {
      "candidate_reference_id": "cr4",
      "from_candidate_id": "r2",
      "to_candidate_id": "a5",
      "relation_label": "before",
      "relation_status": "explicit",
      "supporting_text": "before the check-in with Dr. Sen, my supervisor",
      "notes": ""
    },
    {
      "candidate_reference_id": "cr5",
      "from_candidate_id": "a6",
      "to_candidate_id": "a5",
      "relation_label": "with",
      "relation_status": "explicit",
      "supporting_text": "check-in with Dr. Sen",
      "notes": ""
    },
    {
      "candidate_reference_id": "cr6",
      "from_candidate_id": "a7",
      "to_candidate_id": "a5",
      "relation_label": "with",
      "relation_status": "explicit",
      "supporting_text": "the check-in with Dr. Sen, my supervisor",
      "notes": ""
    },
    {
      "candidate_reference_id": "cr7",
      "from_candidate_id": "r3",
      "to_candidate_id": "a2",
      "relation_label": "wondering whether she had sent the message",
      "relation_status": "explicit",
      "supporting_text": "I kept wondering whether she had sent the message",
      "notes": ""
    },
    {
      "candidate_reference_id": "cr8",
      "from_candidate_id": "r3",
      "to_candidate_id": "a1",
      "relation_label": "she had sent the message",
      "relation_status": "explicit",
      "supporting_text": "she had sent the message",
      "notes": ""
    },
    {
      "candidate_reference_id": "cr9",
      "from_candidate_id": "r3",
      "to_candidate_id": "a8",
      "relation_label": "warn me or to push me out",
      "relation_status": "ambiguous",
      "supporting_text": "to warn me or to push me out",
      "notes": "Alternative propositions are preserved in one unresolved relation."
    },
    {
      "candidate_reference_id": "cr10",
      "from_candidate_id": "r5",
      "to_candidate_id": "a5",
      "relation_label": "during",
      "relation_status": "explicit",
      "supporting_text": "During the check-in with Dr. Sen, my supervisor",
      "notes": ""
    },
    {
      "candidate_reference_id": "cr11",
      "from_candidate_id": "r5",
      "to_candidate_id": "a9",
      "relation_label": "hadn't emailed",
      "relation_status": "explicit",
      "supporting_text": "hadn't emailed the foundation",
      "notes": ""
    },
    {
      "candidate_reference_id": "cr12",
      "from_candidate_id": "r6",
      "to_candidate_id": "a5",
      "relation_label": "during",
      "relation_status": "explicit",
      "supporting_text": "During the check-in with Dr. Sen, my supervisor",
      "notes": ""
    },
    {
      "candidate_reference_id": "cr13",
      "from_candidate_id": "r6",
      "to_candidate_id": "a10",
      "relation_label": "apologized for freezing during",
      "relation_status": "explicit",
      "supporting_text": "I apologized for freezing during the donor call on Monday",
      "notes": ""
    },
    {
      "candidate_reference_id": "cr14",
      "from_candidate_id": "r7",
      "to_candidate_id": "a11",
      "relation_label": "replaying",
      "relation_status": "explicit",
      "supporting_text": "I kept replaying the moment Leah laughed",
      "notes": ""
    },
    {
      "candidate_reference_id": "cr15",
      "from_candidate_id": "a11",
      "to_candidate_id": "a12",
      "relation_label": "Leah laughed",
      "relation_status": "explicit",
      "supporting_text": "the moment Leah laughed",
      "notes": ""
    },
    {
      "candidate_reference_id": "cr16",
      "from_candidate_id": "r8",
      "to_candidate_id": "a8",
      "relation_label": "laughing at",
      "relation_status": "ambiguous",
      "supporting_text": "she was laughing at me",
      "notes": ""
    },
    {
      "candidate_reference_id": "cr17",
      "from_candidate_id": "r8",
      "to_candidate_id": "a13",
      "relation_label": "laughing at",
      "relation_status": "ambiguous",
      "supporting_text": "at the slide with the broken chart",
      "notes": ""
    },
    {
      "candidate_reference_id": "cr18",
      "from_candidate_id": "r10",
      "to_candidate_id": "a14",
      "relation_label": "after",
      "relation_status": "explicit",
      "supporting_text": "After the meeting",
      "notes": ""
    },
    {
      "candidate_reference_id": "cr19",
      "from_candidate_id": "r9",
      "to_candidate_id": "a15",
      "relation_label": "put",
      "relation_status": "explicit",
      "supporting_text": "I put the mug",
      "notes": ""
    },
    {
      "candidate_reference_id": "cr20",
      "from_candidate_id": "r9",
      "to_candidate_id": "a16",
      "relation_label": "beside",
      "relation_status": "explicit",
      "supporting_text": "beside my laptop",
      "notes": ""
    },
    {
      "candidate_reference_id": "cr21",
      "from_candidate_id": "r10",
      "to_candidate_id": "a17",
      "relation_label": "opened",
      "relation_status": "explicit",
      "supporting_text": "opened the email draft to the foundation",
      "notes": ""
    },
    {
      "candidate_reference_id": "cr22",
      "from_candidate_id": "a17",
      "to_candidate_id": "a9",
      "relation_label": "to",
      "relation_status": "explicit",
      "supporting_text": "email draft to the foundation",
      "notes": ""
    },
    {
      "candidate_reference_id": "cr23",
      "from_candidate_id": "r10",
      "to_candidate_id": "a17",
      "relation_label": "consulted",
      "relation_status": "ambiguous",
      "supporting_text": "opened the email draft to the foundation",
      "notes": "Likely too abstract compared with the text."
    },
    {
      "candidate_reference_id": "cr24",
      "from_candidate_id": "r11",
      "to_candidate_id": "a17",
      "relation_label": "stared at",
      "relation_status": "explicit",
      "supporting_text": "stared at it",
      "notes": ""
    },
    {
      "candidate_reference_id": "cr25",
      "from_candidate_id": "r11",
      "to_candidate_id": "a17",
      "relation_label": "send",
      "relation_status": "ambiguous",
      "supporting_text": "sending it",
      "notes": "This intentionally shows a likely failure mode under load because negation was lost."
    },
    {
      "candidate_reference_id": "cr26",
      "from_candidate_id": "r12",
      "to_candidate_id": "a18",
      "relation_label": "wanted to cancel",
      "relation_status": "explicit",
      "supporting_text": "I wanted to cancel the hospital scan next week",
      "notes": ""
    },
    {
      "candidate_reference_id": "cr27",
      "from_candidate_id": "r13",
      "to_candidate_id": "a19",
      "relation_label": "wasn't the thing I was really afraid of",
      "relation_status": "explicit",
      "supporting_text": "the scan wasn't the thing I was really afraid of",
      "notes": ""
    },
    {
      "candidate_reference_id": "cr28",
      "from_candidate_id": "a21",
      "to_candidate_id": "a20",
      "relation_label": "with",
      "relation_status": "explicit",
      "supporting_text": "dinner with my parents",
      "notes": ""
    },
    {
      "candidate_reference_id": "cr29",
      "from_candidate_id": "a22",
      "to_candidate_id": "a20",
      "relation_label": "at",
      "relation_status": "explicit",
      "supporting_text": "At dinner with my parents, my mother asked",
      "notes": ""
    },
    {
      "candidate_reference_id": "cr30",
      "from_candidate_id": "r14",
      "to_candidate_id": "a20",
      "relation_label": "at",
      "relation_status": "explicit",
      "supporting_text": "At dinner with my parents",
      "notes": ""
    },
    {
      "candidate_reference_id": "cr31",
      "from_candidate_id": "r14",
      "to_candidate_id": "a21",
      "relation_label": "told",
      "relation_status": "explicit",
      "supporting_text": "I told them I was fine",
      "notes": ""
    },
    {
      "candidate_reference_id": "cr32",
      "from_candidate_id": "r15",
      "to_candidate_id": "a20",
      "relation_label": "at",
      "relation_status": "explicit",
      "supporting_text": "At dinner with my parents",
      "notes": ""
    },
    {
      "candidate_reference_id": "cr33",
      "from_candidate_id": "r16",
      "to_candidate_id": "a20",
      "relation_label": "at",
      "relation_status": "explicit",
      "supporting_text": "At dinner with my parents",
      "notes": ""
    },
    {
      "candidate_reference_id": "cr34",
      "from_candidate_id": "r17",
      "to_candidate_id": "a23",
      "relation_label": "on",
      "relation_status": "explicit",
      "supporting_text": "On the ride home",
      "notes": ""
    },
    {
      "candidate_reference_id": "cr35",
      "from_candidate_id": "r17",
      "to_candidate_id": "a24",
      "relation_label": "read",
      "relation_status": "explicit",
      "supporting_text": "I read the note about the hearing again",
      "notes": ""
    },
    {
      "candidate_reference_id": "cr36",
      "from_candidate_id": "a24",
      "to_candidate_id": "a3",
      "relation_label": "about",
      "relation_status": "explicit",
      "supporting_text": "the note about the hearing",
      "notes": ""
    },
    {
      "candidate_reference_id": "cr37",
      "from_candidate_id": "r18",
      "to_candidate_id": "a24",
      "relation_label": "read",
      "relation_status": "explicit",
      "supporting_text": "read it again",
      "notes": ""
    },
    {
      "candidate_reference_id": "cr38",
      "from_candidate_id": "r19",
      "to_candidate_id": "a23",
      "relation_label": "on",
      "relation_status": "explicit",
      "supporting_text": "On the ride home",
      "notes": ""
    },
    {
      "candidate_reference_id": "cr39",
      "from_candidate_id": "r19",
      "to_candidate_id": "a12",
      "relation_label": "kept hearing ... say",
      "relation_status": "explicit",
      "supporting_text": "kept hearing Leah say",
      "notes": ""
    },
    {
      "candidate_reference_id": "cr40",
      "from_candidate_id": "r20",
      "to_candidate_id": "a25",
      "relation_label": "deleted one paragraph from",
      "relation_status": "explicit",
      "supporting_text": "I deleted one paragraph from the draft reply to Maya's message",
      "notes": ""
    },
    {
      "candidate_reference_id": "cr41",
      "from_candidate_id": "a25",
      "to_candidate_id": "a2",
      "relation_label": "reply to",
      "relation_status": "explicit",
      "supporting_text": "draft reply to Maya's message",
      "notes": ""
    },
    {
      "candidate_reference_id": "cr42",
      "from_candidate_id": "r21",
      "to_candidate_id": "a25",
      "relation_label": "restored",
      "relation_status": "explicit",
      "supporting_text": "restored it",
      "notes": ""
    },
    {
      "candidate_reference_id": "cr43",
      "from_candidate_id": "r22",
      "to_candidate_id": "a25",
      "relation_label": "don't know whether the reply was for",
      "relation_status": "explicit",
      "supporting_text": "I don't know whether the reply was for Maya, for the foundation, or just for me",
      "notes": ""
    },
    {
      "candidate_reference_id": "cr44",
      "from_candidate_id": "a25",
      "to_candidate_id": "a1",
      "relation_label": "for",
      "relation_status": "ambiguous",
      "supporting_text": "for Maya",
      "notes": ""
    },
    {
      "candidate_reference_id": "cr45",
      "from_candidate_id": "a25",
      "to_candidate_id": "a9",
      "relation_label": "for",
      "relation_status": "ambiguous",
      "supporting_text": "for the foundation",
      "notes": ""
    },
    {
      "candidate_reference_id": "cr46",
      "from_candidate_id": "a25",
      "to_candidate_id": "a8",
      "relation_label": "for",
      "relation_status": "ambiguous",
      "supporting_text": "for me",
      "notes": ""
    }
  ],
  "uncertainties": [
    "cr23 may be a dominated abstraction of cr21.",
    "cr25 appears to lose the negation from 'without sending it'.",
    "cr16 and cr17 should survive together as alternatives.",
    "cr44, cr45, and cr46 should survive together as alternatives."
  ]
}
```

## Phase 4 Worked Output

This uses the current phase-4 idea: genuine removal, hard consolidation when clearly safe, and soft grouping when relatedness matters but merger is too early.

```json
{
  "candidate_records": [
    {
      "candidate_id": "r1",
      "process_type": "behaviour",
      "source_text": "I reread Maya's message about the appeal hearing",
      "notes": "",
      "absorbed_candidate_ids": []
    },
    {
      "candidate_id": "r2",
      "process_type": "behaviour",
      "source_text": "printed the revised budget spreadsheet",
      "notes": "",
      "absorbed_candidate_ids": []
    },
    {
      "candidate_id": "r3",
      "process_type": "thought",
      "source_text": "I kept wondering whether she had sent the message to warn me or to push me out",
      "notes": "",
      "absorbed_candidate_ids": []
    },
    {
      "candidate_id": "r4",
      "process_type": "body",
      "source_text": "my stomach tightened",
      "notes": "",
      "absorbed_candidate_ids": []
    },
    {
      "candidate_id": "r5",
      "process_type": "behaviour",
      "source_text": "I admitted I still hadn't emailed the foundation",
      "notes": "",
      "absorbed_candidate_ids": []
    },
    {
      "candidate_id": "r6",
      "process_type": "behaviour",
      "source_text": "I apologized for freezing during the donor call on Monday",
      "notes": "",
      "absorbed_candidate_ids": []
    },
    {
      "candidate_id": "r7",
      "process_type": "thought",
      "source_text": "I kept replaying the moment Leah laughed",
      "notes": "",
      "absorbed_candidate_ids": []
    },
    {
      "candidate_id": "r8",
      "process_type": "thought",
      "source_text": "couldn't tell whether she was laughing at me or at the slide with the broken chart",
      "notes": "",
      "absorbed_candidate_ids": []
    },
    {
      "candidate_id": "r10",
      "process_type": "behaviour",
      "source_text": "opened the email draft to the foundation",
      "notes": "",
      "absorbed_candidate_ids": []
    },
    {
      "candidate_id": "r11",
      "process_type": "behaviour",
      "source_text": "stared at it without sending it",
      "notes": "",
      "absorbed_candidate_ids": []
    },
    {
      "candidate_id": "r12",
      "process_type": "thought",
      "source_text": "I wanted to cancel the hospital scan next week",
      "notes": "",
      "absorbed_candidate_ids": []
    },
    {
      "candidate_id": "r13",
      "process_type": "thought",
      "source_text": "I also knew the scan wasn't the thing I was really afraid of",
      "notes": "",
      "absorbed_candidate_ids": []
    },
    {
      "candidate_id": "r14",
      "process_type": "behaviour",
      "source_text": "I told them I was fine",
      "notes": "",
      "absorbed_candidate_ids": []
    },
    {
      "candidate_id": "r15",
      "process_type": "thought",
      "source_text": "I wasn't fine",
      "notes": "",
      "absorbed_candidate_ids": []
    },
    {
      "candidate_id": "r16",
      "process_type": "body",
      "source_text": "I could barely swallow",
      "notes": "",
      "absorbed_candidate_ids": []
    },
    {
      "candidate_id": "r17",
      "process_type": "behaviour",
      "source_text": "I read the note about the hearing again",
      "notes": "Absorbs the follow-on reread split.",
      "absorbed_candidate_ids": [
        "r18"
      ]
    },
    {
      "candidate_id": "r19",
      "process_type": "thought",
      "source_text": "kept hearing Leah say, \"just present the numbers.\"",
      "notes": "",
      "absorbed_candidate_ids": []
    },
    {
      "candidate_id": "r20",
      "process_type": "behaviour",
      "source_text": "I deleted one paragraph from the draft reply to Maya's message",
      "notes": "",
      "absorbed_candidate_ids": []
    },
    {
      "candidate_id": "r21",
      "process_type": "behaviour",
      "source_text": "then restored it",
      "notes": "",
      "absorbed_candidate_ids": []
    },
    {
      "candidate_id": "r22",
      "process_type": "thought",
      "source_text": "I don't know whether the reply was for Maya, for the foundation, or just for me",
      "notes": "",
      "absorbed_candidate_ids": []
    }
  ],
  "candidate_artifacts": [
    {
      "candidate_id": "a1",
      "artifact_kind": "object",
      "source_text": "Maya",
      "notes": "",
      "absorbed_candidate_ids": []
    },
    {
      "candidate_id": "a2",
      "artifact_kind": "object",
      "source_text": "Maya's message",
      "notes": "",
      "absorbed_candidate_ids": []
    },
    {
      "candidate_id": "a3",
      "artifact_kind": "encounter",
      "source_texts": [
        "the appeal hearing"
      ],
      "notes": "",
      "absorbed_candidate_ids": []
    },
    {
      "candidate_id": "a4",
      "artifact_kind": "object",
      "source_text": "the revised budget spreadsheet",
      "notes": "",
      "absorbed_candidate_ids": []
    },
    {
      "candidate_id": "a5",
      "artifact_kind": "encounter",
      "source_texts": [
        "the check-in with Dr. Sen, my supervisor"
      ],
      "notes": "",
      "absorbed_candidate_ids": []
    },
    {
      "candidate_id": "a6",
      "artifact_kind": "object",
      "source_text": "Dr. Sen",
      "notes": "",
      "absorbed_candidate_ids": []
    },
    {
      "candidate_id": "a7",
      "artifact_kind": "object",
      "source_text": "my supervisor",
      "notes": "",
      "absorbed_candidate_ids": []
    },
    {
      "candidate_id": "a8",
      "artifact_kind": "object",
      "source_text": "me",
      "notes": "",
      "absorbed_candidate_ids": []
    },
    {
      "candidate_id": "a9",
      "artifact_kind": "object",
      "source_text": "the foundation",
      "notes": "",
      "absorbed_candidate_ids": []
    },
    {
      "candidate_id": "a10",
      "artifact_kind": "encounter",
      "source_texts": [
        "the donor call on Monday"
      ],
      "notes": "",
      "absorbed_candidate_ids": []
    },
    {
      "candidate_id": "a11",
      "artifact_kind": "encounter",
      "source_texts": [
        "the moment Leah laughed"
      ],
      "notes": "",
      "absorbed_candidate_ids": []
    },
    {
      "candidate_id": "a12",
      "artifact_kind": "object",
      "source_text": "Leah",
      "notes": "",
      "absorbed_candidate_ids": []
    },
    {
      "candidate_id": "a13",
      "artifact_kind": "object",
      "source_text": "the slide with the broken chart",
      "notes": "",
      "absorbed_candidate_ids": []
    },
    {
      "candidate_id": "a14",
      "artifact_kind": "encounter",
      "source_texts": [
        "the meeting"
      ],
      "notes": "",
      "absorbed_candidate_ids": []
    },
    {
      "candidate_id": "a17",
      "artifact_kind": "object",
      "source_text": "the email draft to the foundation",
      "notes": "",
      "absorbed_candidate_ids": []
    },
    {
      "candidate_id": "a18",
      "artifact_kind": "encounter",
      "source_texts": [
        "the hospital scan next week"
      ],
      "notes": "Absorbs the shorter local variant 'the scan'.",
      "absorbed_candidate_ids": [
        "a19"
      ]
    },
    {
      "candidate_id": "a20",
      "artifact_kind": "encounter",
      "source_texts": [
        "dinner with my parents"
      ],
      "notes": "",
      "absorbed_candidate_ids": []
    },
    {
      "candidate_id": "a21",
      "artifact_kind": "object",
      "source_text": "my parents",
      "notes": "",
      "absorbed_candidate_ids": []
    },
    {
      "candidate_id": "a22",
      "artifact_kind": "object",
      "source_text": "my mother",
      "notes": "",
      "absorbed_candidate_ids": []
    },
    {
      "candidate_id": "a23",
      "artifact_kind": "encounter",
      "source_texts": [
        "the ride home"
      ],
      "notes": "",
      "absorbed_candidate_ids": []
    },
    {
      "candidate_id": "a24",
      "artifact_kind": "object",
      "source_text": "the note about the hearing",
      "notes": "",
      "absorbed_candidate_ids": []
    },
    {
      "candidate_id": "a25",
      "artifact_kind": "object",
      "source_text": "the draft reply to Maya's message",
      "notes": "",
      "absorbed_candidate_ids": []
    }
  ],
  "candidate_references": [
    {
      "candidate_reference_id": "cr1",
      "from_candidate_id": "r1",
      "to_candidate_id": "a2",
      "relation_label": "reread",
      "relation_status": "explicit",
      "supporting_text": "I reread Maya's message",
      "notes": "",
      "absorbed_candidate_reference_ids": []
    },
    {
      "candidate_reference_id": "cr2",
      "from_candidate_id": "a2",
      "to_candidate_id": "a3",
      "relation_label": "about",
      "relation_status": "explicit",
      "supporting_text": "Maya's message about the appeal hearing",
      "notes": "",
      "absorbed_candidate_reference_ids": []
    },
    {
      "candidate_reference_id": "cr3",
      "from_candidate_id": "r2",
      "to_candidate_id": "a4",
      "relation_label": "printed",
      "relation_status": "explicit",
      "supporting_text": "printed the revised budget spreadsheet",
      "notes": "",
      "absorbed_candidate_reference_ids": []
    },
    {
      "candidate_reference_id": "cr4",
      "from_candidate_id": "r2",
      "to_candidate_id": "a5",
      "relation_label": "before",
      "relation_status": "explicit",
      "supporting_text": "before the check-in with Dr. Sen, my supervisor",
      "notes": "",
      "absorbed_candidate_reference_ids": []
    },
    {
      "candidate_reference_id": "cr5",
      "from_candidate_id": "a6",
      "to_candidate_id": "a5",
      "relation_label": "with",
      "relation_status": "explicit",
      "supporting_text": "check-in with Dr. Sen",
      "notes": "",
      "absorbed_candidate_reference_ids": []
    },
    {
      "candidate_reference_id": "cr6",
      "from_candidate_id": "a7",
      "to_candidate_id": "a5",
      "relation_label": "with",
      "relation_status": "explicit",
      "supporting_text": "the check-in with Dr. Sen, my supervisor",
      "notes": "",
      "absorbed_candidate_reference_ids": []
    },
    {
      "candidate_reference_id": "cr7",
      "from_candidate_id": "r3",
      "to_candidate_id": "a2",
      "relation_label": "wondering whether she had sent the message",
      "relation_status": "explicit",
      "supporting_text": "I kept wondering whether she had sent the message",
      "notes": "",
      "absorbed_candidate_reference_ids": []
    },
    {
      "candidate_reference_id": "cr8",
      "from_candidate_id": "r3",
      "to_candidate_id": "a1",
      "relation_label": "she had sent the message",
      "relation_status": "explicit",
      "supporting_text": "she had sent the message",
      "notes": "",
      "absorbed_candidate_reference_ids": []
    },
    {
      "candidate_reference_id": "cr9",
      "from_candidate_id": "r3",
      "to_candidate_id": "a8",
      "relation_label": "warn me or to push me out",
      "relation_status": "ambiguous",
      "supporting_text": "to warn me or to push me out",
      "notes": "",
      "absorbed_candidate_reference_ids": []
    },
    {
      "candidate_reference_id": "cr10",
      "from_candidate_id": "r5",
      "to_candidate_id": "a5",
      "relation_label": "during",
      "relation_status": "explicit",
      "supporting_text": "During the check-in with Dr. Sen, my supervisor",
      "notes": "",
      "absorbed_candidate_reference_ids": []
    },
    {
      "candidate_reference_id": "cr11",
      "from_candidate_id": "r5",
      "to_candidate_id": "a9",
      "relation_label": "hadn't emailed",
      "relation_status": "explicit",
      "supporting_text": "hadn't emailed the foundation",
      "notes": "",
      "absorbed_candidate_reference_ids": []
    },
    {
      "candidate_reference_id": "cr12",
      "from_candidate_id": "r6",
      "to_candidate_id": "a5",
      "relation_label": "during",
      "relation_status": "explicit",
      "supporting_text": "During the check-in with Dr. Sen, my supervisor",
      "notes": "",
      "absorbed_candidate_reference_ids": []
    },
    {
      "candidate_reference_id": "cr13",
      "from_candidate_id": "r6",
      "to_candidate_id": "a10",
      "relation_label": "apologized for freezing during",
      "relation_status": "explicit",
      "supporting_text": "I apologized for freezing during the donor call on Monday",
      "notes": "",
      "absorbed_candidate_reference_ids": []
    },
    {
      "candidate_reference_id": "cr14",
      "from_candidate_id": "r7",
      "to_candidate_id": "a11",
      "relation_label": "replaying",
      "relation_status": "explicit",
      "supporting_text": "I kept replaying the moment Leah laughed",
      "notes": "",
      "absorbed_candidate_reference_ids": []
    },
    {
      "candidate_reference_id": "cr15",
      "from_candidate_id": "a11",
      "to_candidate_id": "a12",
      "relation_label": "Leah laughed",
      "relation_status": "explicit",
      "supporting_text": "the moment Leah laughed",
      "notes": "",
      "absorbed_candidate_reference_ids": []
    },
    {
      "candidate_reference_id": "cr16",
      "from_candidate_id": "r8",
      "to_candidate_id": "a8",
      "relation_label": "laughing at",
      "relation_status": "ambiguous",
      "supporting_text": "she was laughing at me",
      "notes": "",
      "absorbed_candidate_reference_ids": []
    },
    {
      "candidate_reference_id": "cr17",
      "from_candidate_id": "r8",
      "to_candidate_id": "a13",
      "relation_label": "laughing at",
      "relation_status": "ambiguous",
      "supporting_text": "at the slide with the broken chart",
      "notes": "",
      "absorbed_candidate_reference_ids": []
    },
    {
      "candidate_reference_id": "cr18",
      "from_candidate_id": "r10",
      "to_candidate_id": "a14",
      "relation_label": "after",
      "relation_status": "explicit",
      "supporting_text": "After the meeting",
      "notes": "",
      "absorbed_candidate_reference_ids": []
    },
    {
      "candidate_reference_id": "cr21",
      "from_candidate_id": "r10",
      "to_candidate_id": "a17",
      "relation_label": "opened",
      "relation_status": "explicit",
      "supporting_text": "opened the email draft to the foundation",
      "notes": "",
      "absorbed_candidate_reference_ids": []
    },
    {
      "candidate_reference_id": "cr22",
      "from_candidate_id": "a17",
      "to_candidate_id": "a9",
      "relation_label": "to",
      "relation_status": "explicit",
      "supporting_text": "email draft to the foundation",
      "notes": "",
      "absorbed_candidate_reference_ids": []
    },
    {
      "candidate_reference_id": "cr24",
      "from_candidate_id": "r11",
      "to_candidate_id": "a17",
      "relation_label": "stared at",
      "relation_status": "explicit",
      "supporting_text": "stared at it",
      "notes": "",
      "absorbed_candidate_reference_ids": []
    },
    {
      "candidate_reference_id": "cr26",
      "from_candidate_id": "r12",
      "to_candidate_id": "a18",
      "relation_label": "wanted to cancel",
      "relation_status": "explicit",
      "supporting_text": "I wanted to cancel the hospital scan next week",
      "notes": "",
      "absorbed_candidate_reference_ids": []
    },
    {
      "candidate_reference_id": "cr27",
      "from_candidate_id": "r13",
      "to_candidate_id": "a18",
      "relation_label": "wasn't the thing I was really afraid of",
      "relation_status": "explicit",
      "supporting_text": "the scan wasn't the thing I was really afraid of",
      "notes": "Target redirected from absorbed a19.",
      "absorbed_candidate_reference_ids": []
    },
    {
      "candidate_reference_id": "cr28",
      "from_candidate_id": "a21",
      "to_candidate_id": "a20",
      "relation_label": "with",
      "relation_status": "explicit",
      "supporting_text": "dinner with my parents",
      "notes": "",
      "absorbed_candidate_reference_ids": []
    },
    {
      "candidate_reference_id": "cr29",
      "from_candidate_id": "a22",
      "to_candidate_id": "a20",
      "relation_label": "at",
      "relation_status": "explicit",
      "supporting_text": "At dinner with my parents, my mother asked",
      "notes": "",
      "absorbed_candidate_reference_ids": []
    },
    {
      "candidate_reference_id": "cr30",
      "from_candidate_id": "r14",
      "to_candidate_id": "a20",
      "relation_label": "at",
      "relation_status": "explicit",
      "supporting_text": "At dinner with my parents",
      "notes": "",
      "absorbed_candidate_reference_ids": []
    },
    {
      "candidate_reference_id": "cr31",
      "from_candidate_id": "r14",
      "to_candidate_id": "a21",
      "relation_label": "told",
      "relation_status": "explicit",
      "supporting_text": "I told them I was fine",
      "notes": "",
      "absorbed_candidate_reference_ids": []
    },
    {
      "candidate_reference_id": "cr32",
      "from_candidate_id": "r15",
      "to_candidate_id": "a20",
      "relation_label": "at",
      "relation_status": "explicit",
      "supporting_text": "At dinner with my parents",
      "notes": "",
      "absorbed_candidate_reference_ids": []
    },
    {
      "candidate_reference_id": "cr33",
      "from_candidate_id": "r16",
      "to_candidate_id": "a20",
      "relation_label": "at",
      "relation_status": "explicit",
      "supporting_text": "At dinner with my parents",
      "notes": "",
      "absorbed_candidate_reference_ids": []
    },
    {
      "candidate_reference_id": "cr34",
      "from_candidate_id": "r17",
      "to_candidate_id": "a23",
      "relation_label": "on",
      "relation_status": "explicit",
      "supporting_text": "On the ride home",
      "notes": "",
      "absorbed_candidate_reference_ids": []
    },
    {
      "candidate_reference_id": "cr35",
      "from_candidate_id": "r17",
      "to_candidate_id": "a24",
      "relation_label": "read",
      "relation_status": "explicit",
      "supporting_text": "I read the note about the hearing again",
      "notes": "",
      "absorbed_candidate_reference_ids": [
        "cr37"
      ]
    },
    {
      "candidate_reference_id": "cr36",
      "from_candidate_id": "a24",
      "to_candidate_id": "a3",
      "relation_label": "about",
      "relation_status": "explicit",
      "supporting_text": "the note about the hearing",
      "notes": "",
      "absorbed_candidate_reference_ids": []
    },
    {
      "candidate_reference_id": "cr38",
      "from_candidate_id": "r19",
      "to_candidate_id": "a23",
      "relation_label": "on",
      "relation_status": "explicit",
      "supporting_text": "On the ride home",
      "notes": "",
      "absorbed_candidate_reference_ids": []
    },
    {
      "candidate_reference_id": "cr39",
      "from_candidate_id": "r19",
      "to_candidate_id": "a12",
      "relation_label": "kept hearing ... say",
      "relation_status": "explicit",
      "supporting_text": "kept hearing Leah say",
      "notes": "",
      "absorbed_candidate_reference_ids": []
    },
    {
      "candidate_reference_id": "cr40",
      "from_candidate_id": "r20",
      "to_candidate_id": "a25",
      "relation_label": "deleted one paragraph from",
      "relation_status": "explicit",
      "supporting_text": "I deleted one paragraph from the draft reply to Maya's message",
      "notes": "",
      "absorbed_candidate_reference_ids": []
    },
    {
      "candidate_reference_id": "cr41",
      "from_candidate_id": "a25",
      "to_candidate_id": "a2",
      "relation_label": "reply to",
      "relation_status": "explicit",
      "supporting_text": "draft reply to Maya's message",
      "notes": "",
      "absorbed_candidate_reference_ids": []
    },
    {
      "candidate_reference_id": "cr42",
      "from_candidate_id": "r21",
      "to_candidate_id": "a25",
      "relation_label": "restored",
      "relation_status": "explicit",
      "supporting_text": "restored it",
      "notes": "",
      "absorbed_candidate_reference_ids": []
    },
    {
      "candidate_reference_id": "cr43",
      "from_candidate_id": "r22",
      "to_candidate_id": "a25",
      "relation_label": "don't know whether the reply was for",
      "relation_status": "explicit",
      "supporting_text": "I don't know whether the reply was for Maya, for the foundation, or just for me",
      "notes": "",
      "absorbed_candidate_reference_ids": []
    },
    {
      "candidate_reference_id": "cr44",
      "from_candidate_id": "a25",
      "to_candidate_id": "a1",
      "relation_label": "for",
      "relation_status": "ambiguous",
      "supporting_text": "for Maya",
      "notes": "",
      "absorbed_candidate_reference_ids": []
    },
    {
      "candidate_reference_id": "cr45",
      "from_candidate_id": "a25",
      "to_candidate_id": "a9",
      "relation_label": "for",
      "relation_status": "ambiguous",
      "supporting_text": "for the foundation",
      "notes": "",
      "absorbed_candidate_reference_ids": []
    },
    {
      "candidate_reference_id": "cr46",
      "from_candidate_id": "a25",
      "to_candidate_id": "a8",
      "relation_label": "for",
      "relation_status": "ambiguous",
      "supporting_text": "for me",
      "notes": "",
      "absorbed_candidate_reference_ids": []
    }
  ],
  "removed_items": [
    {
      "item_kind": "candidate_record",
      "item_id": "r9",
      "removal_kind": "low_mental_consequence",
      "reason": "The mug-placement action looks like incidental scene management and no higher-value candidate depends on preserving it.",
      "replacement_item_id": ""
    },
    {
      "item_kind": "candidate_artifact",
      "item_id": "a15",
      "removal_kind": "incidental_scene_furniture",
      "reason": "The mug is incidental and has no surviving higher-value role after r9 is removed.",
      "replacement_item_id": ""
    },
    {
      "item_kind": "candidate_artifact",
      "item_id": "a16",
      "removal_kind": "incidental_scene_furniture",
      "reason": "The laptop is incidental and has no surviving higher-value role after r9 is removed.",
      "replacement_item_id": ""
    },
    {
      "item_kind": "candidate_reference",
      "item_id": "cr19",
      "removal_kind": "orphaned_after_parent_removal",
      "reason": "This reference depends on removed low-consequence item r9 and removed artifact a15.",
      "replacement_item_id": ""
    },
    {
      "item_kind": "candidate_reference",
      "item_id": "cr20",
      "removal_kind": "orphaned_after_parent_removal",
      "reason": "This reference depends on removed low-consequence item r9 and removed artifact a16.",
      "replacement_item_id": ""
    },
    {
      "item_kind": "candidate_reference",
      "item_id": "cr23",
      "removal_kind": "dominated_variant",
      "reason": "The more text-faithful 'opened' relation already survives as cr21.",
      "replacement_item_id": "cr21"
    },
    {
      "item_kind": "candidate_reference",
      "item_id": "cr25",
      "removal_kind": "negation_damaged",
      "reason": "The text says 'without sending it', so an affirmative send relation should not survive.",
      "replacement_item_id": ""
    }
  ],
  "soft_groups": [
    {
      "group_id": "g1",
      "group_type": "possible_same_unresolved",
      "member_item_ids": [
        "a6",
        "a7"
      ],
      "notes": "Apposition strongly links these, but this output keeps them unresolved."
    },
    {
      "group_id": "g2",
      "group_type": "possible_same_unresolved",
      "member_item_ids": [
        "a5",
        "a14"
      ],
      "notes": "The later 'meeting' likely refers back to the earlier check-in."
    },
    {
      "group_id": "g3",
      "group_type": "possible_same_unresolved",
      "member_item_ids": [
        "a2",
        "a24"
      ],
      "notes": "These may be the same document or closely related documents about the same hearing."
    },
    {
      "group_id": "g4",
      "group_type": "possible_same_unresolved",
      "member_item_ids": [
        "a17",
        "a25"
      ],
      "notes": "These may be the same evolving draft or two different written artifacts."
    },
    {
      "group_id": "g5",
      "group_type": "alternative_set",
      "member_item_ids": [
        "cr16",
        "cr17"
      ],
      "notes": "The text explicitly leaves open what Leah's laughter was directed at."
    },
    {
      "group_id": "g6",
      "group_type": "alternative_set",
      "member_item_ids": [
        "cr44",
        "cr45",
        "cr46"
      ],
      "notes": "The reply target remains explicitly unresolved across three alternatives."
    }
  ],
  "uncertainties": [
    "The current phase-4 schema can remove negation-damaged references like cr25, but it cannot yet rewrite them into a better surviving form such as 'without sending'.",
    "a6 and a7 could plausibly be hard-consolidated in a stricter pass because the apposition is very strong.",
    "a5 and a14 could plausibly be hard-consolidated in a stricter pass, but this run keeps them soft-grouped."
  ]
}
```

## What This Example Shows

- The current phase-2 design still does the right kind of over-capture. It finds the meaningful mental material, but it also brings along some clutter and some near-duplicates.
- The current phase-3 design handles candidate-to-candidate relations much better than the earlier narrow reference-type approach. The alternative sets survive. The overlapping scenes survive. Carrier-versus-topic structure survives.
- The current phase-4 design can already do useful work on a bigger example. It trims incidental furniture, collapses obvious reread duplicates, collapses the scan variants, and preserves unresolved families rather than forcing identity decisions too early.

## Main Remaining Weak Spot

The biggest weakness exposed here is still the lack of a rewrite channel in phase 4.

Example:

- `cr25` is bad because it loses the negation from `without sending it`
- phase 4 can correctly remove it
- but phase 4 cannot currently replace it with a corrected unresolved reference such as `without sending`

So on a large example like this, the pipeline is already pretty workable, but it would get noticeably better if phase 4 were allowed to emit explicit rewrites for malformed surviving candidate references.
