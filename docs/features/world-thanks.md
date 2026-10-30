# 世界の「ありがとう」

## 現在の表示

[WorldThanks.astro](../../src/components/Home/WorldThanks.astro) は、トップページのGitHubセクションの下に「ご覧いただきありがとうございます。」を表示します。
[SplitText](../../src/components/ui/SplitText.tsx) を `client:visible` で描画し、文字単位のアニメーションを設定しています。
文章はサーバー生成HTMLの段階から表示します。Reactの読み込み前、JavaScript無効時、フォントやアニメーションの準備中も `visibility: hidden` にはしません。
画面内に入り、フォントの準備が整った場合にアニメーションを適用します。「動きを減らす」設定では文字を分割せず、文章をそのまま表示します。

多言語スクロールの表示先、Popover、初期化処理はコンポーネント内でコメントアウトされており、現在のページでは動作しません。
以下は残してあるモジュールの利用方法と、無効化されている連携の説明です。再利用時は現行ページへの組み込みと操作確認が必要です。

## 多言語スクロールモジュール

言語データは [src/data/world-thanks.json](../../src/data/world-thanks.json) で管理します。

- 表示コンポーネント（多言語連携は無効）: `src/components/Home/WorldThanks.astro`
- TypeScriptモジュール: `src/scripts/world-thanks.ts`
- スクロール用CSS: `src/styles/world-thanks.scss`
- 言語データ: `src/data/world-thanks.json`

Astro の `<script>` など、バンドラーが処理するコードから使います。
`WorldThanks.astro` はフロントマターからSCSSを読み込んでいます。
別のコンポーネントで使う場合も、利用側で `src/styles/world-thanks.scss` を読み込んでください。

```ts
import { mount } from './world-thanks';

const marquee = mount('#thanks', {
  speed: 60, // 1秒あたりの移動距離（px）。小さくするとゆっくり流れる
  shuffle: true, // 表示順をランダムにする
  showRoman: false, // 読み仮名を表示
  showLang: false, // 言語名をその言語で表示
});

// 必要に応じて操作する
marquee.pause();
marquee.resume();
marquee.destroy(); // 元の内容に戻し、サイズ監視を解除
```

`#thanks` は事前にHTMLへ用意する表示先です。要素を直接渡すこともできます。
`items` に `{ lang, text, roman?, dir?, regions? }` の配列を渡すと、独自のテキストへ変更できます。
速度は正の有限数、配列は1件以上にしてください。

表示先のCSS変数 `--wt-font-size` と `--wt-color` で文字サイズと色を変更できます。

ホバーに対応する端末ではホバー中、キーボード操作ではフォーカス中に停止します。コンポーネントのボタンでは継続的に停止・再開できます。
OSの「動きを減らす」が有効な場合は自動スクロールを止め、手動で横スクロールできる表示になります。
複製したテキストは読み上げ対象から除外し、各言語には `lang`、RTLの言語には `dir` を設定しています。

表示先の幅変更とフォント読み込み後に幅と所要時間を再計算します。
文字の表示には端末のフォントを使うため、対応フォントのない言語は正しく表示できない場合があります。

## 言語の説明（現在のページでは無効）

`onSelect(item, trigger)` を渡すと、各テキストをボタンとして描画し、クリックやキーボード操作でコールバックを呼びます。
複製したボタンもクリックできますが、読み上げとTab移動の対象から除外します。

`WorldThanks.astro` に残っているコメントアウト済みの連携は、このコールバックからネイティブPopoverを開き、言語名・元の表記・読み仮名・主に使われる国や地域を表示します。
`anchored-popover.ts` がクリックした文字の表示位置を基準に吹き出しを配置します。
上に空きがない場合は下へ切り替え、左右は画面内に収め、矢印を文字へ向けます。
スクロール・画面サイズ・カードサイズの変化にも追従します。文字が画面外へ出た場合は閉じます。
背景はモバイルメニューと同じ半透明色と `blur(2px)` でぼかします。
表示位置が決まった後、矢印側を起点に移動と拡大を `--spring` と `--transition-duration-extra-slow` でアニメーションします。
「動きを減らす」設定では吹き出しと背景のトランジションも無効にします。
言語名は `Intl.DisplayNames` で日本語にします。Google検索のリンクは新しいタブで開きます。
Popover非対応ブラウザでは、クリックから直接Google検索を開きます。

説明が開いている間の停止と、停止ボタンの状態は独立しています。
Escape・カード外のクリック・閉じるボタンで閉じられ、停止ボタンで停止済みの場合は閉じた後も停止を維持します。
ホバー対応端末でのホバー中・キーボードフォーカス中の停止も継続します。ポインター操作で戻ったフォーカスだけでは停止しません。

国・地域は分布の一例で、すべての話者や公用語の指定を網羅するものではありません。
中国語の2項目は表記体系の違いです。ラテン語とエスペラントは「使われ方」を表示します。
地域情報の確認資料は [Unicode CLDR territoryInfo](https://github.com/unicode-org/cldr-json/blob/main/cldr-json/cldr-core/supplemental/territoryInfo.json)、
アイヌ語は [UNESCOの解説](https://www.unesco.org/en/articles/saga-ainu-language-0)、
エスペラントは [Indiana Universityの解説](https://celt.indiana.edu/portal/Esperanto/index.html)です。
