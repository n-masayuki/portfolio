// @vitest-environment node
// 先頭の指定により、このファイルはブラウザー環境ではなくNode.js上で実行する。
// AstroContainerでコンポーネントをHTML文字列にし、JSDOMで要素として調べる。
// ここでは生成されたHTMLを確認し、画面上での操作はe2eのテストに任せる。
import { JSDOM } from 'jsdom';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, expect, it } from 'vitest';
import ExternalLink from '../../src/components/ui/ExternalLink.astro';
import SectionHeading from '../../src/components/ui/SectionHeading.astro';
import Contact from '../../src/components/Home/Contact.astro';

// JSDOMは、ブラウザーを開かずにHTMLの検索などを行うための仕組み。
const document = new JSDOM().window.document;

describe('Astroの生成HTML', () => {
  it('外部リンクに新規タブと安全なrelを付け、属性と内容を保持する', async () => {
    // Astroコンポーネントを単体で描画するための実行環境を作る。
    const container = await AstroContainer.create();
    const html = await container.renderToString(ExternalLink, {
      // propsはコンポーネントに渡す属性、slotsはタグの内側に入れる内容。
      props: {
        href: 'https://example.com',
        class: 'example',
        'aria-label': '外部サイト',
      },
      slots: { default: 'リンク' },
    });
    // HTML文字列を要素に変換すると、querySelectorでaタグなどを検索できる。
    const root = document.createElement('div');
    root.innerHTML = html;
    const link = root.querySelector('a')!;
    expect(link.target).toBe('_blank');
    // relは空白区切りなので配列にする。必要な2つの値が含まれればよく、順番は問わない。
    expect(link.rel.split(' ')).toEqual(
      expect.arrayContaining(['noopener', 'noreferrer']),
    );
    expect(link.getAttribute('aria-label')).toBe('外部サイト');
    expect(link.classList.contains('example')).toBe(true);
    expect(link.textContent).toBe('リンク');
  });

  it('見出しのID・日本語と装飾用英語を出力する', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(SectionHeading, {
      props: { id: 'about-heading', title: '私について', english: 'About' },
    });
    const root = document.createElement('div');
    root.innerHTML = html;
    expect(root.querySelector('#about-heading')!.textContent?.trim()).toBe(
      '私について',
    );
    // 装飾用の英語は、読み上げ対象から除くaria-hidden付きの要素にあることを確認する。
    expect(
      root.querySelector('[aria-hidden="true"]')!.textContent?.trim(),
    ).toBe('About');
  });

  it('フォームのラベル・必須入力・入力上限・エラー通知を出力する', async () => {
    const container = await AstroContainer.create();
    const root = document.createElement('div');
    root.innerHTML = await container.renderToString(Contact);
    // 入力欄のname属性と最大文字数の組を使い、3項目の共通ルールを確認する。
    for (const [name, max] of [
      ['name', 24],
      ['email', 254],
      ['message', 500],
    ] as const) {
      // <...>は取得する要素の型、`...${name}...`は変数を埋め込んだ文字列。
      const field = root.querySelector<HTMLInputElement | HTMLTextAreaElement>(
        `[name="${name}"]`,
      )!;
      expect(field.required).toBe(true);
      expect(field.maxLength).toBe(max);
      // labelのforと入力欄のidが対応し、どの入力欄のラベルか分かることを確認する。
      expect(root.querySelector(`label[for="${field.id}"]`)).not.toBeNull();
    }
    expect(root.querySelector('[name="email"]')!.getAttribute('type')).toBe(
      'email',
    );
    expect(
      // role=alertは、エラーの更新を支援技術に通知するための指定。
      root.querySelector('#contact-form-error')!.getAttribute('role'),
    ).toBe('alert');
  });
});
