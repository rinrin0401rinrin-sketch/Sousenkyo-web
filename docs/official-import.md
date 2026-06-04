# Official Data Import

公式Excel/CSVをそのまま画面へ反映せず、必ず staging、差分、strict検証、人間確認を通します。

```text
official Excel/CSV
  -> fetch:official
  -> import:official
  -> data/source/elections/{electionId}/election.json
  -> report:data
  -> validate:data:strict
  -> human review
  -> gen:data
  -> release:check
```

## 1. Fetch

取得元をmanifestにします。URLでもローカルファイルでも指定できます。URL取得はNodeの `fetch` を使うため、ネットワーク制限のある環境では実行許可が必要です。

```bash
npm run fetch:official:dry -- --manifest=data/import-schemas/official-fetch-manifest.example.json
npm run fetch:official -- --manifest=data/import-schemas/official-fetch-manifest.example.json
```

取得物は `data/imports/{electionId}/{timestamp}/raw/` に保存され、receiptも残ります。

## 2. Normalize And Import

公式CSVの列名がこのプロジェクトの標準CSVと同じなら、既定の `data/import-schemas/internal-csv-v1.json` を使えます。

```bash
npm run import:official:dry -- shugiin-50th --input=data/source/elections/shugiin-50th/csv
```

反映時は source CSV と `election.json` だけを更新します。`public/data` はまだ更新しません。

```bash
npm run import:official -- shugiin-50th --input=data/source/elections/shugiin-50th/csv
```

このコマンドは次を実行します。

- 公式/staged CSVを標準CSVへ正規化
- `import:csv:dry` 相当の検証
- `data/source/elections/{electionId}/csv/*.csv` へ反映
- `data/source/elections/{electionId}/election.json` を更新
- `gen:data:dry`
- `report:data:write`
- `validate:data:strict`

## 3. Human Review

`import:official` 後は、必ず次を人間が確認します。

- `data/imports/{electionId}/{timestamp}/normalized/`
- `data/source/elections/{electionId}/election.json`
- `data/reports/*-{electionId}-diff.txt`
- `validate:data:strict` の結果

問題なければ公開JSONへ進めます。

```bash
npm run gen:data -- shugiin-50th
npm run release:check -- shugiin-50th
```

## Mapping Schema

公式CSVの列名が違う場合は、`data/import-schemas/internal-csv-v1.json` をコピーして `source` と `columns` を変更します。
実運用向けの例は `data/import-schemas/official-csv-v1.example.json` にあります。

```json
{
  "files": {
    "single_member_district_results.csv": {
      "source": {
        "file": "official-districts.csv",
        "sheet": "小選挙区"
      },
      "requiredColumns": ["candidateName", "partyName", "status"],
      "columns": {
        "electionId": { "value": "{electionId}" },
        "candidateName": { "source": "候補者名", "aliases": ["氏名", "候補者"] },
        "partyName": { "source": "届出政党", "aliases": ["政党名", "党派"] },
        "status": { "source": "当落", "normalize": "status", "default": "pending" },
        "votes": { "source": "得票数", "normalize": "number", "blankAs": "0" },
        "voteRate": { "source": "得票率", "normalize": "percent", "blankAs": "0" },
        "updatedAt": { "source": "更新日時", "default": "{updatedAt}", "normalize": "dateTime" }
      }
    }
  }
}
```

指定していない列は同名列から読みます。値がない列は空欄で出力されるため、公式データにない `photoUrl` や `mapX/mapY/mapZ` は後編集または別マスタで補えます。

対応している主な正規化:

- `aliases`: 公式CSVの列名ゆれを配列で指定し、最初に見つかった列を使います。
- `normalize: "number"`: `120,430票` のようなカンマや単位つき数値を標準CSV向けに正規化します。
- `normalize: "percent"`: `54.2%` / `54.2％` を数値文字列へ正規化します。
- `normalize: "status"`: `当選`、`比例復活`、`落選`、`開票中`、`未確定` を内部statusへ寄せます。
- `normalize: "dateTime"`: 更新日時をISO文字列へ寄せます。解析できない日時は元文字列を残します。
- `blankAs`: 空欄時に入れる値を指定します。
- `default`: 公式CSVに列や値がない場合の既定値です。`{electionId}`、`{rowIndex}`、`{updatedAt}` が使えます。

TSVは `.tsv` または `.txt` を `source` に指定するとタブ区切りとして読みます。

## Excel Files

初期実装では `.xlsx` の直接解析はしません。公式Excelは、シートごとにCSV/TSV保存してから `import:official` へ渡してください。
schema の `source.sheet` は、どのシートから書き出したCSVかを記録するメモとして扱います。
`.xlsx` / `.xls` を直接指定した場合は、取り込みを止めてCSV/TSV化を促します。

## Release Modes

候補者・準備データとして公開する場合:

```bash
npm run release:check -- shugiin-51st
```

開票結果を最終結果として公開する場合:

```bash
npm run release:check:final -- shugiin-51st
```

`release:check:final` は `pending` / `counting`、開票率100未満、partySeats未反映、確定結果とsummaryのズレを公開前に止めます。
