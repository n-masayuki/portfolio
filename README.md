# Portfolio

転職活動用ポートフォリオサイトのソースコードです。制作物やプロフィールを公開します。

## 使用技術

Astro / TypeScript / React / CSS・SCSS / GSAP / Three.js / `@lucide/astro`。
Astroを中心に静的HTMLを生成し、Reactはカレンダーやアニメーションなどに使用しています。
依存関係とバージョンは [package.json](package.json)、インストールする正確なバージョンは [package-lock.json](package-lock.json) で管理します。

## 開発を始める

開発用Node.jsは [.nvmrc](.nvmrc)、最低要件は [package.json の engines](package.json) を参照してください。
nvmを使う場合は、次の手順で環境を準備します。

```sh
nvm install
nvm use
npm ci
```

制作実績と一部の画像はGit管理対象外です。別環境でビルドする場合は、これらの素材も用意してください。

起動前に [サーバーとポートの運用](docs/server-operations.md) を確認します。

```sh
npm run dev:status
npm run dev -- --background
```

同じ作業ディレクトリのサーバーが利用できれば再利用します。URLは起動ログで確認してください。
状態確認は `npm run dev:status`、ログ確認は `npm run dev:logs`、終了は `npm run dev:stop` を使います。

```sh
npm run check:static
npm run build
```

ブラウザーテストの準備と一括検証は [開発ガイド](docs/development.md#検証) を参照してください。
本番では `dist/` をApache + PHPで配信します。[公開・認証の手順](docs/development.md#公開とphp認証) に従って設定してください。

## ドキュメント

| 文書                                                  | 内容                                     |
| ----------------------------------------------------- | ---------------------------------------- |
| [要件](docs/requirements.md)                          | 目的、対象者、機能、プライバシー要件     |
| [アーキテクチャ](docs/architecture.md)                | 現在の構成、技術の役割、重要な設計判断   |
| [デザイン](docs/design.md)                            | 共通のUI方針とスタイルの管理元           |
| [開発ガイド](docs/development.md)                     | 環境構築、検証、公開、文書更新の流れ     |
| [サーバー運用](docs/server-operations.md)             | 起動・終了、ポート競合、権限制限への対応 |
| [スプラッシュ](docs/features/splash-screen.md)        | 表示条件、実装、確認方法                 |
| [世界の「ありがとう」](docs/features/world-thanks.md) | 現在の表示と未使用モジュールの扱い       |

AI向けの共通指示は [AGENTS.md](AGENTS.md) にまとめています。

## ライセンス

All rights reserved. 詳細は [LICENSE.md](LICENSE.md) を参照してください。
