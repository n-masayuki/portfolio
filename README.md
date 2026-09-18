# Portfolio

## このサイトについて

このリポジトリは、ポートフォリオサイトのソースコードです。制作物やプロフィールを、見やすく、更新しやすい形で公開することを目的としています。

## 使用技術

- Astro
- TypeScript
- CSS
- SCSS
- `@lucide/astro`（UIアイコン）
- Node.js 22.12.0 以上

## 開発方法

依存関係をインストールします。

```sh
npm install
```

開発サーバーを起動します。

```sh
npm run dev
```

本番ビルドを確認します。

```sh
npm run build
npm run preview
```

## ディレクトリ構成

```text
/
├── public/       公開ファイル
├── src/
│   ├── assets/   画像などの素材
│   ├── components/  再利用する UI 部品
│   ├── layouts/  ページ共通レイアウト
│   └── pages/    ページ本体
├── package.json
└── README.md
```

## 設計上の特徴

- ページ固有の内容と、再利用する UI 部品を分ける
- Astro の特性を活かし、必要以上にクライアント側の JavaScript に依存しない
- 表示内容、保守性、アクセシビリティを確認しながら改善する
- UI操作用アイコンは `@lucide/astro` を使用し、ブランドロゴや単純な装飾は用途に応じて SVG または CSS で表現する

## AI 利用方針

AI は調査、実装、文章作成、レビューの補助として利用します。採用する内容は自分で確認し、サイトの目的や品質に合わない提案は採用しません。

## 更新方針

この README は、プロジェクトの実態や開発方法と内容がずれたときに更新します。規則や説明を増やすこと自体を目的にせず、必要性を確認してから変更します。

開発では既存のルールを機械的に守るだけでなく、目的に照らして疑問を持ち、より現代的で良い方法があれば改善します。ルールは固定されたものではなく、プロジェクトの理解が深まったときや状況が変わったときに更新します。

# Astro Starter Kit: Basics

```sh
npm create astro@latest -- --template basics
```

> 🧑‍🚀 **Seasoned astronaut?** Delete this file. Have fun!

## 🚀 Project Structure

Inside of your Astro project, you'll see the following folders and files:

```text
/
├── public/
│   └── favicon.svg
├── src
│   ├── assets
│   │   └── astro.svg
│   ├── components
│   │   └── Welcome.astro
│   ├── layouts
│   │   └── Layout.astro
│   └── pages
│       └── index.astro
└── package.json
```

To learn more about the folder structure of an Astro project, refer to [our guide on project structure](https://docs.astro.build/en/basics/project-structure/).

## 🧞 Commands

All commands are run from the root of the project, from a terminal:

| Command                   | Action                                           |
| :------------------------ | :----------------------------------------------- |
| `npm install`             | Installs dependencies                            |
| `npm run dev`             | Starts local dev server at `localhost:4321`      |
| `npm run build`           | Build your production site to `./dist/`          |
| `npm run preview`         | Preview your build locally, before deploying     |
| `npm run astro ...`       | Run CLI commands like `astro add`, `astro check` |
| `npm run astro -- --help` | Get help using the Astro CLI                     |

## 👀 Want to learn more?

Feel free to check [our documentation](https://docs.astro.build) or jump into our [Discord server](https://astro.build/chat).
