export function initCalendarFade(calendar: HTMLElement | null) {
  // 外枠がないページでは、監視やイベントの登録を行わず終了する。
  if (!calendar) return;

  // 右側に未表示の内容があるかを調べ、フェードの表示を更新する。
  const updateFade = () => {
    // ライブラリが生成した、実際に横スクロールする要素を取得する。
    const element = calendar.querySelector<HTMLElement>(
      '.react-activity-calendar__scroll-container',
    );
    // Reactの描画前など、対象の要素がまだない場合は処理を終える。
    if (!element) return;

    // キーボードでも横スクロールできるようにし、領域の用途を支援技術へ伝える。
    element.tabIndex = 0;
    element.setAttribute('role', 'region');
    element.setAttribute('aria-label', 'GitHubの活動履歴（横スクロール）');

    // 全体の幅から表示幅と移動済みの距離を引き、右側の残り幅を求める。
    // 小数による丸め誤差を考慮し、残り幅が1pxを超える場合に続きがあると判断する。
    const hasMore =
      element.scrollWidth - element.clientWidth - element.scrollLeft > 1;
    // 続きがあればCSS用の属性を付け、右端まで到達していれば属性を外す。
    element.toggleAttribute('data-overflow-right', hasMore);
  };

  // 監視対象の表示サイズが変わったときに、フェードを再判定する。
  const resizeObserver = new ResizeObserver(updateFade);
  // 現在のDOMに合わせてサイズの監視対象を登録し直す。
  const observeSizes = () => {
    // 古い要素の監視と重複登録を避けるため、いったん全対象の監視を解除する。
    resizeObserver.disconnect();
    // 外枠の幅が変わる場合（画面幅やレイアウトの変更など）を監視する。
    resizeObserver.observe(calendar);
    // 表示領域と内容のSVGを取得し、どちらのサイズ変更も検出できるようにする。
    calendar
      .querySelectorAll('.react-activity-calendar__scroll-container, svg')
      // 取得した各要素をサイズの監視対象に追加する。
      .forEach((element) => resizeObserver.observe(element));
    // サイズ変更の通知を待たずに、現在の状態を反映する。
    updateFade();
  };

  // Reactによる要素の追加・削除を検出したら、サイズの監視対象を更新する。
  const mutationObserver = new MutationObserver(observeSizes);
  // 外枠の直下だけでなく、内部全体の子要素の追加・削除を監視する。
  // 属性変更は監視しないため、フェード用の属性更新でこの処理が繰り返されることはない。
  mutationObserver.observe(calendar, { childList: true, subtree: true });
  // 内部のスクロールに合わせて、右側の残り幅を再判定する。
  calendar.addEventListener('scroll', updateFade, {
    // scrollイベントはバブリングしないため、外枠で捕捉できるようにする。
    capture: true,
    // スクロールの既定動作を妨げる処理を行わないことをブラウザーに伝える。
    passive: true,
  });
  // 初期状態の監視対象を登録し、既に描画済みならフェードも反映する。
  observeSizes();

  // Astroのクライアント側ページ遷移でDOMが差し替わる前に、監視を解除する。
  document.addEventListener(
    'astro:before-swap',
    () => {
      // ページから取り除かれるカレンダーのDOM監視を終了する。
      mutationObserver.disconnect();
      // 同じカレンダーのサイズ監視を終了する。
      resizeObserver.disconnect();
      // 登録時と同じcapture指定で、スクロールのイベント処理を解除する。
      calendar.removeEventListener('scroll', updateFade, true);
    },
    // 後始末は一度だけ実行し、このページ遷移用のイベント処理も自動で解除する。
    { once: true },
  );
}
