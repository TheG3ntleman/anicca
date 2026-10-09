import type { Node as EditorNode } from 'prosemirror-model';
import type { EditorView, NodeView } from 'prosemirror-view';
import type { BoxRegistry } from '../../../../document/boxRegistry';
import styles from '../BoxView.module.css';
import { fieldValueIssues } from '../../../../document/validation';
import type { FieldDefinition, FieldValue } from '../../../../document/types';
import { undo, redo } from 'prosemirror-history';

export class FieldView implements NodeView {
  dom = document.createElement('span');
  contentDOM?: HTMLSpanElement;
  private input?: HTMLInputElement | HTMLSelectElement;
  private kind: string;
  private name: string;
  private definition: FieldDefinition;
  constructor(node: EditorNode, view: EditorView, getPos: () => number | undefined, registry: BoxRegistry) {
    this.kind = node.attrs.kind;
    this.name = node.attrs.name;
    const position = getPos();
    const parent = position === undefined ? null : view.state.doc.resolve(position).parent;
    if (!parent || parent.type.name !== 'box') throw new Error('A field must belong to a box.');
    const definition = registry.get(parent.attrs.definitionId, parent.attrs.definitionVersion);
    const field = definition.fields.find((item) => item.name === node.attrs.name)!;
    this.definition = field;
    this.dom.className = field.label === null ? styles.unnamedField : styles.field;
    if (field.label !== null) {
      const label = document.createElement('span');
      label.className = styles.label; label.contentEditable = 'false';
      label.textContent = field.label + (field.required ? ' *' : '');
      this.dom.append(label);
    }
    if (field.kind === 'freeform') {
      this.contentDOM = document.createElement('span');
      this.contentDOM.className = styles.content;
      this.dom.append(this.contentDOM);
    } else {
      this.dom.contentEditable = 'false';
      if (field.kind === 'choice') {
        const select = document.createElement('select');
        select.add(new Option('Not specified', ''));
        field.options.forEach((option) => select.add(new Option(option, option)));
        this.input = select;
      } else {
        const input = document.createElement('input');
        input.type = field.kind === 'number' ? 'number' : 'text';
        if (field.kind === 'number') {
          input.step = 'any';
          if (field.min !== undefined) input.min = String(field.min);
          if (field.max !== undefined) input.max = String(field.max);
        }
        this.input = input;
      }
      this.input.className = styles.input;
      this.input.setAttribute('aria-label', field.label ?? field.name);
      this.input.setAttribute('aria-required', String(Boolean(field.required)));
      this.input.addEventListener('keydown', (event) => {
        const key = event as KeyboardEvent;
        if ((key.metaKey || key.ctrlKey) && key.key.toLowerCase() === 'z') {
          event.preventDefault();
          (key.shiftKey ? redo : undo)(view.state, view.dispatch);
        }
      });
      this.input.addEventListener('input', () => {
        const position = getPos();
        if (position === undefined) return;
        const current = view.state.doc.nodeAt(position);
        if (!current || current.type.name !== 'box_field') return;
        const raw = this.input!.value;
        const value = field.kind === 'number' ? (raw === '' ? null : Number(raw))
          : field.kind === 'choice' ? (raw || null) : raw;
        view.dispatch(view.state.tr.setNodeMarkup(position, undefined, { ...current.attrs, value }));
      });
      this.dom.append(this.input);
    }
    this.update(node);
  }
  update(node: EditorNode) {
    if (node.type.name !== 'box_field' || node.attrs.kind !== this.kind || node.attrs.name !== this.name) return false;
    if (this.input) {
      const value = node.attrs.value === null ? '' : String(node.attrs.value);
      if (this.input instanceof HTMLSelectElement) {
        this.input.querySelectorAll('option[data-unknown]').forEach((option) => option.remove());
        if (value && !Array.from(this.input.options).some((option) => option.value === value)) {
          const option = new Option(`${value} (unrecognized)`, value);
          option.dataset.unknown = 'true'; this.input.add(option);
        }
      }
      if (this.input.value !== value) this.input.value = value;
      const issues = fieldValueIssues(this.definition, { kind: node.attrs.kind, value: node.attrs.value } as FieldValue);
      this.input.setAttribute('aria-invalid', String(issues.length > 0));
      this.input.title = issues.map((issue) => issue.message).join(' ');
    }
    return true;
  }
  stopEvent(event: Event) { return Boolean(this.input && this.dom.contains(event.target as Node)); }
  ignoreMutation(mutation: MutationRecord | { type: 'selection'; target: Node }) {
    return !this.contentDOM || (mutation.type !== 'selection' && !this.contentDOM.contains(mutation.target));
  }
}
