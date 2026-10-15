// スプラッシュ（最初に表示するオープニング）の表示条件と終了方法を確認する。
// 共通設定では「動きを減らす」が有効。通常のアニメーションの確認時だけ設定を変える。
// await expectは、アニメーションなどで表示状態が変わるまで一定時間待って確認する。
import { test, expect } from './fixtures';

test('動きを減らす設定ではスプラッシュを表示しない', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#site-splash')).not.toBeVisible();
});

// describeでテストをまとめ、useでこのグループにだけ適用する設定を指定する。
test.describe('通常の動き', () => {
  test.use({ reducedMotion: 'no-preference' });

  test('初回だけ表示して自動終了し、再読み込みでは表示しない', async ({
    page,
  }) => {
    await page.goto('/');
    // sessionStorageは同じタブ内で再読み込み後も残る保存領域。
    // pollで「表示済み」の印が保存されるまで繰り返し調べる。
    await expect
      .poll(() =>
        page.evaluate(() => sessionStorage.getItem('portfolio:splash-seen')),
      )
      .toBe('1');
    await expect(page.locator('#site-splash')).not.toBeVisible({
      // 自動終了のアニメーションを待つため、この確認は最大4秒まで待つ。
      timeout: 4000,
    });
    await page.reload();
    await expect(page.locator('#site-splash')).not.toBeVisible();
  });

  test('アンカー付きのアクセスでは表示しない', async ({ page }) => {
    // #contactはページ内の移動先。直接その位置へ行く場合はオープニングを省く。
    await page.goto('/#contact');
    await expect(page.locator('#site-splash')).not.toBeVisible();
    expect(
      await page.evaluate(() =>
        sessionStorage.getItem('portfolio:splash-seen'),
      ),
      // 省略した場合は「表示済み」の印も保存されていないことを確認する。
    ).toBeNull();
  });

  test('Escapeでオープニングを終了できる', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#site-splash')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#site-splash')).not.toBeVisible();
  });
});
