// カレンダー右端のフェード（右に続きがあることを示すぼかし）を検証する。
// 実ブラウザーではなく、jsdomが用意するテスト用のDOM（HTMLの要素構造）を使う。
// describeはテストのグループ、itは個別の確認、expectは期待する結果との比較を表す。
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initCalendarFade } from '../../src/scripts/calendar';

// サイズ変更時の処理を保存し、テストから好きなタイミングで呼び出す。
let resize: () => void;
let disconnect: ReturnType<typeof vi.fn>;
// テスト用の横スクロール領域を作る。引数は「内容全体の幅・表示幅・移動距離」。
function scroller(width = 800, visible = 300, position = 0) {
  const element = document.createElement('div');
  element.className = 'react-activity-calendar__scroll-container';
  // jsdomは画面のレイアウトを計算しないため、判定に必要な幅を手動で設定する。
  Object.defineProperties(element, {
    scrollWidth: { value: width, configurable: true },
    clientWidth: { value: visible, configurable: true },
  });
  element.scrollLeft = position;
  element.innerHTML = '<svg></svg>';
  return element;
}

describe('横スクロールのフェード', () => {
  // 各テストの前に、HTMLと監視用の代役（モック）を新しく用意する。
  beforeEach(() => {
    document.body.innerHTML = '<div id="calendar"></div>';
    // vi.fn()は、呼び出された回数や引数を後で確認できるテスト用の関数。
    disconnect = vi.fn();
    // 実際のサイズ監視の代わりに、コールバックを保存するクラスを登録する。
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: () => void) {
          resize = callback;
        }
        observe = vi.fn();
        disconnect = disconnect;
      },
    );
  });
  // 各テストの後にページ遷移前のイベントを発生させ、登録した監視を解除する。
  afterEach(() => {
    document.dispatchEvent(new Event('astro:before-swap'));
  });

  it('対象がないページでは監視しない', () => {
    initCalendarFade(null);
    expect(disconnect).not.toHaveBeenCalled();
  });

  // 同じ確認を表の各行で繰り返す。最後の値はフェードを表示すべきかどうか。
  // 残り0.5pxは丸め誤差として扱い、残り2pxなら続きを表示する。
  it.each([
    [800, 300, 0, true],
    [800, 300, 500, false],
    [800, 300, 499.5, false],
    [800, 300, 498, true],
    [300, 300, 0, false],
    [200, 300, 0, false],
  ])(
    '幅%s・表示幅%s・位置%sではフェード=%s',
    (width, visible, position, expected) => {
      // 末尾の ! は「この要素は存在する」とTypeScriptに伝える指定（実行時の検査ではない）。
      const root = document.getElementById('calendar')!;
      const element = scroller(width, visible, position);
      root.append(element);
      initCalendarFade(root);
      expect(element.hasAttribute('data-overflow-right')).toBe(expected);
      // キーボードで選択でき、読み上げでも領域の用途が伝わることを確認する。
      expect(element.tabIndex).toBe(0);
      expect(element.getAttribute('role')).toBe('region');
      expect(element.getAttribute('aria-label')).toBe(
        'GitHubの活動履歴（横スクロール）',
      );
    },
  );

  it('Reactによる遅延描画・要素の差し替えにも追従する', async () => {
    const root = document.getElementById('calendar')!;
    initCalendarFade(root);
    const element = scroller();
    root.append(element);
    // 要素追加をMutationObserverが検知するまで、期待する状態になるか繰り返し確認する。
    await vi.waitFor(() =>
      expect(element.hasAttribute('data-overflow-right')).toBe(true),
    );
    // React自体は起動せず、要素の追加・差し替えで遅延描画に相当する状況を再現する。
    const replacement = scroller(300, 300);
    root.replaceChildren(replacement);
    await vi.waitFor(() =>
      expect(replacement.hasAttribute('data-overflow-right')).toBe(false),
    );
    replacement.scrollLeft = 0;
    Object.defineProperty(replacement, 'scrollWidth', {
      value: 900,
      configurable: true,
    });
    // 本物の画面サイズを変える代わりに、保存したサイズ変更の処理を呼ぶ。
    resize();
    expect(replacement.hasAttribute('data-overflow-right')).toBe(true);
  });

  it('右端・左端へのスクロールと幅の変更で表示を切り替える', () => {
    const root = document.getElementById('calendar')!;
    const element = scroller();
    root.append(element);
    initCalendarFade(root);
    element.scrollLeft = 500;
    // scrollLeftの代入だけでは通知されないため、スクロールイベントも発生させる。
    element.dispatchEvent(new Event('scroll'));
    expect(element.hasAttribute('data-overflow-right')).toBe(false);
    element.scrollLeft = 0;
    element.dispatchEvent(new Event('scroll'));
    expect(element.hasAttribute('data-overflow-right')).toBe(true);
    Object.defineProperty(element, 'clientWidth', { value: 800 });
    resize();
    expect(element.hasAttribute('data-overflow-right')).toBe(false);
  });

  it('ページ差し替え後は監視とイベントを解除する', () => {
    const root = document.getElementById('calendar')!;
    const element = scroller();
    root.append(element);
    initCalendarFade(root);
    document.dispatchEvent(new Event('astro:before-swap'));
    // サイズ監視の解除は、初期登録前とページ差し替え前の合計2回。
    expect(disconnect).toHaveBeenCalledTimes(2);
    element.scrollLeft = 500;
    element.dispatchEvent(new Event('scroll'));
    // 解除後はスクロールしても属性が更新されず、解除前の値が残る。
    expect(element.hasAttribute('data-overflow-right')).toBe(true);
  });
});
