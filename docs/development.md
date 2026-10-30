# 開発ガイド

概要と最短の開始手順は [README](../README.md)、AI向けの共通指示は [AGENTS.md](../AGENTS.md) を参照してください。
この文書は環境構築・検証・公開・変更時の確認手順を管理します。

## 開発環境

開発用Node.jsは [.nvmrc](../.nvmrc)、対応範囲は [package.json の engines](../package.json) を管理元とします。
依存関係は `npm ci` で [package-lock.json](../package-lock.json) に合わせます。
制作実績と一部の画像はGit管理対象外なので、別環境でのビルドには別途素材が必要です。

### サーバー

起動・ブラウザー確認・E2E実行前に [サーバーとポートの運用](server-operations.md) を確認してください。
同じ作業ディレクトリの開発サーバーを再利用し、新規起動にはバックグラウンドモードを使います。
ポートと終了確認の手順は運用ガイドに集約しています。

### ローカルHTTPS（任意）

ローカルHTTPSには [mkcert](https://github.com/FiloSottile/mkcert#installation) を使用します。リポジトリのルートでローカル認証局を信頼させ、証明書を生成します。

```sh
mkcert -install
mkcert localhost 127.0.0.1 ::1
```

[astro.config.mjs](../astro.config.mjs) はルートの `localhost+2.pem` と `localhost+2-key.pem` が両方ある場合だけHTTPSを有効にします。どちらかがない場合はHTTPです。起動後はログの実際のURLで確認してください。
証明書と秘密鍵は端末ごとに生成し、Gitに登録せず、秘密鍵を共有しません。mkcertが使えない環境ではHTTPで開発できます。

## 検証

### 初回の準備

```sh
npx playwright install --no-shell chromium webkit
```

LinuxのCI環境を用意する場合は `npx playwright install --with-deps --no-shell chromium webkit` を使用します。
現在、このリポジトリにGitHub Actionsのワークフローはありません。

### 実行方法

| コマンド                | 確認する内容                                                 |
| ----------------------- | ------------------------------------------------------------ |
| `npm run check:docs`    | 文書のローカルリンクとnpmスクリプトの参照                    |
| `npm run check:static`  | 文書参照、Astro／TypeScriptの型、ESLint、Prettier            |
| `npm run test:unit`     | VitestによるロジックとAstroの生成HTML                        |
| `npm run test:coverage` | ユニットテストとカバレッジの最低基準                         |
| `npm run test:e2e`      | ビルド後、PC Chromium・iPhone相当（WebKit）の2構成で画面操作 |
| `npm run test:e2e:ui`   | ブラウザーテストのUIモード                                   |
| `npm run verify`        | 静的チェックからブラウザーテストまで一括実行                 |

開発中の継続実行は `npm test` を使用します。
インストール済みChromeを使用する場合は `PLAYWRIGHT_CHROMIUM_CHANNEL=chrome npm run test:e2e -- --project=chromium` を使用できます。

E2Eは `chromium`（PC）と `mobile`（iPhone 13相当のWebKit）の2構成です。
対象と実行件数は `tests/e2e/` と実行時のレポートで確認します。
端末設定はエミュレーションで、実機確認ではありません。

### 確認する仕様

| 対象             | ユニット／生成HTML                                                                      | 実ブラウザー                                                                                                         |
| ---------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| お問い合わせ     | 文字数、空文字・絵文字・500文字、二重送信、成功・HTTP失敗・通信失敗、再送、認証リセット | 必須入力、メール形式、文字数、入力上限、送信中の表示、完了ページへの遷移、失敗後の再送                               |
| GitHubカレンダー | 幅の境界、丸め誤差、遅延描画、差し替え、スクロール、サイズ変更、監視解除                | 単一表示、実際の横スクロール、フェード、取得失敗                                                                     |
| ナビゲーション   | 型・Lint                                                                                | セクション移動、現在地、モバイル開閉、フォーカス、Escape、背景クリック、PC幅への切り替え、ヘッダー縮小               |
| 開発履歴         | 型・コンテンツのビルド検証                                                              | 全カードのダイアログ開閉、Escape、フォーカス復帰                                                                     |
| スプラッシュ     | 型・Lint                                                                                | 初回表示、自動終了、再表示抑制、アンカーアクセス、動きを減らす設定、Escape                                           |
| HTML・画面       | 外部リンク、見出し、フォームのラベル・制約                                              | メタ情報、構造化データ、重複ID、画像読込、外部リンク属性、404・完了ページ、320〜1440pxの横はみ出し、アクセシビリティ |

### 検証の範囲

- カバレッジの対象は `src/scripts/**/*.ts` です。100%でもサイト全体や全ブラウザーの動作保証を意味しません。最低基準は行・文・関数90%、分岐85%です。
- Astroの生成HTMLテストはサーバー側の出力を確認します。クライアント側スクリプトはユニットテストとブラウザーテストで確認します。
- 外部通信はブラウザーテスト内で置き換えます。Formspreeへの実送信、Cloudflareの実認証、GTMの実計測、GitHub APIの稼働状況は検証しません。
- ブラウザーテストはローカルの `dist` を配信します。MAMP／PHP認証／本番CSPは別の確認対象です。
- WCAGの自動検査は人によるキーボード・読み上げ・視認性の確認を補完します。
- 通常は `/works/[slug]` の個別ページを生成しない設定です。生成を有効にする場合は `GENERATE_WORK_PAGES=true` でビルドします。
- 別プロジェクトのビルド済みデモ、生成物、ローカル専用設定は整形チェックから除外します。

### 結果の確認

カバレッジは `coverage/index.html`、ブラウザーの結果は `playwright-report/index.html` に出力します。
失敗時のスクリーンショットとトレースは `test-results/` に保存されます。
これらの生成物はGit管理対象外です。

### Lighthouse

本番はパスワード保護のため、ビルド済みの `dist/` に対してローカルで計測します。

```sh
npm run lighthouse
```

- ビルド後に `lhci autorun` を実行します。計測条件と閾値は [lighthouserc.json](../lighthouserc.json) を参照してください。
- `staticDistDir` により空きポートの一時サーバーを使うため、dev/preview/E2Eのポートと競合しません。
- 制作実績の詳細を対象に追加する場合は、ページを生成したうえで設定の `url` に追加します。
- レポートは `.lighthouseci/reports/`（Git管理外）に出力されます。
- ローカル静的サーバーは本番のHTTPS・HTTPヘッダー・GTM等の影響が異なります。改善前後の比較に使い、最終確認や原因調査はChrome DevToolsで行います。

## 公開とPHP認証

`npm run build` で生成される `dist/` を静的ファイルとして配信します。
Apacheで配信する場合は、`public/.htaccess` がビルド時に `dist/.htaccess` へコピーされ、Content-Security-PolicyなどのHTTPヘッダーを設定します。Apache以外のホスティングサービスでは、同じヘッダー設定をサービス側へ移行してください。

Apache 2.4で`mod_rewrite`・`mod_headers`を有効にし、公開ディレクトリの`AllowOverride`で`Options FileInfo`を許可してください。
本番のエックスサーバーでは`.htaccess`が利用できます。HTTP→HTTPS転送は、サーバーパネルのドメイン設定で「HTTPSに転送する」を有効にしてください。
手順は[公式の常時SSL化マニュアル](https://www.xserver.ne.jp/manual/man_server_fullssl.php)を参照してください。
HSTSはApacheのHTTPS接続判定またはサーバー側の`HTTPS=on`環境変数を条件に送信します。
本番反映後はHTTPS応答に`Strict-Transport-Security`が付くことと、HTTPから転送されることを確認してください。
`includeSubDomains`・`preload`は全サブドメインを含むHTTPS運用を確認してから検討してください。

### PHP認証

Apache配信では、`public/.htaccess` が通常のページと静的ファイルのリクエストを`auth.php`へ渡し、認証後にビルド成果物を配信します。
ただし、検索エンジン用の`robots.txt`・`sitemap.xml`と、ホーム画面/ブラウザー用の`apple-touch-icon.png`・`favicon.ico`は認証なしで直接配信します。
認証対象の応答には`Cache-Control: private, no-store`を設定します。
隠しファイルと隠しディレクトリ、および`auth.php`の`$mimeTypes`にない拡張子は配信しません。新しいファイル形式を公開する場合は、この許可リストも更新してください。

#### 初回設定

まだ`private/users.php`がない場合だけ、雛形をコピーします。

```sh
cp private/users.php.example private/users.php
```

#### ハッシュの生成

ユーザーごとにパスワードを1つ決め、次のコマンドを実行します。
`ここにパスワード`の部分を実際のパスワードへ置き換えてください。

```sh
php -r 'echo password_hash("ここにパスワード", PASSWORD_DEFAULT), PHP_EOL;'
```

実行するとハッシュが表示されます。
パスワードではなく、表示されたハッシュだけを登録します。

#### 管理者の追加

`private/users.php`の`return`配列へ、IDと生成したハッシュを追加します。
既存の行は残したまま、管理者ごとに1行追加してください。

```php
return [
	'admin' => '$2y$10$adminのハッシュ',
	'designer' => '$2y$10$designerのハッシュ',
	'reviewer' => '$2y$10$reviewerのハッシュ',
];
```

IDは配列のキーになるため、同じIDを複数登録することはできません。
管理者を削除するときは、そのIDの行を削除し、パスワードを変更するときは同じIDのハッシュを置き換えます。

ログイン画面ではIDを入力せず、パスワードだけを入力します。複数の管理者を登録する場合は、管理者ごとに異なるパスワードを設定してください。同じパスワードを複数のIDで使うと、先に登録されたIDとして認証されます。

`private/users.php`は公開ディレクトリの外に置き、Gitへ登録しないでください。
認証はApache + PHPで配信する場合のみ動作します。`astro dev`や`astro preview`では認証されません。

### セキュリティ設定の確認

CSPの管理元は [public/.htaccess](../public/.htaccess) です。
外部サービスの追加・変更時には許可先も見直し、Turnstile、フォーム送信、フォント読み込みを確認します。
`astro dev` や `astro preview` ではPHP認証や本番のHTTPヘッダーを検証できません。

## 変更とレビュー

1. 依頼と [要件](requirements.md) を確認し、必要な範囲で設計・実装方針を決める。
2. 作業内容に応じたブランチで実装し、変更の影響に合う検証を行う。
3. 差分を基に関連する文書を検索し、同じ変更で更新する。
4. レビューと最終確認後に `main` へマージする。

ブランチ名は `feature/works`、`fix/navigation`、`refactor/styles` など、目的が分かる名前にします。
UI変更ではレスポンシブ、キーボード操作、フォーカス、読み上げ、動きを減らす設定も確認します。
AIの出力は要件・保守性・性能・アクセシビリティ・セキュリティの観点でレビューします。

## 文書の管理

### 役割と管理元

READMEは入口、要件は期待する挙動、アーキテクチャは現在の構成、デザインは共通方針、この文書は開発手順を扱います。
機能の詳細は `features/` に置き、独立して参照する必要がある場合だけ文書を分けます。
同じ手順やバージョンを複数箇所へ転記せず、管理元へリンクします。

| 情報                                      | 管理元                                          |
| ----------------------------------------- | ----------------------------------------------- |
| 開発用Node.js                             | [.nvmrc](../.nvmrc)                             |
| Node.js対応範囲、依存関係、コマンド       | [package.json](../package.json)                 |
| 正確な依存バージョンと各依存のNode.js要件 | [package-lock.json](../package-lock.json)       |
| E2Eの構成とポート                         | [playwright.config.ts](../playwright.config.ts) |
| ユニットテストとカバレッジ基準            | [vitest.config.ts](../vitest.config.ts)         |
| Lighthouseの計測条件                      | [lighthouserc.json](../lighthouserc.json)       |
| AIへの共通指示                            | [AGENTS.md](../AGENTS.md)                       |

### 変更時の確認先

| 変更                     | 確認する文書・設定                                                                        |
| ------------------------ | ----------------------------------------------------------------------------------------- |
| 依存関係・Node.js        | package.json、ロックファイル、.nvmrc、README、開発環境の説明。依存のNode.js要件も確認する |
| ページ・機能・入力制約   | requirements、architecture、該当するfeatures文書                                          |
| 共通UI・スタイル         | design、該当するfeatures文書                                                              |
| テスト・検証コマンド     | この文書の検証、package.json、テスト設定                                                  |
| 起動・ポート             | server-operations、README、AGENTS、Playwright設定                                         |
| 公開・認証・外部サービス | この文書の公開手順、architecture、.htaccess                                               |
| 文書の移動・統合         | READMEの一覧、文書内リンク、AGENTS、Copilotの参照先                                       |

上の表を起点に、旧名称・コマンド・設定値をリポジトリ全体で検索して参照漏れを確認します。
仕様と実装が異なる場合は、実装の不具合・文書の陳腐化・要件の曖昧さを区別し、根拠なしに一方へ合わせません。
将来の構想を現在の実装として書かず、未決定事項はその状態を明記します。
大きな技術判断はまずarchitectureに理由を残し、記録が増えて独立した管理が必要になった段階でADRを検討します。

### 完了時の確認

`npm run check:docs` はREADME・AGENTS・Copilot指示・docs内のMarkdownについて、ローカルリンク先のファイルと `npm run` のスクリプト名を確認します。
アンカー、外部URL、説明の意味や実装との一致は自動検査の対象外です。`npm run check:static` と `npm run verify` にも含まれます。
レビューでは文意の整合性も確認し、完了報告に更新した文書、または更新不要の理由と未解決の不一致を短く残します。
文書更新が不要な変更で、形式のために文書を書き換える必要はありません。

共有する文書は [.gitignore](../.gitignore) で明示的に許可します。個人用メモや機密情報は対象にしません。
