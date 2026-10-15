// ページ全体の構造・移動・メニュー・ダイアログなどを実ブラウザーで確認する。
// pageは操作するタブ、locatorは要素の指定、expectは期待する結果の確認に使う。
// isMobileはテスト構成の端末設定を表す（現在のウィンドウ幅そのものではない）。
import AxeBuilder from '@axe-core/playwright';
import { test, expect } from './fixtures';

test('主要セクション・メタ情報・内部リンク・画像が正しく生成される', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page).toHaveTitle('Niibori Masayuki - Portfolio');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ja');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    'https://nm-dev.jp/',
  );
  // 構造化データ（検索エンジン向けのJSON）がプロフィールページを表すことを確認する。
  const data = await page
    .locator('script[type="application/ld+json"]')
    .textContent();
  expect(JSON.parse(data!)['@type']).toBe('ProfilePage');
  for (const id of ['about', 'skills', 'works', 'contact']) {
    await expect(page.locator(`#${id}`)).toHaveCount(1);
    await expect(page.locator(`#${id}-heading`)).toHaveCount(1);
  }
  // evaluateの中はブラウザー内で実行する。同じidが2回目以降に現れたら抽出する。
  const duplicateIds = await page.evaluate(() => {
    const ids = [...document.querySelectorAll('[id]')].map(
      (element) => element.id,
    );
    return ids.filter((id, index) => ids.indexOf(id) !== index);
  });
  expect(duplicateIds).toEqual([]);
  // 遅延読み込みを含め、ページ内の画像を実際に表示して確認する。
  for (const image of await page.locator('main img').all()) {
    await image.scrollIntoViewIfNeeded();
    // naturalWidthは読み込んだ画像の幅。0より大きくなるまで待ち、読み込み成功を確かめる。
    await expect
      .poll(() =>
        image.evaluate((element: HTMLImageElement) => element.naturalWidth),
      )
      .toBeGreaterThan(0);
    await expect(image).toHaveAttribute('alt');
  }
  // 新規タブで開くリンクに、安全性と参照元情報に関するrel指定があることを確認する。
  for (const link of await page.locator('a[target="_blank"]').all()) {
    const rel = await link.getAttribute('rel');
    expect(rel).toContain('noopener');
    expect(rel).toContain('noreferrer');
  }
});

test('ナビゲーションで各セクションへ移動し、現在地を更新する', async ({
  page,
  isMobile,
}) => {
  await page.goto('/');
  for (const id of ['about', 'skills', 'works', 'contact']) {
    if (isMobile) await page.getByRole('button', { name: 'メニュー' }).click();
    const link = page.locator(`.site-nav a[href="/#${id}"]`);
    await link.click();
    await expect(page).toHaveURL(new RegExp(`#${id}$`));
    // URLだけでなく、ナビゲーションの現在地表示も移動先に追従することを確認する。
    try {
      await expect(link).toHaveAttribute('aria-current', 'location');
    } catch (error) {
      // 失敗時だけ各要素の位置をレポートに添付し、ずれの原因を調べやすくする。
      await test.info().attach('navigation-metrics', {
        contentType: 'application/json',
        body: JSON.stringify(
          await page.evaluate(() => ({
            scrollY: window.scrollY,
            header: document
              .querySelector('.site-header')
              ?.getBoundingClientRect()
              .toJSON(),
            sections: [...document.querySelectorAll('main section[id]')].map(
              (section) => ({
                id: section.id,
                rect: section.getBoundingClientRect().toJSON(),
              }),
            ),
          })),
        ),
      });
      // 診断情報を保存した後も、元の失敗をテスト結果として報告する。
      throw error;
    }
    if (isMobile)
      await expect(
        page.getByRole('button', { name: 'メニュー' }),
      ).toHaveAttribute('aria-expanded', 'false');
  }
});

test('モバイルメニューはEscape・背景・画面幅変更で閉じる', async ({
  page,
  isMobile,
}) => {
  // PC構成ではこのテストを実行しない。
  test.skip(!isMobile, 'モバイルメニューのみ');
  await page.goto('/');
  const toggle = page.getByRole('button', { name: 'メニュー' });
  const nav = page.locator('#site-navigation');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(nav.locator('a').first()).toBeFocused();
  await expect(page.locator('body')).toHaveClass(/menu-open/);
  await page.keyboard.press('Escape');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(toggle).toBeFocused();
  await toggle.click();
  // ナビゲーション要素内の、リンクがない背景部分をクリックする。
  await nav.click({ position: { x: 10, y: 150 } });
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await toggle.click();
  // メニューを開いたままPC幅へ広げ、開閉状態とスクロール制限が解除されるか調べる。
  await page.setViewportSize({ width: 1000, height: 800 });
  await expect(page.locator('.menu-toggle')).toHaveAttribute(
    'aria-expanded',
    'false',
  );
  await expect(page.locator('body')).not.toHaveClass(/menu-open/);
});

test('ヘッダーはスクロール後に縮小し、先頭で戻る', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'PCのヘッダーのみ');
  await page.goto('/');
  const header = page.locator('.site-header');
  await expect(header).not.toHaveAttribute('data-shrunk');
  await page.evaluate(() => window.scrollTo(0, 300));
  await expect(header).toHaveAttribute('data-shrunk');
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(header).not.toHaveAttribute('data-shrunk');
});

test('すべての開発履歴の詳細を開き、閉じるボタンとEscapeで戻れる', async ({
  page,
}) => {
  await page.goto('/');
  const triggers = page.locator('.work__trigger');
  expect(await triggers.count()).toBeGreaterThan(0);
  for (const trigger of await triggers.all()) {
    // aria-controlsに書かれたidから、そのボタンに対応するダイアログを探す。
    const id = await trigger.getAttribute('aria-controls');
    const dialog = page.locator(`[id="${id}"]`);
    await trigger.click();
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('h3')).not.toBeEmpty();
    await dialog.getByRole('button', { name: '閉じる' }).click();
    await expect(dialog).not.toBeVisible();
  }
  // Safariはポインターで押したボタンへフォーカスしないため、
  // 復帰先の検証はキーボードから開いた場合に行う。
  await triggers.first().focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.work-modal[open]')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(page.locator('.work-modal[open]')).toHaveCount(0);
  await expect(triggers.first()).toBeFocused();
});

test('完了ページ・404からトップへ戻れる', async ({ page }) => {
  await page.goto('/contact/thanks/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'お問い合わせありがとうございます',
  );
  // 完了ページを検索結果に掲載しないためのメタ情報も確認する。
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    'content',
    'noindex, nofollow',
  );
  await page.getByRole('link', { name: 'トップページへ戻る' }).click();
  await expect(page).toHaveURL('/');
  await expect(page.locator('#github-calendar article')).toHaveCount(1);
  const response = await page.goto('/does-not-exist/');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.locator('.not-found__link').click();
  await expect(page).toHaveURL('/');
});

test('PC・モバイル・境界幅でページ全体に横はみ出しがない', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.react-activity-calendar')).toBeVisible();
  // 767px・768pxはレイアウト切り替えの境界付近。狭い画面からPC幅まで確認する。
  for (const width of [320, 390, 767, 768, 1000, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            // 内容全体の幅 − 表示幅。丸め誤差の1pxまでを許容する。
            document.documentElement.scrollWidth -
            document.documentElement.clientWidth,
        ),
      )
      .toBeLessThanOrEqual(1);
  }
});

test('ページと開いたダイアログに重大なアクセシビリティ違反がない', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('.react-activity-calendar')).toBeVisible();
  // axeで指定したWCAG基準の自動検査を行う。人による読みやすさの判断などは別途必要。
  const scan = () =>
    new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
  // 通常のページとダイアログ表示中の両方で、検出された違反が0件であることを確認する。
  expect((await scan()).violations).toEqual([]);
  await page.locator('.work__trigger').first().click();
  expect((await scan()).violations).toEqual([]);
});
