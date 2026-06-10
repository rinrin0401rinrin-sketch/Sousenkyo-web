# Public Release And Automation

公開サイトは GitHub Pages を前提にします。無料プランで誰でも見られるようにする場合は、リポジトリを Public にし、Pages の source を GitHub Actions にします。

GitHub Pages の deploy job は `github-pages` environment を使います。GitHub画面の Settings で、この environment に required reviewers を設定すると、Pages公開前に人間承認を強制できます。

## Public Repository Checklist

Public にする前に、次を通します。

```bash
npm run test:fetch:official
npm run scan:secrets
npm run validate:materials:strict
npm run validate:data:strict
npm run build
```

人物写真、候補者名、読み、政党名、選挙区、PDF由来データは公開対象になります。`public/data` に置いたJSON、画像、写真はブラウザから誰でも取得できます。

## Automation Stages

完全自動化は、次の6段階で進めます。

1. 公式URLの登録
   - 第51回の公式元は `衆議院事務局` として `data/source/materials/official-sources.csv` に記録します。
   - 直URLが確定したPDF/CSV/Excelは、`candidate-list`、`result`、`turnout` など sourceType ごとに別行で追加します。

2. fetch manifest
   - 第51回の初期manifestは `data/import-schemas/shugiin-51st-shugiin-office-fetch-manifest.example.json` です。
   - `allowedHosts` は `www.shugiin.go.jp` と `.shugiin.go.jp` に限定します。
   - URL取得後は `fetch-receipt.json` の `sha256`、`bytes`、`finalUrl`、`contentType` を確認します。

3. Excel/CSV intake
   - 現時点の importer は CSV/TSV を正本にします。
   - Excelは fetch で保存し、人間がシートをCSV/TSVへ書き出してから `import:official:dry` に渡します。
   - Excel直読みを入れる場合は、sheet名 allowlist、最大行数、最大列数、ファイルサイズ上限を必須にします。

4. 結果データ接続
   - 小選挙区は `single_member_district_results.csv`。
   - 比例代表は `proportional_results.csv`。
   - 政党別議席は `summary_party_seats.csv`。
   - 開票率と更新日時は `summary.csv`。
   - 候補者名簿モードと確定結果モードを混ぜず、最終公開前は `release:check:final` を通します。

5. GitHub Actions automation
   - `.github/workflows/official-data-pipeline.yml` を手動実行します。
   - fetch、receipt生成、素材台帳検証、データ検証、build、release gate、artifact保存までを自動化します。
   - `staged_input_dir` を指定した時だけ import dry-run を行います。

6. Human approval gate
   - 自動取得しただけでは公開JSONへ反映しません。
   - artifact、receipt、normalized CSV、diff report を人間が確認します。
   - 確認後に `import:official --apply`、`gen:data`、`release:check`、必要なら `release:check:final` を通して公開します。
   - GitHub Pages の `github-pages` environment に required reviewers を設定し、deploy前承認を有効にします。

## Security Notes

- APIキーやトークンは `.env` ではなく GitHub Actions Secrets に入れます。
- `.env`、`data/imports`、`data/work`、`dist`、`node_modules` はGit管理しません。
- 外部manifestはそのまま実行しません。
- allowlist外ドメイン、HTTP、巨大ファイル、hash不一致、redirect先不一致は止めます。
- 写真の出典と許諾は `photo-rights.csv`、公式資料の根拠は `official-sources.csv` に残します。
