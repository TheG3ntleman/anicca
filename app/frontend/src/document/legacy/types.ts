export interface NarrativeDocument {
  schemaVersion: 1;
  id: string;
  type: 'narrative';
  content: Paragraph[];
}

export interface Paragraph {
  type: 'paragraph';
  content: InlineNode[];
}

export type InlineNode =
  | { type: 'text'; text: string }
  | { type: 'lineBreak' }
  | FreeformBox;

export interface FreeformBox {
  type: 'freeform';
  id: string;
  selector: string;
  fields: { content: InlineNode[] };
}
