## Working principles

- ルールは目的を達成するための手段であり、機械的に守ること自体を目的にしない。
- 既存のルールや実装に改善点を見つけた場合は、依頼の範囲内であれば改善してよい。範囲外の場合は変更せず、提案として報告する。
- ルールは状況や知見の変化に合わせて更新する。更新の必要がないときは、無理に変更しない。

## Development

- 静的な内容はAstro、状態管理やクライアント描画が必要な部分はReactを使う。HTMLとCSSで十分な場合はクライアントJavaScriptを追加しない。
- JavaScript・Reactの実装はTypeScriptを基本とし、セマンティックHTMLとアクセシビリティを必須要件とする。
- 単純な動きはCSS、CSSだけでは対応しにくい動きはGSAPを使う。依存関係を追加する場合は必要性を説明する。
- 構造や設計を変更する前に、[要件](docs/requirements.md)、[アーキテクチャ](docs/architecture.md)、[デザイン](docs/design.md) と関連する機能文書を確認する。

When starting the dev server, use background mode:

```
astro dev --background
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

### Server lifecycle and port conflicts

- サーバーの起動・ブラウザー確認・E2E実行前に、[サーバーとポートの運用](docs/server-operations.md)を読む。
- 起動前に `npx astro dev status` で既存サーバーを確認する。同じ作業ディレクトリのサーバーが利用できる場合は再利用し、起動ログの実際のURL・ポートを使う。
- PlaywrightのE2E専用ポートは既定 `14322`（`PLAYWRIGHT_TEST_PORT` で変更可）。開発・プレビューのサーバーに流用しない。`reuseExistingServer: false` を維持する。
- AIが検証用に起動したサーバーは作業後に終了する。開発サーバーは `npx astro dev stop` を使う。継続利用のため残す場合は、起動したサーバーのURL・PID・終了方法をユーザーへ伝える。
- サンドボックス下ではAstroの生存確認が `EPERM` を停止済みと誤判定し、管理ファイルを削除することがある。起動・`status`・`stop` はプロセス確認権限のある環境で実行し、終了後は記録したPIDと実際の待受ポートも確認する。`No dev server is running` だけで終了済みと判断しない。
- ポート競合では、設定変更や追加起動の前に既存プロセスの用途・作業ディレクトリを調べる。ユーザーや別タスクのプロセスを一括終了しない。原因と解決が既知なら、文書の手順を優先する。

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

### Project documentation

- 文書の入口は [README](README.md#ドキュメント)、文書の役割・管理元・変更時の確認先は [開発ガイド](docs/development.md#文書の管理) を参照する。
- 実装差分を基に関連する説明・旧名称・設定値を検索し、必要な文書を同じ変更で更新する。固定の文書一覧だけで確認を終えない。
- 文書の移動や更新後は `npm run check:docs` を実行する。文意と実装の一致は別途確認する。
- 完了報告には更新した関連文書、または更新不要の理由と未解決の不一致を短く記す。
