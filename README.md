# Portfolio

## このサイトについて

このリポジトリは、ポートフォリオサイトのソースコードです。
制作物やプロフィールを、見やすく、更新しやすい形で公開することを目的としています。

## 使用技術

- Astro
- TypeScript
- CSS
- SCSS
- `@lucide/astro`（UIアイコン）
- GSAP（スクロール連動アニメーション）
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

### ローカル HTTPS（任意）

HTTPSでの動作確認には、mkcertをインストールしてローカル認証局を信頼させた後、リポジトリのルートで証明書を生成します。mkcertのインストール方法は[公式README](https://github.com/FiloSottile/mkcert#installation)を参照してください。

```sh
mkcert -install
mkcert localhost 127.0.0.1 ::1
```

生成された`localhost+2.pem`と`localhost+2-key.pem`が両方ある場合、開発サーバーは`https://localhost:4321`で起動します。どちらかがない場合はHTTPで起動します。証明書と秘密鍵はマシンごとに生成し、Gitへ登録しないでください。

本番ビルドを確認します。

```sh
npm run build
npm run preview
```

## ディレクトリ構成

```text
/
├── public/       公開ファイル、Webフォント、Apache設定
├── src/
│   ├── assets/   画像などの素材
│   ├── components/  再利用する UI 部品
│   ├── layouts/  ページ共通レイアウト
│   └── pages/    ページ本体
├── package.json
└── README.md
```

## 本番配信

`npm run build` で生成される `dist/` を静的ファイルとして配信します。
Apacheで配信する場合は、`public/.htaccess` がビルド時に `dist/.htaccess` へコピーされ、Content-Security-PolicyなどのHTTPヘッダーを設定します。Apache以外のホスティングサービスでは、同じヘッダー設定をサービス側へ移行してください。

Apache 2.4で`mod_rewrite`・`mod_headers`を有効にし、公開ディレクトリの`AllowOverride`で`Options FileInfo`を許可してください。
本番のエックスサーバーでは`.htaccess`が利用できます。HTTP→HTTPS転送は、サーバーパネルのドメイン設定で「HTTPSに転送する」を有効にしてください。
手順は[公式の常時SSL化マニュアル](https://www.xserver.ne.jp/manual/man_server_fullssl.php)を参照してください。
HSTSはApacheのHTTPS接続判定またはサーバー側の`HTTPS=on`環境変数を条件に送信します。
本番反映後はHTTPS応答に`Strict-Transport-Security`が付くことと、HTTPから転送されることを確認してください。
`includeSubDomains`・`preload`は全サブドメインを含むHTTPS運用を確認してから検討してください。

## PHP認証

Apache配信では、`public/.htaccess` が通常のページと静的ファイルのリクエストを`auth.php`へ渡し、認証後にビルド成果物を配信します。
ただし、検索エンジン用の`robots.txt`・`sitemap.xml`と、ホーム画面/ブラウザー用の`apple-touch-icon.png`・`favicon.ico`は認証なしで直接配信します。
認証対象の応答には`Cache-Control: private, no-store`を設定します。
隠しファイルと隠しディレクトリ、および`auth.php`の`$mimeTypes`にない拡張子は配信しません。新しいファイル形式を公開する場合は、この許可リストも更新してください。

### 初回設定

まだ`private/users.php`がない場合だけ、雛形をコピーします。

```sh
cp private/users.php.example private/users.php
```

### ハッシュの生成

ユーザーごとにパスワードを1つ決め、次のコマンドを実行します。
`ここにパスワード`の部分を実際のパスワードへ置き換えてください。

```sh
php -r 'echo password_hash("ここにパスワード", PASSWORD_DEFAULT), PHP_EOL;'
```

実行するとハッシュが表示されます。
パスワードではなく、表示されたハッシュだけを登録します。

### 管理者の追加

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

## 設計上の特徴

スプラッシュスクリーンの目的・表示条件・実装ルールは [docs/splash-screen.md](docs/splash-screen.md) を参照してください。

- ページ固有の内容と、再利用する UI 部品を分ける
- Astro の特性を活かし、必要以上にクライアント側の JavaScript に依存しない
- 表示内容、保守性、アクセシビリティを確認しながら改善する
- UI操作用アイコンは `@lucide/astro` を使用し、ブランドロゴや単純な装飾は用途に応じて SVG または CSS で表現する

## ライセンス

All rights reserved. 詳細は [LICENSE.md](LICENSE.md) を参照してください。
