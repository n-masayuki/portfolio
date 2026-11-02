import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  anchorPopover,
  getPopoverPosition,
} from '../../src/scripts/anchored-popover';

const viewport = { left: 0, top: 0, width: 1200, height: 800 };
const size = { width: 320, height: 280 };

describe('anchored popover placement', () => {
  it('places the bubble above the clicked sentence and points at its center', () => {
    const anchor = { left: 400, right: 600, top: 600, bottom: 660 };
    const position = getPopoverPosition(anchor, size, viewport);
    expect(position.placement).toBe('above');
    expect(position.top + size.height).toBe(anchor.top - 12);
    expect(position.left + position.arrowLeft).toBe(500);
  });

  it('flips below a sentence near the top of the screen', () => {
    const anchor = { left: 400, right: 600, top: 40, bottom: 100 };
    const position = getPopoverPosition(anchor, size, viewport);
    expect(position.placement).toBe('below');
    expect(position.top).toBe(anchor.bottom + 12);
    expect(position.top + size.height).toBeLessThan(viewport.height - 16);
  });

  it.each([
    { left: 16, right: 116, expectedLeft: 16 },
    { left: 1084, right: 1184, expectedLeft: 864 },
  ])('keeps the bubble on screen near a horizontal edge: $left', (edge) => {
    const position = getPopoverPosition(
      { ...edge, top: 600, bottom: 660 },
      size,
      viewport,
    );
    expect(position.left).toBe(edge.expectedLeft);
    expect(position.left + position.arrowLeft).toBe(
      (edge.left + edge.right) / 2,
    );
  });

  it('limits long content to the available mobile space', () => {
    const mobile = { left: 0, top: 0, width: 390, height: 500 };
    const position = getPopoverPosition(
      { left: 120, right: 260, top: 220, bottom: 280 },
      { width: 358, height: 600 },
      mobile,
    );
    expect(position.maxHeight).toBe(192);
    expect(position.top).toBe(16);
    expect(position.left).toBe(16);
  });

  it('accounts for the visible viewport offset when zoomed', () => {
    const zoomed = { left: 100, top: 200, width: 390, height: 500 };
    const position = getPopoverPosition(
      { left: 120, right: 220, top: 250, bottom: 310 },
      { width: 358, height: 200 },
      zoomed,
    );
    expect(position.placement).toBe('below');
    expect(position.left).toBe(116);
    expect(position.top).toBe(322);
  });
});

describe('anchored popover lifecycle', () => {
  let host: HTMLDivElement;
  let trigger: HTMLButtonElement;
  let popover: HTMLDivElement;
  let rect: DOMRect;
  let update: FrameRequestCallback;
  let resize: () => void;
  let stop: (() => void) | undefined;
  const observe = vi.fn();
  const disconnect = vi.fn();
  const hide = vi.fn();

  beforeEach(() => {
    host = document.createElement('div');
    host.className = 'wt';
    trigger = document.createElement('button');
    popover = document.createElement('div');
    host.append(trigger);
    document.body.append(host, popover);
    rect = { left: 400, right: 600, top: 600, bottom: 660 } as DOMRect;
    vi.spyOn(trigger, 'getBoundingClientRect').mockImplementation(() => rect);
    vi.spyOn(host, 'getBoundingClientRect').mockReturnValue({
      left: 450,
      right: 550,
    } as DOMRect);
    Object.defineProperties(popover, {
      offsetWidth: { value: 320 },
      scrollHeight: { value: 278 },
      hidePopover: { value: hide },
    });
    vi.stubGlobal('innerWidth', 1200);
    vi.stubGlobal('innerHeight', 800);
    vi.stubGlobal('visualViewport', undefined);
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn((callback: FrameRequestCallback) => {
        update = callback;
        return 1;
      }),
    );
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: () => void) {
          resize = callback;
        }
        observe = observe;
        disconnect = disconnect;
      },
    );
  });

  afterEach(() => {
    stop?.();
    stop = undefined;
    document.body.replaceChildren();
  });

  it('positions from layout dimensions, clips the anchor and follows nested scroll and resize', () => {
    stop = anchorPopover(popover, trigger);
    update(0);
    expect(popover.style.left).toBe('340px');
    expect(popover.style.top).toBe('308px');
    expect(popover.style.maxWidth).toBe('1168px');
    expect(popover.dataset.placement).toBe('above');
    expect(popover.style.getPropertyValue('--wt-details-arrow-left')).toBe(
      '160px',
    );
    expect(observe).toHaveBeenCalledWith(popover);
    expect(observe).toHaveBeenCalledWith(host);
    rect = { left: 500, right: 700, top: 40, bottom: 100 } as DOMRect;
    host.dispatchEvent(new Event('scroll'));
    update(0);
    expect(popover.dataset.placement).toBe('below');
    expect(popover.style.top).toBe('112px');
    expect(popover.style.left).toBe('365px');
    vi.mocked(requestAnimationFrame).mockClear();
    window.dispatchEvent(new Event('resize'));
    resize();
    expect(requestAnimationFrame).toHaveBeenCalledTimes(2);
  });

  it('uses the visual viewport and remeasures expanded content rather than an old height limit', () => {
    const visual = Object.assign(new EventTarget(), {
      offsetLeft: 100,
      offsetTop: 200,
      width: 390,
      height: 500,
    });
    vi.stubGlobal('visualViewport', visual);
    host.className = '';
    rect = { left: 120, right: 220, top: 250, bottom: 310 } as DOMRect;
    const content = document.createElement('div');
    content.className = 'wt-details__content';
    Object.defineProperty(content, 'scrollHeight', {
      configurable: true,
      value: 198,
    });
    popover.append(content);
    stop = anchorPopover(popover, trigger);
    update(0);
    expect(popover.style.left).toBe('116px');
    expect(popover.style.top).toBe('322px');
    expect(popover.style.maxWidth).toBe('358px');
    Object.defineProperty(content, 'scrollHeight', { value: 600 });
    vi.mocked(requestAnimationFrame).mockClear();
    visual.dispatchEvent(new Event('resize'));
    visual.dispatchEvent(new Event('scroll'));
    update(0);
    expect(requestAnimationFrame).toHaveBeenCalledTimes(2);
    expect(popover.style.getPropertyValue('--wt-details-max-height')).toBe(
      '362px',
    );
    stop();
    stop = undefined;
    vi.mocked(requestAnimationFrame).mockClear();
    visual.dispatchEvent(new Event('scroll'));
    window.dispatchEvent(new Event('scroll'));
    window.dispatchEvent(new Event('resize'));
    resize();
    update(0);
    expect(requestAnimationFrame).not.toHaveBeenCalled();
    expect(disconnect).toHaveBeenCalled();
    expect(cancelAnimationFrame).toHaveBeenCalledWith(1);
  });

  it.each(['detached', 'clipped', 'above', 'below'])(
    'closes when the trigger becomes %s',
    (reason) => {
      if (reason === 'detached') trigger.remove();
      if (reason === 'clipped') rect = { ...rect, left: 600, right: 700 };
      if (reason === 'above') rect = { ...rect, top: -60, bottom: 0 };
      if (reason === 'below') rect = { ...rect, top: 800, bottom: 860 };
      stop = anchorPopover(popover, trigger);
      update(0);
      expect(hide).toHaveBeenCalledOnce();
      expect(popover.style.left).toBe('');
    },
  );
});
