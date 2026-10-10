import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent,
  type MouseEvent,
} from 'react';

export type SwipePhase = 'idle' | 'dragging' | 'opening' | 'open' | 'closing';
interface SwipeState {
  phase: SwipePhase;
  offset: number;
  width: number;
}
interface Gesture {
  pointerId: number;
  x: number;
  y: number;
  at: number;
  width: number;
  locked: boolean;
}
const IDLE: SwipeState = { phase: 'idle', offset: 0, width: 0 };
const panelWidth = () =>
  Math.min(window.visualViewport?.width ?? window.innerWidth, 620);

/** Direction-lock horizontal drags while leaving native vertical scrolling available. */
export function useCreateSwipe(enabled: boolean) {
  const [state, setState] = useState<SwipeState>(IDLE);
  const current = useRef(state);
  const gesture = useRef<Gesture | null>(null);
  const suppressUntil = useRef(0);
  const publish = useCallback((next: SwipeState) => {
    current.current = next;
    setState(next);
  }, []);
  const settle = useCallback(() => {
    const value = current.current;
    if (value.phase === 'opening' && value.offset === 0)
      publish({ ...value, phase: 'open' });
    if (value.phase === 'closing') publish(IDLE);
  }, [publish]);
  const close = useCallback(() => {
    gesture.current = null;
    const value = current.current;
    if (value.phase !== 'idle')
      publish({ ...value, phase: 'closing', offset: value.width });
  }, [publish]);
  const open = useCallback(() => {
    if (!enabled || current.current.phase !== 'idle') return;
    const width = panelWidth();
    publish({ phase: 'opening', width, offset: width });
  }, [enabled, publish]);
  const cancel = useCallback(() => {
    if (!gesture.current) return;
    gesture.current = null;
    if (current.current.phase === 'dragging') {
      suppressUntil.current = Date.now() + 350;
      close();
    }
  }, [close]);

  // Button opens begin offscreen, then animate in after their initial layout.
  useEffect(() => {
    if (state.phase !== 'opening' || state.offset === 0) return;
    let secondFrame = 0;
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        if (current.current.phase === 'opening')
          publish({ ...current.current, offset: 0 });
      });
    });
    return () => {
      window.cancelAnimationFrame(firstFrame);
      window.cancelAnimationFrame(secondFrame);
    };
  }, [state.phase, state.offset, publish]);
  // transitionend is the normal completion path; this covers reduced motion and interruptions.
  useEffect(() => {
    if (
      state.phase !== 'closing' &&
      !(state.phase === 'opening' && state.offset === 0)
    )
      return;
    const timer = window.setTimeout(
      settle,
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 0 : 280,
    );
    return () => window.clearTimeout(timer);
  }, [state.phase, state.offset, settle]);
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') cancel();
    };
    window.addEventListener('blur', cancel);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('blur', cancel);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [cancel]);

  const move = (event: PointerEvent<HTMLElement>) => {
    const start = gesture.current;
    if (!start || (event.pointerId ?? 0) !== start.pointerId) return;
    const dx = start.x - event.clientX;
    const dy = Math.abs(start.y - event.clientY);
    if (!start.locked) {
      if (Math.max(Math.abs(dx), dy) < 8) return;
      if (dx <= 0 || dy >= dx) {
        gesture.current = null;
        return;
      }
      start.locked = true;
      try {
        event.currentTarget.setPointerCapture?.(event.pointerId);
      } catch {
        /* Pointer already ended. */
      }
    }
    publish({
      phase: 'dragging',
      width: start.width,
      offset: start.width - Math.min(start.width, Math.max(0, dx)),
    });
  };
  return {
    ...state,
    open,
    close,
    settle,
    bind: {
      onPointerDown(event: PointerEvent<HTMLElement>) {
        if (
          !enabled ||
          current.current.phase !== 'idle' ||
          event.pointerType === 'mouse' ||
          !event.isPrimary
        )
          return;
        const target = event.target as Element;
        if (
          target.closest('input,textarea,select,a,summary,[contenteditable]') ||
          (target.closest('button') && !target.closest('[data-swipe-surface]'))
        )
          return;
        gesture.current = {
          pointerId: event.pointerId ?? 0,
          x: event.clientX,
          y: event.clientY,
          at: event.timeStamp,
          width: panelWidth(),
          locked: false,
        };
      },
      onPointerMove: move,
      onPointerUp(event: PointerEvent<HTMLElement>) {
        move(event);
        const start = gesture.current;
        if (!start || (event.pointerId ?? 0) !== start.pointerId) return;
        gesture.current = null;
        if (!start.locked) return;
        suppressUntil.current = Date.now() + 350;
        const distance = start.width - current.current.offset;
        const fastFlick = distance >= 60 && event.timeStamp - start.at < 220;
        if (distance >= start.width * 0.32 || fastFlick)
          publish({ ...current.current, phase: 'opening', offset: 0 });
        else close();
      },
      onPointerCancel(event: PointerEvent<HTMLElement>) {
        if ((event.pointerId ?? 0) === gesture.current?.pointerId) cancel();
      },
      onLostPointerCapture(event: PointerEvent<HTMLElement>) {
        if ((event.pointerId ?? 0) === gesture.current?.pointerId) cancel();
      },
      onClickCapture(event: MouseEvent<HTMLElement>) {
        if (Date.now() < suppressUntil.current) {
          event.preventDefault();
          event.stopPropagation();
        }
      },
    },
  };
}
