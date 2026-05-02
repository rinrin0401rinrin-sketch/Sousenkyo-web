# Operations

このプロジェクトでは、`data/source/elections/{electionId}/election.json` を編集元、`public/data` をアプリ配信用の生成物として扱います。

## Data Flow

```text
data/source/elections/{electionId}/election.json
  -> npm run gen:data -- {electionId}
  -> public/data/{electionId}/*.json
  -> npm run validate:data
  -> npm run build
```

`public/data` を直接編集した場合は、必ず source 側へ戻します。

```bash
npm run export:source -- shugiin-50th
```

新しく作業する人向けの最短手順は [README.md](../README.md) にまとめています。

## Generate Public Data

反映前に生成対象を確認します。

```bash
npm run gen:data:dry -- shugiin-50th
```

実際に `public/data` へ生成します。

```bash
npm run gen:data -- shugiin-50th
```

生成後は必ず検証します。

```bash
npm run validate:data
npm run build
```

ローカルサーバーが起動している場合は主要ルートも確認します。

```bash
npm run smoke:routes
```

build済みのpreviewサーバー込みで確認する場合は、次を使います。

```bash
npm run smoke:preview
```

## Edit With CSV Or Excel

Excelで編集する場合は、`election.json` をCSVシート群へ書き出します。

```bash
npm run export:csv -- shugiin-50th
```

CSVは次の場所に出ます。

```text
data/source/elections/shugiin-50th/csv/
```

ExcelでCSVを編集したあと、source JSONへ戻します。

```bash
npm run import:csv:dry -- shugiin-50th
npm run import:csv -- shugiin-50th
```

`import:csv:dry` ではCSVファイル不足、列名・列順のズレ、閉じ忘れたクォートを検出します。

その後、公開用JSONを再生成して検証します。

```bash
npm run gen:data -- shugiin-50th
npm run validate:data
```

CSV運用では `mapPoint.x/y/z` を `mapX`, `mapY`, `mapZ` として扱います。配列データは `election_visuals.csv` や `summary_party_seats.csv` のように別CSVへ分けます。

新しい選挙の空CSVテンプレートは次で作成します。

```bash
npm run template:csv -- shugiin-51st
```

既存テンプレートを上書きする場合だけ `--force` を付けます。CSV列はテンプレートと同じ列名・列順である必要があります。

新しい選挙のsource JSONとCSVテンプレートをまとめて作る場合は、次を使います。

```bash
npm run create:election -- shugiin-51st --name=第51回衆議院総選挙 --type=衆議院 --year=2028
```

現在表示する選挙も同時に切り替える場合だけ `--current` を付けます。作成前の確認には `--dry-run` を使います。

実運用に近い行数でCSV/Excel入力を確認する場合は、大量フィクスチャを使います。既存の `public/data` は変更せず、既定では `data/source/elections/shugiin-large-fixture/` に source JSON とCSVシート群を作ります。

```bash
npm run fixture:large:dry
npm run fixture:large
```

件数や元データを変える場合は、引数で指定します。

```bash
npm run fixture:large:dry -- --from=shugiin-50th --target=shugiin-large-fixture --districts=289 --candidates=1100 --members=465 --proportional=176
```

CIや検証手順だけを軽く通す場合は、小さいsmoke fixtureを使います。`fixture:large` の既定値は変えず、専用ID `shugiin-large-fixture-smoke` にだけ書き込みます。

```bash
node scripts/create-large-fixture.mjs --preset=smoke
node scripts/create-large-fixture.mjs --write --preset=smoke
```

CSV取り込み経路を確認する場合は、生成されたCSVをそのまま dry-run import にかけます。

```bash
npm run import:csv:dry -- shugiin-large-fixture
```

公開JSONの生成確認だけなら、dry-run を使います。

```bash
npm run gen:data:dry -- shugiin-large-fixture
```

smoke fixtureで実書き込みを確認したあとは、公開JSONを生成せず dry-run の検証に留め、最後に source 側を削除します。

```bash
npm run import:csv:dry -- shugiin-large-fixture-smoke
npm run gen:data:dry -- shugiin-large-fixture-smoke
node scripts/create-large-fixture.mjs --write --clean --target=shugiin-large-fixture-smoke
```

削除前に対象を確認する場合は `--write` を外します。`--clean` は `data/source/elections/{target}/` の内側だけを削除し、`public/data` は変更しません。

CSV取り込みや生成のあと、sourceと公開JSONの差分を確認します。

```bash
npm run report:data -- shugiin-50th
```

更新ログを残す場合は、`data/reports/` にテキストレポートを書き出します。

```bash
npm run report:data:write -- shugiin-50th
```

レポートのヘッダーには `timestamp`、`electionId`、実行時の `npm run ...` または `node ...` 相当のコマンドが残ります。データ更新時はこのレポートを更新履歴として保存してください。

CIや公開前ゲートで「source と public に差分が残っていないこと」を確認する場合は、差分ありで失敗するチェックを使います。

```bash
npm run report:data:check -- shugiin-50th
```

公開前の厳格チェックでは、通常検証でのINFO/WARNも失敗扱いにします。

```bash
npm run validate:data:strict
```

公開対象の秘密情報や仮表記だけを単独で確認する場合は、次を使います。

```bash
npm run scan:secrets
npm run scan:release-text -- shugiin-50th
```

公開前の一括チェックは次で実行します。

```bash
npm run release:check -- shugiin-50th
```

`release:check` は指定した `electionId` について、`scan:secrets`、`scan:release-text -- {electionId}`、`validate:data:strict`、`report:data:check -- {electionId}`、`build`、`smoke:preview` を順番に実行します。
`electionId` を省略した場合は `public/data/active-election.json` の `currentId` を使います。

## Placeholder Data Before Production

本番データ投入前の架空名、仮データ、TODO、サンプル表記は、公開対象の `public/data` に残さないでください。画面検証用の空データやフィクスチャは source 側で検証用と分かる `electionId` に分け、公開対象の `elections-index.json` では `isDataReady: false` にします。

公開対象へ切り替える前に、少なくとも次を通します。

```bash
npm run scan:release-text -- {electionId}
npm run release:check -- {electionId}
```

`scan:release-text` が検出する `TODO`、`sample`、`dummy`、`placeholder`、`仮`、`未定` などは、実データへ差し替えるか、公開して問題ない正式文言に直します。空配列で公開する場合も、仕様として空でよい画面かを release checklist で確認してください。

## Add A New Election

1. `data/source/elections/{newElectionId}/election.json` を作成する
2. `elections-index.json` 相当の source に新しい選挙を登録する
3. データ未整備なら `isDataReady: false` にする
4. 公開できる状態になったら `isDataReady: true` にする
5. `npm run gen:data -- {newElectionId}` を実行する
6. `npm run validate:data` と `npm run build` を通す

## Switch Current Election

`active-election.json` 相当の source で `currentId` を変更し、生成します。
`currentId` は `elections-index.json` に存在し、かつ `isDataReady: false` ではない選挙だけを指定します。

```bash
npm run gen:data -- {electionId}
npm run validate:data
```

## CI

GitHub Actionsでは以下を実行します。

- `npm ci`
- `npm run validate:data`
- `npm run build`

通常CIでは開発中のサンプル差分を許容するため、`validate:data:strict` と `smoke:preview` は必須にしません。公開前は GitHub Actions の `workflow_dispatch` で `run_release_check=true` を指定し、必要に応じて `election_id` に対象IDを指定します。未指定時は `shugiin-50th` で `npm run release:check -- {electionId}` を実行します。

`smoke:routes` はローカルまたは別途previewサーバーを立てる環境で実行してください。

公開前の手順は [release-checklist.md](./release-checklist.md) を使って確認してください。

画像の形式、サイズ、命名ルールは [asset-guidelines.md](./asset-guidelines.md) を確認してください。

## Deploy

`main` にpushすると、GitHub Pages workflowが `npm run pages:build` を実行し、`dist` をPagesへアップロードします。GitHub Pagesでは `/Sousenkyo-web/` 配下で配信されるため、アプリ内の `/data/...` 参照は `import.meta.env.BASE_URL` を通して解決します。

Pagesの直リンクで404にならないよう、`pages:build` は `dist/index.html` を `dist/404.html` にコピーしてSPA fallbackも用意します。

手元でPages向けbuildだけ確認する場合は次を使います。

```bash
npm run pages:build
```

## Safety Rules

- APIキー、トークン、パスワード、秘密鍵、個人情報を source / public のJSONに入れない
- 画像パスは `/data/...` の公開資産のみ使う
- `public/data` に置く画像は公開してよいものだけにする
- `gen:data` の入力 `electionId` は小文字英数字とハイフンだけにする
- 生成前後で `npm run validate:data` を必ず実行する
