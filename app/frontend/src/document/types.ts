export type FieldDefinition = {
  name: string;
  label: string | null;
  required?: boolean;
} & (
  | { kind: 'freeform' }
  | { kind: 'text'; default?: string }
  | { kind: 'number'; default?: number; min?: number; max?: number }
  | { kind: 'choice'; options: string[]; default?: string }
);

export interface BoxDefinition {
  id: string;
  version: number;
  selector: string;
  label: string | null;
  fields: FieldDefinition[];
}

export type FieldValue =
  | { kind: 'freeform'; content: InlineNode[] }
  | { kind: 'text'; value: string }
  | { kind: 'number'; value: number | null }
  | { kind: 'choice'; value: string | null };

export interface BoxInstance {
  type: 'box';
  id: string;
  definitionId: string;
  definitionVersion: number;
  selector: string;
  fields: Record<string, FieldValue>;
}

export type InlineNode = { type: 'text'; text: string } | { type: 'lineBreak' } | BoxInstance;
export interface Paragraph { type: 'paragraph'; content: InlineNode[] }

export interface NarrativeDocument {
  schemaVersion: 2;
  id: string;
  type: 'narrative';
  // Definition snapshots travel with the document, including user-created types.
  definitions: BoxDefinition[];
  content: Paragraph[];
}
