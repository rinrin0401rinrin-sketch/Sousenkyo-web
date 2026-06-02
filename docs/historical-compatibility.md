# Historical Election Compatibility

歴代選挙は `electionId` 単位で独立したデータとして扱います。第49回と第50回の区割り、政党、比例定数を混ぜないことを最優先にします。

## Rules

- `data/source/elections/{electionId}/election.json` を回次ごとの正本にする
- `parties`, `districts`, `proportionalBlocks` は当該選挙時点のマスタとして固定する
- 未整備の過去選挙は `elections-index.json` で `isDataReady:false` にする
- 同名政党でも、回次横断の同一扱いは別マッピングで管理する
- 区割り変更は共通IDで無理に吸収せず、必要なら注記または別マスタにする

## Optional Cross-election Masters

将来、比較機能を強化する場合は次の別データを検討します。

```text
party-lineage.csv
district-aliases.csv
member-identities.csv
```

これらは結果表示の正本ではなく、比較・検索・注記用の補助データです。

## Minimum Intake For Past Elections

- 当時の選挙区マスタ
- 当時の政党マスタ
- 当時の比例ブロック定数
- 候補者、当選者、比例復活、得票、投票率
- 公式資料のURL、取得日、加工ログ

