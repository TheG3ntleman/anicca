import { NodeSelection, TextSelection, type Command, type EditorState } from 'prosemirror-state';
import { createBox } from '../../../document/boxInstances';
import type { BoxDefinition } from '../../../document/types';
import { boxToEditor, boxFromEditor, inlineToEditor } from './conversion';
import { unwrappedContent } from '../../../document/operations';
import { closeHistory } from 'prosemirror-history';

export interface BoxTrigger { from: number; to: number; query: string }

export function boxDepth(state: EditorState): number {
  const { $from } = state.selection;
  let depth = 0;
  for (let level = 1; level <= $from.depth; level++) {
    if ($from.node(level).type.name === 'box') depth++;
  }
  return depth;
}

export function findBoxTrigger(state: EditorState): BoxTrigger | null {
  if (!state.selection.empty || !state.selection.$from.parent.inlineContent) return null;
  const previous = state.selection.$from.nodeBefore;
  if (!previous?.isText) return null;
  const match = /@([a-zA-Z0-9-]*)$/.exec(previous.text!);
  if (!match) return null;
  return { from: state.selection.from - match[0].length, to: state.selection.from, query: match[1].toLowerCase() };
}

export const insertBox = (trigger: BoxTrigger, definition: BoxDefinition, maxDepth: number): Command => (state, dispatch) => {
  if (boxDepth(state) >= maxDepth) return false;
  if (dispatch) {
    const box = boxToEditor(createBox(definition), state.schema);
    const transaction = closeHistory(state.tr).replaceWith(trigger.from, trigger.to, box);
    let offset = trigger.from + 1;
    let editable: number | undefined;
    box.forEach((field) => {
      if (editable === undefined && field.attrs.kind === 'freeform') editable = offset + 1;
      offset += field.nodeSize;
    });
    transaction.setSelection(editable !== undefined ? TextSelection.create(transaction.doc, editable)
      : NodeSelection.create(transaction.doc, trigger.from));
    dispatch(transaction.scrollIntoView());
  }
  return true;
};

/** Replace the wrapper with its original selector and keep all its children. */
export const unwrapBox: Command = (state, dispatch) => {
  const { selection } = state;
  let position: number | undefined;
  let node = selection instanceof NodeSelection && selection.node.type.name === 'box'
    ? selection.node : undefined;
  if (node) position = selection.from;
  else if (selection.empty) {
    const { $from } = selection;
    if ($from.parent.type.name === 'box_field' && $from.parentOffset === 0 && $from.index($from.depth - 1) === 0) {
      position = $from.before($from.depth - 1); node = $from.node($from.depth - 1);
    } else if ($from.nodeBefore?.type.name === 'box') {
      node = $from.nodeBefore; position = selection.from - node.nodeSize;
    }
  }
  if (!node || position === undefined) return false;
  if (dispatch) {
    const selector = `@${node.attrs.selector}`;
    const replacement = inlineToEditor(unwrappedContent(boxFromEditor(node)), state.schema);
    const transaction = closeHistory(state.tr).replaceWith(position, position + node.nodeSize, replacement);
    transaction.setSelection(TextSelection.create(transaction.doc, position + selector.length));
    // Don't immediately reopen the menu when reversing a box.
    transaction.setMeta('anicca-dismiss-trigger', true);
    dispatch(transaction.scrollIntoView());
  }
  return true;
};

export const lineBreakInBox: Command = (state, dispatch) => {
  if (!boxDepth(state)) return false;
  if (dispatch) dispatch(state.tr.replaceSelectionWith(state.schema.nodes.hard_break.create()).scrollIntoView());
  return true;
};

export const leaveBox = (direction: -1 | 1): Command => (state, dispatch) => {
  const { $from } = state.selection;
  if (!state.selection.empty || $from.parent.type.name !== 'box_field') return false;
  const atBoundary = direction === -1 ? $from.parentOffset === 0 : $from.parentOffset === $from.parent.content.size;
  if (!atBoundary) return false;
  if (dispatch) {
    const position = direction === -1 ? $from.before($from.depth - 1) : $from.after($from.depth - 1);
    dispatch(state.tr.setSelection(TextSelection.create(state.doc, position)).scrollIntoView());
  }
  return true;
};
