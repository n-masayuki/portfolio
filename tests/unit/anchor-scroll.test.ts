import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { initAnchorScroll } from '../../src/scripts/anchor-scroll';

let cleanup: () => void;
let tick: FrameRequestCallback;
let reduced = false;
let started: number;

beforeEach(() => {
  history.replaceState(null, '', '/');
  document.body.innerHTML =
    '<a href="#destination"><span>移動</span></a><section id="destination" style="scroll-margin-top: 64px"></section>';
  const target = document.getElementById('destination')!;
  vi.spyOn(target, 'getBoundingClientRect').mockReturnValue({
    top: 1064,
  } as DOMRect);
  vi.spyOn(document.documentElement, 'scrollHeight', 'get').mockReturnValue(
    5000,
  );
  vi.stubGlobal('scrollY', 0);
  vi.stubGlobal('scrollTo', vi.fn());
  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn((callback) => {
      tick = callback;
      return 1;
    }),
  );
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  reduced = false;
  vi.stubGlobal('matchMedia', () =>
    Object.defineProperty(new EventTarget(), 'matches', {
      get: () => reduced,
    }),
  );
  started = 0;
  vi.spyOn(performance, 'now').mockImplementation(() => started);
  cleanup = initAnchorScroll();
});

afterEach(() => cleanup());

function click() {
  const event = new MouseEvent('click', { bubbles: true, cancelable: true });
  let prevented = false;
  // 標準遷移の許可だけ検査し、jsdom自身の画面遷移は実行しない。
  window.addEventListener(
    'click',
    (event) => {
      prevented = event.defaultPrevented;
      event.preventDefault();
    },
    { once: true },
  );
  document.querySelector('a span')!.dispatchEvent(event);
  return { defaultPrevented: prevented };
}

it('短く加速し、長く減速して余白付きの目的地へ着地する', () => {
  const finished = vi.fn();
  document.addEventListener('anchor-scroll:end', finished, { once: true });
  expect(click().defaultPrevented).toBe(true);
  const positions = [0, 0.125, 0.25, 0.5, 0.75, 1].map((progress) => {
    tick(progress * 1020);
    return vi.mocked(window.scrollTo).mock.lastCall![0] as ScrollToOptions;
  });
  expect(positions[1].top).toBeCloseTo(31.25);
  expect(positions[2].top).toBeCloseTo(250);
  expect(positions[3].top).toBeCloseTo(777.7778);
  expect(positions[4].top).toBeCloseTo(972.2222);
  expect(positions[5]).toEqual({ top: 1000, behavior: 'instant' });
  expect(location.hash).toBe('#destination');
  expect(document.activeElement?.id).toBe('destination');
  expect(document.activeElement?.hasAttribute('tabindex')).toBe(false);
  expect(finished).toHaveBeenCalledOnce();
});

it('動きを減らす設定では標準のアンカー移動に任せる', () => {
  reduced = true;
  expect(click().defaultPrevented).toBe(false);
  expect(requestAnimationFrame).not.toHaveBeenCalled();
});

it.each(['touchmove', 'popstate'])('%sで移動を中断する', (type) => {
  click();
  vi.mocked(cancelAnimationFrame).mockClear();
  window.dispatchEvent(new Event(type));
  expect(cancelAnimationFrame).toHaveBeenCalledWith(1);
});

it('無関係なクリック・キー・移動量ゼロのwheelで停止しない', () => {
  click();
  expect(location.hash).toBe('');
  vi.mocked(cancelAnimationFrame).mockClear();
  window.dispatchEvent(new Event('pointerdown'));
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift' }));
  window.dispatchEvent(new WheelEvent('wheel', { deltaY: 0 }));
  expect(cancelAnimationFrame).not.toHaveBeenCalled();
  tick(1020);
  expect(location.hash).toBe('#destination');
});

it('明示的なホイールスクロールでは停止し、URLを先走って更新しない', () => {
  click();
  expect(document.documentElement.style.scrollBehavior).toBe('auto');
  window.dispatchEvent(new WheelEvent('wheel', { deltaY: 100 }));
  expect(cancelAnimationFrame).toHaveBeenLastCalledWith(1);
  expect(location.hash).toBe('');
  expect(document.documentElement.style.scrollBehavior).toBe('');
});

it('リサイズでは中断せず、移動先のレイアウト変化に追従する', () => {
  click();
  vi.mocked(cancelAnimationFrame).mockClear();
  window.dispatchEvent(new Event('resize'));
  expect(cancelAnimationFrame).not.toHaveBeenCalled();
  vi.mocked(
    document.getElementById('destination')!.getBoundingClientRect,
  ).mockReturnValue({ top: 1264 } as DOMRect);
  tick(1020);
  expect(scrollTo).toHaveBeenLastCalledWith({ top: 1200, behavior: 'instant' });
});

it('別ページや新規タブへのリンクは横取りしない', () => {
  const link = document.querySelector('a')!;
  link.href = '/other/#destination';
  expect(click().defaultPrevented).toBe(false);
  link.href = '#destination';
  link.target = '_blank';
  expect(click().defaultPrevented).toBe(false);
  expect(requestAnimationFrame).not.toHaveBeenCalled();
});
