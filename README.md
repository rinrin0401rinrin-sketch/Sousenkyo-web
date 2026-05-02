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

## Release Check

公開前は electionId を指定して一括チェックを実行します。

```bash
npm run release:check -- shugiin-50th
```

このコマンドは、秘密情報スキャン、仮表記スキャン、strictデータ検証、source/public差分チェック、build、preview smoke を順番に実行します。

## Deploy

`main` にpushすると GitHub Pages 用のworkflowが `dist` をビルドして公開します。GitHub Pagesでは `/Sousenkyo-web/` 配下で配信されるため、`GITHUB_PAGES=true` のbuildではViteのbase pathを自動で切り替えます。

```bash
GITHUB_PAGES=true npm run build
```

## Placeholder Policy

本番公開対象の `public/data/{electionId}` には、`TODO`、`sample`、`dummy`、`サンプル`、`ダミー` などの仮表記を残さないでください。画面検証用の架空名や空データは、公開対象ではない electionId に分け、`elections-index.json` では `isDataReady: false` にします。

## Useful Commands

```bash
npm run validate:data
npm run validate:data:strict
npm run report:data:check -- shugiin-50th
npm run scan:secrets
npm run scan:release-text -- shugiin-50th
npm run screenshots:routes
```

詳しい運用手順は [docs/operations.md](./docs/operations.md)、画像ルールは [docs/asset-guidelines.md](./docs/asset-guidelines.md)、公開前確認は [docs/release-checklist.md](./docs/release-checklist.md) を参照してください。
