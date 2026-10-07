# Editor integration

`schema.ts` currently provides text editing only. Add `commands.ts`,
`conversion.ts`, `plugins/commandTrigger.ts`, `plugins/boxDeletion.ts`,
`plugins/nestingLimit.ts`, and `nodeViews/FreeformBoxView.ts` as box support is
implemented. Engine state is the live editing state; serialization must derive
from the document, not maintain a second independently editable copy.
