# Glossary Operation

単語帳は、候補者名、政党名、選挙区、比例ブロック、選挙用語を軽く検索・カード表示するためのデータです。選挙結果JSONとは分けて管理し、`electionIds` で関連付けます。

465名規模のiPhone/Webカード運用は [glossary-card-operations.md](./glossary-card-operations.md) を参照します。

## Data Flow

```text
PDF
  -> text extraction
  -> data/source/glossary/csv/*.csv
  -> human review
  -> npm run gen:glossary
  -> public/data/glossary/*.json
  -> /glossary
```

PDF抽出結果は直接公開せず、必ずCSVで確認してから公開JSONへ生成します。

PDFからCSVへ変換する専用抽出スクリプトは、実際のPDFレイアウトを受け取ってから追加します。初期運用では、PDFから抽出した候補者名・政党名・選挙区名・比例区分を下記CSVへ整理して投入します。

## CSV Files

```text
data/source/glossary/csv/
  candidates.csv
  parties.csv
  districts.csv
  proportional-blocks.csv
  terms.csv
```

列はすべて共通です。実装上の正は `scripts/glossary-schema.mjs` の `glossaryCsvHeaders` です。

```text
id,label,category,reading,description,electionIds,relatedIds,photoUrl,districtLabel,partyLabel,statusLabel,age,wins,seatType,reviewStatus
```

`electionIds` と `relatedIds` は `|` 区切りで複数指定できます。

候補者カードで使う追加列:

- `photoUrl`: 公開配下の写真URL。未整備なら空欄にしてplaceholderを使います。
- `districtLabel`: 小選挙区または比例ブロック表示。
- `partyLabel`: 表示用政党名。
- `statusLabel`: 新人、前職、元職など。
- `age`: 年齢。
- `wins`: 当選回数。
- `seatType`: `小選挙区` または `比例`。
- `reviewStatus`: `ok` または `needs-review`。

`category` はファイルごとに固定です。

- `candidates.csv`: `candidate`
- `parties.csv`: `party`
- `districts.csv`: `district`
- `proportional-blocks.csv`: `proportional`
- `terms.csv`: `term`

## Human Review Checklist

CSV確認時は次を見ます。

- `id` が空ではなく、全ファイルを通して重複していない
- `label` がPDFの表記と一致している
- `reading` がiPhone検索で使いやすい読みになっている
- `category` がファイル種別と一致している
- `electionIds` が `elections-index.json` に存在している
- `relatedIds` が単語帳内の既存IDを指している
- 個人情報、APIキー、秘密情報、非公開メモが入っていない

## Commands

第51回PDFから20名分の試験抽出を行う場合:

```bash
npm run extract:glossary:shugiin51 -- --limit 20
```

出力先:

```text
data/work/shugiin-51st-glossary-review/
  candidates.csv
  extract-report.csv
  photos/
```

このCSVと写真は確認用です。氏名、読み、選挙区、政党、当選回数、写真トリミングを確認してから、必要な行だけ `data/source/glossary/csv/candidates.csv` へ反映します。

確認だけ行う場合:

```bash
npm run gen:glossary:dry
```

`gen:glossary:dry` は、CSV列、重複ID、カテゴリ不一致、存在しない `electionIds`、存在しない `relatedIds` を検出します。

公開JSONへ反映する場合:

```bash
npm run gen:glossary
npm run validate:data:strict
npm run build
```

`public/data/glossary/*.json` は生成物です。直接編集せず、必ず `data/source/glossary/csv/*.csv` を直してから `npm run gen:glossary` を実行します。

## UI

`/glossary` はiPhone優先の軽量UIです。

- 検索辞書モード
- 暗記カードモード: 横3:縦5の単語カード、証明写真風3:4写真枠、中央揃えの氏名/読み
- 分類フィルター
- 選挙回次フィルター

画像や重いアニメーションは使わず、白基調のガラスUIで既存サイトの世界観に合わせます。

ローカル確認:

```bash
npm run dev
```

Viteが表示したURLで `/glossary` を開き、次を確認します。

- 検索欄で候補者名、政党名、選挙区名を検索できる
- 分類フィルターで候補者、政党、選挙区、比例、用語を切り替えられる
- 選挙回次フィルターで対象選挙を絞り込める
- カードモードで前へ/次へが軽く動く
- iPhone幅で横スクロールや文字のはみ出しがない
