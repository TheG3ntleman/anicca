import type { Node as EditorNode, Schema } from 'prosemirror-model';
import type { InlineNode, NarrativeDocument, BoxDefinition, BoxInstance, FieldValue } from '../../../document/types';
import { validateDocument } from '../../../document/validation';
import { boxDefinitions } from '../../../document/boxDefinitions';
import { BoxRegistry } from '../../../document/boxRegistry';

export function boxToEditor(box: BoxInstance, schema: Schema, registry?: BoxRegistry): EditorNode {
  const names = registry ? registry.get(box.definitionId, box.definitionVersion).fields.map((field) => field.name) : Object.keys(box.fields);
  return schema.nodes.box.create({ id: box.id, definitionId: box.definitionId,
    definitionVersion: box.definitionVersion, selector: box.selector },
  names.map((name) => {
    const value = box.fields[name];
    return schema.nodes.box_field.create({
    name, kind: value.kind, value: value.kind === 'freeform' ? null : value.value,
  }, value.kind === 'freeform' ? inlineToEditor(value.content, schema, registry) : undefined);
  }));
}
function inlineToEditor(nodes: InlineNode[], schema: Schema, registry?: BoxRegistry): EditorNode[] {
  return nodes.flatMap((node) => {
    if (node.type === 'text') return node.text ? [schema.text(node.text)] : [];
    if (node.type === 'lineBreak') return [schema.nodes.hard_break.create()];
    return [boxToEditor(node, schema, registry)];
  });
}
function inlineFromEditor(parent: EditorNode): InlineNode[] {
  const nodes: InlineNode[] = [];
  parent.forEach((node) => {
    if (node.isText) nodes.push({ type: 'text', text: node.text! });
    else if (node.type.name === 'hard_break') nodes.push({ type: 'lineBreak' });
    else if (node.type.name === 'box') {
      const fields: Record<string, FieldValue> = {};
      node.forEach((field) => {
        if (Object.hasOwn(fields, field.attrs.name) || (field.attrs.kind !== 'freeform' && field.content.size)) throw new Error('Invalid editor field structure.');
        fields[field.attrs.name] = field.attrs.kind === 'freeform'
          ? { kind: 'freeform', content: inlineFromEditor(field) }
          : { kind: field.attrs.kind, value: field.attrs.value };
      });
      nodes.push({ type: 'box', id: node.attrs.id, definitionId: node.attrs.definitionId,
        definitionVersion: node.attrs.definitionVersion, selector: node.attrs.selector, fields });
    } else throw new Error(`Unsupported editor node: ${node.type.name}`);
  });
  return nodes;
}
export function toAniccaDocument(doc: EditorNode, id: string, definitions: BoxDefinition[] = boxDefinitions): NarrativeDocument {
  const content: NarrativeDocument['content'] = [];
  doc.forEach((paragraph) => content.push({ type: 'paragraph', content: inlineFromEditor(paragraph) }));
  return { schemaVersion: 2, id, type: 'narrative', definitions: structuredClone(definitions), content };
}
export function fromAniccaDocument(document: NarrativeDocument, schema: Schema): EditorNode {
  validateDocument(document);
  const registry = new BoxRegistry(document.definitions);
  return schema.nodes.doc.create(null, document.content.map((p) => schema.nodes.paragraph.create(null, inlineToEditor(p.content, schema, registry))));
}

export { inlineToEditor };
export function boxFromEditor(node: EditorNode): BoxInstance {
  const wrapper = node.type.schema.nodes.paragraph.create(null, node);
  return inlineFromEditor(wrapper)[0] as BoxInstance;
}
