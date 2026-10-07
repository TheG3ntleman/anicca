# Anicca document model

Reserved for engine-independent `types.ts`, `boxDefinitions.ts`,
`validation.ts`, and `serialization.ts`. The eventual model is a narrative root
with recursively nested boxes, stable IDs, and a configurable depth limit.
Serialization must preserve the complete structure and parse back without loss.
These contracts will be implemented with the first nested-box prototype.
