interface ContactOptions {
  submit?: typeof fetch;
  navigate?: (url: string) => void;
}

// 通信と遷移を差し替え可能にし、実送信せずに成功・失敗を検証できるようにする。
export function initContact(
  root: ParentNode = document,
  {
    submit = fetch,
    navigate = (url) => window.location.assign(url),
  }: ContactOptions = {},
) {
  const form = root.querySelector<HTMLFormElement>('.contact-form');
  const submitButton = form?.querySelector<HTMLButtonElement>(
    'button[type="submit"]',
  );
  const errorMessage = root.querySelector<HTMLElement>('#contact-form-error');

  if (form && submitButton && errorMessage) {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (submitButton.disabled) return;

      const data = new FormData(form);
      errorMessage.textContent = '';
      submitButton.disabled = true;
      submitButton.textContent = '送信中…';
      form.setAttribute('aria-busy', 'true');

      try {
        const response = await submit(form.action, {
          method: 'POST',
          body: data,
          headers: { Accept: 'application/json' },
        });

        if (!response.ok) throw new Error('Form submission failed');

        navigate('/contact/thanks/');
      } catch {
        errorMessage.textContent =
          '送信を完了できませんでした。通信環境や入力内容を確認し、認証後にもう一度送信してください。';
        // 再送時には、新しい Turnstile トークンを取得する。
        const turnstile = (
          window as Window & {
            turnstile?: { reset: (container: HTMLElement) => void };
          }
        ).turnstile;
        const widget = form.querySelector<HTMLElement>('.cf-turnstile');
        if (turnstile && widget) turnstile.reset(widget);
      } finally {
        submitButton.disabled = false;
        submitButton.textContent = '送信';
        form.removeAttribute('aria-busy');
      }
    });
  }

  // メッセージ入力欄の文字数をリアルタイムでカウントするためのスクリプト
  const message = root.querySelector<HTMLTextAreaElement>(
    '#contact-form-message',
  );
  const messageCount = root.querySelector<HTMLElement>(
    '#contact-form-message-count',
  );

  if (message && messageCount) {
    const updateMessageCount = () => {
      messageCount.textContent = String(Array.from(message.value).length);
    };

    message.addEventListener('input', updateMessageCount);
    updateMessageCount();
  }
}
