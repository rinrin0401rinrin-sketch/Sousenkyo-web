# Operations

このプロジェクトでは、`data/source/elections/{electionId}/election.json` を編集元、`public/data` をアプリ配信用の生成物として扱います。

快適運用の全体像は [operation-roadmap.md](./operation-roadmap.md)、デザイン基準は [design-system.md](./design-system.md)、素材受け入れは [materials.md](./materials.md)、実データリハーサルは [data-rehearsal.md](./data-rehearsal.md)、CSV要件は [csv-requirements.md](./csv-requirements.md) にまとめています。

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

## Switch Current Election

`active-election.json` の `currentId` はサイト全体の本番選挙を決めます。単語帳だけを先行して整備している選挙を、選挙結果サイト本体の current にしないでください。

第51回をサイト全体の本番選挙に切り替える場合は、次の順番を固定します。

1. `data/source/elections/shugiin-51st/election.json` またはCSV一式を作成する
2. source 側の `topLevel` で `active-election.json` 相当の `currentId` を `shugiin-51st` にする
3. source 側の `topLevel` で `elections-index.json` 相当の `shugiin-51st` を `isDataReady: true`、`status: current` にする
4. source 側の `topLevel` で旧currentの `shugiin-50th` を `status: past` にする
5. `npm run gen:data -- shugiin-51st` で `public/data` を生成する
6. 公開前チェックを通す

`public/data/shugiin-51st/` に最低限必要なJSONは次です。

```text
election-meta.json
parties.json
members.json
candidates.json
prefectures.json
districts.json
proportional-blocks.json
summary.json
single-member-districts.json
results.json
```

単語帳用の `public/data/glossary/*.json` と候補者写真だけでは、`/live`、`/map`、`/parties`、`/proportional` の選挙結果ページを本番運用できません。第51回の単語帳を先に公開する場合は、`elections-index.json` では `shugiin-51st` を `isDataReady: false` のままにし、`/glossary` とトップの単語帳枠で扱います。

切替前の確認コマンドは次です。

```bash
npm run gen:data:dry -- shugiin-51st
npm run gen:data -- shugiin-51st
npm run validate:data:strict
npm run report:data:check -- shugiin-51st
npm run scan:secrets
npm run scan:release-text -- shugiin-51st
npm run build
npm run smoke:routes
```

`validate:data:strict` が `active-election.json currentId "shugiin-51st" は elections-index.json で isDataReady:false` を出す状態では、本番切替を完了扱いにしません。

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

## Official CSV Import Gate

公式Excel/CSVを使う場合は、既存のCSV取り込みを直接置き換えず、公式データを標準CSVへ正規化してから `election.json` に戻します。詳しい手順は [official-import.md](./official-import.md) を参照してください。

```bash
npm run fetch:official:dry -- --manifest=data/import-schemas/official-fetch-manifest.example.json
npm run import:official:dry -- shugiin-50th --input=data/source/elections/shugiin-50th/csv
```

反映する場合は source 側まで更新し、差分レポートと strict 検証で止めます。人間が差分を確認するまでは `public/data` を生成しません。

```bash
npm run import:official -- shugiin-50th --input=data/source/elections/shugiin-50th/csv
```

確認後に公開JSONと公開前チェックへ進みます。

```bash
npm run gen:data -- shugiin-50th
npm run release:check -- shugiin-50th
```

公式URL、取得日、形式、利用条件は `data/source/materials/official-sources.csv` に記録します。

```bash
npm run template:data-package -- --dry-run shugiin-50th
npm run validate:materials
npm run validate:materials:strict
```

## Glossary

PDFで受け取る候補者名、選挙区、比例区分、政党名は、単語帳CSVで人間確認してから公開JSONへ生成します。詳しい手順は [glossary.md](./glossary.md) を参照してください。

```bash
npm run gen:glossary:dry
npm run gen:glossary
npm run validate:data:strict
npm run build
```

`public/data/glossary/*.json` は生成物です。直接編集せず、`data/source/glossary/csv/*.csv` を正として扱います。

候補者写真を入れる場合は `data/source/materials/photo-rights.csv` に出典と許諾を記録します。出典不明、未許諾、権利不明の人物写真は公開対象へ入れません。

公開対象の秘密情報や仮表記だけを単独で確認する場合は、次を使います。

```bash
npm run scan:secrets
npm run scan:release-text -- shugiin-50th
```

公開前の一括チェックは次で実行します。

```bash
npm run release:check -- shugiin-50th
```

`release:check` は指定した `electionId` について、`scan:secrets`、`scan:release-text -- {electionId}`、`gen:data:dry -- {electionId}`、`gen:glossary:dry`、`validate:materials:strict`、`validate:data:strict`、`report:data:check -- {electionId}`、`build`、`smoke:preview` を順番に実行します。
`electionId` を省略した場合は `public/data/active-election.json` の `currentId` を使います。

## Placeholder Data Before Production

本番データ投入前の架空名、仮データ、TODO、サンプル表記は、公開対象の `public/data` に残さないでください。画面検証用の空データやフィクスチャは source 側で検証用と分かる `electionId` に分け、公開対象の `elections-index.json` では `isDataReady: false` にします。

候補者写真が未整備の場合に限り、明示的な `/data/{electionId}/photos/placeholder.svg` はfallbackとして許可します。実人物写真を入れた時点で `photo-rights.csv` の出典・許諾行と `photoUrl` を一致させてください。ヒーロー画像、ページ画像、実データ本文、内部メモの placeholder 表記は公開対象に残しません。

公開対象へ切り替える前に、少なくとも次を通します。

```bash
npm run scan:release-text -- {electionId}
npm run release:check -- {electionId}
```

`scan:release-text` が検出する `TODO`、`sample`、`dummy`、`サンプル`、`ダミー` などは、実データへ差し替えるか、公開して問題ない正式文言に直します。空配列で公開する場合も、仕様として空でよい画面かを release checklist で確認してください。

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
