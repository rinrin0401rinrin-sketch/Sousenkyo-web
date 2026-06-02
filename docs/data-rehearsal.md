# Data Rehearsal

実データ1セットを本番投入する前に、受け入れ、正規化、検証、表示確認を同じ順番でリハーサルします。

## 1. Create Package

作業用パッケージを `data/work/` に作ります。`data/work/` はGit管理しません。

```bash
npm run template:data-package -- shugiin-50th
```

作成前の確認だけなら:

```bash
npm run template:data-package -- --dry-run shugiin-50th
```

## 2. Record Sources

公式URL、取得日、形式、利用条件は次に記録します。

```text
data/source/materials/official-sources.csv
```

写真を入れる場合は、写真ファイルと同時に次へ記録します。

```text
data/source/materials/photo-rights.csv
```

候補者写真が未整備の場合だけ、`/data/{electionId}/photos/placeholder.svg` をfallbackとして使えます。

## 3. Normalize CSV

ExcelはシートごとにCSV保存し、標準CSVへ寄せます。

```bash
npm run import:csv:dry -- shugiin-50th
npm run gen:data:dry -- shugiin-50th
```

公式/staged CSVを使う場合:

```bash
npm run import:official:dry -- shugiin-50th --input=data/source/elections/shugiin-50th/csv
```

## 4. Verify

```bash
npm run validate:materials:strict
npm run validate:data:strict
npm run report:data:check -- shugiin-50th
npm run scan:release-text -- shugiin-50th
npm run release:check -- shugiin-50th
```

`release:check` は build と 12ルートの smoke まで通します。

## Review Points

- `photoUrl` と `photo-rights.csv` の `photoFile` が一致している
- 実人物写真の `rightsStatus` が `confirmed`
- source と public の差分が説明できる
- PDFは直接公開JSONにせず、単語帳CSVへ抽出する
- placeholder は候補者写真fallback以外に残さない
