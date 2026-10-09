import { useState } from 'react';
import { AniccaEditor } from '../AniccaEditor/AniccaEditor';
import styles from './Composer.module.css';
import type { EntrySession } from '../../state/EntrySession';
import { useEntrySession } from '../../state/useEntrySession';

export function Composer({ session }: { session: EntrySession }) {
  const [focused, setFocused] = useState(false);
  const { document } = useEntrySession(session);
  const hasContent = document.content.some((paragraph) => paragraph.content.length > 0);
  const expanded = hasContent;

  return (
    <div className={styles.composer} data-expanded={expanded} data-focused={focused}>
      <div className={styles.promptSpace}>
        <h1 id="composer-prompt" className={styles.prompt}>What on your mind?</h1>
      </div>
      <div className={styles.editorSpace}>
        <AniccaEditor session={session} onFocusChange={setFocused} />
      </div>
    </div>
  );
}
