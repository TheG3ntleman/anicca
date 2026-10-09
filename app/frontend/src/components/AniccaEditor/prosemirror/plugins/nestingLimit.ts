import { Plugin } from 'prosemirror-state';
import type { Node } from 'prosemirror-model';
import { BoxRegistry } from '../../../../document/boxRegistry';
import { normalizeBoxIds } from '../../../../document/operations';
import { validateDocument } from '../../../../document/validation';
import { toAniccaDocument } from '../conversion';

export function documentDepth(node: Node): number {
  let maximum = 0;
  const visit = (parent: Node, depth: number) => parent.forEach((child) => {
    const next = depth + (child.type.name === 'box' ? 1 : 0);
    maximum = Math.max(maximum, next); visit(child, next);
  });
  visit(node, 0); return maximum;
}

/** Early editor feedback delegates the rules to the independent document model. */
export function nestingLimit(getMaxDepth: () => number, getRegistry: () => BoxRegistry = () => new BoxRegistry(), getId: () => string = () => 'editor-root') {
  return new Plugin({
    filterTransaction(transaction) {
      if (!transaction.docChanged) return true;
      try {
        const candidate = toAniccaDocument(transaction.doc, getId(), getRegistry().definitions);
        validateDocument(normalizeBoxIds(candidate), getMaxDepth());
        return true;
      } catch { return false; }
    },
    appendTransaction(transactions, _old, state) {
      if (!transactions.some((transaction) => transaction.docChanged)) return null;
      const candidate = toAniccaDocument(state.doc, getId(), getRegistry().definitions);
      const normalized = normalizeBoxIds(candidate);
      const ids: string[] = [];
      const collect = (nodes: typeof normalized.content[number]['content']) => {
        for (const node of nodes) if (node.type === 'box') {
          ids.push(node.id);
          for (const field of Object.values(node.fields)) if (field.kind === 'freeform') collect(field.content);
        }
      };
      normalized.content.forEach((paragraph) => collect(paragraph.content));
      const transaction = state.tr;
      let index = 0;
      state.doc.descendants((node, position) => {
        if (node.type.name !== 'box') return;
        const id = ids[index++];
        if (node.attrs.id !== id) transaction.setNodeMarkup(position, undefined, { ...node.attrs, id });
      });
      return transaction.docChanged ? transaction : null;
    },
  });
}
