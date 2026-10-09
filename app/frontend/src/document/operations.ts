import type { BoxInstance, FieldValue, InlineNode, NarrativeDocument } from './types';
import { validateDocument } from './validation';
import { BoxRegistry } from './boxRegistry';

export type ContentTarget = { paragraph: number } | { boxId: string; field: string };
export type DocumentOperation =
  | { type: 'replaceDocument'; document: NarrativeDocument }
  | { type: 'setField'; boxId: string; field: string; value: FieldValue }
  | { type: 'replaceContent'; target: ContentTarget; content: InlineNode[] }
  | { type: 'insertBox'; target: ContentTarget; index: number; box: BoxInstance }
  | { type: 'unwrapBox'; boxId: string };

export function findBox(document: NarrativeDocument, id: string): BoxInstance | undefined {
  const visit = (nodes: InlineNode[]): BoxInstance | undefined => {
    for (const node of nodes) if (node.type === 'box') {
      if (node.id === id) return node;
      for (const value of Object.values(node.fields)) if (value.kind === 'freeform') {
        const result = visit(value.content); if (result) return result;
      }
    }
  };
  for (const paragraph of document.content) {
    const result = visit(paragraph.content); if (result) return result;
  }
}

export function unwrappedContent(box: BoxInstance): InlineNode[] {
  const content: InlineNode[] = [{ type: 'text', text: `@${box.selector}` }];
  for (const [name, field] of Object.entries(box.fields)) {
    if (field.kind === 'freeform' && field.content.length) {
      content.push({ type: 'text', text: Object.keys(box.fields).length > 1 ? ` ${name}: ` : ' ' }, ...field.content);
    } else if (field.kind !== 'freeform' && field.value !== null && field.value !== '') {
      content.push({ type: 'text', text: ` ${name}=${JSON.stringify(field.value)}` });
    }
  }
  return content;
}

export function applyOperation(document: NarrativeDocument, operation: DocumentOperation, maxDepth = 32): NarrativeDocument {
  const next = structuredClone(operation.type === 'replaceDocument' ? operation.document : document);
  const contentAt = (target: ContentTarget) => {
    if ('paragraph' in target) {
      const paragraph = next.content[target.paragraph];
      if (!paragraph) throw new Error('Unknown paragraph.');
      return paragraph.content;
    }
    const field = findBox(next, target.boxId)?.fields[target.field];
    if (!field || field.kind !== 'freeform') throw new Error('Unknown freeform field.');
    return field.content;
  };
  if (operation.type === 'setField') {
    const box = findBox(next, operation.boxId);
    if (!box || !Object.hasOwn(box.fields, operation.field)) throw new Error('Unknown field.');
    box.fields[operation.field] = structuredClone(operation.value);
  } else if (operation.type === 'replaceContent') {
    const content = contentAt(operation.target);
    content.splice(0, content.length, ...structuredClone(operation.content));
  } else if (operation.type === 'insertBox') {
    const content = contentAt(operation.target);
    if (!Number.isInteger(operation.index) || operation.index < 0 || operation.index > content.length) throw new Error('Invalid insertion index.');
    content.splice(operation.index, 0, structuredClone(operation.box));
  } else if (operation.type === 'unwrapBox') {
    let found = false;
    const visit = (nodes: InlineNode[]) => {
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        if (node.type !== 'box') continue;
        if (node.id === operation.boxId) { nodes.splice(i, 1, ...unwrappedContent(node)); found = true; return; }
        for (const field of Object.values(node.fields)) if (field.kind === 'freeform') visit(field.content);
        if (found) return;
      }
    };
    for (const paragraph of next.content) { visit(paragraph.content); if (found) break; }
    if (!found) throw new Error('Unknown box.');
  }
  validateDocument(next, maxDepth);
  const registry = new BoxRegistry(next.definitions);
  const normalizeText = (nodes: InlineNode[]) => {
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      if (node.type === 'text') {
        if (!node.text) { nodes.splice(i--, 1); continue; }
        const previous = nodes[i - 1];
        if (previous?.type === 'text') { previous.text += node.text; nodes.splice(i--, 1); }
      } else if (node.type === 'box') {
        node.fields = Object.fromEntries(registry.get(node.definitionId, node.definitionVersion).fields
          .map((field) => [field.name, node.fields[field.name]]));
        for (const field of Object.values(node.fields)) if (field.kind === 'freeform') normalizeText(field.content);
      }
    }
  };
  next.content.forEach((paragraph) => normalizeText(paragraph.content));
  return next;
}

/** Shared repair for copied box identities, independent of the editing engine. */
export function normalizeBoxIds(document: NarrativeDocument): NarrativeDocument {
  const next = structuredClone(document);
  const ids = new Set([next.id]);
  const visit = (nodes: InlineNode[]) => {
    for (const node of nodes) if (node.type === 'box') {
      if (typeof node.id !== 'string' || !node.id || ids.has(node.id)) node.id = crypto.randomUUID();
      ids.add(node.id);
      for (const field of Object.values(node.fields)) if (field.kind === 'freeform') visit(field.content);
    }
  };
  next.content.forEach((paragraph) => visit(paragraph.content));
  return next;
}
