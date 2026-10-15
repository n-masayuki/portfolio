// お問い合わせの文字数表示と送信処理を、実際には送信・画面遷移せずに検証する。
// describeで関連する確認をまとめ、itで1つのケース、expectで期待する結果を記述する。
// async / awaitは、通信などの非同期処理が終わるのを待つために使う。
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initContact } from '../../src/scripts/contact';

// fixture（フィクスチャ）は、テストに必要なHTMLや入力値を準備する関数。
function fixture() {
  document.body.innerHTML = `<form class="contact-form" action="https://example.test/contact">
    <input name="name" value="テスト"><input name="email" value="test@example.com">
    <textarea name="message" id="contact-form-message">こんにちは😀</textarea>
    <div class="cf-turnstile"></div><button type="submit">送信</button>
  </form><p id="contact-form-error"></p><span id="contact-form-message-count"></span>`;
  // よく操作する要素をまとめて返す。末尾の ! は要素の存在をTypeScriptに伝える。
  return {
    form: document.querySelector<HTMLFormElement>('form')!,
    button: document.querySelector<HTMLButtonElement>('button')!,
    message: document.querySelector<HTMLTextAreaElement>('textarea')!,
  };
}

describe('お問い合わせ', () => {
  // 前のテストのHTMLが次のテストに影響しないよう、毎回空にする。
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('対象がないページでも初期化できる', () => {
    expect(() => initContact()).not.toThrow();
  });

  it('通常の初期化ではブラウザーのfetchとlocationを使用する', async () => {
    const { form } = fixture();
    // vi.fn()は呼び出しを記録する代役。実際のページ遷移は行わない。
    const assign = vi.fn();
    // ブラウザー標準の通信と遷移先を差し替える。mockResolvedValueは成功結果を返す。
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
    vi.stubGlobal('window', { location: { assign } });
    initContact();
    // 送信イベントを発生させる。cancelableにより処理側のpreventDefault()が有効になる。
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    // 通信後の処理はすぐには終わらないので、期待する呼び出しが起きるまで確認を繰り返す。
    await vi.waitFor(() =>
      expect(assign).toHaveBeenCalledWith('/contact/thanks/'),
    );
  });

  it('初期値・日本語・絵文字・空文字の文字数を更新する', () => {
    const { message } = fixture();
    initContact();
    const count = document.getElementById('contact-form-message-count')!;
    expect(count.textContent).toBe('6');
    // 「入力内容・期待する文字数」の組ごとに入力イベントを発生させる。
    // このテストでは、例に使った絵文字😀も1文字として数えることを確認する。
    for (const [value, expected] of [
      ['', '0'],
      ['😀😀', '2'],
      ['あ'.repeat(500), '500'],
    ]) {
      message.value = value;
      message.dispatchEvent(new Event('input'));
      expect(count.textContent).toBe(expected);
    }
  });

  it('送信中は操作を無効化し、二重送信を防ぎ、成功後に完了ページへ遷移する', async () => {
    const { form, button } = fixture();
    // 通信の完了を保留し、送信中の状態を確認してからcompleteで成功させる。
    // ! は、この変数が使用前に代入されることをTypeScriptに伝える。
    let complete!: (response: Response) => void;
    const submit = vi.fn<typeof fetch>(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    );
    const navigate = vi.fn();
    // 通信と遷移を代役に置き換え、結果をテスト側で操作・確認できるようにする。
    initContact(document, { submit, navigate });
    const event = new Event('submit', { cancelable: true });
    form.dispatchEvent(event);
    // 通常のフォーム送信を止め、JavaScript側が送信を担当していることを確認する。
    expect(event.defaultPrevented).toBe(true);
    expect(button.disabled).toBe(true);
    expect(button.textContent).toBe('送信中…');
    expect(form.getAttribute('aria-busy')).toBe('true');
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    expect(submit).toHaveBeenCalledTimes(1);
    // mock.callsには呼び出しごとの引数が入る。最初の通信の宛先と送信内容を調べる。
    const [url, options] = submit.mock.calls[0];
    expect(url).toBe(form.action);
    expect(options?.method).toBe('POST');
    expect((options?.body as FormData).get('message')).toBe('こんにちは😀');
    expect(options?.headers).toEqual({ Accept: 'application/json' });
    // この処理が読むokだけを用意する。as Responseは型の指定で、実際の応答生成ではない。
    complete({ ok: true } as Response);
    await vi.waitFor(() =>
      expect(navigate).toHaveBeenCalledWith('/contact/thanks/'),
    );
    expect(button.disabled).toBe(false);
    expect(form.hasAttribute('aria-busy')).toBe(false);
  });

  // HTTPエラー（応答あり）と通信エラー（応答なし）の2通りで同じ確認を行う。
  it.each(['http', 'network'])(
    '失敗（%s）時は入力を保持し、再送できる状態に戻す',
    async (failure) => {
      const { form, button, message } = fixture();
      const submit = vi.fn<typeof fetch>();
      if (failure === 'http')
        submit.mockResolvedValue({ ok: false } as Response);
      // mockRejectedValueは、通信が例外で失敗した状態を再現する。
      else submit.mockRejectedValue(new Error('offline'));
      const navigate = vi.fn();
      initContact(document, { submit, navigate });
      form.dispatchEvent(new Event('submit', { cancelable: true }));
      await vi.waitFor(() => expect(button.disabled).toBe(false));
      expect(
        document.getElementById('contact-form-error')!.textContent,
      ).toContain('送信を完了できませんでした');
      expect(message.value).toBe('こんにちは😀');
      expect(button.textContent).toBe('送信');
      expect(navigate).not.toHaveBeenCalled();
      // 次の通信は成功させ、入力し直さなくても再送できることを確認する。
      submit.mockResolvedValue({ ok: true } as Response);
      form.dispatchEvent(new Event('submit', { cancelable: true }));
      await vi.waitFor(() => expect(navigate).toHaveBeenCalledOnce());
      expect(document.getElementById('contact-form-error')!.textContent).toBe(
        '',
      );
    },
  );

  it('認証ウィジェットがある場合は、失敗後にトークンをリセットする', async () => {
    const { form } = fixture();
    // Turnstile（認証サービス）の代役で、再認証のためのリセット要求を記録する。
    const reset = vi.fn();
    vi.stubGlobal('turnstile', { reset });
    initContact(document, {
      submit: vi.fn().mockRejectedValue(new Error('offline')),
    });
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    await vi.waitFor(() =>
      expect(reset).toHaveBeenCalledWith(form.querySelector('.cf-turnstile')),
    );
  });
});
