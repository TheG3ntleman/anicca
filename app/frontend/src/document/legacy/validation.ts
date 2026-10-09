import type { InlineNode, NarrativeDocument } from './types';

export function validateDocument(document: NarrativeDocument, maxDepth = 32): void {
  if (document.schemaVersion !== 1 || document.type !== 'narrative' || !document.id) {
    throw new Error('Invalid Anicca document header.');
  }
  const ids = new Set([document.id]);
  const visit = (nodes: InlineNode[], depth: number) => {
    for (const node of nodes) {
      if (node.type === 'text') {
        if (typeof node.text !== 'string') throw new Error('Invalid text.');
      } else if (node.type === 'freeform') {
        if (depth + 1 > maxDepth) throw new Error('Maximum nesting depth exceeded.');
        if (!node.id || ids.has(node.id)) throw new Error('Missing or duplicate node ID.');
        ids.add(node.id);
        if (!node.selector) throw new Error('Missing box selector.');
        visit(node.fields.content, depth + 1);
      } else if (node.type !== 'lineBreak') {
        throw new Error('Unknown node type.');
      }
    }
  };
  if (!document.content.length) throw new Error('A document needs a paragraph.');
  for (const paragraph of document.content) {
    if (paragraph.type !== 'paragraph') throw new Error('Invalid paragraph.');
    visit(paragraph.content, 0);
  }
}
