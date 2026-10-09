import { useEffect, useRef, useState } from 'react';
import { EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { keymap } from 'prosemirror-keymap';
import { baseKeymap } from 'prosemirror-commands';
import { history, redo, undo } from 'prosemirror-history';
import { editorSchema } from './prosemirror/schema';
import { insertBox, leaveBox, lineBreakInBox } from './prosemirror/commands';
import { nestingLimit } from './prosemirror/plugins/nestingLimit';
import { boxDeletion } from './prosemirror/plugins/boxDeletion';
import { commandTrigger, type CommandMenuState } from './prosemirror/plugins/commandTrigger';
import { BoxView } from './prosemirror/nodeViews/BoxView';
import { FieldView } from './prosemirror/nodeViews/FieldView';
import { fromAniccaDocument } from './prosemirror/conversion';
import { EntryEditorAdapter } from './prosemirror/adapter';
import type { EntrySession } from '../../state/EntrySession';
import type { BoxDefinition } from '../../document/types';
import { CommandMenu } from '../CommandMenu/CommandMenu';
import styles from './AniccaEditor.module.css';

interface AniccaEditorProps {
  session: EntrySession;
  onFocusChange?: (focused: boolean) => void;
}

export function AniccaEditor({ session, onFocusChange }: AniccaEditorProps) {
  const host = useRef<HTMLDivElement>(null);
  const editor = useRef<EditorView | null>(null);
  const callbacks = useRef({ onFocusChange });
  callbacks.current = { onFocusChange };
  const [error, setError] = useState<string | null>(null);
  const [menu, setMenu] = useState<CommandMenuState | null>(null);

  useEffect(() => {
    if (!host.current) return;
    let adapter: EntryEditorAdapter;
    const view = new EditorView(host.current, {
      state: EditorState.create({
        doc: fromAniccaDocument(session.getSnapshot().document, editorSchema),
        plugins: [
          nestingLimit(() => session.maxDepth, () => session.registry, () => session.getSnapshot().document.id),
          commandTrigger(() => session.maxDepth, setMenu, () => session.registry),
          boxDeletion(),
          history(),
          keymap({
            'Mod-z': undo, 'Mod-Shift-z': redo, 'Mod-y': redo,
            Enter: lineBreakInBox,
            'Shift-Enter': (state, dispatch) => {
              if (dispatch) dispatch(state.tr.replaceSelectionWith(state.schema.nodes.hard_break.create()).scrollIntoView());
              return true;
            },
            ArrowLeft: leaveBox(-1), ArrowRight: leaveBox(1),
            'Mod-Enter': leaveBox(1),
          }),
          keymap(baseKeymap),
        ],
      }),
      nodeViews: {
        box: (node) => new BoxView(node, () => session.registry),
        box_field: (node, view, getPos) => new FieldView(node, view, getPos, session.registry),
      },
      attributes: {
        class: styles.document,
        role: 'textbox',
        'aria-label': 'Entry text',
        'aria-multiline': 'true',
        'aria-describedby': 'composer-prompt',
        spellcheck: 'true',
      },
      dispatchTransaction(transaction) { adapter.dispatch(transaction); },
      handleDOMEvents: {
        focus: () => { callbacks.current.onFocusChange?.(true); return false; },
        blur: () => { callbacks.current.onFocusChange?.(false); return false; },
      },
    });
    adapter = new EntryEditorAdapter(view, session, setError);
    editor.current = view;
    return () => { editor.current = null; adapter.destroy(); view.destroy(); };
  }, [session]);

  const insert = (definition: BoxDefinition) => {
    const view = editor.current;
    if (!view || !menu) return;
    insertBox(menu, definition, session.maxDepth)(view.state, view.dispatch);
    view.focus();
  };

  return (
    <div className={styles.frame}>
      <div ref={host} className={styles.host} />
      {error && <div className={styles.error} role="alert">{error}</div>}
      {menu && <CommandMenu {...menu} maxDepth={session.maxDepth} onSelect={insert} />}
    </div>
  );
}
