# サーバーとポートの運用

AIの検証で起動した開発サーバーが残り、E2E用サーバーの起動を妨げる競合が繰り返し発生している。2026-10-30には、開発サーバーが使用中の `127.0.0.1:4322` に `scripts/test-server.mjs` が待ち受けようとして `EADDRINUSE` で終了した。Playwright側では `Process from config.webServer was not able to start. Exit code: 1` と表示された。

この競合への対応として、E2E用のポートを開発・プレビューから分けている。

| 用途            | ポート・URL                                        | 管理方法                                                  |
| --------------- | -------------------------------------------------- | --------------------------------------------------------- |
| Astro開発       | 起動ログ・`npx astro dev status` の実際のURLを使う | `npx astro dev --background` / `stop` / `status` / `logs` |
| Astroプレビュー | 起動ログの実際のURLを使う                          | 起動したプロセスを管理し、確認後に終了する                |
| Playwright E2E  | 既定 `http://127.0.0.1:14322`                      | Playwrightの `webServer` が起動・終了する                 |

E2Eの設定は `playwright.config.ts`、静的サーバーの実装は `scripts/test-server.mjs` にある。どちらも `PLAYWRIGHT_TEST_PORT` を参照する。開発・プレビューにはE2E専用ポートを使わない。

## 起動前と終了時

これらは終了を確認するための運用手順であり、自動終了の設定ではない。バックグラウンドサーバーは起動コマンドが終了しても動き続ける。ターミナルでは `npm run dev:status` / `npm run dev:stop` / `npm run dev:logs` も利用できる。`astro status` / `astro stop` は使わず、`npx astro dev status` / `npx astro dev stop` のように `dev` を含める。

1. `npx astro dev status` で既存の開発サーバーを確認する。同じ作業ディレクトリの利用可能なサーバーがあれば再利用する。
2. 必要な場合だけ `npx astro dev --background` で起動する。起動ログのURL・PIDを記録し、既定ポートで動いていると決めつけない。
3. AIが検証のために起動した開発サーバーは、検証後に `npx astro dev stop` で終了し、`status` に加えて記録したPIDと実際の待受ポートで終了を確認する。作業前からあるユーザーのサーバーは勝手に止めない。
4. ユーザーが続けて確認するため残す場合は、URL・PID・終了コマンドを報告する。プレビュー等、別に起動したサーバーも管理対象とし、不要なプロセスを残さない。

E2Eは `npm run test:e2e` でビルドしてから実行する。通常はE2E用サーバーを手動起動しない。`reuseExistingServer: false` は、開発サーバーや古い配布物を誤って検証しないため維持する。

## 起動エラーが出たとき

### サンドボックスで「停止中」と誤表示される場合

2026-10-30には、PID `40862` がこのプロジェクトの `127.0.0.1:4321` で待ち受けている一方、`npx astro dev status` が `No dev server is running` と表示された。現在のAstroの `node_modules/astro/dist/core/dev/lockfile.js` は、`process.kill(pid, 0)` の例外をすべて停止済みとして扱い、管理ファイル `.astro/dev.json` を削除する。サンドボックスの `EPERM` でもこの経路に入るため、表示だけでは終了を確認できない。

AIは起動・`status`・`stop` をプロセス確認権限のある環境で実行する。権限制限がある場合は権限を申請する。管理ファイルが失われた後は `stop` でも対象を見つけられないため、下記の `lsof` と `ps` でPID・コマンド・作業ディレクトリを確認し、終了対象と確認できたPIDだけに `kill -TERM <PID>` を送る。その後、PIDと待受ポートの両方で終了を確認する。`node_modules` の直接変更は行っていない。

### ポートが使用中の場合

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
