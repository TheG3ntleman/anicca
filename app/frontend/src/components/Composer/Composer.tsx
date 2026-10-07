import { useState } from 'react';
import { AniccaEditor } from '../AniccaEditor/AniccaEditor';
import styles from './Composer.module.css';

export function Composer() {
  const [focused, setFocused] = useState(false);
  const [hasText, setHasText] = useState(false);
  const [started, setStarted] = useState(false);
  const expanded = started && (focused || hasText);

  return (
    <div className={styles.composer} data-expanded={expanded}>
      <div className={styles.promptSpace}>
        <h1 id="composer-prompt" className={styles.prompt}>What on your mind?</h1>
      </div>
      <div className={styles.editorSpace}>
        <AniccaEditor onFocusChange={setFocused} onTextChange={(textPresent) => {
          setHasText(textPresent);
          if (textPresent) setStarted(true);
        }} />
      </div>
    </div>
  );
}
