# Material Intake

実データ、PDF、写真、公式URLは、公開JSONへ直接入れず、source 側で台帳管理します。

## Data Package Acceptance Template

新しいデータパッケージを受け取ったら、公開JSONへ入れる前に次の項目を1セットで残します。

```text
受付日:
担当:
electionId:
提供元:
提供形式: csv / xlsx / pdf / html / json / other
元ファイル/URL:
取得日:
利用条件:
写真の有無:
写真の権利確認:
変換先:
検証コマンド:
確認メモ:
```

受け入れ時の最小チェックは次の順で行います。

```bash
npm run template:data-package -- --dry-run {electionId}
npm run validate:materials:strict
npm run import:csv:dry -- {electionId}
npm run gen:data:dry -- {electionId}
npm run validate:data:strict
```

`validate:materials:strict` では素材台帳の warning も失敗扱いにします。公開前・実データ受け入れリハーサルでは strict を使い、未許諾写真、未確認ライセンス、公開JSONと未照合の写真行を残さないでください。

## Official Source Ledger

公式データの取得元は `data/source/materials/official-sources.csv` に記録します。

```text
id,electionId,publisher,sourceType,format,title,url,retrievedAt,publishedAt,licenseStatus,notes
```

- `sourceType`: `result`, `candidate-list`, `district-list`, `party-list`, `proportional-list`, `turnout`, `other`
- `format`: `csv`, `xlsx`, `pdf`, `html`, `json`, `other`
- `licenseStatus`: `confirmed`, `needs-review`, `restricted`, `unknown`

最低限、`electionId`, `publisher`, `format`, `title`, `url`, `retrievedAt` を埋めます。

実データ受け入れリハーサルとして、`shugiin-50th` のローカルCSV一式を `shugiin-50th-rehearsal-csv` で台帳登録しています。外部の公式URLやPDFへ差し替える場合は、同じ列を使って行を追加し、元行は履歴として残します。

新しい受け入れパッケージの雛形は次で作成できます。

```bash
npm run template:data-package -- {electionId}
```

既存ファイルを上書きする場合だけ `--force` を付けます。作成前の確認には `--dry-run` を使います。

実データ1セットの通し確認は [data-rehearsal.md](./data-rehearsal.md) を使います。

## Photo Rights Ledger

候補者・議員写真は `data/source/materials/photo-rights.csv` で出典と許諾を管理します。

```text
candidateId,electionId,photoFile,sourceUrl,rightHolder,rightsStatus,retrievedAt,notes
```

- `rightsStatus`: `confirmed`, `needs-review`, `restricted`, `unknown`
- `photoFile`: `/data/{electionId}/photos/{candidateId}.webp` のような公開パスまたは `photos/{candidateId}.webp`

未許諾、出典不明、権利不明の人物写真は公開対象に入れません。写真がない候補者は placeholder を使います。

`validate:materials:strict` は、placeholder 以外の `photoUrl` に対応する写真台帳行がない場合、台帳行の `photoFile` が公開JSONの `photoUrl` から参照されていない場合、または台帳の `candidateId` と公開JSON側の候補者IDが違う場合に失敗します。実人物写真を追加したら、`photoUrl` と `photoFile` を同じ公開パスにそろえてください。

## Photo Quality

- 最低: 1MB以下、顔が判別できる、正方形表示で破綻しない
- 推奨: 480x480px以上、顔中心、明るい、同じ比率
- 理想: 800x800px前後、WebP/JPEGで軽量化、出典と許諾が台帳で確認できる

## PDF Intake

PDFは直接公開JSONへ変換しません。抽出結果をCSVへ出し、人間確認を挟みます。

```text
PDF
  -> text extraction / OCR
  -> data/source/glossary/csv/*.csv
  -> human review
  -> npm run gen:glossary
```

テキスト選択できるPDFを優先します。スキャンPDFや複雑な段組みPDFはOCRまたはPDF別の抽出ルールが必要です。
