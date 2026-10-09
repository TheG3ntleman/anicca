import type { InlineNode, NarrativeDocument, BoxInstance, FieldDefinition, FieldValue } from './types';
import { BoxRegistry } from './boxRegistry';

export function validateDocument(document: NarrativeDocument, maxDepth = 32): void {
  if (document.schemaVersion !== 2 || document.type !== 'narrative' || typeof document.id !== 'string' || !document.id || !Array.isArray(document.content) || !document.content.length) throw new Error('Invalid document.');
  const registry = new BoxRegistry(document.definitions);
  const ids = new Set([document.id]);
  const visit = (nodes: InlineNode[], depth: number) => {
    if (!Array.isArray(nodes)) throw new Error('Invalid content.');
    for (const node of nodes) {
      if (node.type === 'text') {
        if (typeof node.text !== 'string') throw new Error('Invalid text.');
      } else if (node.type === 'box') {
        if (depth + 1 > maxDepth || typeof node.id !== 'string' || !node.id || ids.has(node.id)) throw new Error('Invalid box depth or ID.');
        ids.add(node.id);
        const definition = registry.get(node.definitionId, node.definitionVersion);
        if (node.selector !== definition.selector || !node.fields || Object.keys(node.fields).length !== definition.fields.length) throw new Error('Invalid box fields.');
        for (const field of definition.fields) {
          const value = node.fields[field.name];
          if (!value || value.kind !== field.kind) throw new Error('Field type mismatch.');
          if (value.kind === 'freeform') visit(value.content, depth + 1);
          else if (value.kind === 'text' && typeof value.value !== 'string') throw new Error('Invalid text field.');
          else if (value.kind === 'number' && value.value !== null) {
            if (typeof value.value !== 'number' || !Number.isFinite(value.value)) throw new Error('Invalid number field.');
          } else if (value.kind === 'choice' && value.value !== null
            && typeof value.value !== 'string') throw new Error('Invalid choice type.');
        }
      } else if (node.type !== 'lineBreak') throw new Error('Unknown node type.');
    }
  };
  for (const paragraph of document.content) {
    if (paragraph.type !== 'paragraph') throw new Error('Invalid paragraph.');
    visit(paragraph.content, 0);
  }
}

/** Required fields can be empty while drafting. */
export function missingRequiredFields(box: BoxInstance, registry: BoxRegistry): string[] {
  return registry.get(box.definitionId, box.definitionVersion).fields
    .filter((field) => fieldValueIssues(field, box.fields[field.name]).some((issue) => issue.code === 'required'))
    .map((field) => field.name);
}

export interface ValidationIssue { boxId: string; field: string; code: 'required' | 'range' | 'choice'; message: string }
export function fieldValueIssues(field: FieldDefinition, value: FieldValue): Pick<ValidationIssue, 'code' | 'message'>[] {
  const issues: Pick<ValidationIssue, 'code' | 'message'>[] = [];
  const empty = value.kind === 'freeform' ? !value.content.some((node) => node.type === 'box' || (node.type === 'text' && node.text.trim()))
    : value.kind === 'text' ? !value.value.trim() : value.value === null;
  if (field.required && empty) issues.push({ code: 'required', message: 'Required value is missing.' });
  if (field.kind === 'number' && value.kind === 'number' && value.value !== null
    && ((field.min !== undefined && value.value < field.min) || (field.max !== undefined && value.value > field.max))) {
    issues.push({ code: 'range', message: 'Value is outside the permitted range.' });
  }
  if (field.kind === 'choice' && value.kind === 'choice' && value.value !== null && !field.options.includes(value.value)) {
    issues.push({ code: 'choice', message: 'Value is not one of the available choices.' });
  }
  return issues;
}

export function getValidationIssues(document: NarrativeDocument): ValidationIssue[] {
  const registry = new BoxRegistry(document.definitions);
  const issues: ValidationIssue[] = [];
  const visit = (nodes: InlineNode[]) => {
    for (const box of nodes) if (box.type === 'box') {
      for (const field of registry.get(box.definitionId, box.definitionVersion).fields) {
        const value = box.fields[field.name];
        issues.push(...fieldValueIssues(field, value).map((issue) => ({ ...issue, boxId: box.id, field: field.name })));
        if (value.kind === 'freeform') visit(value.content);
      }
    }
  };
  document.content.forEach((paragraph) => visit(paragraph.content));
  return issues;
}
