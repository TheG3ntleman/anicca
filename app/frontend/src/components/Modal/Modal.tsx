import { useEffect, useRef, type ReactNode } from 'react';
import styles from './Modal.module.css';
export function Modal({
  title,
  children,
  onClose,
  locked = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  locked?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => {
      dialog.close();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={styles.modal}
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault();
        if (!locked) onClose();
      }}
    >
      <header className={styles.header}>
        <h2>{title}</h2>
        <button
          type="button"
          disabled={locked}
          onClick={onClose}
          aria-label="Close"
          className={styles.close}
        >
          ×
        </button>
      </header>
      <div className={styles.body}>{children}</div>
    </dialog>
  );
}
