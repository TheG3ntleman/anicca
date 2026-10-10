import { useEffect, useRef } from 'react';
import styles from './Celebration.module.css';
export function Celebration({
  message,
  onDone,
}: {
  message: string;
  onDone: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    dialog.current?.showModal();
    const timer = setTimeout(() => done.current(), 1900);
    return () => {
      clearTimeout(timer);
      dialog.current?.close();
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className={styles.celebration}
      aria-label="Review complete"
      onCancel={(event) => event.preventDefault()}
    >
      <div className={styles.content} role="status">
        <div className={styles.symbol} aria-hidden="true">
          ✓<i />
          <i />
          <i />
          <i />
        </div>
        <h2>{message}</h2>
        <p>Review complete. One step at a time.</p>
      </div>
    </dialog>
  );
}
