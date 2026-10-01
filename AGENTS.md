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

## Documentation

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)

### Documentation and source of truth

- 実際の挙動を説明するときは、現在のコード、設定、テスト、CIを根拠にする。文書だけから実装の挙動を推測しない。
- 期待する挙動や設計意図を判断するときは、要件・設計文書とユーザーの最新の依頼を根拠にする。
- 実装と文書が矛盾する場合は、該当するファイルやテストを示して、実装の不具合・文書の陳腐化・要件の曖昧さのどれかを報告する。依頼の範囲で解消方針が明らかな場合を除き、どちらかを黙って正として扱ったり、整合させるためだけに変更したりしない。
- 矛盾を解消する変更を行った場合は、選んだ根拠に合わせて実装または文書を更新し、残る不一致や未検証の点を伝える。
