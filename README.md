# Sousenkyo Web

選挙特番風の「日本全国 選挙結果マップWebアプリ」です。React + TypeScript + Vite + Tailwind CSS + React Router で構成し、選挙データはJSON/CSV差し替えで長期運用できる形にしています。

## Quick Start

```bash
npm install
npm run dev
```

ローカル確認は通常 `http://127.0.0.1:5174/` など、Viteが表示したURLを使います。

## Data Source

このリポジトリでは、`data/source/elections/{electionId}/election.json` を編集元、`public/data` をアプリ配信用の生成物として扱います。原則として `public/data` を直接編集した場合は、必ず source 側にも戻してください。

```text
data/source/elections/{electionId}/election.json
  -> npm run gen:data -- {electionId}
  -> public/data/{electionId}/*.json
```

現在表示する選挙は `public/data/active-election.json` の `currentId` で決まります。`currentId` は `elections-index.json` に存在し、`isDataReady: false` ではない選挙だけを指定します。

## CSV / Excel Workflow

Excelで編集したい場合は、source JSONからCSVシート群を書き出します。

```bash
npm run export:csv -- shugiin-50th
```

編集後は dry-run で確認してから source JSON へ戻します。

```bash
npm run import:csv:dry -- shugiin-50th
npm run import:csv -- shugiin-50th
npm run gen:data -- shugiin-50th
```

CSVの列名と列順はテンプレートと一致している必要があります。新規選挙のテンプレートは次で作れます。

```bash
npm run create:election -- shugiin-51st --name=第51回衆議院総選挙 --type=衆議院 --year=2028
```

## Official CSV Import Gate

公式Excel/CSVは、まず公式ファイルをCSVへ寄せてから staged import します。標準CSVと同じ列なら identity schema のまま使えます。

```bash
npm run fetch:official:dry -- --manifest=data/import-schemas/official-fetch-manifest.example.json
npm run import:official:dry -- shugiin-50th --input=data/source/elections/shugiin-50th/csv
```

反映する場合も `public/data` へは直接出さず、source CSV と `election.json` まで更新し、差分レポートと strict 検証で人間確認します。

```bash
npm run import:official -- shugiin-50th --input=data/source/elections/shugiin-50th/csv
```

確認後に公開JSONへ進めます。

```bash
npm run gen:data -- shugiin-50th
npm run release:check -- shugiin-50th
```

## Glossary Workflow

PDFで受け取る候補者名、選挙区、比例区分、政党名は、確認用CSVを経由して軽量な単語帳JSONへ生成します。

```bash
npm run gen:glossary:dry
npm run gen:glossary
```

生成後は `/glossary` で検索辞書・カード表示を確認できます。

## Material Intake

実データ、PDF、候補者写真、公式URLは source 側で台帳管理します。

- CSV列の必須/任意: [docs/csv-requirements.md](./docs/csv-requirements.md)
- 素材台帳: [docs/materials.md](./docs/materials.md)
- 実データリハーサル: [docs/data-rehearsal.md](./docs/data-rehearsal.md)
- PDF抽出設計: [docs/pdf-extraction-design.md](./docs/pdf-extraction-design.md)
- 歴代選挙互換: [docs/historical-compatibility.md](./docs/historical-compatibility.md)

素材台帳だけを確認する場合は次を使います。

```bash
npm run template:data-package -- --dry-run shugiin-50th
npm run validate:materials
npm run validate:materials:strict
```

## Release Check

公開前は electionId を指定して一括チェックを実行します。

```bash
npm run release:check -- shugiin-50th
```

このコマンドは、秘密情報スキャン、仮表記スキャン、公開JSON生成dry-run、単語帳生成dry-run、素材台帳検証、strictデータ検証、source/public差分チェック、build、preview smoke を順番に実行します。

## Design And Operations

長期運用では、デザイン、データ、公開前検証を分けて扱います。

- デザイン基準: [docs/design-system.md](./docs/design-system.md)
- 運用ロードマップ: [docs/operation-roadmap.md](./docs/operation-roadmap.md)
- 公開前チェック: [docs/release-checklist.md](./docs/release-checklist.md)

中核ページの役割は `/live` が速報、`/map` が全国結果、`/parties` が政党分析、`/proportional` が比例代表、`/archive` が歴代比較、`/glossary` が単語帳です。

## Deploy

`main` にpushすると GitHub Pages 用のworkflowが `dist` をビルドして公開します。GitHub Pagesでは `/Sousenkyo-web/` 配下で配信されるため、`GITHUB_PAGES=true` のbuildではViteのbase pathを自動で切り替えます。

```bash
npm run pages:build
```

## Placeholder Policy

本番公開対象の `public/data/{electionId}` には、`TODO`、`sample`、`dummy`、`サンプル`、`ダミー` などの仮表記を残さないでください。画面検証用の架空名や空データは、公開対象ではない electionId に分け、`elections-index.json` では `isDataReady: false` にします。

候補者写真が未整備の場合に限り、明示的な `/data/{electionId}/photos/placeholder.svg` はfallbackとして使えます。実人物写真を入れる場合は、`data/source/materials/photo-rights.csv` に出典と許諾を記録します。

## Useful Commands

```bash
npm run validate:data
npm run validate:data:strict
npm run validate:materials
npm run report:data:check -- shugiin-50th
npm run scan:secrets
npm run scan:release-text -- shugiin-50th
npm run screenshots:routes
```

詳しい運用手順は [docs/operations.md](./docs/operations.md)、運用ロードマップは [docs/operation-roadmap.md](./docs/operation-roadmap.md)、デザイン基準は [docs/design-system.md](./docs/design-system.md)、素材受け入れは [docs/materials.md](./docs/materials.md)、CSV要件は [docs/csv-requirements.md](./docs/csv-requirements.md)、単語帳運用は [docs/glossary.md](./docs/glossary.md)、画像ルールは [docs/asset-guidelines.md](./docs/asset-guidelines.md)、公開前確認は [docs/release-checklist.md](./docs/release-checklist.md) を参照してください。
