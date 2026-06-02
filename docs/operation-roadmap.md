# Operation Roadmap

快適運用の目的は、デザインを崩さず、データ更新を安全に進め、公開前の確認漏れを減らすことです。

## Standard Release Gate

公開前は electionId を指定して一括チェックします。

```bash
npm run release:check -- shugiin-50th
```

このゲートでは、秘密情報、仮表記、公開JSON生成のdry-run、単語帳生成のdry-run、strictデータ検証、source/public差分、build、主要ルート表示を確認します。

## Data Update Flow

通常更新:

```text
公式Excel/CSV
  -> importer
  -> data/source/elections/{electionId}/election.json
  -> 差分レポート
  -> strict検証
  -> 人間確認
  -> public/data 生成
  -> release:check
```

開票日更新:

- `/live` と `/map` に必要なCSVを優先して取り込む
- 顔写真や詳細プロフィールは後追い更新でよい
- 未確定、開票中、比例復活などの状態はJSONで管理し、UIへ直書きしない
- 公開前は差分レポートで議席数、候補者数、未確定数、政党別合計を確認する

## Historical Elections

歴代選挙は `electionId` 単位で追加します。詳細データが未整備の場合は `elections-index.json` で `isDataReady: false` にし、`/archive` では準備中として扱います。

新規作成:

```bash
npm run create:election -- shugiin-51st --name=第51回衆議院総選挙 --type=衆議院 --year=2028
```

現在表示へ切り替える場合だけ `--current` を付けます。

## Glossary Update Flow

PDFで受け取る候補者名、政党名、選挙区、比例区分、用語は直接公開しません。

```text
PDF
  -> 抽出
  -> data/source/glossary/csv/*.csv
  -> 人間確認
  -> npm run gen:glossary
  -> public/data/glossary/*.json
  -> /glossary 確認
```

実際のPDFレイアウトが届いたら、抽出スクリプトをPDFの構造に合わせて追加します。

## GitHub Workflow

- main/master へ直接大きな変更を入れない
- 変更は「データ」「UI」「検証」「ドキュメント」で分ける
- PRには検証コマンド、スクリーンショット、未対応TODOを残す
- GitHub Pages公開前は `pages:build` と Pages workflow の成功を確認する

