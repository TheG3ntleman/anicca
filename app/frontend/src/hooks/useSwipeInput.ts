import { useCallback, useEffect, useRef, type PointerEvent } from 'react';

export interface SwipeInput {
  target: EventTarget;
  currentTarget: HTMLElement;
  pointerId: number;
  pointerType: string;
  isPrimary: boolean;
  button: number;
  clientX: number;
  clientY: number;
  timeStamp: number;
  nativeTouch?: boolean;
}

interface Handlers {
  start: (event: SwipeInput) => boolean;
  move: (event: SwipeInput) => boolean;
  end: (event: SwipeInput) => void;
  cancel: (id: number) => void;
}

/** Touch owns touch gestures; pointer events remain available for pen/mouse input.
 * A non-passive touchmove only prevents native scrolling after horizontal lock.
 * Window listeners keep tracking when a preview changes hit-testing mid-drag.
 */
export function useSwipeInput(handlers: Handlers) {
  const latest = useRef(handlers);
  latest.current = handlers;
  const touchId = useRef<number | null>(null);
  const dispose = useRef<(() => void) | null>(null);
  const ref = useCallback((node: HTMLElement | null) => {
    dispose.current?.();
    dispose.current = null;
    touchId.current = null;
    if (!node) return;
    const input = (event: TouchEvent, touch: Touch): SwipeInput => ({
      target: event.target as Element,
      currentTarget: node,
      pointerId: touch.identifier,
      pointerType: 'touch',
      isPrimary: true,
      button: 0,
      clientX: touch.clientX,
      clientY: touch.clientY,
      timeStamp: event.timeStamp,
      nativeTouch: true,
    });
    const start = (event: TouchEvent) => {
      if (event.touches.length !== 1) {
        if (touchId.current !== null) latest.current.cancel(touchId.current);
        touchId.current = null;
        return;
      }
      const touch = event.touches[0];
      if (latest.current.start(input(event, touch)))
        touchId.current = touch.identifier;
    };
    const move = (event: TouchEvent) => {
      if (touchId.current === null) return;
      if (event.touches.length !== 1) {
        latest.current.cancel(touchId.current);
        touchId.current = null;
        return;
      }
      const touch = Array.from(event.touches).find(
        (touch) => touch.identifier === touchId.current,
      );
      if (touch && latest.current.move(input(event, touch)) && event.cancelable)
        event.preventDefault();
    };
    const end = (event: TouchEvent) => {
      if (touchId.current === null) return;
      const touch = Array.from(event.changedTouches).find(
        (touch) => touch.identifier === touchId.current,
      );
      if (!touch) return;
      latest.current.end(input(event, touch));
      touchId.current = null;
    };
    const cancel = () => {
      if (touchId.current !== null) latest.current.cancel(touchId.current);
      touchId.current = null;
    };
    node.addEventListener('touchstart', start, { passive: true });
    window.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('touchend', end);
    window.addEventListener('touchcancel', cancel);
    window.addEventListener('blur', cancel);
    dispose.current = () => {
      node.removeEventListener('touchstart', start);
      window.removeEventListener('touchmove', move);
      window.removeEventListener('touchend', end);
      window.removeEventListener('touchcancel', cancel);
      window.removeEventListener('blur', cancel);
    };
  }, []);
  useEffect(() => () => dispose.current?.(), []);
  return {
    ref,
    bind: {
      onPointerDown(event: PointerEvent<HTMLElement>) {
        if (touchId.current === null) latest.current.start(event);
      },
      onPointerMove(event: PointerEvent<HTMLElement>) {
        if (touchId.current === null) latest.current.move(event);
      },
      onPointerUp(event: PointerEvent<HTMLElement>) {
        if (touchId.current === null) latest.current.end(event);
      },
      onPointerCancel(event: PointerEvent<HTMLElement>) {
        if (touchId.current === null)
          latest.current.cancel(event.pointerId ?? 0);
      },
      onLostPointerCapture(event: PointerEvent<HTMLElement>) {
        if (touchId.current === null)
          latest.current.cancel(event.pointerId ?? 0);
      },
    },
  };
}
