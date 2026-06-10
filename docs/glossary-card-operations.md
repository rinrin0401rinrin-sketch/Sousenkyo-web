# Glossary Card Operations

この文書は、465名規模の単語帳カードを iPhone 運用と Web アプリ運用で安全に回すための手順です。単語帳データの基本仕様は [glossary.md](./glossary.md)、素材と権利の受け入れは [materials.md](./materials.md)、公開前ゲートは [operation-roadmap.md](./operation-roadmap.md) を正とします。

## 目的

- 465名分の候補者カードを、検索用データと暗記カード用データとして同じCSV正本から運用する
- iPhoneでは現地確認、読み合わせ、暗記カード確認を軽く行える状態にする
- Webアプリでは `/glossary` の検索、分類フィルター、選挙回次フィルター、カードモードを公開前に確認する
- PDF抽出、手入力、写真追加、公開JSON生成の責任範囲を分け、戻せる更新にする

## データ正本

単語帳の正本は `data/source/glossary/csv/*.csv` です。`public/data/glossary/*.json` は生成物なので直接編集しません。

```text
data/source/glossary/csv/
  candidates.csv
  parties.csv
  districts.csv
  proportional-blocks.csv
  terms.csv
```

候補者465名は `candidates.csv` に投入します。列定義は既存の単語帳仕様に合わせます。

```text
id,label,category,reading,description,electionIds,relatedIds,photoUrl,districtLabel,partyLabel,statusLabel,age,wins,seatType,reviewStatus
```

この15列が実装上の正です。最新の列定義は `scripts/glossary-schema.mjs` の `glossaryCsvHeaders` を確認します。候補者カードでは `photoUrl`、`districtLabel`、`partyLabel`、`statusLabel`、`age`、`wins`、`seatType`、`reviewStatus` も使います。

運用上の正本は次の優先順で扱います。

1. 公式PDF、公式CSV、公式ページなどの一次情報
2. `data/source/materials/official-sources.csv` に記録した取得元
3. 人間確認済みの `data/source/glossary/csv/*.csv`
4. `npm run gen:glossary` で生成した `public/data/glossary/*.json`

PDFやOCRの抽出結果は正本ではありません。必ずCSVへ反映し、人間確認を通してから公開JSONへ生成します。

## 465名投入フロー

大量投入では、1回で全公開まで進めず、抽出、整形、確認、生成、表示確認を分けます。

```text
公式PDF/CSV
  -> 抽出作業
  -> data/work/{electionId}-review/ などの作業用CSV
  -> data/source/glossary/csv/candidates.csv へ反映
  -> human review
  -> npm run gen:glossary:dry
  -> npm run gen:glossary
  -> npm run validate:data:strict
  -> /glossary 確認
```

投入時の作業単位は、可能なら50名から100名程度に分けます。465名を一括で入れる場合も、差分確認では次を必ず見ます。

- 候補者数が想定件数と一致している
- `id` が全ファイルを通して重複していない
- `label` が公式表記と一致している
- `reading` がiPhone検索で入力しやすい
- `category` が `candidate` になっている
- `electionIds` が対象 electionId を指している
- `relatedIds` が既存の政党、選挙区、比例ブロック、用語IDを指している
- 個人情報、秘密情報、未公開メモが混入していない

抽出コマンドが対象PDFに対応している場合は、まず試験抽出で形式を確認します。

```bash
npm run extract:glossary:shugiin51 -- --limit 20
```

試験抽出の出力は確認用です。`data/work` 配下はレビュー用の一時領域であり、公開正本ではありません。必要な行だけを `data/source/glossary/csv/candidates.csv` へ反映します。写真も同じく、`data/work` の写真は確認用です。公開する写真は `photo-rights.csv` と照合できる公開パスへ置き、`photoUrl` をその公開パスに正規化します。

## 確認済み候補者CSVの昇格手順

第51回衆院の確認済み作業CSVを正本へ移す場合は、作業用CSVを直接コピーせず、昇格スクリプトで事前検証します。標準は dry-run です。

```bash
npm run promote:glossary:shugiin51:dry
```

dry-run は `data/work/shugiin-51st-glossary-review/candidates.csv` を読み、`data/source/glossary/csv/candidates.csv` へ昇格できるかを検証します。source 本体は書き換えません。結果は `data/work/shugiin-51st-glossary-review/manual-fix/glossary-promotion-dry-run.csv` に出ます。

dry-run で確認する主な項目:

- 候補者件数
- QA summary の有無と概要
- `scripts/glossary-schema.mjs` と同じCSV列
- `electionIds` が `elections-index.json` に存在すること
- `data/work` を指す危険な `photoUrl`
- `reviewStatus` の内訳。`needs-review` は、QA上の `manual-review-real-needed.csv` が0件で、過去QA理由だけが残っている場合のみ人間確認後に許容します。
- `manual-review-real-needed.csv` が存在し、0件であること

dry-run のCSVを人間が確認し、source へ移してよいと判断した場合だけ apply します。

```bash
npm run promote:glossary:shugiin51
```

apply は既存の `data/source/glossary/csv/candidates.csv` を同じディレクトリへ `candidates.backup-YYYYMMDDHHmmss.csv` としてバックアップしてから、確認済み候補者CSVを書き込みます。ただし `data/work` を指す人物写真の `photoUrl` は公開用に使わず空欄へ戻します。実人物写真は、別途 `data/source/materials/photo-rights.csv` で権利確認できた公開パスだけを後続タスクで入れます。

昇格後の標準ゲート:

```bash
npm run gen:glossary:dry
npm run gen:glossary
npm run validate:data:strict
npm run build
```

つまり、実運用では次の順番で進めます。

1. `npm run promote:glossary:shugiin51:dry`
2. `glossary-promotion-dry-run.csv` を人間が確認する。`overall` が `ng` の場合は apply しない
3. `npm run promote:glossary:shugiin51`
4. `npm run gen:glossary:dry`
5. `npm run gen:glossary`
6. `npm run validate:data:strict`
7. `npm run build`

## iPhoneカード運用

iPhoneでは、現地での見え方と暗記カードとしての使いやすさを優先して確認します。確認対象は `/glossary` のiPhone幅表示です。

主な確認項目:

- 検索欄で氏名、読み、政党名、選挙区名を探せる
- 候補者カードで氏名、読み、分類、説明が読み切れる
- 暗記カードモードで前へ/次へが軽く動く
- 横3:縦5のカード比率が崩れない
- 3:4の写真枠が崩れない
- 写真なし候補者で placeholder 表示が破綻しない
- iPhone幅で横スクロールが出ない
- 長い氏名、長い選挙区名、長い政党名がUIを押し出さない

iPhone確認は、全465名を毎回精査するのではなく、次のサンプルを含めます。

- 先頭、中央、末尾の候補者
- 氏名が長い候補者
- 読みが長い候補者
- 写真あり候補者
- placeholder 候補者
- 複数の `relatedIds` を持つ候補者
- 対象 electionId の境界ケース

## Web公開運用

Web公開前は、CSVから公開JSONを再生成し、既存の公開ゲートに乗せます。

```bash
npm run gen:glossary:dry
npm run gen:glossary
npm run validate:data:strict
npm run build
```

対象 electionId が決まっている公開では、標準リリースゲートを使います。

```bash
npm run release:check -- {electionId}
```

ブラウザ確認では `/glossary` を開き、次を確認します。

- 検索辞書モードで候補者名、政党名、選挙区名が検索できる
- 分類フィルターで候補者、政党、選挙区、比例、用語を切り替えられる
- 選挙回次フィルターで対象 electionId に絞り込める
- カードモードで465名規模でも操作が重くならない
- 公開JSONへ直接編集した差分がない

## QAゲート

公開前に最低限通すゲートは次です。

```bash
npm run gen:glossary:dry
npm run gen:glossary
npm run validate:data:strict
npm run build
```

素材台帳や写真を含む更新では、素材検証も通します。

```bash
npm run validate:materials:strict
```

QAで見る観点:

- CSV列が仕様どおりである
- 重複IDがない
- 存在しない `electionIds` がない
- 存在しない `relatedIds` がない
- generated JSON が最新CSVから作られている
- `/glossary` のiPhone幅で文字、写真枠、カード操作が破綻しない
- 未許諾写真、権利不明写真、出典不明写真が公開対象に混ざっていない

## 写真/権利/placeholder

候補者写真は `data/source/materials/photo-rights.csv` で出典と許諾を管理します。未許諾、出典不明、権利不明の人物写真は公開対象に入れません。

写真を追加する場合:

- `sourceUrl`、`rightHolder`、`rightsStatus`、`retrievedAt` を台帳に記録する
- `rightsStatus` が `confirmed` でない写真は公開しない
- 公開JSON側の `photoUrl` と台帳の `photoFile` を同じ公開パスにそろえる
- 顔が判別でき、正方形表示と3:4写真枠で破綻しない画像を使う

写真が未整備、または権利確認できない場合は、実人物写真を公開せず placeholder を使います。あとから写真の出典と権利確認が取れた場合だけ置き換えます。

写真確認を含む公開前チェック:

```bash
npm run validate:materials:strict
```

## 更新時の手順

通常更新:

1. 公式情報の取得元を `data/source/materials/official-sources.csv` に記録する
2. 抽出結果を作業用CSVへ出す
3. 人間確認済みの行だけ `data/source/glossary/csv/*.csv` へ反映する
4. `npm run gen:glossary:dry` で構造と参照を確認する
5. `npm run gen:glossary` で公開JSONを生成する
6. `npm run validate:data:strict` を実行する
7. 写真を触った場合は `npm run validate:materials:strict` を実行する
8. ローカル確認では `npm run build`、公開前確認では `npm run release:check -- {electionId}` を実行する
9. `/glossary` をWebとiPhone幅で確認する

軽微な修正:

- 誤字、読み、説明の修正はCSVだけを直す
- 生成物のJSONは直接直さない
- 修正後は必ず `npm run gen:glossary:dry` と `npm run gen:glossary` を再実行する

## 失敗時の戻し方

失敗した場合は、原因の層を分けて戻します。無関係な変更は戻しません。

- CSV投入ミス: 対象行だけを `data/source/glossary/csv/*.csv` で修正し、再生成する
- 生成JSONミス: JSONを直接編集せず、CSVを直して `npm run gen:glossary` を再実行する
- 写真権利ミス: 対象写真の公開参照を外し、placeholder に戻し、台帳を更新する
- 表示崩れ: まず長い文言、空の読み、写真サイズ、placeholder の有無を確認する
- 公開前ゲート失敗: エラーメッセージの対象ファイルだけを直し、同じコマンドを再実行する

Gitで戻す場合も、今回の単語帳運用に関係するファイルだけを対象にします。候補者写真、CSV、Reactコードなど、別担当の変更は勝手に戻しません。

## チェックリスト

投入前:

- [ ] 対象 electionId が決まっている
- [ ] 公式情報の取得元を確認した
- [ ] 写真を使う場合、権利確認方針が決まっている
- [ ] 作業用CSVと公開CSVの役割を分けた

CSV確認:

- [ ] 候補者465名の件数が一致している
- [ ] `id` が重複していない
- [ ] `label` が公式表記と一致している
- [ ] `reading` が検索しやすい
- [ ] `electionIds` が存在している
- [ ] `relatedIds` が存在している
- [ ] 非公開メモや秘密情報がない

生成/検証:

- [ ] `npm run gen:glossary:dry` が通った
- [ ] `npm run gen:glossary` を実行した
- [ ] `npm run validate:data:strict` が通った
- [ ] 写真を触った場合、`npm run validate:materials:strict` が通った
- [ ] `npm run build` または `npm run release:check -- {electionId}` が通った

表示確認:

- [ ] `/glossary` の検索が動く
- [ ] 分類フィルターが動く
- [ ] 選挙回次フィルターが動く
- [ ] カードモードの前へ/次へが動く
- [ ] iPhone幅で横スクロールや文字はみ出しがない
- [ ] 写真あり、placeholder の両方が破綻していない

公開前:

- [ ] 生成物を直接編集していない
- [ ] 写真の出典と許諾が台帳に残っている
- [ ] 失敗時に戻す対象ファイルが分かっている
- [ ] 変更差分を確認した
