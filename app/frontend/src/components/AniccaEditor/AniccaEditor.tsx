import { useEffect, useRef } from 'react';
import { EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { keymap } from 'prosemirror-keymap';
import { baseKeymap } from 'prosemirror-commands';
import { history, redo, undo } from 'prosemirror-history';
import { editorSchema } from './prosemirror/schema';
import styles from './AniccaEditor.module.css';

interface AniccaEditorProps {
  onTextChange?: (hasText: boolean) => void;
  onFocusChange?: (focused: boolean) => void;
}

export function AniccaEditor({ onTextChange, onFocusChange }: AniccaEditorProps) {
  const host = useRef<HTMLDivElement>(null);
  const callbacks = useRef({ onTextChange, onFocusChange });
  callbacks.current = { onTextChange, onFocusChange };

  useEffect(() => {
    if (!host.current) return;
    const view = new EditorView(host.current, {
      state: EditorState.create({
        schema: editorSchema,
        plugins: [
          history(),
          keymap({ 'Mod-z': undo, 'Mod-Shift-z': redo, 'Mod-y': redo }),
          keymap(baseKeymap),
        ],
      }),
      attributes: {
        class: styles.document,
        role: 'textbox',
        'aria-label': 'Entry text',
        'aria-multiline': 'true',
        'aria-describedby': 'composer-prompt',
        spellcheck: 'true',
      },
      dispatchTransaction(transaction) {
        view.updateState(view.state.apply(transaction));
        if (transaction.docChanged) {
          callbacks.current.onTextChange?.(view.state.doc.textContent.length > 0);
        }
      },
      handleDOMEvents: {
        focus: () => { callbacks.current.onFocusChange?.(true); return false; },
        blur: () => { callbacks.current.onFocusChange?.(false); return false; },
      },
    });
    return () => view.destroy();
  }, []);

  return <div ref={host} className={styles.host} />;
}
