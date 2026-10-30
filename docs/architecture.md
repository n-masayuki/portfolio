# アーキテクチャ

この文書は現在の構成と、採用している設計判断を扱います。
目的と期待する挙動は [要件](requirements.md)、操作手順は [開発ガイド](development.md) を参照してください。

## 技術の役割

依存関係と対応するNode.jsの範囲は [package.json](../package.json) で管理します。

| 技術            | 役割                                                          |
| --------------- | ------------------------------------------------------------- |
| Astro           | ページ、レイアウト、共通部品、静的HTMLの生成                  |
| TypeScript      | データ・Props・クライアント処理の型付け                       |
| React           | GitHubカレンダー、SplitText、ColorBendsなどのクライアント描画 |
| CSS / SCSS      | コンポーネントのスタイル、共通トークン、レスポンシブ          |
| GSAP            | CSSのみでは扱いにくいアニメーション                           |
| Three.js        | ColorBendsのWebGL背景                                         |
| `@lucide/astro` | UI操作用SVGアイコン                                           |
| Apache / PHP    | 本番の認証ゲート、静的ファイル配信、HTTPヘッダー              |

静的な内容はAstroを優先し、クライアント側の状態や描画が必要な部分にReactを限定します。
単純なtransitionはCSSを使い、追加のJavaScriptや依存関係は必要性・バンドルサイズ・保守性・ライセンスを確認して導入します。

## ページとレンダリング

[astro.config.mjs](../astro.config.mjs) はReact連携とサイトURLを設定しています。出力は静的HTMLで、成果物は `dist/` です。

- [トップページ](../src/pages/index.astro): About、Skills、Works、Contact、GitHub、WorldThanksの順に配置。HeroとBuiltの呼び出しはコメントアウトされています。
- [制作実績の詳細](../src/pages/works/[slug].astro): `GENERATE_WORK_PAGES=true` の場合だけ静的パスを生成します。
- [送信完了](../src/pages/contact/thanks.astro) と [404](../src/pages/404.astro): 共通レイアウトを使います。
- [Layout](../src/layouts/Layout.astro): 共通メタ情報、GTM、背景、ヘッダー、フッター、スプラッシュ用スロットを管理します。

Reactは `client:visible` や `client:only="react"` で必要な部分を描画します。
スプラッシュとWorldThanksの現状・表示条件は [スプラッシュ](features/splash-screen.md)、[世界の「ありがとう」](features/world-thanks.md) を参照してください。

## コンテンツとディレクトリ

```text
public/                  そのまま配信するファイル、フォント、認証、Apache設定
private/                 認証ユーザー情報（実ファイルはGit管理外）
src/
├── assets/              Astroで扱う画像など
├── components/
│   ├── Home/            トップページのセクション
│   └── ui/              共通部品とReactコンポーネント
├── content/works/       制作実績のMarkdown（Git管理外）
├── content.config.ts    コレクションの取得方法とスキーマ
├── data/                言語データなど
├── layouts/             共通レイアウト
├── pages/               ルーティング対象
├── scripts/             ブラウザー側の処理
└── styles/              共通スタイルとトークン
scripts/                 検証用ツール
tests/                   ユニットテストとE2E
docs/                    要件、設計、開発手順、機能の詳細
```

制作実績は [src/content.config.ts](../src/content.config.ts) のスキーマで検証します。
トップページでは `order` 順に並べ、タイトル・カテゴリ・期間・サムネイル・URL・担当範囲・使用技術を扱います。
本文と画像をコンポーネントへ直接埋め込まず、コンテンツと表示処理を分けます。

共通部品は再利用性と責務の明確さを基準に分離し、将来の利用だけを理由とした抽象化や細分化は避けます。

## スタイルとパフォーマンス

共通の色・文字・余白・動きはCSS Custom Properties、ブレークポイントはSCSSで管理します。
詳細な管理元は [デザイン](design.md) を参照してください。SCSSの過度なネストを避け、部品ごとに責務を分けます。

- Webフォントは `public/fonts/` にセルフホストし、必要なウェイトのみ読み込みます。
- 画像はAstroで最適化し、表示サイズと2倍密度を満たす素材・配信サイズを用意します。詳細は [AGENTS.md](../AGENTS.md#image-quality) を参照してください。
- Reactの利用箇所と不要なJavaScriptを見直し、Lighthouseで変更前後を確認します。
- `vite.build.cssMinify` は `esbuild` に固定しています。`lightningcss` が `animation-timeline` を `animation` の省略記法へ統合し、ビルド後にscroll-driven animationが無効になったためです。

## アクセシビリティ

セマンティックHTML、見出しの階層、キーボード操作、フォーカス管理、適切なARIA、画像alt、色のコントラスト、`prefers-reduced-motion` を基本要件とします。
UIアイコンは必要なものだけ名前付きimportし、操作要素にアクセシブルな名前を付けます。ブランドロゴは既存SVG、単純な装飾はCSSも使います。
検証の範囲と自動検査の限界は [開発ガイド](development.md#検証) にまとめています。

## 本番配信と外部サービス

[public/.htaccess](../public/.htaccess) が [public/auth.php](../public/auth.php) へリクエストを渡し、PHPセッションで認証後に保護対象ファイルを配信します。
`robots.txt`、`sitemap.xml`、`apple-touch-icon.png`、`favicon.ico` は認証なしで直接配信します。
認証対象の応答には `Cache-Control: private, no-store` を設定し、隠しファイルや許可されていない拡張子は配信しません。

- フォーム送信: Formspree
- Bot対策: Cloudflare Turnstile
- 計測: Google Tag Manager
- コントリビューション表示: GitHubカレンダー

CSPなどのHTTPヘッダーは `.htaccess` で管理します。外部サービス変更時はCSPの許可先も見直します。
公開・認証ユーザーの管理・Apache以外への移行は [開発ガイド](development.md#公開とphp認証) を参照してください。

## SEO

共通レイアウトがtitle、description、canonical、OGP、JSON-LDを出力し、ページ側から値を渡します。
制作実績の詳細は `noindex` を指定しています。robotsとsitemapは `public/` のファイルで管理します。
本番のPHP認証下では検索クローラーが保護ページを閲覧できないため、メタ情報の出力と検索への掲載は区別します。
