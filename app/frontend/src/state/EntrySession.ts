import type { BoxDefinition, NarrativeDocument } from '../document/types';
import { BoxRegistry } from '../document/boxRegistry';
import { boxDefinitions, DEFAULT_MAX_DEPTH } from '../document/boxDefinitions';
import { applyOperation, type DocumentOperation } from '../document/operations';
import { getValidationIssues, validateDocument, type ValidationIssue } from '../document/validation';

export interface EntrySnapshot { document: NarrativeDocument; revision: number; issues: ValidationIssue[] }
function freeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze); Object.freeze(value);
  }
  return value;
}
export function createEntry(definitions: BoxDefinition[] = boxDefinitions): NarrativeDocument {
  return { schemaVersion: 2, id: crypto.randomUUID(), type: 'narrative', definitions: structuredClone(definitions),
    content: [{ type: 'paragraph', content: [] }] };
}

/** Primary entry state. No React, DOM, or editor dependencies. */
export class EntrySession {
  private snapshot: EntrySnapshot;
  private listeners = new Set<(source?: unknown) => void>();
  private registryValue: BoxRegistry;
  readonly maxDepth: number;
  constructor(document = createEntry(), maxDepth = DEFAULT_MAX_DEPTH) {
    if (!Number.isInteger(maxDepth) || maxDepth < 0 || maxDepth > 32) throw new Error('Invalid nesting limit.');
    validateDocument(document, maxDepth);
    this.maxDepth = maxDepth;
    this.registryValue = new BoxRegistry(document.definitions);
    const owned = applyOperation(document, { type: 'replaceDocument', document }, maxDepth);
    this.snapshot = freeze({ document: owned, revision: 0, issues: getValidationIssues(owned) });
  }
  get registry() { return this.registryValue; }
  getSnapshot = (): EntrySnapshot => this.snapshot;
  subscribe = (listener: (source?: unknown) => void): (() => void) => {
    this.listeners.add(listener); return () => { this.listeners.delete(listener); };
  };
  apply(operation: DocumentOperation, source?: unknown): void {
    const document = applyOperation(this.snapshot.document, operation, this.maxDepth);
    const registry = new BoxRegistry(document.definitions);
    // Definition versions already in use cannot silently change meaning.
    for (const definition of this.snapshot.document.definitions) {
      const existing = document.definitions.find((item) => item.id === definition.id && item.version === definition.version);
      if (document.id === this.snapshot.document.id && (!existing || JSON.stringify(existing) !== JSON.stringify(definition))) {
        throw new Error('Existing definition versions must be retained unchanged.');
      }
    }
    this.registryValue = registry;
    this.snapshot = freeze({ document, revision: this.snapshot.revision + 1, issues: getValidationIssues(document) });
    this.listeners.forEach((listener) => listener(source));
  }
  addDefinitions(definitions: BoxDefinition[]): void {
    const registry = this.registry.extend(definitions);
    this.apply({ type: 'replaceDocument', document: { ...this.snapshot.document, definitions: registry.definitions } });
  }
}
