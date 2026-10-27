import thanks from '../data/world-thanks.json';
import { mountCurvedLoop } from './world-thanks-curved-loop';

export type ThanksTrigger = HTMLButtonElement | SVGAElement;

export interface ThanksItem {
  lang: string;
  text: string;
  roman?: string;
  dir?: string;
  regions?: string;
}

export interface WorldThanksOptions {
  items?: readonly ThanksItem[];
  speed?: number;
  shuffle?: boolean;
  showLang?: boolean;
  showRoman?: boolean;
  label?: string;
  curved?: boolean;
  /** Arc control-point offset in pixels, softened automatically on mobile. */
  curveAmount?: number;
  onSelect?: (item: ThanksItem, trigger: ThanksTrigger) => void;
}

export interface WorldThanksControls {
  pause(): void;
  resume(): void;
  destroy(): void;
}

const instances = new WeakMap<HTMLElement, WorldThanksControls>();

function shuffle<T>(items: readonly T[]): T[] {
  const result = items.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// 言語コードから表示用の言語名を取得する
function langName(code: string): string {
  try {
    return new Intl.DisplayNames([code], { type: 'language' }).of(code) ?? code;
  } catch {
    return code;
  }
}

/**
 * 世界の「ありがとう」を右から左へ無限スクロールする。
 * Astro の script など、バンドラーから import して使用する。
 * スタイルは利用側で styles/world-thanks.scss を読み込む。
 */
export function mount(
  target: string | HTMLElement,
  opts: WorldThanksOptions = {},
): WorldThanksControls {
  const host =
    typeof target === 'string' ? document.querySelector(target) : target;
  if (!(host instanceof HTMLElement)) {
    throw new Error('world-thanks: target not found');
  }
  const options = {
    speed: 60,
    shuffle: true,
    showLang: false,
    showRoman: false,
    label: '世界の言葉で「ありがとう」',
    ...opts,
  };
  if (!Number.isFinite(options.speed) || options.speed <= 0) {
    throw new RangeError('world-thanks: speed must be a positive number');
  }
  const source: readonly ThanksItem[] = options.items ?? thanks;
  if (
    !Array.isArray(source) ||
    !source.length ||
    source.some(
      (item) =>
        !item ||
        typeof item.lang !== 'string' ||
        typeof item.text !== 'string' ||
        !item.text.trim(),
    )
  ) {
    throw new TypeError('world-thanks: items must contain lang and text');
  }
  instances.get(host)?.destroy();

  const originalChildren = [...host.childNodes];
  const attributes = [
    'class',
    'role',
    'aria-label',
    'tabindex',
    'data-wt-paused',
    'data-wt-curved',
  ];
  const originalAttributes = attributes.map(
    (name) => [name, host.getAttribute(name)] as const,
  );
  const originalDuration = host.style.getPropertyValue('--wt-duration');
  host.classList.add('wt');
  host.setAttribute('role', 'group');
  host.setAttribute('aria-label', options.label);
  host.setAttribute('tabindex', '0');
  host.removeAttribute('data-wt-paused');
  if (options.curved) host.setAttribute('data-wt-curved', '');

  const track = document.createElement('div');
  track.className = 'wt__track';
  const group = document.createElement('div');
  group.className = 'wt__group';
  const items = options.shuffle ? shuffle(source) : source;
  for (const [index, item] of items.entries()) {
    const el = document.createElement(options.onSelect ? 'button' : 'span');
    if (el instanceof HTMLButtonElement) {
      el.type = 'button';
      el.dataset.wtIndex = String(index);
      el.setAttribute('aria-haspopup', 'dialog');
      el.setAttribute('aria-expanded', 'false');
    }
    el.className = 'wt__item';
    el.lang = item.lang;
    el.dir = item.dir === 'rtl' ? 'rtl' : 'auto';
    el.textContent = item.text;
    const sub = [
      options.showRoman && item.roman,
      options.showLang && langName(item.lang),
    ]
      .filter(Boolean)
      .join(' / ');
    if (sub) {
      const span = document.createElement('span');
      span.className = 'wt__sub';
      span.lang = options.showLang ? item.lang : 'und-Latn';
      span.dir = 'auto';
      span.textContent = sub;
      el.append(span);
    }
    group.append(el);
  }
  track.append(group);
  host.replaceChildren(track);
  const originals = [...group.children];
  let destroyed = false;

  const select = (event: MouseEvent) => {
    const trigger =
      event.target instanceof Element
        ? event.target.closest<ThanksTrigger>('[data-wt-index]')
        : null;
    if (!trigger || !host.contains(trigger)) return;
    const item = items[Number(trigger.dataset.wtIndex)];
    if (item) options.onSelect?.(item, trigger);
  };
  host.addEventListener('click', select);

  const visualClone = <T extends Element>(element: T): T => {
    const clone = element.cloneNode(true) as T;
    clone.setAttribute('aria-hidden', 'true');
    // Visual repeats remain clickable without adding hidden keyboard stops.
    if (clone instanceof HTMLButtonElement) clone.tabIndex = -1;
    clone.querySelectorAll('button').forEach((button) => {
      button.tabIndex = -1;
    });
    return clone;
  };

  const measure = () => {
    if (destroyed) return;
    // Remove previous visual repeats before measuring the original sequence.
    group.replaceChildren(...originals);
    const width = group.getBoundingClientRect().width;
    if (width <= 0 || host.clientWidth <= 0) return;
    const copies = Math.max(1, Math.ceil(host.clientWidth / width));
    for (let i = 1; i < copies; i++) {
      for (const original of originals) {
        group.append(visualClone(original));
      }
    }
    // Two identical groups make translateX(-50%) a seamless loop.
    const clone = visualClone(group);
    track.replaceChildren(group, clone);
    host.style.setProperty(
      '--wt-duration',
      `${group.getBoundingClientRect().width / options.speed}s`,
    );
  };

  const observer = new ResizeObserver(measure);
  observer.observe(host);
  // Also measure again when web fonts (including language-specific fonts) load.
  document.fonts?.ready.then(measure);
  document.fonts?.addEventListener('loadingdone', measure);
  measure();
  const destroyCurvedLoop = options.curved
    ? mountCurvedLoop(host, items, options.speed, options.curveAmount)
    : undefined;

  const controls = {
    pause() {
      host.setAttribute('data-wt-paused', '');
    },
    resume() {
      host.removeAttribute('data-wt-paused');
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      observer.disconnect();
      destroyCurvedLoop?.();
      host.removeEventListener('click', select);
      document.fonts?.removeEventListener('loadingdone', measure);
      host.replaceChildren(...originalChildren);
      for (const [name, value] of originalAttributes) {
        if (value === null) host.removeAttribute(name);
        else host.setAttribute(name, value);
      }
      if (originalDuration)
        host.style.setProperty('--wt-duration', originalDuration);
      else host.style.removeProperty('--wt-duration');
      instances.delete(host);
    },
  };
  instances.set(host, controls);
  return controls;
}
