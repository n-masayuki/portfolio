interface Rect {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

interface Viewport {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Keep the bubble inside the viewport and its arrow aimed at the trigger. */
export function getPopoverPosition(
  anchor: Rect,
  size: { width: number; height: number },
  viewport: Viewport,
) {
  const margin = 16;
  const gap = 12;
  const above = Math.max(0, anchor.top - viewport.top - margin - gap);
  const below = Math.max(
    0,
    viewport.top + viewport.height - margin - anchor.bottom - gap,
  );
  const placement = size.height <= above || above >= below ? 'above' : 'below';
  const maxHeight = Math.max(1, placement === 'above' ? above : below);
  const height = Math.min(size.height, maxHeight);
  const center = (anchor.left + anchor.right) / 2;
  const left = Math.max(
    viewport.left + margin,
    Math.min(
      center - size.width / 2,
      viewport.left + viewport.width - margin - size.width,
    ),
  );
  const top =
    placement === 'above' ? anchor.top - gap - height : anchor.bottom + gap;
  const arrowLeft = Math.max(24, Math.min(center - left, size.width - 24));
  return { left, top, maxHeight, arrowLeft, placement };
}

/** Position a visible native popover and follow scroll, resize and content changes. */
export function anchorPopover(
  popover: HTMLElement,
  trigger: Element,
): () => void {
  let frame = 0;
  let stopped = false;
  const update = () => {
    if (stopped) return;
    const visual = window.visualViewport;
    const viewport = {
      left: visual?.offsetLeft ?? 0,
      top: visual?.offsetTop ?? 0,
      width: visual?.width ?? window.innerWidth,
      height: visual?.height ?? window.innerHeight,
    };
    const rect = trigger.getBoundingClientRect();
    const clip = trigger.closest('.wt')?.getBoundingClientRect() ?? rect;
    const anchor = {
      left: Math.max(rect.left, clip.left, viewport.left),
      right: Math.min(rect.right, clip.right, viewport.left + viewport.width),
      top: rect.top,
      bottom: rect.bottom,
    };
    if (
      !trigger.isConnected ||
      anchor.right <= anchor.left ||
      rect.bottom <= viewport.top ||
      rect.top >= viewport.top + viewport.height
    ) {
      popover.hidePopover();
      return;
    }
    popover.style.maxWidth = `${Math.max(1, viewport.width - 32)}px`;
    // Measure the unconstrained content so a smaller previous placement cannot stick.
    const content = popover.querySelector<HTMLElement>('.wt-details__content');
    const size = {
      // Entrance scale must not affect the layout position or arrow alignment.
      width: popover.offsetWidth,
      height: (content?.scrollHeight ?? popover.scrollHeight) + 2,
    };
    const position = getPopoverPosition(anchor, size, viewport);
    popover.style.left = `${position.left}px`;
    popover.style.top = `${position.top}px`;
    popover.style.setProperty(
      '--wt-details-max-height',
      `${position.maxHeight}px`,
    );
    popover.style.setProperty(
      '--wt-details-arrow-left',
      `${position.arrowLeft}px`,
    );
    popover.dataset.placement = position.placement;
  };
  const schedule = () => {
    if (stopped) return;
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(update);
  };
  const observer = new ResizeObserver(schedule);
  observer.observe(popover);
  const host = trigger.closest('.wt');
  if (host) observer.observe(host);
  window.addEventListener('scroll', schedule, true);
  window.addEventListener('resize', schedule);
  window.visualViewport?.addEventListener('resize', schedule);
  window.visualViewport?.addEventListener('scroll', schedule);
  schedule();
  return () => {
    stopped = true;
    cancelAnimationFrame(frame);
    observer.disconnect();
    window.removeEventListener('scroll', schedule, true);
    window.removeEventListener('resize', schedule);
    window.visualViewport?.removeEventListener('resize', schedule);
    window.visualViewport?.removeEventListener('scroll', schedule);
  };
}
