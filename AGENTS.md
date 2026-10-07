## Working principles

- ルールは目的を達成するための手段であり、機械的に守ること自体を目的にしない。
- 既存のルールや実装に改善点を見つけた場合は、依頼の範囲内であれば改善してよい。範囲外の場合は変更せず、提案として報告する。
- ルールは状況や知見の変化に合わせて更新する。更新の必要がないときは、無理に変更しない。

## Development

When starting the dev server, use background mode:

```
astro dev --background
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

## Image quality

- ラスター画像は、各ブレークポイントでの実際のCSS表示幅・高さに対して、Retinaの2倍密度（@2x）まで十分な画素数を確保する。`object-fit: cover` や切り抜き後の有効な解像度も考慮する。
- 元画像には最大表示サイズの縦横2倍以上の解像度を用意する。低解像度素材をアップスケールしても品質を担保したことにはしない。不足する場合は、高解像度素材の差し替えまたは表示サイズの調整が必要なことを報告する。
- Astroの `Image` / `Picture` / `getImage` を使い、固定サイズには `densities={[1, 2]}`、可変サイズにはCSSと一致する `sizes` と@2xをカバーする `widths` を設定する。必要以上の高密度画像は生成しない。
- CSS背景画像も同じ方針を適用し、必要に応じて `image-set()` で1x・2xを配信する。SVGは解像度に依存しないため、この画素数要件の対象外とする。
- 画像の追加・変更時は、元画像と生成画像の寸法、`srcset` / `sizes`、表示サイズを確認する。圧縮品質は写真・文字入り画像などの用途に合わせ、@2xの画素数だけで見た目の品質を判断しない。

## Documentation

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Adding or optimizing images](https://docs.astro.build/en/guides/images/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)

### Documentation and source of truth

- 実際の挙動を説明するときは、現在のコード、設定、テスト、CIを根拠にする。文書だけから実装の挙動を推測しない。
- 期待する挙動や設計意図を判断するときは、要件・設計文書とユーザーの最新の依頼を根拠にする。
- 実装と文書が矛盾する場合は、該当するファイルやテストを示して、実装の不具合・文書の陳腐化・要件の曖昧さのどれかを報告する。依頼の範囲で解消方針が明らかな場合を除き、どちらかを黙って正として扱ったり、整合させるためだけに変更したりしない。
- 矛盾を解消する変更を行った場合は、選んだ根拠に合わせて実装または文書を更新し、残る不一致や未検証の点を伝える。
