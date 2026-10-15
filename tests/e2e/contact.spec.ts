// 実ブラウザーでお問い合わせフォームを操作する。外部への送信は模擬応答に置き換える。
// getByLabelはラベル名で入力欄を、getByRoleは役割と名前でボタンなどを探す。
// awaitは操作の完了を待ち、await expectは期待する画面状態になるまで確認を繰り返す。
import { test, expect } from './fixtures';

// 正常な入力を複数のテストで使い回すための補助関数。
async function fillContact(page: import('@playwright/test').Page) {
  await page.getByLabel('お名前').fill('テスト利用者');
  await page.getByLabel('メールアドレス').fill('test@example.com');
  await page.getByLabel('お問い合わせ内容').fill('動作確認用の内容です😀');
}

test('必須項目・メール形式の検証で不正な入力を送信しない', async ({ page }) => {
  // 通信回数を数え、入力チェックで止まった場合は送信されていないことを確かめる。
  let requests = 0;
  // routeで送信を捕まえ、実サービスに送らずテスト用の応答を返す。
  await page.route('https://formspree.io/**', async (route) => {
    requests++;
    await route.fulfill({ json: {} });
  });
  await page.goto('/#contact');
  await page.getByRole('button', { name: '送信', exact: true }).click();
  await expect(page.getByLabel('お名前')).toBeFocused();
  await fillContact(page);
  await page.getByLabel('メールアドレス').fill('invalid-address');
  await page.getByRole('button', { name: '送信', exact: true }).click();
  await expect(page.getByLabel('メールアドレス')).toBeFocused();
  expect(requests).toBe(0);
});

test('文字数と入力上限を反映する', async ({ page }) => {
  await page.goto('/#contact');
  const message = page.getByLabel('お問い合わせ内容');
  await message.fill('あ😀');
  await expect(page.locator('#contact-form-message-count')).toHaveText('2');
  // repeat(500)で上限の500文字を用意し、さらにキー入力しても増えないことを確認する。
  await message.fill('あ'.repeat(500));
  await message.press('End');
  await page.keyboard.type('追加入力');
  await expect(message).toHaveValue('あ'.repeat(500));
  await expect(page.locator('#contact-form-message-count')).toHaveText('500');
});

test('送信中は二重送信を防ぎ、成功時に完了ページへ遷移する', async ({
  page,
}) => {
  // 応答を保留するためのPromise（後で完了する処理）を用意する。
  // finish()を呼ぶまで待機することで、送信中の状態を確実に検証できる。
  let finish!: () => void;
  const ready = new Promise<void>((resolve) => {
    finish = resolve;
  });
  let requests = 0;
  await page.route('https://formspree.io/**', async (route) => {
    requests++;
    expect(route.request().method()).toBe('POST');
    expect(route.request().postData()).toContain('test@example.com');
    // テスト側が送信中の確認を終えるまで、サーバー応答を返さず待つ。
    await ready;
    await route.fulfill({ json: { ok: true } });
  });
  await page.goto('/#contact');
  await fillContact(page);
  await page.getByRole('button', { name: '送信', exact: true }).click();
  await expect(page.getByRole('button', { name: '送信中…' })).toBeDisabled();
  await expect(page.locator('.contact-form')).toHaveAttribute(
    'aria-busy',
    'true',
  );
  // ボタンは無効なので、イベントを直接発生させて二重送信への防御も確認する。
  await page
    .locator('.contact-form')
    .evaluate((form) =>
      form.dispatchEvent(new Event('submit', { cancelable: true })),
    );
  // 保留していた応答を返し、完了ページへの移動と通信回数を確認する。
  finish();
  await expect(page).toHaveURL('/contact/thanks/');
  expect(requests).toBe(1);
});

// HTTPエラー（500応答）と通信エラー（接続失敗）それぞれのテストを作る。
for (const failure of ['http', 'network'] as const) {
  test(`送信失敗（${failure}）後に入力を保持して再送できる`, async ({
    page,
  }) => {
    let attempts = 0;
    await page.route('https://formspree.io/**', async (route) => {
      // 初回だけ失敗させ、2回目以降は成功させて再送の流れを確認する。
      attempts++;
      if (attempts > 1) await route.fulfill({ json: { ok: true } });
      else if (failure === 'http')
        await route.fulfill({ status: 500, json: { error: 'mock failure' } });
      else await route.abort('failed');
    });
    await page.goto('/#contact');
    await fillContact(page);
    await page.getByRole('button', { name: '送信', exact: true }).click();
    await expect(page.locator('#contact-form-error')).toContainText(
      '送信を完了できませんでした',
    );
    await expect(page.getByLabel('お名前')).toHaveValue('テスト利用者');
    await expect(page.getByLabel('お問い合わせ内容')).toHaveValue(
      '動作確認用の内容です😀',
    );
    await expect(
      page.getByRole('button', { name: '送信', exact: true }),
    ).toBeEnabled();
    await page.getByRole('button', { name: '送信', exact: true }).click();
    await expect(page).toHaveURL('/contact/thanks/');
    expect(attempts).toBe(2);
  });
}
