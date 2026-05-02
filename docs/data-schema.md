# Sousenkyo Data Schema

このアプリは `public/data` 配下のJSONを読み込んで画面を描画します。運用上の正本は `data/source/elections/{electionId}/election.json` とし、`public/data` は生成物として扱います。React側に政党名、政党カラー、議員名、選挙区、議席数を直書きせず、選挙データを差し替えて長期運用できる構成を前提にします。

## Directory Layout

```text
public/data/
  active-election.json
  elections-index.json
  {electionId}/
    election-meta.json
    parties.json
    members.json
    prefectures.json
    districts.json
    proportional-blocks.json
    summary.json
    candidates.json
    single-member-districts.json
    results.json
    photos/
    visuals/
```

`electionId` は `shugiin-50th` のような安定IDにします。URL、JSON参照、画像パスで使うため、後から変えない前提です。

## Source Of Truth

編集元は次の単一JSONです。

```text
data/source/elections/{electionId}/election.json
```

このsourceから公開用JSONを生成します。

```bash
npm run gen:data -- {electionId}
```

既存の `public/data` をsourceへ戻す場合は次を使います。

```bash
npm run export:source -- {electionId}
```

Excelで編集したい場合は、sourceをCSVシート群へ書き出して編集します。

```bash
npm run export:csv -- {electionId}
npm run import:csv -- {electionId}
```

主なCSVファイル:

- `election_meta.csv`
- `election_visuals.csv`
- `parties.csv`
- `prefectures.csv`
- `proportional_blocks.csv`
- `districts.csv`
- `candidates.csv`
- `members.csv`
- `single_member_district_results.csv`
- `proportional_results.csv`
- `summary.csv`
- `summary_party_seats.csv`
- `top_level_active.csv`
- `top_level_elections.csv`

CSVでは `mapPoint.x/y/z` を `mapX`, `mapY`, `mapZ` として平坦化します。

空テンプレートを作る場合は次を使います。

```bash
npm run template:csv -- {electionId}
```

## Top Level Files

### active-election.json

現在トップページで表示する選挙IDを指定します。

```json
{
  "currentId": "shugiin-50th"
}
```

`currentId` は `elections-index.json` の `elections[].id` に存在している必要があります。

### elections-index.json

選挙回次の一覧です。未整備の過去選挙や今後の選挙もここに登録できます。

```json
{
  "elections": [
    {
      "id": "shugiin-50th",
      "type": "衆議院",
      "name": "第50回 衆議院総選挙",
      "status": "current",
      "year": 2024,
      "isDataReady": true
    }
  ]
}
```

- `status`: `current`, `past`, `upcoming`
- `isDataReady`: `false` の場合、選挙選択カードは準備中表示になり、詳細URLへ直接アクセスしても準備中画面を表示します。

## Election Files

### election-meta.json

選挙単位の基本情報です。`id` はフォルダ名と一致させます。

主な項目:

- `id`
- `type`
- `name`
- `status`
- `year`
- `shortName`
- `description`
- `visuals`

`visuals[].imageUrl` は `/data/{electionId}/visuals/...` のような公開パスにします。外部URL、`data:` URL、秘密情報を含むファイル名は使いません。

### parties.json

政党マスタです。

```json
{
  "parties": [
    {
      "id": "liberal-blue",
      "name": "未来政策党",
      "shortName": "未来",
      "color": "#2563eb"
    }
  ]
}
```

`id` は `partyId` 参照の正とします。`color` は政党別表示、地図ドット、バッジに使われます。

### prefectures.json

都道府県マスタです。

- `id`
- `name`
- `region`
- `districtCount`

`districtCount` は表示用の目安です。実際の小選挙区データは `districts.json` を正とします。

### districts.json

小選挙区マスタです。

- `id`
- `name`
- `prefectureId`
- `winnerMemberId`

`prefectureId` は `prefectures[].id`、`winnerMemberId` は `members[].id` を参照します。

### proportional-blocks.json

比例ブロックマスタです。

- `id`
- `name`
- `seats`

`id` は比例結果の `blockId` から参照されます。

### members.json

議員・当選者として表示する人物データです。

- `id`
- `name`
- `partyId`
- `prefectureId`
- `districtId`
- `proportionalBlockId`
- `photoUrl`
- `wins`
- `status`

`photoUrl` は `/data/...` 配下の公開画像を指定します。未指定の場合、画面側でプレースホルダー表示にできます。

### candidates.json

候補者データです。省略した場合、アプリ側では `members.json` を候補者データとして代替できます。

`partyId`, `prefectureId`, `districtId`, `proportionalBlockId` は各マスタに存在するIDを指定します。

## Result Files

### single-member-districts.json

小選挙区の結果データです。

主な項目:

- `id`
- `electionId`
- `prefectureId`
- `prefecture`
- `districtName`
- `districtNumber`
- `candidateId`
- `candidateName`
- `partyId`
- `partyName`
- `status`
- `votes`
- `voteRate`
- `turnout`
- `photoUrl`
- `profileUrl`
- `mapPoint`

`status` は次の値を使います。

- `elected`
- `proportionalRevival`
- `runnerUp`
- `counting`
- `pending`

`mapPoint.x` と `mapPoint.y` は必須です。欠けている結果は地図表示から除外されます。

### results.json

比例代表の結果データです。

```json
{
  "proportionalSeats": [
    {
      "id": "tokyo-pr-1",
      "electionId": "shugiin-50th",
      "blockId": "tokyo-block",
      "blockName": "東京",
      "partyId": "liberal-blue",
      "partyName": "未来政策党",
      "status": "elected",
      "seats": 5,
      "voteRate": 45.5,
      "turnout": 62.1,
      "mapPoint": { "x": 79, "y": 52, "z": 6 }
    }
  ]
}
```

`blockId` は `proportional-blocks.json`、`partyId` は `parties.json` を参照します。

## Summary

`summary.json` はトップページやヘッダーの表示キャッシュです。

- `totalSeats`
- `districtSeats`
- `proportionalSeats`
- `reportingRate`
- `updatedAt`
- `partySeats`

`updatedAt` はISO 8601形式を推奨します。`partySeats[].partyId` は `parties[].id` を参照します。トップページの政党別議席数では、基本的に `seats > 0` の既存政党のみ表示します。

`summary.json` は表示キャッシュなので、詳細な結果データと検算します。`totalSeats` と `districtSeats + proportionalSeats`、`proportionalSeats` と `proportional-blocks.json` の議席合計は一致させてください。`partySeats` は `single-member-districts.json` と `results.json` の確定系ステータスから推定した党別議席と比較されます。開票中・未確定を含む場合は参考情報、開票率100%で未確定がない場合は警告として扱います。

## Validation

データを追加・修正したら、必ず次を実行します。

```bash
npm run validate:data
```

このチェックでは、JSON構文、トップレベルキー、ID重複、参照ID、結果ステータス、画像パス、地図座標、summaryと結果データの検算を確認します。

公開前にINFO/WARNも失敗扱いにする場合は strict モードを使います。

```bash
npm run validate:data:strict
```

画面の最低限確認は次で実行できます。事前に `npm run dev -- --host 127.0.0.1 --port 5174` などでローカルサーバーを起動してください。

```bash
npm run smoke:routes
```

別ポートの場合は `SMOKE_BASE_URL` を指定します。

```bash
SMOKE_BASE_URL=http://127.0.0.1:5175 npm run smoke:routes
```

## Security Rules

- APIキー、トークン、パスワード、個人情報、秘密鍵をJSONや画像ファイル名に含めない
- `.env` と `.env.local` はGit管理に含めない
- `.env.example` を作る場合も、実キーやトークン値は書かない
- 画像は公開してよいものだけ `public/data` に置く
- 外部URLや `data:` URLを画像パスに使わない
