import type { BoxDefinition, BoxInstance, FieldValue } from './types';

export function createBox(definition: BoxDefinition): BoxInstance {
  const fields: Record<string, FieldValue> = {};
  for (const field of definition.fields) {
    if (field.kind === 'freeform') fields[field.name] = { kind: 'freeform', content: [] };
    else if (field.kind === 'text') fields[field.name] = { kind: 'text', value: field.default ?? '' };
    else if (field.kind === 'number') fields[field.name] = { kind: 'number', value: field.default ?? null };
    else fields[field.name] = { kind: 'choice', value: field.default ?? null };
  }
  return { type: 'box', id: crypto.randomUUID(), definitionId: definition.id,
    definitionVersion: definition.version, selector: definition.selector, fields };
}
