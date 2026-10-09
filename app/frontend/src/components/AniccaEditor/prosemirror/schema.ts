import { Schema } from 'prosemirror-model';

/** Definitions are data. Every box uses the same node types and commands. */
export const editorSchema = new Schema({ nodes: {
  doc: { content: 'paragraph+' },
  paragraph: { content: 'inline*', group: 'block', parseDOM: [{ tag: 'p' }], toDOM: () => ['p', 0] },
  text: { group: 'inline' },
  box: {
    inline: true, group: 'inline', content: 'box_field*', defining: true, selectable: true,
    attrs: { id: { default: null }, definitionId: {}, definitionVersion: {}, selector: {} },
    parseDOM: [{ tag: 'span[data-anicca-box]', getAttrs: (element) => ({
      id: element.getAttribute('data-id'), definitionId: element.getAttribute('data-definition'),
      definitionVersion: Number(element.getAttribute('data-version')), selector: element.getAttribute('data-selector'),
    }) }],
    toDOM: (node) => ['span', { 'data-anicca-box': 'box', 'data-id': node.attrs.id,
      'data-definition': node.attrs.definitionId, 'data-version': node.attrs.definitionVersion,
      'data-selector': node.attrs.selector }, 0],
  },
  box_field: {
    inline: true, content: 'inline*', defining: true,
    attrs: { name: {}, kind: {}, value: { default: null } },
    parseDOM: [{ tag: 'span[data-anicca-field]', getAttrs: (element) => ({
      name: element.getAttribute('data-anicca-field'), kind: element.getAttribute('data-kind'),
      value: JSON.parse(element.getAttribute('data-value') ?? 'null'),
    }) }],
    toDOM: (node) => ['span', { 'data-anicca-field': node.attrs.name,
      'data-kind': node.attrs.kind, 'data-value': JSON.stringify(node.attrs.value) }, 0],
  },
  hard_break: { inline: true, group: 'inline', selectable: false,
    parseDOM: [{ tag: 'br' }], toDOM: () => ['br'] },
} });
