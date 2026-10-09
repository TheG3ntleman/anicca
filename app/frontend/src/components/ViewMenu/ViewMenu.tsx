import { useEffect, useRef, useState } from 'react';
import styles from './ViewMenu.module.css';

export type AppView = 'compose' | 'library';

export function ViewMenu({ view, onViewChange }: {
  view: AppView;
  onViewChange: (view: AppView) => void;
}) {
  const drawer = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [active, setActive] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const frame = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => {
    cancelAnimationFrame(frame.current);
    clearTimeout(timer.current);
  }, []);

  const open = () => {
    clearTimeout(timer.current);
    setActive(true);
    drawer.current?.showModal();
    // Let the closed position paint before transitioning to the open position.
    frame.current = requestAnimationFrame(() => {
      frame.current = requestAnimationFrame(() => setExpanded(true));
    });
  };

  const close = () => {
    cancelAnimationFrame(frame.current);
    setExpanded(false);
    clearTimeout(timer.current);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    timer.current = setTimeout(() => drawer.current?.close(), reduced ? 0 : 320);
  };

  return (
    <>
      <button ref={trigger} type="button" className={styles.trigger}
        style={{ visibility: active ? 'hidden' : undefined }}
        aria-label="Open Anicca navigation" aria-haspopup="dialog"
        aria-expanded={active} aria-controls="view-navigation" onClick={open}>
        <span className={styles.circle} aria-hidden="true" />
      </button>
      <dialog ref={drawer} id="view-navigation" className={styles.drawer}
        data-expanded={expanded} aria-label="Anicca navigation"
        onCancel={(event) => { event.preventDefault(); close(); }}
        onClose={() => {
          setActive(false);
          setExpanded(false);
          frame.current = requestAnimationFrame(() => trigger.current?.focus());
        }}>
        <button type="button" className={styles.backdrop}
          aria-label="Close navigation" tabIndex={-1} onClick={close} />
        <div className={styles.panel}>
          <nav aria-label="App views">
            {(['compose', 'library'] as const).map((option) => (
              <button key={option} type="button" className={styles.option}
                aria-current={view === option ? 'page' : undefined}
                onClick={() => { onViewChange(option); close(); }}>
                {option === 'compose' ? 'Compose' : 'Library'}
              </button>
            ))}
          </nav>
        </div>
        <div className={styles.circleTrack}>
        <button type="button" className={`${styles.trigger} ${styles.movingTrigger}`}
          aria-label="Close Anicca navigation" autoFocus onClick={close}>
          <span className={styles.circle} aria-hidden="true" />
        </button>
        </div>
      </dialog>
    </>
  );
}
