import {
  useLayoutEffect,
  useRef,
  type CSSProperties,
  type ReactNode,
} from 'react';
import type { SwipePhase } from '../../hooks/useCreateSwipe';
import styles from './SlidePanel.module.css';
interface Props {
  title: string;
  phase: Exclude<SwipePhase, 'idle'>;
  offset: number;
  width: number;
  locked?: boolean;
  onClose: () => void;
  onSettled: () => void;
  children: ReactNode;
}

/** A non-interactive preview during a drag, promoted to a native modal on release. */
export function SlidePanel({
  title,
  phase,
  offset,
  width,
  locked = false,
  onClose,
  onSettled,
  children,
}: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  useLayoutEffect(() => {
    const dialog = ref.current!;
    if (phase === 'opening') {
      if (dialog.open) dialog.close();
      dialog.showModal();
    } else if (!dialog.open) dialog.setAttribute('open', '');
  }, [phase]);
  useLayoutEffect(() => {
    const dialog = ref.current!;
    return () => dialog.close();
  }, []);
  const interactive = phase === 'open';
  const appearance = {
    '--panel-offset': `${offset}px`,
    '--panel-shade': 0.65 * (1 - offset / width),
  } as CSSProperties;
  return (
    <dialog
      ref={ref}
      autoFocus
      className={styles.dialog}
      style={appearance}
      data-phase={phase}
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault();
        if (!locked && interactive) onClose();
      }}
    >
      <div
        className={styles.shade}
        aria-hidden="true"
        onClick={() => {
          if (!locked && interactive) onClose();
        }}
      />
      <section
        className={styles.surface}
        inert={!interactive}
        onTransitionEnd={(event) => {
          if (
            event.target === event.currentTarget &&
            event.propertyName === 'transform'
          )
            onSettled();
        }}
      >
        <header className={styles.header}>
          <h2>{title}</h2>
          <button
            type="button"
            aria-label="Close"
            disabled={locked || !interactive}
            onClick={onClose}
          >
            ×
          </button>
        </header>
        <div className={styles.body}>{children}</div>
      </section>
    </dialog>
  );
}
