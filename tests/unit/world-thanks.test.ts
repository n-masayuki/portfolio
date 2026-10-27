import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '../../src/scripts/world-thanks';
import thanks from '../../src/data/world-thanks.json';

describe('world-thanks', () => {
  let resize: () => void;
  let host: HTMLDivElement;
  let controls: ReturnType<typeof mount> | undefined;

  beforeEach(() => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: () => void) {
          resize = callback;
        }
        observe() {}
        disconnect() {}
      },
    );
    host = document.createElement('div');
    host.innerHTML = '<p>元のテキスト</p>';
    document.body.append(host);
    Object.defineProperty(host, 'clientWidth', {
      configurable: true,
      value: 500,
    });
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(
      function (this: Element) {
        return { width: this.children.length * 100 } as DOMRect;
      },
    );
  });

  afterEach(() => {
    controls?.destroy();
    controls = undefined;
    document.body.replaceChildren();
  });

  it('fills a wide container with short input and keeps matching loop halves after resizing', () => {
    controls = mount(host, {
      items: [{ lang: 'ja', text: 'ありがとう' }],
      shuffle: false,
      speed: 50,
    });
    const groups = host.querySelectorAll('.wt__group');
    expect(groups).toHaveLength(2);
    expect(groups[0].children).toHaveLength(5);
    expect(groups[0].innerHTML).toBe(groups[1].innerHTML);
    expect(groups[1].getAttribute('aria-hidden')).toBe('true');
    expect(groups[0].querySelectorAll('[aria-hidden]')).toHaveLength(4);
    expect(host.style.getPropertyValue('--wt-duration')).toBe('10s');

    Object.defineProperty(host, 'clientWidth', { value: 900 });
    resize();
    expect(host.querySelector('.wt__group')?.children).toHaveLength(9);
    expect(host.style.getPropertyValue('--wt-duration')).toBe('18s');
  });

  it('preserves RTL text and inserts custom text safely', () => {
    controls = mount(host, {
      items: [
        { lang: 'ar', text: '<b>شكرًا</b>', dir: 'rtl', roman: 'shukran' },
      ],
      showRoman: true,
    });
    const item = host.querySelector<HTMLElement>('.wt__item');
    expect(item?.dir).toBe('rtl');
    expect(item?.lang).toBe('ar');
    expect(item?.textContent).toContain('<b>شكرًا</b>');
    expect(item?.querySelector('b')).toBeNull();
    expect(item?.querySelector('.wt__sub')?.textContent).toBe('shukran');
  });

  it('can pause, remount, and restore the original content', () => {
    controls = mount(host);
    expect(host.querySelectorAll('.wt__group')[0].children).toHaveLength(65);
    controls.pause();
    expect(host.hasAttribute('data-wt-paused')).toBe(true);
    controls.resume();
    expect(host.hasAttribute('data-wt-paused')).toBe(false);
    controls = mount(host);
    expect(host.querySelectorAll('.wt__track')).toHaveLength(1);
    controls.destroy();
    resize();
    expect(host.innerHTML).toBe('<p>元のテキスト</p>');
    expect(host.hasAttribute('role')).toBe(false);
    expect(host.style.getPropertyValue('--wt-duration')).toBe('');
  });

  it('rejects invalid speed and empty input before replacing existing content', () => {
    expect(() => mount(host, { speed: 0 })).toThrow(RangeError);
    expect(() => mount(host, { items: [] })).toThrow(TypeError);
    expect(host.textContent).toBe('元のテキスト');
  });

  it('selects a language from visual repeats without adding hidden tab stops', () => {
    const onSelect = vi.fn();
    const item = { lang: 'ja', text: 'ありがとう', regions: '日本' };
    controls = mount(host, { items: [item], onSelect });
    const original = host.querySelector<HTMLButtonElement>('.wt__item')!;
    expect(original.type).toBe('button');
    expect(original.getAttribute('aria-haspopup')).toBe('dialog');
    expect(original.tabIndex).toBe(0);
    original.click();
    expect(onSelect).toHaveBeenLastCalledWith(item, original);

    const clone = host.querySelector<HTMLButtonElement>(
      '.wt__group[aria-hidden] button',
    )!;
    expect(clone.tabIndex).toBe(-1);
    expect(
      host.querySelector('.wt__item[aria-hidden]')?.getAttribute('tabindex'),
    ).toBe('-1');
    clone.click();
    expect(onSelect).toHaveBeenLastCalledWith(item, clone);

    controls.destroy();
    host.append(original);
    original.click();
    expect(onSelect).toHaveBeenCalledTimes(2);
  });

  it('provides a region or usage description for every bundled language', () => {
    expect(new Set(thanks.map((item) => item.lang)).size).toBe(thanks.length);
    for (const item of thanks) expect(item.regions.trim()).not.toBe('');
  });

  it('keeps curved-loop words selectable and stops their motion when paused', () => {
    vi.stubGlobal('SVGAElement', SVGElement);
    const hover = { matches: true };
    vi.stubGlobal('matchMedia', (query: string) =>
      query === '(hover: hover)'
        ? hover
        : {
            matches: false,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
          },
    );
    let tick: FrameRequestCallback;
    const cancel = vi.fn();
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      tick = callback;
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', cancel);
    Object.defineProperties(SVGElement.prototype, {
      getComputedTextLength: { configurable: true, value: () => 400 },
      getTotalLength: { configurable: true, value: () => 800 },
    });
    try {
      const item = { lang: 'ja', text: 'ありがとう' };
      const onSelect = vi.fn();
      controls = mount(host, {
        items: [item],
        shuffle: false,
        curved: true,
        onSelect,
      });
      const curve = host.querySelector('defs path')!;
      // A single arc replaces the repeated wave, and softens at mobile widths.
      expect(curve.getAttribute('d')).toBe('M -100 40 Q 175 130 600 40');
      Object.defineProperty(host, 'clientWidth', { value: 1200 });
      resize();
      expect(curve.getAttribute('d')).toBe('M -100 40 Q 420 180 1300 40');
      const words = host.querySelectorAll<SVGAElement>('svg a');
      expect(words).toHaveLength(4);
      expect(words[0].getAttribute('tabindex')).toBe('0');
      expect(words[1].getAttribute('tabindex')).toBe('-1');
      words[0].dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
      );
      expect(onSelect).toHaveBeenLastCalledWith(item, words[0]);
      const path = host.querySelector('textPath')!;
      // Model the pointer explicitly; jsdom has no real pointer hit testing.
      let overWord = false;
      vi.spyOn(host, 'matches').mockImplementation(
        (selector) =>
          selector === ':hover' ||
          (selector === ':has(.wt__curve a:hover)' && overWord),
      );
      tick!(100);
      expect(Number(path.getAttribute('startOffset'))).toBeLessThan(0);
      controls.pause();
      const offset = path.getAttribute('startOffset');
      tick!(150);
      expect(path.getAttribute('startOffset')).toBe(offset);
      controls.resume();
      tick!(200);
      expect(Number(path.getAttribute('startOffset'))).toBeLessThan(
        Number(offset),
      );

      // Hovering the surrounding band must not stop the curved loop.
      let lastOffset = path.getAttribute('startOffset');
      tick!(250);
      expect(path.getAttribute('startOffset')).not.toBe(lastOffset);

      overWord = true;
      lastOffset = path.getAttribute('startOffset');
      tick!(300);
      expect(path.getAttribute('startOffset')).toBe(lastOffset);

      overWord = false;
      tick!(350);
      expect(path.getAttribute('startOffset')).not.toBe(lastOffset);

      // Touch hover must not stick after a tap; the open explanation pauses it.
      hover.matches = false;
      overWord = true;
      lastOffset = path.getAttribute('startOffset');
      tick!(400);
      expect(path.getAttribute('startOffset')).not.toBe(lastOffset);
      host.setAttribute('data-wt-details-open', '');
      lastOffset = path.getAttribute('startOffset');
      tick!(450);
      expect(path.getAttribute('startOffset')).toBe(lastOffset);
      host.removeAttribute('data-wt-details-open');
      tick!(500);
      expect(path.getAttribute('startOffset')).not.toBe(lastOffset);
      controls.destroy();
      expect(cancel).toHaveBeenCalled();
      expect(host.innerHTML).toBe('<p>元のテキスト</p>');
    } finally {
      Reflect.deleteProperty(SVGElement.prototype, 'getComputedTextLength');
      Reflect.deleteProperty(SVGElement.prototype, 'getTotalLength');
    }
  });
});
