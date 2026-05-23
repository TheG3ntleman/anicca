# Initial Qwen3-4B Run Notes

Model:

- `qwen3:4b`

Runner mode:

- `--think false`
- `--format json`

Date:

- `2026-03-16`

## What Happened

The initial end-to-end run did not succeed cleanly.

### Phase 2

Phase 2 returned parseable JSON, but the output quality was weak.

Observed issues:

- candidate IDs were not namespaced and collided across records and artifacts
- several extracted spans were not exact contiguous spans from the entry
- important artifacts were omitted
- process typing was often off
- extraction recall was much lower than expected on the hard case

Examples:

- `I printed the revised budget spreadsheet` was emitted even though the exact text was `printed the revised budget spreadsheet`
- `I opened the email draft to the foundation` was emitted even though the exact text was `opened the email draft to the foundation`
- `my stomach tightened` was typed as `emotion` instead of `body`
- `I could barely swallow` was typed as `emotion` instead of `body`
- only `9` artifacts were emitted on a case where the worked reference output expected far more

### Phase 3

Phase 3 parsed as JSON, but it effectively failed semantically.

Observed issues:

- instead of returning `candidate_references`, it returned the phase-2-style `candidate_records` and `candidate_artifacts` structure again
- no usable candidate-to-candidate reference graph was produced

This means the model did not reliably track the stage shift from extraction to reference construction.

### Phase 4

Phase 4 failed both semantically and syntactically.

Observed issues:

- output drifted back toward phase-2-style content instead of culling/consolidation behavior
- JSON was malformed and could not be parsed
- raw text included `Thinking...` despite non-thinking mode being requested
- the response contained quote corruption / formatting corruption near the end

## Initial Conclusion

On the current prompts and this hard case, `qwen3:4b` did not reliably execute the three-stage pipeline.

The most important failure modes were:

1. weak exact-span fidelity in phase 2
2. stage confusion in phase 3
3. JSON instability in phase 4

## Likely Next Improvements

- add a stricter request wrapper around each phase prompt
- explicitly restate the required top-level keys immediately before the input block
- validate stage-specific output shape and retry failed phases
- consider narrower prompts for local-small-model runs
- possibly use a stronger model for phase 3 and phase 4 while keeping phase 2 local
