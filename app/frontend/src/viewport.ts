export interface ViewportMetrics {
  standalone: boolean;
  editing: boolean;
  layoutHeight: number;
  layoutWidth: number;
  visual?: {
    height: number;
    width: number;
    offsetTop: number;
    offsetLeft: number;
  };
}

/** Installed iOS PWAs can under-report visualViewport.height by the safe areas.
 * Keep idle standalone layout in CSS's dynamic viewport; only a substantial
 * shrink while editing should switch it to the keyboard's visible rectangle.
 * https://bugs.webkit.org/show_bug.cgi?id=254868
 */
export function viewportFrame(metrics: ViewportMetrics) {
  const keyboard =
    !!metrics.visual &&
    metrics.editing &&
    metrics.layoutHeight - metrics.visual.height >
      Math.min(160, metrics.layoutHeight * 0.2);
  if (metrics.standalone && !keyboard)
    return {
      height: '100dvh',
      width: '100vw',
      top: '0px',
      left: '0px',
      keyboard: false,
    };
  return {
    height: `${metrics.visual?.height ?? metrics.layoutHeight}px`,
    width: `${metrics.visual?.width ?? metrics.layoutWidth}px`,
    top: `${metrics.visual?.offsetTop ?? 0}px`,
    left: `${metrics.visual?.offsetLeft ?? 0}px`,
    keyboard,
  };
}

/** Keep the shell full-screen at rest, and above the keyboard while editing. */
export function initializeViewport(): () => void {
  const viewport = window.visualViewport;
  const style = document.documentElement.style;
  const standalone = window.matchMedia('(display-mode: standalone)');
  let frame = 0;
  const update = () => {
    const active = document.activeElement;
    const editing =
      active instanceof HTMLElement &&
      active.matches(
        'textarea, input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]):not([type="file"]), [contenteditable]:not([contenteditable="false"])',
      );
    const bounds = viewportFrame({
      standalone:
        standalone.matches ||
        (navigator as Navigator & { standalone?: boolean }).standalone === true,
      editing,
      layoutHeight: Math.max(
        window.innerHeight,
        document.documentElement.clientHeight,
      ),
      layoutWidth: window.innerWidth,
      visual: viewport ?? undefined,
    });
    style.setProperty('--viewport-height', bounds.height);
    style.setProperty('--viewport-width', bounds.width);
    style.setProperty('--viewport-top', bounds.top);
    style.setProperty('--viewport-left', bounds.left);
    style.setProperty(
      '--app-safe-bottom',
      bounds.keyboard
        ? '0px'
        : 'clamp(0px, env(safe-area-inset-bottom, 0px), 34px)',
    );
  };
  const scheduleUpdate = () => {
    window.cancelAnimationFrame(frame);
    frame = window.requestAnimationFrame(update);
  };

  // Safari may ignore viewport zoom restrictions; suppress its touch gestures too.
  // Single-finger scrolling and text interaction remain available inside widgets.
  const touchEnvironment = window.matchMedia('(any-pointer: coarse)');
  const preventGesture = (event: Event) => {
    if (touchEnvironment.matches) event.preventDefault();
  };
  const preventPinch = (event: TouchEvent) => {
    if (touchEnvironment.matches && event.touches.length > 1)
      event.preventDefault();
  };

  update();
  window.addEventListener('resize', scheduleUpdate);
  window.addEventListener('orientationchange', scheduleUpdate);
  window.addEventListener('pageshow', scheduleUpdate);
  document.addEventListener('visibilitychange', scheduleUpdate);
  document.addEventListener('focusin', scheduleUpdate);
  document.addEventListener('focusout', scheduleUpdate);
  standalone.addEventListener('change', scheduleUpdate);
  viewport?.addEventListener('resize', scheduleUpdate);
  viewport?.addEventListener('scroll', scheduleUpdate);
  document.addEventListener('gesturestart', preventGesture, { passive: false });
  document.addEventListener('gesturechange', preventGesture, {
    passive: false,
  });
  document.addEventListener('touchmove', preventPinch, { passive: false });

  return () => {
    window.cancelAnimationFrame(frame);
    window.removeEventListener('resize', scheduleUpdate);
    window.removeEventListener('orientationchange', scheduleUpdate);
    window.removeEventListener('pageshow', scheduleUpdate);
    document.removeEventListener('visibilitychange', scheduleUpdate);
    document.removeEventListener('focusin', scheduleUpdate);
    document.removeEventListener('focusout', scheduleUpdate);
    standalone.removeEventListener('change', scheduleUpdate);
    viewport?.removeEventListener('resize', scheduleUpdate);
    viewport?.removeEventListener('scroll', scheduleUpdate);
    document.removeEventListener('gesturestart', preventGesture);
    document.removeEventListener('gesturechange', preventGesture);
    document.removeEventListener('touchmove', preventPinch);
  };
}
