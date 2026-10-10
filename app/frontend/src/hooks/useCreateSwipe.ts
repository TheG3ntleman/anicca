import { useRef, type PointerEvent, type MouseEvent } from 'react';
export function useCreateSwipe(onCreate: () => void, enabled: boolean) {
  const start = useRef<{ x: number; y: number; at: number } | null>(null);
  const suppressUntil = useRef(0);
  return {
    onPointerDown(event: PointerEvent<HTMLElement>) {
      if (
        !enabled ||
        event.pointerType === 'mouse' ||
        !event.isPrimary ||
        (event.target as Element).closest(
          'input,textarea,select,a,summary,[contenteditable]',
        ) ||
        ((event.target as Element).closest('button') &&
          !(event.target as Element).closest('[data-swipe-surface]'))
      )
        return;
      start.current = { x: event.clientX, y: event.clientY, at: Date.now() };
    },
    onPointerCancel() {
      start.current = null;
    },
    onPointerUp(event: PointerEvent<HTMLElement>) {
      const previous = start.current;
      start.current = null;
      if (!previous || !enabled) return;
      if (
        event.clientX - previous.x < -80 &&
        Math.abs(event.clientY - previous.y) < 40 &&
        Date.now() - previous.at < 800
      ) {
        suppressUntil.current = Date.now() + 350;
        onCreate();
      }
    },
    onClickCapture(event: MouseEvent<HTMLElement>) {
      if (Date.now() < suppressUntil.current) {
        event.preventDefault();
        event.stopPropagation();
      }
    },
  };
}
