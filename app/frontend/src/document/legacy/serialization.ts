import type { InlineNode, NarrativeDocument } from './types';
import { validateDocument } from './validation';

// Explicit delimiters plus JSON-escaped strings make user text unambiguous.
export function serializeDocument(document: NarrativeDocument): string {
  validateDocument(document);
  const inline = (nodes: InlineNode[]): string => nodes.map((node) => {
    if (node.type === 'text') return `@text(${JSON.stringify(node.text)})`;
    if (node.type === 'lineBreak') return '@break()';
    return `@freeform(${JSON.stringify(node.id)},${JSON.stringify(node.selector)}){${inline(node.fields.content)}}`;
  }).join('');
  return `@document(${JSON.stringify(document.id)},1){${document.content.map((p) => `@paragraph{${inline(p.content)}}`).join('')}}`;
}

export function parseDocument(raw: string): NarrativeDocument {
  let position = 0;
  const take = (token: string) => {
    if (!raw.startsWith(token, position)) throw new Error(`Expected ${token} at ${position}.`);
    position += token.length;
  };
  const string = (): string => {
    const match = /^"(?:[^"\\]|\\.)*"/.exec(raw.slice(position));
    if (!match) throw new Error(`Expected a string at ${position}.`);
    position += match[0].length;
    return JSON.parse(match[0]);
  };
  const inline = (depth: number): InlineNode[] => {
    if (depth > 32) throw new Error('Maximum serialization nesting depth exceeded.');
    const result: InlineNode[] = [];
    while (position < raw.length && raw[position] !== '}') {
      if (raw.startsWith('@text(', position)) {
        take('@text('); const text = string(); take(')');
        result.push({ type: 'text', text });
      } else if (raw.startsWith('@break()', position)) {
        take('@break()'); result.push({ type: 'lineBreak' });
      } else {
        take('@freeform('); const id = string(); take(','); const selector = string(); take('){');
        const content = inline(depth + 1); take('}');
        result.push({ type: 'freeform', id, selector, fields: { content } });
      }
    }
    return result;
  };
  take('@document('); const id = string(); take(',1){');
  const content: NarrativeDocument['content'] = [];
  while (position < raw.length && raw[position] !== '}') {
    take('@paragraph{'); content.push({ type: 'paragraph', content: inline(0) }); take('}');
  }
  take('}');
  if (position !== raw.length) throw new Error('Unexpected trailing content.');
  const document: NarrativeDocument = { schemaVersion: 1, id, type: 'narrative', content };
  validateDocument(document);
  return document;
}
