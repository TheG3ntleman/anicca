import { EditorState, TextSelection, type Transaction } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';
import type { EntrySession } from '../../../state/EntrySession';
import { fromAniccaDocument, toAniccaDocument } from './conversion';

/** ProseMirror is a projection of the session; it never owns the entry. */
export class EntryEditorAdapter {
  private unsubscribe: () => void;
  private documentId: string;
  constructor(private view: EditorView, private session: EntrySession, private onError: (message: string | null) => void = () => {}) {
    this.documentId = session.getSnapshot().document.id;
    this.unsubscribe = session.subscribe((source) => {
      if (source !== this) this.syncFromSession();
    });
  }
  dispatch(transaction: Transaction) {
    const next = this.view.state.applyTransaction(transaction);
    const changed = next.transactions.some((item) => item.docChanged);
    if (changed) {
      const current = this.session.getSnapshot().document;
      try {
        const candidate = toAniccaDocument(next.state.doc, current.id, current.definitions);
        this.session.apply({ type: 'replaceDocument', document: candidate }, this);
      } catch (error) {
        this.onError(error instanceof Error ? error.message : 'Document update rejected.');
        return;
      }
    }
    if (!changed) { this.view.updateState(next.state); this.onError(null); return; }
    // Model normalization is authoritative too (for example, field ordering).
    const projected = fromAniccaDocument(this.session.getSnapshot().document, next.state.schema);
    if (!next.state.doc.eq(projected)) {
      const correction = next.state.tr.replaceWith(0, next.state.doc.content.size, projected.content);
      correction.setSelection(TextSelection.near(correction.doc.resolve(Math.min(next.state.selection.from, correction.doc.content.size))));
      correction.setMeta('addToHistory', false);
      this.view.updateState(next.state.applyTransaction(correction).state);
    } else this.view.updateState(next.state);
    this.onError(null);
  }
  private syncFromSession() {
    const current = this.session.getSnapshot().document;
    const desired = fromAniccaDocument(current, this.view.state.schema);
    if (current.id !== this.documentId) {
      this.documentId = current.id;
      this.view.updateState(EditorState.create({ doc: desired, plugins: this.view.state.plugins }));
      // Recreate views when switching entries, including their field-definition metadata.
      const constructors = this.view.props.nodeViews;
      if (constructors) this.view.setProps({ nodeViews: Object.fromEntries(Object.entries(constructors)
        .map(([name, constructor]) => [name, (...args: Parameters<typeof constructor>) => constructor(...args)])) });
      return;
    }
    const start = this.view.state.doc.content.findDiffStart(desired.content);
    if (start === null) {
      // Definitions may have changed even when the editor document has not.
      this.view.updateState(this.view.state);
      return;
    }
    const difference = this.view.state.doc.content.findDiffEnd(desired.content)!;
    const overlap = start - Math.min(difference.a, difference.b);
    const endA = difference.a + Math.max(0, overlap);
    const endB = difference.b + Math.max(0, overlap);
    const transaction = this.view.state.tr.replace(start, endA, desired.slice(start, endB));
    transaction.setMeta('addToHistory', false);
    if (!transaction.doc.eq(desired)) {
      // Unusual structural edits: replace content, mapping/clamping the selection.
      const replacement = this.view.state.tr.replaceWith(0, this.view.state.doc.content.size, desired.content);
      const position = Math.min(this.view.state.selection.from, replacement.doc.content.size);
      replacement.setSelection(TextSelection.near(replacement.doc.resolve(position)));
      replacement.setMeta('addToHistory', false);
      this.view.updateState(this.view.state.applyTransaction(replacement).state);
    } else {
      this.view.updateState(this.view.state.applyTransaction(transaction).state);
    }
  }
  destroy() { this.unsubscribe(); }
}
