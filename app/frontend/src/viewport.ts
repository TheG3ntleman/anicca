/** Keep the shell within the visible viewport, including when iOS opens a keyboard. */
export function initializeViewport(): () => void {
  const viewport = window.visualViewport;
  const style = document.documentElement.style;
  let frame = 0;
  const update = () => {
    style.setProperty('--viewport-height', `${viewport?.height ?? window.innerHeight}px`);
    style.setProperty('--viewport-width', `${viewport?.width ?? window.innerWidth}px`);
    style.setProperty('--viewport-top', `${viewport?.offsetTop ?? 0}px`);
    style.setProperty('--viewport-left', `${viewport?.offsetLeft ?? 0}px`);
  };
  const scheduleUpdate = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(update);
  };

  // Safari may ignore viewport zoom restrictions; suppress its touch gestures too.
  // Single-finger scrolling and text interaction remain available inside widgets.
  const touchEnvironment = window.matchMedia('(any-pointer: coarse)');
  const preventGesture = (event: Event) => {
    if (touchEnvironment.matches) event.preventDefault();
  };
  const preventPinch = (event: TouchEvent) => {
    if (touchEnvironment.matches && event.touches.length > 1) event.preventDefault();
  };

  update();
  window.addEventListener('resize', scheduleUpdate);
  viewport?.addEventListener('resize', scheduleUpdate);
  viewport?.addEventListener('scroll', scheduleUpdate);
  document.addEventListener('gesturestart', preventGesture, { passive: false });
  document.addEventListener('gesturechange', preventGesture, { passive: false });
  document.addEventListener('touchmove', preventPinch, { passive: false });

  return () => {
    cancelAnimationFrame(frame);
    window.removeEventListener('resize', scheduleUpdate);
    viewport?.removeEventListener('resize', scheduleUpdate);
    viewport?.removeEventListener('scroll', scheduleUpdate);
    document.removeEventListener('gesturestart', preventGesture);
    document.removeEventListener('gesturechange', preventGesture);
    document.removeEventListener('touchmove', preventPinch);
  };
}
