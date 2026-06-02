# Release Checklist

公開前は、source JSON / CSV / public JSON / 画面表示が同じ内容を指していることを確認します。

## Data

- [ ] `data/source/elections/{electionId}/election.json` に秘密情報、個人情報、実キーが入っていない
- [ ] `data/source/elections/{electionId}/election.json` が正本であり、`public/data` は生成物として扱っている
- [ ] 公式Excel/CSVを使う場合は importer を通し、直接 `public/data` を編集していない
- [ ] 公式URL、取得日、形式、利用条件を `data/source/materials/official-sources.csv` に記録した
- [ ] 候補者写真を使う場合は `data/source/materials/photo-rights.csv` に出典と許諾を記録した
- [ ] CSV編集後に `npm run import:csv:dry -- {electionId}` が通る
- [ ] `npm run gen:data:dry -- {electionId}` で生成対象が想定どおり
- [ ] `npm run gen:data -- {electionId}` で `public/data` が更新される
- [ ] `npm run report:data -- {electionId}` で source と public の差分が説明できる
- [ ] `npm run report:data:write -- {electionId}` で更新ログを `data/reports/` に残した
- [ ] `npm run report:data:check -- {electionId}` が通る
- [ ] 大量データ経路を確認する場合は `shugiin-large-fixture-smoke` を作成し、dry-run検証後に削除した

## Validation

- [ ] `npm run scan:secrets` が通る
- [ ] `npm run scan:release-text -- {electionId}` が通る
- [ ] `npm run gen:glossary:dry` が通る
- [ ] `npm run validate:materials` が通る
- [ ] `npm run validate:materials:strict` が通る
- [ ] `npm run validate:data` が通る
- [ ] `npm run validate:data:strict` が通る
- [ ] `npm run build` が通る
- [ ] `npm run smoke:preview` が通る
- [ ] `npm run release:check -- {electionId}` が通る

## Visual And UX

- [ ] 画像資産が [asset-guidelines.md](./asset-guidelines.md) の形式、サイズ、命名ルールに沿っている
- [ ] トップページ `/` が表示される
- [ ] `/live` `/map` `/parties` `/proportional` `/archive` `/glossary` が表示される
- [ ] `/elections/{electionId}` に直接アクセスできる
- [ ] `/elections/{electionId}/prefectures/{prefectureId}` に直接アクセスできる
- [ ] 存在しないURLで404ページが出る
- [ ] iPhone幅で主要カード、地図、フィルター、詳細カードが崩れない
- [ ] 画像が欠けず、代替表示も成立している
- [ ] 出典不明、未許諾、権利不明の人物写真が公開対象に入っていない
- [ ] `npm run screenshots:routes` でトップ/詳細/iPhone幅のスクショを保存した

## Release Decision

- [ ] `active-election.json` の `currentId` が `elections-index.json` に存在し、`isDataReady: false` ではない公開対象を指している
- [ ] `elections-index.json` の `isDataReady` が公開可能な選挙だけ `true`
- [ ] 架空名、仮データ、TODO、サンプル表記が公開対象に残っていない
- [ ] 候補者写真のfallback以外に placeholder 画像や placeholder 文言が残っていない
- [ ] 空配列や未入力値が残る場合は、仕様として空でよい画面か確認済み
- [ ] 公開後に差し替えるCSV/Excelの担当と更新手順が決まっている
