export type SpecialPageId = 'live' | 'map' | 'parties' | 'proportional' | 'archive';

export type SpecialPageConfig = {
  id: SpecialPageId;
  path: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  accent: string;
  metrics: Array<{ label: string; value: string; detail: string }>;
  panels: Array<{ title: string; description: string; tags: string[] }>;
};

export const specialPages: SpecialPageConfig[] = [
  {
    id: 'live',
    path: '/live',
    eyebrow: 'LIVE COUNT',
    title: '開票速報',
    subtitle: '確定・開票中・接戦・未確定を同じ画面で追える、選挙特番の速報センター。',
    imageUrl: '/data/shugiin-50th/visuals/pages/live-results.png',
    accent: '#0ea5e9',
    metrics: [
      { label: '確定', value: 'LIVE', detail: '当確更新' },
      { label: '接戦', value: 'Focus', detail: '得票差監視' },
      { label: '未確定', value: 'Auto', detail: 'JSON連動' },
    ],
    panels: [
      { title: '速報タイムライン', description: '当確、開票率、比例議席の更新を時系列で確認できます。', tags: ['当確', '更新履歴', '速報'] },
      { title: '接戦アラート', description: '得票差が小さい選挙区を自動で目立たせる想定の領域です。', tags: ['接戦', '開票中'] },
      { title: '確定状況', description: '確定済み、未確定、集計中の状態を一目で把握できます。', tags: ['確定', '未確定'] },
    ],
  },
  {
    id: 'map',
    path: '/map',
    eyebrow: 'NATIONAL MAP',
    title: '全国マップ',
    subtitle: '小選挙区と比例区を発光ドットで切り替える、全国選挙結果のメインビュー。',
    imageUrl: '/data/shugiin-50th/visuals/pages/national-map.png',
    accent: '#2563eb',
    metrics: [
      { label: '小選挙区', value: '289', detail: 'ドット表示' },
      { label: '比例区', value: '176', detail: 'レイヤー表示' },
      { label: '表示', value: '3', detail: '切替モード' },
    ],
    panels: [
      { title: '地図レイヤー', description: '小選挙区、比例区、両方表示を切り替える専用ページです。', tags: ['小選挙区', '比例区', '両方'] },
      { title: 'フィルター', description: '政党、都道府県、開票状況で表示対象を絞り込めます。', tags: ['政党', '地域', '状況'] },
      { title: '詳細ポップアップ', description: 'ドット選択で候補者、政党、得票、当落状態を表示します。', tags: ['詳細', 'タップ'] },
    ],
  },
  {
    id: 'parties',
    path: '/parties',
    eyebrow: 'CAUCUS ANALYTICS',
    title: '会派別データ',
    subtitle: '会派別議席、前回比、小選挙区と比例区の内訳をまとめる分析ページ。',
    imageUrl: '/data/shugiin-50th/visuals/pages/party-analysis.png',
    accent: '#22c55e',
    metrics: [
      { label: '議席', value: '465', detail: '総数比較' },
      { label: '前回比', value: '+/-', detail: '増減表示' },
      { label: '地域', value: '47', detail: '分布分析' },
    ],
    panels: [
      { title: '会派別議席表', description: '公式結果データを正として、会派別に議席数を表示します。', tags: ['議席', '会派'] },
      { title: '小選挙区 / 比例内訳', description: '選挙制度ごとの獲得状況を比較しやすくします。', tags: ['小選挙区', '比例'] },
      { title: '地域別の強弱', description: '都道府県や比例ブロックごとの傾向を見せる拡張枠です。', tags: ['地域', '比較'] },
    ],
  },
  {
    id: 'proportional',
    path: '/proportional',
    eyebrow: 'PROPORTIONAL',
    title: '比例代表',
    subtitle: '11ブロック別の議席配分、得票率、比例復活候補を見やすく整理します。',
    imageUrl: '/data/shugiin-50th/visuals/pages/proportional.png',
    accent: '#8b5cf6',
    metrics: [
      { label: 'ブロック', value: '11', detail: '地域別' },
      { label: '比例議席', value: '176', detail: '配分' },
      { label: '復活', value: 'Check', detail: '候補者連動' },
    ],
    panels: [
      { title: '比例ブロック選択', description: '北海道から九州まで、ブロック別に結果を切り替えます。', tags: ['11ブロック', '選択'] },
      { title: '議席配分', description: '会派別の比例議席と得票率を同じ画面で確認できます。', tags: ['議席', '得票率'] },
      { title: '比例復活', description: '復活当選者や惜敗率の表示へ拡張しやすい構造です。', tags: ['比例復活', '惜敗率'] },
    ],
  },
  {
    id: 'archive',
    path: '/archive',
    eyebrow: 'ARCHIVE',
    title: '過去選挙アーカイブ',
    subtitle: '過去選挙と今後の選挙を選び、回次ごとの結果を比較できる長期運用ページ。',
    imageUrl: '/data/shugiin-50th/visuals/pages/archive.png',
    accent: '#64748b',
    metrics: [
      { label: '回次', value: 'History', detail: '一覧管理' },
      { label: '比較', value: 'Trend', detail: '推移表示' },
      { label: '検索', value: 'Ready', detail: '地域/回次' },
    ],
    panels: [
      { title: '選挙回次カード', description: '衆院選、参院選、今後の選挙を同じ一覧で管理します。', tags: ['過去選挙', '今後'] },
      { title: '比較タイムライン', description: '投票率や議席推移を時系列で確認できる想定です。', tags: ['推移', '比較'] },
      { title: '検索導線', description: '選挙回次、地域、キーワードから過去データへ移動できます。', tags: ['検索', '地域'] },
    ],
  },
];

export function getSpecialPage(id: SpecialPageId): SpecialPageConfig {
  return specialPages.find((page) => page.id === id) ?? specialPages[0];
}
