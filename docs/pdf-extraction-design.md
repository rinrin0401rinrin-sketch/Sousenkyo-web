# PDF Extraction Design

候補者一覧、比例名簿、選挙区一覧、政党一覧PDFは、単語帳CSVの入力元として扱います。

## Input Types

- **Text PDF**: テキスト抽出を優先。表の列が崩れる場合はPDFごとのパーサーを作る。
- **Scanned PDF**: OCR前提。低信頼行はレビューCSVへ残す。
- **Multi-column PDF**: 段組み順序が崩れやすいため、ページ領域または列ごとの抽出ルールを持つ。

## Output

抽出結果は必ず `data/source/glossary/csv/*.csv` に寄せます。

```text
id,label,category,reading,description,electionIds,relatedIds
```

候補者IDは、可能な限り選挙結果側の `candidates.csv` と合わせます。PDFだけではIDが決められない場合はレビューCSVで人間が確定します。

## Review Rules

- PDF表記と `label` が一致している
- `reading` がiPhone検索で使いやすい
- `category` がファイル種別と一致している
- `electionIds` が存在する
- `relatedIds` が単語帳内IDを指す
- 個人情報、APIキー、内部メモがない

## Future Script

実PDFを受け取った後に、次の流れでスクリプトを追加します。

```text
scripts/extract-glossary-pdf.mjs
  -> data/source/glossary/review/*.csv
  -> human review
  -> data/source/glossary/csv/*.csv
```

最初から完全自動公開にはせず、レビューCSVを必ず挟みます。

