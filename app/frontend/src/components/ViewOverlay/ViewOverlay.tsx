import {
  useCallback,
  useLayoutEffect,
  useRef,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { useCircularSwipe, wrapIndex } from '../../hooks/useCircularSwipe';
import styles from './ViewOverlay.module.css';

export interface OverlayView {
  id: string;
  label: string;
  content: ReactNode;
}

/** Full-screen, circular navigation with mounted pages to retain local state. */
export function ViewOverlay({
  views,
  onClose,
  title = 'Tools',
  locked = false,
}: {
  views: [OverlayView, ...OverlayView[]];
  title?: string;
  onClose: () => void;
  locked?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const pager = useCircularSwipe(views.length, !locked);
  const attachDialog = useCallback(
    (element: HTMLDialogElement | null) => {
      dialog.current = element;
      pager.ref(element);
    },
    [pager.ref],
  );
  useLayoutEffect(() => {
    const element = dialog.current!;
    element.showModal();
    return () => element.close();
  }, []);
  const activeView = views[pager.index];
  const pagePosition = (index: number) => {
    const forward = wrapIndex(index - pager.index, views.length);
    if (views.length === 2 && forward === 1) return pager.offset > 0 ? -1 : 1;
    return forward > views.length / 2 ? forward - views.length : forward;
  };
  return (
    <dialog
      ref={attachDialog}
      className={styles.overlay}
      aria-label={title}
      data-current-view={activeView.id}
      data-dragging={pager.dragging || undefined}
      onCancel={(event) => {
        event.preventDefault();
        if (!locked) onClose();
      }}
      {...pager.bind}
    >
      <header className={styles.header}>
        <nav
          className={styles.ring}
          aria-label="Overlay views"
          onKeyDown={(event) => {
            if (!locked && ['ArrowLeft', 'ArrowRight'].includes(event.key)) {
              event.preventDefault();
              pager.select(pager.index + (event.key === 'ArrowLeft' ? -1 : 1));
            }
          }}
        >
          {[-2, -1, 0, 1, 2].map((position) => {
            const index = wrapIndex(pager.index + position, views.length);
            const view = views[index];
            const appearance = {
              '--label-position': position,
              '--label-drag': `${(pager.offset / pager.width) * 100}%`,
            } as CSSProperties;
            // These outer labels only fill the ring's edges during a drag.
            if (Math.abs(position) === 2)
              return (
                <span
                  key={position}
                  className={styles.label}
                  style={appearance}
                  aria-hidden="true"
                >
                  {view.label}
                </span>
              );
            return (
              <button
                key={position}
                className={styles.label}
                style={appearance}
                data-view-swipe-surface
                aria-current={position === 0 ? 'page' : undefined}
                disabled={locked}
                onClick={() => pager.select(index)}
              >
                {view.label}
              </button>
            );
          })}
        </nav>
        <button
          className={styles.close}
          type="button"
          aria-label="Close overlay"
          disabled={locked}
          onClick={onClose}
        >
          ×
        </button>
      </header>
      <div className={styles.pages}>
        {views.map((view, index) => (
          <section
            key={view.id}
            className={styles.page}
            data-overlay-page={view.id}
            aria-label={view.label}
            aria-hidden={index !== pager.index}
            inert={index !== pager.index || pager.dragging}
            style={{
              transform: `translateX(calc(${pagePosition(index) * 100}% + ${pager.offset}px))`,
            }}
          >
            {view.content}
          </section>
        ))}
      </div>
    </dialog>
  );
}
