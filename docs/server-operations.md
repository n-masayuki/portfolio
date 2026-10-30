# サーバーとポートの運用

AIの検証で起動した開発サーバーが残り、E2E用サーバーの起動を妨げる競合が繰り返し発生している。2026-10-30には、開発サーバーが使用中の `127.0.0.1:4322` に `scripts/test-server.mjs` が待ち受けようとして `EADDRINUSE` で終了した。Playwright側では `Process from config.webServer was not able to start. Exit code: 1` と表示された。

この競合への対応として、E2E用のポートを開発・プレビューから分けている。

| 用途 | ポート・URL | 管理方法 |
| --- | --- | --- |
| Astro開発 | 起動ログ・`npx astro dev status` の実際のURLを使う | `npx astro dev --background` / `stop` / `status` / `logs` |
| Astroプレビュー | 起動ログの実際のURLを使う | 起動したプロセスを管理し、確認後に終了する |
| Playwright E2E | 既定 `http://127.0.0.1:14322` | Playwrightの `webServer` が起動・終了する |

E2Eの設定は `playwright.config.ts`、静的サーバーの実装は `scripts/test-server.mjs` にある。どちらも `PLAYWRIGHT_TEST_PORT` を参照する。開発・プレビューにはE2E専用ポートを使わない。

## 起動前と終了時

1. `npx astro dev status` で既存の開発サーバーを確認する。同じ作業ディレクトリの利用可能なサーバーがあれば再利用する。
2. 必要な場合だけ `npx astro dev --background` で起動する。起動ログのURL・PIDを記録し、既定ポートで動いていると決めつけない。
3. AIが検証のために起動した開発サーバーは、検証後に `npx astro dev stop` で終了し、`status` で終了を確認する。作業前からあるユーザーのサーバーは勝手に止めない。
4. ユーザーが続けて確認するため残す場合は、URL・PID・終了コマンドを報告する。プレビュー等、別に起動したサーバーも管理対象とし、不要なプロセスを残さない。

E2Eは `npm run test:e2e` でビルドしてから実行する。通常はE2E用サーバーを手動起動しない。`reuseExistingServer: false` は、開発サーバーや古い配布物を誤って検証しないため維持する。

## 起動エラーが出たとき

上記のPlaywrightエラーだけでは原因は決まらない。直前の `[WebServer]` 出力を確認する。`EADDRINUSE` なら、macOSでは次のコマンドで使用中のプロセスを調べる。

```sh
lsof -nP -iTCP:14322 -sTCP:LISTEN
```

実際に競合したポートが異なる場合は、その番号に置き換える。取得したPIDについて、コマンドと作業ディレクトリを確認する。

```sh
ps -p <PID> -o pid,ppid,command
lsof -a -p <PID> -d cwd
```

自分が起動した不要なサーバーだけを、そのサーバーの終了方法で止める。`killall node` 等でユーザーや別タスクのプロセスを巻き込まない。サンドボックス内だけで `EPERM` が出る場合は、ポート競合と混同せず実行権限を確認する。

別タスクのE2Eと並行実行するなど、既存プロセスを維持する必要がある場合は、未使用ポートを確認したうえで今回の実行だけ上書きできる。

```sh
PLAYWRIGHT_TEST_PORT=14323 npm run test:e2e
```

原因を調べずに既定ポートを変更し続けない。既知の競合では、この手順と現在のプロセスを先に確認する。
