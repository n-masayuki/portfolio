// 最初の25%で加速し、残り75%を使ってゆっくり止まる。
function easeAnchor(progress: number) {
  const peak = 0.25;
  return progress < peak
    ? peak * (progress / peak) ** 3
    : 1 - (1 - peak) * ((1 - progress) / (1 - peak)) ** 3;
}

export function initAnchorScroll() {
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const controller = new AbortController();
  const { signal } = controller;
  let frame = 0;
  let restoreScrollBehavior: (() => void) | undefined;

  const cancel = () => {
    cancelAnimationFrame(frame);
    const wasScrolling = frame !== 0;
    frame = 0;
    restoreScrollBehavior?.();
    restoreScrollBehavior = undefined;
    if (wasScrolling) document.dispatchEvent(new Event('anchor-scroll:end'));
  };

  document.addEventListener(
    'click',
    (event) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;

      const link =
        event.target instanceof Element
          ? event.target.closest<HTMLAnchorElement>('a[href]')
          : null;
      if (
        !link ||
        link.hasAttribute('download') ||
        (link.target && link.target !== '_self')
      )
        return;

      const url = new URL(link.href);
      if (
        url.origin !== location.origin ||
        url.pathname !== location.pathname ||
        url.search !== location.search ||
        !url.hash
      )
        return;

      let target: HTMLElement | null;
      try {
        target = document.getElementById(decodeURIComponent(url.hash.slice(1)));
      } catch {
        return;
      }
      if (!target) return;

      cancel();
      // 動きを減らす設定では、ブラウザー標準のアンカー移動を使う。
      if (motion.matches) return;
      event.preventDefault();

      const start = window.scrollY;
      const margin = parseFloat(getComputedStyle(target).scrollMarginTop) || 0;
      const getEnd = () =>
        Math.max(
          0,
          Math.min(
            window.scrollY + target.getBoundingClientRect().top - margin,
            document.documentElement.scrollHeight - window.innerHeight,
          ),
        );
      const distance = getEnd() - start;
      const duration = Math.min(1400, 900 + Math.abs(distance) * 0.12);
      const started = performance.now();

      // 他のスクロール処理にもCSSのsmoothが適用されないよう、移動中は無効にする。
      const root = document.documentElement;
      const previousBehavior = root.style.getPropertyValue('scroll-behavior');
      const previousPriority =
        root.style.getPropertyPriority('scroll-behavior');
      root.style.setProperty('scroll-behavior', 'auto', 'important');
      restoreScrollBehavior = () => {
        if (previousBehavior) {
          root.style.setProperty(
            'scroll-behavior',
            previousBehavior,
            previousPriority,
          );
        } else {
          root.style.removeProperty('scroll-behavior');
        }
      };
      document.dispatchEvent(
        new CustomEvent('anchor-scroll:start', {
          detail: { id: target.id },
        }),
      );

      const tick = (now: number) => {
        const progress = Math.max(0, Math.min(1, (now - started) / duration));
        // CSSのsmoothと重ならないよう、各フレームの座標を直接反映する。
        window.scrollTo({
          top: start + (getEnd() - start) * easeAnchor(progress),
          behavior: 'instant',
        });
        if (progress < 1) {
          frame = requestAnimationFrame(tick);
        } else {
          // 到着前にURLだけが変わる状態を作らない。
          if (location.hash !== url.hash) history.pushState(null, '', url.href);
          const temporaryTabIndex = !target.hasAttribute('tabindex');
          if (temporaryTabIndex) target.setAttribute('tabindex', '-1');
          target.focus({ preventScroll: true });
          if (temporaryTabIndex) target.removeAttribute('tabindex');
          cancel();
        }
      };
      frame = requestAnimationFrame(tick);
    },
    { signal },
  );

  // 無関係なクリックや修飾キーでは止めず、明示的なスクロール操作にだけ譲る。
  window.addEventListener(
    'wheel',
    (event) => {
      if (event.deltaY !== 0 && !event.ctrlKey) cancel();
    },
    { passive: true, signal },
  );
  window.addEventListener('touchmove', cancel, { passive: true, signal });
  window.addEventListener(
    'keydown',
    (event) => {
      if (
        [
          'ArrowUp',
          'ArrowDown',
          'PageUp',
          'PageDown',
          'Home',
          'End',
          ' ',
          'Escape',
        ].includes(event.key)
      )
        cancel();
    },
    { signal },
  );
  window.addEventListener('popstate', cancel, { signal });
  window.addEventListener('hashchange', cancel, { signal });
  motion.addEventListener('change', cancel, { signal });

  return () => {
    cancel();
    controller.abort();
  };
}
