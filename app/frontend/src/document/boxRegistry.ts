import type { BoxDefinition } from './types';
import { boxDefinitions } from './boxDefinitions';

export function definitionKey(id: string, version: number) { return `${id}@${version}`; }

export function validateDefinitions(definitions: BoxDefinition[]): void {
  if (!Array.isArray(definitions)) throw new Error('Definitions must be an array.');
  const ids = new Set<string>();
  for (const definition of definitions) {
    if (typeof definition.id !== 'string' || !definition.id || !Number.isInteger(definition.version) || definition.version < 1
      || !/^[a-z][a-z0-9-]*$/.test(definition.selector)
      || !(definition.label === null || typeof definition.label === 'string')
      || !Array.isArray(definition.fields) || !definition.fields.length) throw new Error('Invalid box definition.');
    const key = definitionKey(definition.id, definition.version);
    if (ids.has(key)) throw new Error('Duplicate box definition version.');
    ids.add(key);
    const names = new Set<string>();
    for (const field of definition.fields) {
      if (!/^[a-z][a-zA-Z0-9_]*$/.test(field.name) || ['constructor', 'prototype', '__proto__'].includes(field.name)
        || names.has(field.name) || !(field.label === null || typeof field.label === 'string')) throw new Error('Invalid field name or label.');
      names.add(field.name);
      if (field.required !== undefined && typeof field.required !== 'boolean') throw new Error('Invalid required flag.');
      if (!['freeform', 'text', 'number', 'choice'].includes(field.kind)) throw new Error('Unsupported field type.');
      if (field.kind === 'choice' && (!Array.isArray(field.options) || !field.options.length
        || field.options.some((option) => typeof option !== 'string' || !option)
        || new Set(field.options).size !== field.options.length
        || (field.default !== undefined && !field.options.includes(field.default)))) throw new Error('Invalid choices.');
      if (field.kind === 'text' && field.default !== undefined && typeof field.default !== 'string') throw new Error('Invalid text default.');
      if (field.kind === 'number') {
        for (const value of [field.min, field.max, field.default]) {
          if (value !== undefined && !Number.isFinite(value)) throw new Error('Invalid numeric constraint.');
        }
        if (field.min !== undefined && field.max !== undefined && field.min > field.max) throw new Error('Invalid numeric range.');
        if (field.default !== undefined && ((field.min !== undefined && field.default < field.min)
          || (field.max !== undefined && field.default > field.max))) throw new Error('Default outside numeric range.');
      }
    }
  }
}

export class BoxRegistry {
  readonly definitions: BoxDefinition[];
  constructor(definitions: BoxDefinition[] = boxDefinitions) {
    validateDefinitions(definitions);
    this.definitions = structuredClone(definitions);
    for (const definition of this.definitions) {
      for (const field of definition.fields) {
        if (field.kind === 'choice') Object.freeze(field.options);
        Object.freeze(field);
      }
      Object.freeze(definition.fields);
      Object.freeze(definition);
    }
    Object.freeze(this.definitions);
    const selectors = new Set<string>();
    for (const definition of this.available()) {
      if (selectors.has(definition.selector)) throw new Error('Ambiguous box selector.');
      selectors.add(definition.selector);
    }
  }
  get(id: string, version: number): BoxDefinition {
    const definition = this.definitions.find((item) => item.id === id && item.version === version);
    if (!definition) throw new Error(`Missing box definition: ${definitionKey(id, version)}`);
    return definition;
  }
  available(): BoxDefinition[] {
    return this.definitions.filter((item) => !this.definitions.some((other) => other.id === item.id && other.version > item.version));
  }
  extend(definitions: BoxDefinition[]): BoxRegistry {
    const combined = [...this.definitions];
    for (const definition of definitions) {
      const existing = combined.find((item) => item.id === definition.id && item.version === definition.version);
      if (existing && JSON.stringify(existing) !== JSON.stringify(definition)) throw new Error('Change a definition by creating a new version.');
      if (!existing) combined.push(definition);
    }
    return new BoxRegistry(combined);
  }
  matching(query: string): BoxDefinition[] {
    return this.available().filter((item) => item.selector.startsWith(query));
  }
}
