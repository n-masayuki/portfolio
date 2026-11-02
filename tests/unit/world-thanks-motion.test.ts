import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mountWave } from '../../src/scripts/world-thanks-wave';
import { mountCurvedLoop } from '../../src/scripts/world-thanks-curved-loop';

// jsdom has no SVG layout. Supply measurements while exercising the real DOM,
// event handlers and animation scheduling of both renderers.
describe.each([
  ['wave', mountWave],
  ['curve', mountCurvedLoop],
] as const)('%s language controls', (_name, mount) => {
  let host: HTMLDivElement;
  let refresh: () => void;
  let tick: FrameRequestCallback;
  let destroy: (() => void) | undefined;
  let reduced: MediaQueryList;
  let hover: MediaQueryList;
  let fonts: EventTarget & { ready: Promise<void> };
  let textWidth: number;
  let visibleFocus: boolean;
  let pointer: boolean;
  const originalFonts = Object.getOwnPropertyDescriptor(document, 'fonts');
  const disconnect = vi.fn();
  const items = [
    { lang: 'ja', text: 'ありがとう' },
    { lang: 'ar', text: 'شكرًا', dir: 'rtl' },
  ];

  beforeEach(() => {
    host = document.createElement('div');
    document.body.append(host);
    Object.defineProperty(host, 'clientWidth', {
      configurable: true,
      value: 500,
    });
    vi.spyOn(host, 'getBoundingClientRect').mockReturnValue({
      top: 10,
      bottom: 190,
    } as DOMRect);
    reduced = Object.assign(new EventTarget(), {
      matches: false,
    }) as MediaQueryList;
    hover = Object.assign(new EventTarget(), {
      matches: true,
    }) as MediaQueryList;
    vi.stubGlobal('matchMedia', (query: string) =>
      query.includes('reduced') ? reduced : hover,
    );
    fonts = Object.assign(new EventTarget(), { ready: Promise.resolve() });
    Object.defineProperty(document, 'fonts', {
      configurable: true,
      value: fonts,
    });
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: () => void) {
          refresh = callback;
        }
        observe() {}
        disconnect = disconnect;
      },
    );
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn((callback: FrameRequestCallback) => {
        tick = callback;
        return 1;
      }),
    );
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    // jsdom does not define the specialized SVG anchor constructor.
    vi.stubGlobal('SVGAElement', SVGElement);
    textWidth = 400;
    visibleFocus = false;
    pointer = false;
    Object.defineProperties(SVGElement.prototype, {
      getComputedTextLength: { configurable: true, value: () => textWidth },
      getTotalLength: { configurable: true, value: () => 800 },
      getSubStringLength: {
        configurable: true,
        value: (_start: number, length: number) => length * 10,
      },
    });
    vi.spyOn(host, 'matches').mockImplementation((selector) =>
      selector.includes('focus-visible') ? visibleFocus : pointer,
    );
  });

  afterEach(() => {
    destroy?.();
    destroy = undefined;
    for (const name of [
      'getComputedTextLength',
      'getTotalLength',
      'getSubStringLength',
    ])
      Reflect.deleteProperty(SVGElement.prototype, name);
    if (originalFonts) Object.defineProperty(document, 'fonts', originalFonts);
    else Reflect.deleteProperty(document, 'fonts');
    document.body.replaceChildren();
  });

  function start() {
    destroy = mount(host, items, 60);
    return host.querySelector('textPath')!;
  }

  it('keeps only original words in the tab order and preserves RTL and language labels', () => {
    start();
    const controls = [...host.querySelectorAll('a')];
    expect(controls).toHaveLength(8);
    expect(
      controls.filter((control) => control.getAttribute('tabindex') === '0'),
    ).toHaveLength(2);
    expect(
      controls
        .slice(2)
        .every((control) => control.getAttribute('aria-hidden') === 'true'),
    ).toBe(true);
    expect(controls[1].querySelector('tspan')?.getAttribute('direction')).toBe(
      'rtl',
    );
    expect(controls[0].querySelector('tspan')?.getAttribute('lang')).toBe('ja');
    expect(controls[0].getAttribute('aria-label')).toBe(items[0].text);
  });

  it('activates language controls with Enter and Space, ignoring unrelated keys and targets', () => {
    start();
    const control = host.querySelector('a')!;
    const clicked = vi.fn();
    control.addEventListener('click', clicked);
    for (const key of ['Enter', ' ']) {
      const event = new KeyboardEvent('keydown', {
        key,
        bubbles: true,
        cancelable: true,
      });
      control.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(true);
    }
    control.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );
    host.querySelector('svg')!.append(document.createElement('span'));
    host
      .querySelector('span')!
      .dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
      );
    expect(clicked).toHaveBeenCalledTimes(2);
  });

  it('brings keyboard-focused words into view without moving pointer-focused words', () => {
    const path = start();
    const controls = host.querySelectorAll('a');
    controls[0].dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    expect(Number(path.getAttribute('startOffset'))).toBe(0);
    for (const [index, control] of [...controls].slice(0, 2).entries()) {
      vi.spyOn(control, 'matches').mockReturnValue(true);
      control.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
      const before = index ? (items[0].text.length + 5) * 10 : 0;
      expect(Number(path.getAttribute('startOffset'))).toBe(
        400 - before - items[index].text.length * 5,
      );
    }
  });

  it.each([
    'reduced motion',
    'hidden document',
    'above viewport',
    'below viewport',
    'manual pause',
    'open details',
    'keyboard focus',
    'hover',
  ])('pauses for %s and resumes afterwards', (reason) => {
    const path = start();
    tick(100);
    const offset = path.getAttribute('startOffset');
    const restore = () => {
      Object.assign(reduced, { matches: false });
      vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
      vi.mocked(host.getBoundingClientRect).mockReturnValue({
        top: 10,
        bottom: 190,
      } as DOMRect);
      host.removeAttribute('data-wt-paused');
      host.removeAttribute('data-wt-details-open');
      visibleFocus = pointer = false;
    };
    if (reason === 'reduced motion') Object.assign(reduced, { matches: true });
    if (reason === 'hidden document')
      vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    if (reason === 'above viewport')
      vi.mocked(host.getBoundingClientRect).mockReturnValue({
        top: -200,
        bottom: -1,
      } as DOMRect);
    if (reason === 'below viewport')
      vi.mocked(host.getBoundingClientRect).mockReturnValue({
        top: innerHeight + 1,
        bottom: innerHeight + 180,
      } as DOMRect);
    if (reason === 'manual pause') host.setAttribute('data-wt-paused', '');
    if (reason === 'open details')
      host.setAttribute('data-wt-details-open', '');
    if (reason === 'keyboard focus') visibleFocus = true;
    if (reason === 'hover') pointer = true;
    tick(150);
    expect(path.getAttribute('startOffset')).toBe(offset);
    restore();
    tick(200);
    expect(path.getAttribute('startOffset')).not.toBe(offset);
    // Touch devices must not remain stopped because of sticky hover.
    pointer = true;
    Object.assign(hover, { matches: false });
    const resumed = path.getAttribute('startOffset');
    tick(250);
    expect(path.getAttribute('startOffset')).not.toBe(resumed);
  });

  it('waits for visible dimensions and measured fonts, then refreshes and disconnects', async () => {
    Object.defineProperty(host, 'clientWidth', { value: 0 });
    const path = start();
    expect(host.querySelectorAll('a')).toHaveLength(0);
    tick(100);
    expect(path.hasAttribute('startOffset')).toBe(false);
    Object.defineProperty(host, 'clientWidth', { value: 500 });
    textWidth = 0;
    refresh();
    expect(host.querySelectorAll('a')).toHaveLength(0);
    textWidth = 400;
    await fonts.ready;
    expect(host.querySelectorAll('a')).toHaveLength(8);
    Object.defineProperty(host, 'clientWidth', { value: 900 });
    fonts.dispatchEvent(new Event('loadingdone'));
    expect(host.querySelector('svg')?.getAttribute('viewBox')).toBe(
      '0 0 900 180',
    );
    textWidth = 800;
    reduced.dispatchEvent(new Event('change'));
    expect(host.querySelectorAll('a')).toHaveLength(4);
    const svg = host.querySelector('svg')!;
    const clicked = vi.fn();
    const control = svg.querySelector('a')!;
    control.addEventListener('click', clicked);
    destroy!();
    destroy = undefined;
    expect(host.querySelector('svg')).toBeNull();
    expect(cancelAnimationFrame).toHaveBeenCalledWith(1);
    expect(disconnect).toHaveBeenCalled();
    Object.defineProperty(host, 'clientWidth', { value: 1000 });
    refresh();
    fonts.dispatchEvent(new Event('loadingdone'));
    control.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
    );
    expect(clicked).not.toHaveBeenCalled();
    expect(svg.getAttribute('viewBox')).toBe('0 0 900 180');
  });
});
