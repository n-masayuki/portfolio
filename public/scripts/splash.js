/* global document, window, sessionStorage */
(() => {
  const splash = document.getElementById('site-splash');
  const storageKey = 'portfolio:splash-seen';
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');

  if (!splash || typeof splash.showModal !== 'function' || motion.matches || window.location.hash || document.hidden)
    return;

  // 保存できない環境では、ページ移動のたびに再生することを避ける。
  try {
    if (sessionStorage.getItem(storageKey)) return;
  } catch {
    return;
  }

  const controller = new window.AbortController();
  const options = { signal: controller.signal };
  let timeout;
  const finish = () => {
    window.clearTimeout(timeout);
    if (splash.open) splash.close();
    controller.abort();
  };

  splash.addEventListener(
    'cancel',
    (event) => {
      event.preventDefault();
      finish();
    },
    options,
  );
  splash.addEventListener(
    'animationend',
    (event) => {
      if (event.target === splash && event.animationName === 'splash-exit') finish();
    },
    options,
  );
  motion.addEventListener('change', finish, options);
  window.addEventListener('pagehide', finish, options);
  window.addEventListener('hashchange', finish, options);
  document.addEventListener(
    'visibilitychange',
    () => {
      if (document.hidden) finish();
    },
    options,
  );

  // 画像やフォント、外部サービスの完了は待たない。
  // CSSの終了イベントが発生しなくても、タイマーで必ず解除する。
  timeout = window.setTimeout(finish, 2000);
  try {
    splash.showModal();
    sessionStorage.setItem(storageKey, '1');
  } catch {
    finish();
  }
})();
