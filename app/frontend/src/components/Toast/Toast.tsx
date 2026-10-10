import { useEffect } from 'react';
import styles from './Toast.module.css';
export function Toast({
  message,
  onUndo,
  onDismiss,
}: {
  message: string;
  onUndo?: () => void;
  onDismiss: () => void;
}) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 6500);
    return () => clearTimeout(timer);
  }, [onDismiss]);
  return (
    <div className={styles.toast} role="status">
      <span>{message}</span>
      {onUndo && <button onClick={onUndo}>Undo</button>}
      <button onClick={onDismiss} aria-label="Dismiss notification">
        ×
      </button>
    </div>
  );
}
