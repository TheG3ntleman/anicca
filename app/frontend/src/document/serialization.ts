import type { InlineNode, NarrativeDocument } from './types';
import { validateDocument } from './validation';
import { parseDocument as parseLegacy } from './legacy/serialization';
import { boxDefinitions } from './boxDefinitions';
import type { InlineNode as LegacyInline } from './legacy/types';

const HEADER = '@anicca/2\n';
// A versioned plain-text envelope with JSON escaping preserves arbitrary field schemas.
export function serializeDocument(document: NarrativeDocument): string {
  validateDocument(document);
  return HEADER + JSON.stringify(document);
}
export function parseDocument(raw: string): NarrativeDocument {
  if (raw.startsWith(HEADER)) {
    const document = JSON.parse(raw.slice(HEADER.length)) as NarrativeDocument;
    validateDocument(document);
    return document;
  }
  const legacy = parseLegacy(raw);
  const migrate = (nodes: LegacyInline[]): InlineNode[] => nodes.map((node) => node.type !== 'freeform' ? node : ({
    type: 'box', id: node.id, definitionId: 'builtin.freeform', definitionVersion: 1,
    selector: node.selector, fields: { content: { kind: 'freeform', content: migrate(node.fields.content) } },
  }));
  const document: NarrativeDocument = { schemaVersion: 2, type: 'narrative', id: legacy.id,
    definitions: [structuredClone(boxDefinitions[0])],
    content: legacy.content.map((paragraph) => ({ ...paragraph, content: migrate(paragraph.content) })) };
  validateDocument(document);
  return document;
}
