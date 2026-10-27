import type { ThanksItem } from './world-thanks';

const ns = 'http://www.w3.org/2000/svg';
const svgNode = <K extends keyof SVGElementTagNameMap>(name: K) =>
  document.createElementNS(ns, name);

/** Curved Loop's single-arc textPath, with individual language controls. */
export function mountCurvedLoop(
  host: HTMLElement,
  items: readonly ThanksItem[],
  speed: number,
  curveAmount = 140,
) {
  const svg = svgNode('svg');
  svg.classList.add('wt__curve');
  svg.setAttribute('role', 'group');
  svg.setAttribute('aria-label', '世界の言葉で「ありがとう」');
  const defs = svgNode('defs');
  const path = svgNode('path');
  path.id = `thanks-curve-${crypto.randomUUID()}`;
  defs.append(path);
  const measure = svgNode('text');
  measure.classList.add('wt__curve-measure');
  measure.setAttribute('aria-hidden', 'true');
  const separator = '\u00a0\u00a0·\u00a0\u00a0';
  const starts: number[] = [];
  let text = '';
  for (const item of items) {
    starts.push(text.length);
    text += item.text + separator;
  }
  measure.textContent = text;
  svg.append(defs, measure);
  const paths: SVGTextPathElement[] = [];
  for (let copy = 0; copy < 2; copy++) {
    const line = svgNode('text');
    line.setAttribute('dominant-baseline', 'central');
    const textPath = svgNode('textPath');
    textPath.setAttribute('href', `#${path.id}`);
    line.append(textPath);
    paths.push(textPath);
    svg.append(line);
  }
  host.append(svg);

  let width = 0;
  let sequence = 0;
  let distance = 0;
  let offset = 0;
  let destroyed = false;
  const apply = () => {
    paths[0].setAttribute('startOffset', String(-offset));
    paths[1].setAttribute('startOffset', String(sequence - offset));
  };
  const refresh = () => {
    if (destroyed || !host.clientWidth) return;
    width = host.clientWidth;
    svg.setAttribute('viewBox', `0 0 ${width} 180`);
    // One broad arc, like Curved Loop. Keep the curve gentle on narrow screens.
    const bend = Math.min(curveAmount, width * 0.18);
    path.setAttribute(
      'd',
      `M -100 40 Q ${width * 0.35} ${40 + bend} ${width + 100} 40`,
    );
    const unitWidth = measure.getComputedTextLength();
    if (!unitWidth) return;
    distance = path.getTotalLength();
    const reps = Math.max(1, Math.ceil(distance / unitWidth));
    sequence = unitWidth * reps;
    offset %= sequence;
    paths.forEach((textPath, copy) => {
      textPath.replaceChildren();
      for (let repeat = 0; repeat < reps; repeat++) {
        items.forEach((item, index) => {
          const control = svgNode('a');
          control.dataset.wtIndex = String(index);
          control.dataset.wtRepeat = String(repeat);
          control.setAttribute('role', 'button');
          control.setAttribute('aria-haspopup', 'dialog');
          control.setAttribute('aria-expanded', 'false');
          control.setAttribute('aria-label', item.text);
          control.setAttribute(
            'tabindex',
            copy === 0 && repeat === 0 ? '0' : '-1',
          );
          if (copy || repeat) control.setAttribute('aria-hidden', 'true');
          const word = svgNode('tspan');
          word.setAttribute('lang', item.lang);
          word.setAttribute('direction', item.dir === 'rtl' ? 'rtl' : 'ltr');
          word.setAttribute('unicode-bidi', 'isolate');
          word.textContent = item.text;
          control.append(word);
          textPath.append(control, document.createTextNode(separator));
        });
      }
    });
    apply();
  };

  const keyboard = (event: KeyboardEvent) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    if (!(event.target instanceof SVGAElement)) return;
    event.preventDefault();
    event.target.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  };
  const focus = (event: FocusEvent) => {
    if (!(event.target instanceof SVGAElement) || !sequence) return;
    if (!event.target.matches(':focus-visible')) return;
    const index = Number(event.target.dataset.wtIndex);
    const before = index ? measure.getSubStringLength(0, starts[index]) : 0;
    const word = measure.getSubStringLength(
      starts[index],
      items[index].text.length,
    );
    // Bring off-path keyboard targets into the middle of the visible curve.
    offset = before + word / 2 - distance / 2;
    apply();
  };
  svg.addEventListener('keydown', keyboard);
  svg.addEventListener('focusin', focus);
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const hover = window.matchMedia('(hover: hover)');
  const observer = new ResizeObserver(refresh);
  observer.observe(host);
  document.fonts?.ready.then(refresh);
  document.fonts?.addEventListener('loadingdone', refresh);
  reduced.addEventListener('change', refresh);
  refresh();

  let previous = 0;
  let frame = 0;
  const tick = (now: number) => {
    const dt = Math.min(0.05, Math.max(0, (now - previous) / 1000));
    previous = now;
    const rect = host.getBoundingClientRect();
    const paused =
      reduced.matches ||
      document.hidden ||
      rect.bottom < 0 ||
      rect.top > window.innerHeight ||
      host.hasAttribute('data-wt-paused') ||
      host.hasAttribute('data-wt-details-open') ||
      host.matches(':focus-visible, :has(:focus-visible)') ||
      (hover.matches && host.matches(':has(.wt__curve a:hover)'));
    if (!paused && sequence) {
      offset = (offset + speed * dt) % sequence;
      apply();
    }
    frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
  return () => {
    destroyed = true;
    cancelAnimationFrame(frame);
    observer.disconnect();
    document.fonts?.removeEventListener('loadingdone', refresh);
    reduced.removeEventListener('change', refresh);
    svg.removeEventListener('keydown', keyboard);
    svg.removeEventListener('focusin', focus);
    svg.remove();
  };
}
