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

```json
{
  "files": {
    "single_member_district_results.csv": {
      "source": "official-districts.csv",
      "columns": {
        "electionId": { "value": "{electionId}" },
        "candidateName": "候補者名",
        "partyName": "届出政党",
        "votes": "得票数"
      }
    }
  }
}
```

指定していない列は同名列から読みます。値がない列は空欄で出力されるため、公式データにない `photoUrl` や `mapX/mapY/mapZ` は後編集または別マスタで補えます。

## Excel Files

初期実装では `.xlsx` の直接解析はしません。公式Excelは、シートごとにCSV保存してから `import:official` へ渡してください。直接 `.xlsx` 取り込みが必要になった場合は、依存追加とシート選択ルールを別途決めます。
