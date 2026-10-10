import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
} from 'react';
import { useSwipeInput, type SwipeInput } from './useSwipeInput';

export function wrapIndex(index: number, count: number): number {
  return ((index % count) + count) % count;
}

interface Gesture {
  id: number;
  x: number;
  y: number;
  at: number;
  width: number;
  locked: boolean;
}

/** A circular pager: horizontal movement tracks the pointer; vertical movement scrolls. */
export function useCircularSwipe(count: number, enabled = true) {
  const [index, setIndex] = useState(0);
  const [offset, setOffset] = useState(0);
  const [width, setWidth] = useState(1);
  const gesture = useRef<Gesture | null>(null);
  const suppressUntil = useRef(0);
  const cancel = useCallback(() => {
    if (gesture.current?.locked) suppressUntil.current = Date.now() + 350;
    gesture.current = null;
    setOffset(0);
  }, []);
  const select = (next: number) => {
    if (!enabled) return;
    cancel();
    setIndex(wrapIndex(next, count));
  };
  useEffect(() => {
    if (!enabled) cancel();
  }, [enabled, cancel]);
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') cancel();
    };
    window.addEventListener('blur', cancel);
    window.addEventListener('resize', cancel);
    window.visualViewport?.addEventListener('resize', cancel);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('blur', cancel);
      window.removeEventListener('resize', cancel);
      window.visualViewport?.removeEventListener('resize', cancel);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [cancel]);

  const move = (event: SwipeInput): boolean => {
    const start = gesture.current;
    if (!start || (event.pointerId ?? 0) !== start.id) return false;
    const dx = event.clientX - start.x;
    const dy = Math.abs(event.clientY - start.y);
    if (!start.locked) {
      if (Math.max(Math.abs(dx), dy) < 8) return false;
      if (dy >= Math.abs(dx)) {
        gesture.current = null;
        return false;
      }
      start.locked = true;
      try {
        if (!event.nativeTouch)
          event.currentTarget.setPointerCapture?.(event.pointerId);
      } catch {
        /* The pointer may already have ended. */
      }
    }
    setOffset(Math.max(-start.width, Math.min(start.width, dx)));
    return true;
  };

  const input = useSwipeInput({
    start(event: SwipeInput) {
      if (
        !enabled ||
        count < 2 ||
        !event.isPrimary ||
        (event.pointerType === 'mouse' && event.button !== 0)
      )
        return false;
      const target = event.target as Element;
      if (
        target.closest(
          'input,textarea,select,a,summary,pre,[contenteditable]',
        ) ||
        (target.closest('button') &&
          !target.closest('[data-view-swipe-surface]'))
      )
        return false;
      const pageWidth =
        event.currentTarget.getBoundingClientRect().width ||
        window.visualViewport?.width ||
        window.innerWidth;
      setWidth(pageWidth);
      gesture.current = {
        id: event.pointerId ?? 0,
        x: event.clientX,
        y: event.clientY,
        at: event.timeStamp,
        width: pageWidth,
        locked: false,
      };
      return true;
    },
    move,
    end(event: SwipeInput) {
      move(event);
      const start = gesture.current;
      if (!start || (event.pointerId ?? 0) !== start.id) return;
      gesture.current = null;
      if (!start.locked) return;
      suppressUntil.current = Date.now() + 350;
      const distance = event.clientX - start.x;
      const fastFlick =
        Math.abs(distance) >= 60 && event.timeStamp - start.at < 220;
      if (Math.abs(distance) >= start.width * 0.32 || fastFlick)
        setIndex((current) =>
          wrapIndex(current + (distance < 0 ? 1 : -1), count),
        );
      setOffset(0);
    },
    cancel(id: number) {
      if (id === gesture.current?.id) cancel();
    },
  });
  return {
    index: wrapIndex(index, count),
    offset,
    width,
    dragging: offset !== 0,
    select,
    ref: input.ref,
    bind: {
      ...input.bind,
      onClickCapture(event: MouseEvent<HTMLElement>) {
        if (Date.now() < suppressUntil.current) {
          event.preventDefault();
          event.stopPropagation();
        }
      },
    },
  };
}
