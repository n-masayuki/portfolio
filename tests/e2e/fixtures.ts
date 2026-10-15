// E2E（利用者の操作に近い形で行うテスト）に共通の準備と後片付けを定義する。
// 各spec.tsは、Playwright標準のtestではなく、このファイルのtestを読み込んで使う。
import { test as base, expect } from '@playwright/test';

// APIから返る活動履歴の代役。毎回同じ365日分を返し、実データの変動を避ける。
export const contributions = Array.from({ length: 365 }, (_, index) => ({
  // UTCの月は0始まり。日を1〜365まで増やし、2025年の日付をYYYY-MM-DD形式にする。
  date: new Date(Date.UTC(2025, 0, index + 1)).toISOString().slice(0, 10),
  // %は余りを求める演算子。0〜4を繰り返し、件数と色の濃さに変化を付ける。
  count: index % 5,
  level: index % 5,
}));

// fixtureはテストに渡す準備済みの値。標準のpage（ブラウザーのタブ）に設定を追加する。
export const test = base.extend({
  page: async ({ page }, providePage) => {
    const errors: string[] = [];
    // ページ内で処理されなかったJavaScriptエラーを集め、テスト終了時に確認する。
    page.on('pageerror', (error) => errors.push(error.message));
    // 外部API・認証・計測はすべて模擬し、テストデータを実送信しない。
    // routeは通信を途中で捕まえる機能。continueは実通信、fulfillは用意した応答を返す。
    await page.route('**/*', async (route) => {
      const url = new URL(route.request().url());
      // ローカルのサイトとdata URLは、そのまま読み込ませる。
      if (url.hostname === '127.0.0.1' || url.protocol === 'data:') {
        await route.continue();
      } else if (url.hostname === 'github-contributions-api.jogruber.de') {
        await route.fulfill({
          // 別のオリジンからの取得を許可するヘッダーと、固定の活動履歴を返す。
          headers: { 'access-control-allow-origin': '*' },
          json: { total: { last: 730 }, contributions },
        });
      } else if (url.hostname === 'formspree.io') {
        // 既定では送信失敗を返す。送信の各テストは専用のrouteで成功・失敗を設定する。
        await route.fulfill({
          status: 503,
          json: { error: 'Mock: submission unavailable' },
        });
      } else {
        await route.fulfill({
          status: 200,
          body: '',
          // 認証や計測など、その他の外部通信には空の応答を返す。
          contentType: 'text/javascript',
        });
      }
    });
    // ここで準備済みpageを各テストへ渡す。テスト終了後に、この後の処理へ戻る。
    await providePage(page);
    expect(errors, 'ブラウザーで未処理のJavaScriptエラーがない').toEqual([]);
  },
});

export { expect };
