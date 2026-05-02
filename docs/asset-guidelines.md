# Asset Guidelines

`public/data` 配下の画像は、そのまま公開される資産として扱います。APIキー、個人情報、未許諾素材、出典不明の人物写真は置かないでください。

## Supported Formats

- ヒーロー・カード・ギャラリー画像: `.png`, `.jpg`, `.jpeg`, `.webp`
- 候補者・議員写真: `.png`, `.jpg`, `.jpeg`, `.webp`, `.svg`
- 外部URL、`data:` URL、`javascript:` URL は使わず、`/data/...` で始まるローカル公開パスを使います。

## Size And Dimensions

- ヒーロー・ギャラリー画像は幅900px以上、高さ600px以上を推奨します。
- ヒーロー・ギャラリー画像は5MB以下にします。
- 候補者・議員写真は1MB以下にします。
- iPhone表示で読み込みが重くならないよう、実画像は必要以上に大きくしないでください。

## Naming

- ファイル名は小文字英数字とハイフンを基本にします。
- 例: `election-main-hero-ballot.png`, `voting-guide-map-panels.webp`
- 選挙ごとの資産は `/public/data/{electionId}/visuals/` または `/public/data/{electionId}/photos/` に置きます。

## Validation

画像は `npm run validate:data` で存在、形式、サイズ、最低寸法を確認します。公開前は `npm run validate:data:strict` で warning / info も失敗扱いにします。

```bash
npm run validate:data
npm run validate:data:strict
```

画像差し替え後は、`npm run build` と `npm run smoke:preview` で表示崩れがないかも確認してください。
