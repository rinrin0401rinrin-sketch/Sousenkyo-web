# CSV Requirements

実データは、公式Excel/CSVを標準CSVへ寄せてから `data/source/elections/{electionId}/election.json` に取り込みます。ExcelはシートごとにCSV保存し、列名と列順をテンプレートへ合わせます。

## Data Package

受け渡しは次の形を推奨します。

```text
data-package/
  election-results/
    election-results.xlsx または csv/
  masters/
    parties.csv
    districts.csv
    proportional-blocks.csv
    candidates.csv
  photos/
    candidate-id.webp
  photo-rights.csv
  pdf/
    candidates.pdf
    proportional-list.pdf
    districts.pdf
    parties.pdf
  sources/
    official-sources.csv
```

## Column Policy

- **必須**: 空だと画面表示または検証が壊れる列
- **推奨**: あると精度、検索性、運用性が上がる列
- **後編集**: 公式データに無いことが多く、別マスタや人間確認で補う列
- **生成物**: `public/data` は直接編集せず、source から生成する

## Standard CSV Columns

| CSV | 必須 | 推奨 | 後編集 |
| --- | --- | --- | --- |
| `top_level_active.csv` | `currentId` |  |  |
| `top_level_elections.csv` | `id`, `type`, `name`, `status`, `year` | `isDataReady` |  |
| `election_meta.csv` | `id`, `type`, `name`, `status`, `year` | `shortName`, `description` |  |
| `election_visuals.csv` | `id`, `role`, `title`, `alt`, `imageUrl` | `description` | 画像差し替え |
| `parties.csv` | `id`, `name`, `color` | `shortName` | 政党系譜メモ |
| `prefectures.csv` | `id`, `name` | `region`, `districtCount` |  |
| `proportional_blocks.csv` | `id`, `name`, `seats` |  | 選挙回次ごとの定数確認 |
| `districts.csv` | `id`, `name`, `prefectureId` | `winnerMemberId` | 区割り変更メモ |
| `candidates.csv` | `id`, `name`, `partyId`, `prefectureId`, `status` | `districtId`, `proportionalBlockId`, `wins` | `photoUrl`, `profileUrl` |
| `members.csv` | `id`, `name`, `partyId`, `prefectureId`, `status` | `districtId`, `proportionalBlockId`, `wins` | `photoUrl` |
| `single_member_district_results.csv` | `id`, `electionId`, `prefectureId`, `candidateName`, `partyId`, `status`, `mapX`, `mapY` | `candidateId`, `partyName`, `votes`, `voteRate`, `turnout`, `districtName`, `districtNumber`, `mapZ` | `photoUrl`, `profileUrl` |
| `proportional_results.csv` | `id`, `electionId`, `blockId`, `partyId`, `status`, `seats`, `mapX`, `mapY` | `blockName`, `partyName`, `voteRate`, `turnout`, `mapZ` |  |
| `summary.csv` | `totalSeats` | `districtSeats`, `proportionalSeats`, `reportingRate`, `updatedAt` |  |
| `summary_party_seats.csv` | `partyId`, `seats` |  |  |

## Status Values

`status` は次のいずれかにします。

```text
elected
proportionalRevival
runnerUp
counting
pending
```

## Fallback

- 写真が未整備の場合は明示的に `/data/{electionId}/photos/placeholder.svg` を使います。
- 地図座標が公式データに無い場合は、別マスタで `mapX`, `mapY`, `mapZ` を補います。
- 過去選挙でデータが未整備なら `elections-index.json` の `isDataReady` を `false` にします。

