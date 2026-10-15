// 実ブラウザーでカレンダーの表示・スクロール・取得失敗時の状態を確認する。
// pageは操作するタブ。locatorはCSSセレクターで対象を指定する仕組み。
// await expect(...)は、期待する画面状態になるまで一定時間確認を繰り返す。
import { test, expect } from './fixtures';

test('カレンダーは一つだけ表示され、右端のフェードを切り替える', async ({
  page,
  isMobile,
}) => {
  // 狭い表示領域にして、横スクロールが必要な状態から始める。
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const calendar = page.locator('#github-calendar');
  await expect(calendar.locator('article')).toHaveCount(1);
  // 730はfixtures.tsで返す固定の合計値。実際のGitHubの件数には依存しない。
  await expect(calendar).toContainText('730 contributions');
  const scroller = calendar.locator(
    '.react-activity-calendar__scroll-container',
  );
  await scroller.scrollIntoViewIfNeeded();
  await expect(scroller).toHaveAttribute('data-overflow-right');
  await expect(scroller).toHaveCSS('mask-image', /linear-gradient/);
  // evaluateの中はブラウザー内で動く。最大幅を代入すると、実際の右端まで移動する。
  await scroller.evaluate((element) => {
    element.scrollLeft = element.scrollWidth;
  });
  await expect(scroller).not.toHaveAttribute('data-overflow-right');
  await scroller.evaluate((element) => {
    element.scrollLeft = 0;
  });
  await expect(scroller).toHaveAttribute('data-overflow-right');
  await page.setViewportSize({ width: 1440, height: 900 });
  // セクションの最大幅は800pxなので、PC幅でも内容は横に続く。
  await expect(scroller).toHaveAttribute('data-overflow-right');
  // デスクトップでは、キーボードでもスクロールできることを確認する。
  if (!isMobile) {
    await scroller.focus();
    await page.keyboard.press('ArrowRight');
    // キー操作による移動は非同期なので、pollで実際の移動距離を繰り返し調べる。
    await expect
      .poll(() => scroller.evaluate((element) => element.scrollLeft))
      .toBeGreaterThan(0);
  }
});

test('外部APIの取得失敗を表示し、ページの他の機能は利用できる', async ({
  page,
}) => {
  // 共通の成功応答をこのテストだけ上書きし、APIのサーバーエラーを再現する。
  await page.route('**/github-contributions-api.jogruber.de/**', (route) =>
    route.fulfill({ status: 500, json: { error: 'mock error' } }),
  );
  await page.goto('/#contact');
  await expect(page.locator('#github-calendar')).toContainText(
    'Fetching GitHub contribution data',
  );
  await expect(page.locator('#github-calendar article')).toHaveCount(0);
  // カレンダーが表示できなくても、お問い合わせ欄を操作できることを確認する。
  await page.getByLabel('お名前').fill('テスト');
  await expect(page.getByLabel('お名前')).toHaveValue('テスト');
});
