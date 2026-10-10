import { useEffect, useRef, type CSSProperties } from 'react';
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
          <span className={styles.halo} />
          <span className={styles.ripple} />
          <span className={styles.ring}>
            <span className={styles.sweep} />
            <span className={styles.tick} />
          </span>
          {Array.from({ length: 12 }, (_, index) => (
            <i
              key={index}
              className={styles.spark}
              style={
                {
                  '--angle': `${index * 30}deg`,
                  '--delay': `${340 + (index % 3) * 35}ms`,
                  '--distance': `${index % 2 ? 108 : 88}px`,
                } as CSSProperties
              }
            />
          ))}
        </div>
        <h2>{message}</h2>
        <p>Review complete. One step at a time.</p>
      </div>
    </dialog>
  );
}
