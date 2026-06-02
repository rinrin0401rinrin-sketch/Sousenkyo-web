import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode, TouchEvent } from 'react';
import { AppShell } from '../components/AppShell';
import { EmptyState } from '../components/EmptyState';
import { ErrorScreen } from '../components/ErrorScreen';
import { LoadingScreen } from '../components/LoadingScreen';
import { useAsyncData } from '../hooks/useAsyncData';
import type { GlossaryCategory, GlossaryEntry } from '../types/glossary';
import { loadElectionsIndex, loadGlossaryBundle } from '../utils/dataLoader';
import { publicPath } from '../utils/publicPath';

type GlossaryMode = 'search' | 'cards';
type CategoryFilter = 'all' | GlossaryCategory;
type SeatScopeFilter = 'all' | 'single' | 'proportional' | 'female' | 'freshman';

const preferredElectionId = 'shugiin-51st';
const searchResultLimit = 465;
const searchResultIncrement = 465;
const allPrefecturesValue = 'all';
const allDistrictsValue = 'all';
const tokyoDistrictCount = 30;
const swipeThreshold = 46;
const japanesePrefectures = [
  '北海道',
  '青森',
  '岩手',
  '宮城',
  '秋田',
  '山形',
  '福島',
  '茨城',
  '栃木',
  '群馬',
  '埼玉',
  '千葉',
  '東京',
  '神奈川',
  '新潟',
  '富山',
  '石川',
  '福井',
  '山梨',
  '長野',
  '岐阜',
  '静岡',
  '愛知',
  '三重',
  '滋賀',
  '京都',
  '大阪',
  '兵庫',
  '奈良',
  '和歌山',
  '鳥取',
  '島根',
  '岡山',
  '広島',
  '山口',
  '徳島',
  '香川',
  '愛媛',
  '高知',
  '福岡',
  '佐賀',
  '長崎',
  '熊本',
  '大分',
  '宮崎',
  '鹿児島',
  '沖縄',
];
const prefectureSet = new Set(japanesePrefectures);
const proportionalBlockOrder = ['北海道', '東北', '北関東', '南関東', '東京', '北信越', '東海', '近畿', '中国', '四国', '九州'];
const femaleCandidateIds = new Set([
  'aoki-hitomi',
  'asada-masumi',
  'abe-toshiko',
  'candidate-052',
  'candidate-064',
  'candidate-067',
  'candidate-083',
  'candidate-087',
  'candidate-095',
  'candidate-103',
  'candidate-104',
  'candidate-111',
  'candidate-118',
  'candidate-123',
  'candidate-125',
  'candidate-143',
  'candidate-155',
  'candidate-190',
  'candidate-199',
  'candidate-210',
  'candidate-212',
  'candidate-222',
  'candidate-228',
  'candidate-233',
  'candidate-234',
  'candidate-260',
  'candidate-263',
  'candidate-266',
  'candidate-269',
  'candidate-272',
  'candidate-280',
  'candidate-281',
  'candidate-303',
  'candidate-304',
  'candidate-316',
  'candidate-320',
  'candidate-323',
  'candidate-336',
  'candidate-351',
  'candidate-357',
  'candidate-363',
  'candidate-372',
  'candidate-380',
  'candidate-382',
  'candidate-384',
  'candidate-387',
  'candidate-391',
  'candidate-394',
  'candidate-395',
  'candidate-412',
  'candidate-424',
  'candidate-433',
  'candidate-435',
  'candidate-437',
  'candidate-445',
  'candidate-448',
  'candidate-457',
  'candidate-460',
]);

const categoryLabels: Record<GlossaryCategory, string> = {
  candidate: '候補者',
  party: '政党',
  district: '選挙区',
  proportional: '比例',
  term: '用語',
};

const categoryOptions: Array<{ id: CategoryFilter; label: string }> = [
  { id: 'all', label: 'すべて' },
  { id: 'candidate', label: categoryLabels.candidate },
  { id: 'party', label: categoryLabels.party },
  { id: 'district', label: categoryLabels.district },
  { id: 'proportional', label: categoryLabels.proportional },
  { id: 'term', label: categoryLabels.term },
];

export function GlossaryPage() {
  const [mode, setMode] = useState<GlossaryMode>('search');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<CategoryFilter>('candidate');
  const [electionId, setElectionId] = useState(preferredElectionId);
  const [seatScope, setSeatScope] = useState<SeatScopeFilter>('all');
  const [prefecture, setPrefecture] = useState(allPrefecturesValue);
  const [districtKey, setDistrictKey] = useState(allDistrictsValue);
  const [cardIndex, setCardIndex] = useState(0);
  const [visibleLimit, setVisibleLimit] = useState(searchResultLimit);
  const deferredQuery = useDeferredValue(query);

  const state = useAsyncData(async () => {
    const [glossary, electionsIndex] = await Promise.all([loadGlossaryBundle(), loadElectionsIndex()]);
    return { glossary, electionsIndex };
  }, []);

  const entries = useMemo(() => {
    if (state.status !== 'success') return [];
    return [
      ...state.data.glossary.candidates,
      ...state.data.glossary.parties,
      ...state.data.glossary.districts,
      ...state.data.glossary.proportionalBlocks,
      ...state.data.glossary.terms,
    ];
  }, [state]);

  const candidateEntries = useMemo(() => entries.filter((entry) => entry.category === 'candidate'), [entries]);

  const locationOptions = useMemo(() => {
    const names = new Set<string>();
    for (const entry of candidateEntries) {
      const parsed = parseDistrictLabel(entry.districtLabel);
      if (!parsed?.prefecture) continue;
      if (seatScope === 'proportional') {
        if (parsed.isProportional) names.add(parsed.prefecture);
      } else if (prefectureSet.has(parsed.prefecture)) {
        names.add(parsed.prefecture);
      }
    }
    return [...names].sort(compareLocationNames);
  }, [candidateEntries, seatScope]);

  const districtOptions = useMemo(
    () => buildDistrictOptions(candidateEntries, prefecture, seatScope),
    [candidateEntries, prefecture, seatScope],
  );

  const filteredEntries = useMemo(() => {
    const normalizedQuery = normalizeText(deferredQuery);
    const filtered = entries.filter((entry) => {
      if (category !== 'all' && entry.category !== category) return false;
      if (electionId !== 'all' && !(entry.electionIds ?? []).includes(electionId)) return false;
      const parsed = parseDistrictLabel(entry.districtLabel);
      if (seatScope !== 'all') {
        if (entry.category !== 'candidate') return false;
        if (seatScope === 'single' && parsed?.isProportional) return false;
        if (seatScope === 'proportional' && !parsed?.isProportional) return false;
        if (seatScope === 'female' && !isFemaleCandidate(entry)) return false;
        if (seatScope === 'freshman' && !isFreshmanCandidate(entry)) return false;
      }
      if (prefecture !== allPrefecturesValue) {
        if (entry.category !== 'candidate') return false;
        if (parsed?.prefecture !== prefecture) return false;
      }
      if (districtKey !== allDistrictsValue) {
        if (entry.category !== 'candidate') return false;
        if (districtOptionKey(parsed) !== districtKey) return false;
      }
      if (!normalizedQuery) return true;
      return searchableEntryText(entry).includes(normalizedQuery);
    });
    return sortGlossaryEntries(filtered, prefecture);
  }, [category, deferredQuery, districtKey, electionId, entries, prefecture, seatScope]);

  const visibleEntries = useMemo(
    () => (mode === 'search' ? filteredEntries.slice(0, visibleLimit) : filteredEntries),
    [filteredEntries, mode, visibleLimit],
  );
  const hasLimitedResults = mode === 'search' && filteredEntries.length > visibleEntries.length;
  const currentCard = filteredEntries[cardIndex % Math.max(1, filteredEntries.length)];
  const elections = state.status === 'success' ? state.data.electionsIndex.elections : [];

  if (state.status === 'loading') return <LoadingScreen />;
  if (state.status === 'error') return <ErrorScreen message={state.error.message} />;

  const resetSelection = () => {
    setCardIndex(0);
    setVisibleLimit(searchResultLimit);
  };

  return (
    <AppShell>
      <div className="space-y-5 sm:space-y-7">
        <section className="special-hero reveal-up p-5 sm:p-8">
          <div className="grid gap-6 lg:grid-cols-[0.82fr_1.18fr] lg:items-end">
            <div>
              <p className="glass-chip text-slate-600">Glossary / iPhone Ready</p>
              <h1 className="mt-4 text-4xl font-black tracking-tight text-slate-950 sm:mt-5 sm:text-6xl">選挙単語帳</h1>
              <p className="mt-3 max-w-xl text-sm leading-7 text-slate-600 sm:mt-4 sm:text-base sm:leading-8">
                候補者名、選挙区、比例区分、政党名をPDF由来の確認CSVから軽量JSONにして、検索辞書とカードで確認できます。
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <GlossaryStat label="候補者" value={`${candidateEntries.length}名`} />
              <GlossaryStat label="表示中" value={`${filteredEntries.length}件`} />
              <GlossaryStat label="モード" value={mode === 'search' ? '検索' : 'カード'} />
            </div>
          </div>
        </section>

        <section className="glass-surface-rich p-4 sm:p-5">
          <div className="grid gap-3 lg:grid-cols-[1fr_10rem_12rem_10rem_12rem]">
            <label className="block">
              <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Search</span>
              <input
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  resetSelection();
                }}
                placeholder="候補者名・選挙区・政党名で検索"
                className="mt-2 min-h-12 w-full rounded-2xl border border-white/70 bg-white/75 px-4 text-sm font-bold text-slate-700 shadow-sm outline-none backdrop-blur-xl focus:ring-4 focus:ring-sky-100"
              />
            </label>
            <FilterSelect
              label="分類"
              value={category}
              onChange={(value) => {
                setCategory(value as CategoryFilter);
                resetSelection();
              }}
            >
              {categoryOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </FilterSelect>
            <FilterSelect
              label="選挙回次"
              value={electionId}
              onChange={(value) => {
                setElectionId(value);
                resetSelection();
              }}
            >
              <option value="all">すべて</option>
              {elections.map((election) => (
                <option key={election.id} value={election.id}>
                  {election.name}
                </option>
              ))}
            </FilterSelect>
            <FilterSelect
              label="区分"
              value={seatScope}
              onChange={(value) => {
                const nextValue = value as SeatScopeFilter;
                setSeatScope(nextValue);
                setPrefecture(allPrefecturesValue);
                setDistrictKey(allDistrictsValue);
                setCategory(nextValue === 'all' ? category : 'candidate');
                resetSelection();
              }}
            >
              <option value="all">すべて</option>
              <option value="single">小選挙区</option>
              <option value="proportional">比例</option>
              <option value="female">女性</option>
              <option value="freshman">1回生（新人）</option>
            </FilterSelect>
            <div>
              <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Mode</span>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setMode('search')}
                  className={`min-h-12 rounded-2xl text-sm font-black transition ${mode === 'search' ? 'bg-slate-950 text-white' : 'bg-white/65 text-slate-600'}`}
                >
                  検索
                </button>
                <button
                  type="button"
                  onClick={() => setMode('cards')}
                  className={`min-h-12 rounded-2xl text-sm font-black transition ${mode === 'cards' ? 'bg-slate-950 text-white' : 'bg-white/65 text-slate-600'}`}
                >
                  カード
                </button>
              </div>
            </div>
          </div>
          <div className="mt-5 grid gap-3 lg:grid-cols-[14rem_1fr]">
            <FilterSelect
              label="都道府県/比例ブロック"
              value={prefecture}
              onChange={(value) => {
                setPrefecture(value);
                setDistrictKey(allDistrictsValue);
                setCategory(value === allPrefecturesValue ? category : 'candidate');
                resetSelection();
              }}
            >
              <option value={allPrefecturesValue}>すべて</option>
              {locationOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </FilterSelect>
            <DistrictScroller
              districts={districtOptions}
              seatScope={seatScope}
              selectedKey={districtKey}
              onSelect={(value) => {
                setDistrictKey(value);
                setCategory(value === allDistrictsValue && prefecture === allPrefecturesValue ? category : 'candidate');
                resetSelection();
              }}
            />
          </div>
        </section>

        {mode === 'search' && filteredEntries.length > 0 ? (
          <p className="px-1 text-xs font-bold text-slate-500">
            {hasLimitedResults
              ? `${filteredEntries.length}件中 ${visibleEntries.length}件を表示中。絞り込みで候補者を探しやすくできます。`
              : `${filteredEntries.length}件を表示中`}
          </p>
        ) : null}

        {mode === 'cards' ? (
          <GlossaryCard
            entry={currentCard}
            count={filteredEntries.length}
            index={cardIndex}
            onPrevious={() => setCardIndex((value) => cycleCardIndex(value - 1, filteredEntries.length))}
            onNext={() => setCardIndex((value) => cycleCardIndex(value + 1, filteredEntries.length))}
          />
        ) : filteredEntries.length > 0 ? (
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visibleEntries.map((entry) => (
              <GlossaryEntryCard key={entry.id} entry={entry} />
            ))}
            {hasLimitedResults ? (
              <button
                type="button"
                onClick={() => setVisibleLimit((value) => Math.min(filteredEntries.length, value + searchResultIncrement))}
                className="min-h-16 rounded-[1.5rem] border border-sky-100 bg-white/75 px-5 text-sm font-black text-slate-700 shadow-sm backdrop-blur-xl transition hover:-translate-y-0.5 hover:bg-sky-50 sm:col-span-2 lg:col-span-3"
              >
                さらに表示 {Math.min(searchResultIncrement, filteredEntries.length - visibleEntries.length)}件
              </button>
            ) : null}
          </section>
        ) : (
          <EmptyState title="単語が見つかりません" message="検索語、分類、選挙回次を変更してください。" />
        )}
      </div>
    </AppShell>
  );
}

function GlossaryEntryCard({ entry }: { entry: GlossaryEntry }) {
  return (
    <article className="glass-card shine-sweep overflow-hidden p-4">
      <div className="grid gap-3">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">{categoryLabels[entry.category]}</p>
          <div className="mt-2 flex items-start gap-3">
            {entry.category === 'candidate' ? <CandidatePhoto entry={entry} size="compact" /> : null}
            <div className="min-w-0 flex-1">
              <h2 className="overflow-wrap-anywhere text-2xl font-black leading-tight text-slate-950">{entry.label}</h2>
              <p className="mt-1 overflow-wrap-anywhere text-xs font-black text-slate-500">{entry.reading || '読み未設定'}</p>
            </div>
          </div>
        </div>
      </div>
      <p className="mt-4 text-sm leading-6 text-slate-600">{entry.description || '説明はCSV確認後に追加します。'}</p>
      <GlossaryMeta entry={entry} />
    </article>
  );
}

function GlossaryCard({
  entry,
  count,
  index,
  onPrevious,
  onNext,
}: {
  entry?: GlossaryEntry;
  count: number;
  index: number;
  onPrevious: () => void;
  onNext: () => void;
}) {
  const [isBackSide, setIsBackSide] = useState(false);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const didSwipeRef = useRef(false);

  useEffect(() => {
    setIsBackSide(false);
  }, [entry?.id]);

  if (!entry) return <EmptyState title="カードがありません" message="検索条件を変更してください。" />;

  const isCandidate = entry.category === 'candidate';
  const flipCard = () => setIsBackSide((value) => !value);

  const handleTouchEnd = (event: TouchEvent<HTMLElement>) => {
    const start = touchStartRef.current;
    const touch = event.changedTouches[0];
    touchStartRef.current = null;
    if (!start || !touch) return;
    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    if (Math.abs(deltaX) < swipeThreshold || Math.abs(deltaX) < Math.abs(deltaY) * 1.4) return;
    didSwipeRef.current = true;
    window.setTimeout(() => {
      didSwipeRef.current = false;
    }, 180);
    if (deltaX < 0) {
      onNext();
    } else {
      onPrevious();
    }
  };

  return (
    <section className="mx-auto grid max-w-3xl gap-4">
      <article
        role="button"
        tabIndex={0}
        onClick={() => {
          if (didSwipeRef.current) {
            didSwipeRef.current = false;
            return;
          }
          flipCard();
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            flipCard();
          }
        }}
        onTouchStart={(event) => {
          const touch = event.touches[0];
          touchStartRef.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
          didSwipeRef.current = false;
        }}
        onTouchEnd={handleTouchEnd}
        className="glossary-study-card mx-auto flex aspect-[3/5] w-full max-w-[22.5rem] flex-col overflow-hidden rounded-[2rem] border border-sky-100 bg-white/90 px-5 py-5 shadow-[0_24px_70px_rgba(103,132,162,0.18)] backdrop-blur-xl"
        aria-label={isBackSide ? 'カード表面を表示' : 'カード裏面を表示'}
        aria-live="polite"
      >
        {!isBackSide && isCandidate ? (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center rounded-[1.65rem] border border-sky-100 bg-sky-50/40 p-3 shadow-inner">
            <CandidatePhoto entry={entry} size="hero" />
          </div>
        ) : (
          <div className="mt-5 flex min-h-0 flex-1 flex-col">
            <div className="h-1 shrink-0 rounded-full bg-sky-300" />
            <div className="mt-4 flex shrink-0 items-center justify-between gap-3">
              <p className="text-[0.68rem] font-black uppercase tracking-[0.24em] text-slate-500">Back Side</p>
              <p className="rounded-full border border-sky-100 bg-sky-50/80 px-3 py-1 text-xs font-black text-slate-600">
                {count > 0 ? (index % count) + 1 : 0} / {count}
              </p>
            </div>
            <p className="shrink-0 text-center text-xs font-black text-slate-500">{categoryLabels[entry.category]}</p>

            <h2 className="mt-4 overflow-wrap-anywhere text-center font-serif text-[clamp(2rem,9vw,2.8rem)] font-black leading-[1.04] tracking-tight text-slate-950">
              {entry.label}
            </h2>
            <p className="mt-2 overflow-wrap-anywhere text-center text-sm font-black text-slate-500">{entry.reading || '読み未設定'}</p>

            <div className="mt-4 grid grid-cols-2 gap-2">
              {cardChips(entry).map((chip) => (
                <span
                  key={chip}
                  className="flex min-h-10 items-center justify-center rounded-full border border-sky-100 bg-sky-50/70 px-2 text-center text-xs font-black leading-tight text-slate-800 shadow-sm"
                >
                  {chip}
                </span>
              ))}
            </div>

            <div className="mt-auto rounded-[1.4rem] border border-sky-100 bg-slate-50/70 p-4">
              <p className="text-xs font-black text-slate-500">カード裏メモ</p>
              <p className="mt-2 text-center text-sm font-black leading-6 text-slate-950">{backMemo(entry)}</p>
            </div>
          </div>
        )}
      </article>
      <div className="mx-auto grid w-full max-w-[22.5rem] grid-cols-[1fr_auto_1fr] items-center gap-3">
          <button type="button" onClick={onPrevious} className="min-h-12 rounded-2xl bg-white/80 text-sm font-black text-slate-700 shadow-sm">
            前へ
          </button>
          <button
            type="button"
            onClick={flipCard}
            className="min-h-12 rounded-2xl bg-white/80 px-4 text-xs font-black text-slate-700 shadow-sm"
          >
            {isBackSide ? '表' : '裏'}
          </button>
          <button type="button" onClick={onNext} className="min-h-12 rounded-2xl bg-slate-950 text-sm font-black text-white shadow-sm">
            次へ
          </button>
      </div>
    </section>
  );
}

function CandidatePhoto({ entry, size = 'study' }: { entry: GlossaryEntry; size?: 'compact' | 'study' | 'hero' | 'back' }) {
  const photo = publicGlossaryPhoto(entry.photoUrl);
  const frameClass =
    size === 'compact'
      ? 'h-16 w-12 shrink-0 rounded-2xl p-1'
      : size === 'hero'
        ? 'h-full w-full rounded-[1.5rem] p-1.5'
        : size === 'back'
          ? 'mx-auto mt-4 aspect-[3/4] w-[38%] min-w-28 max-w-36 rounded-[1.45rem] p-1.5'
          : 'mx-auto mt-5 aspect-[3/4] w-[42%] min-w-32 max-w-40 rounded-[1.65rem] p-1.5';
  const innerClass = size === 'compact' ? 'rounded-[0.85rem]' : size === 'hero' ? 'rounded-[1.15rem]' : 'rounded-[1.35rem]';
  const imageClass = size === 'hero' ? 'h-full w-full object-contain' : 'h-full w-full object-cover';

  return (
    <div className={`flex items-center justify-center border border-sky-100 bg-slate-200 shadow-sm ${frameClass}`}>
      <div className={`flex h-full w-full overflow-hidden border border-white/70 bg-slate-200 ${innerClass}`}>
        {photo ? (
          <img src={photo} alt={`${entry.label}の顔写真`} className={imageClass} loading="lazy" decoding="async" />
        ) : (
          <div className="grid h-full w-full place-items-center bg-gradient-to-br from-slate-100 via-sky-50 to-slate-200 text-center text-[0.58rem] font-black uppercase tracking-[0.12em] text-slate-400">
            No Photo
          </div>
        )}
      </div>
    </div>
  );
}

function publicGlossaryPhoto(photoUrl?: string): string | undefined {
  if (!photoUrl) return undefined;
  if (!photoUrl.startsWith('/data/') && !photoUrl.startsWith('data/')) return undefined;
  return publicPath(photoUrl);
}

function cardChips(entry: GlossaryEntry) {
  const chips = [
    entry.districtLabel || categoryLabels[entry.category],
    entry.partyLabel || '確認中',
    entry.statusLabel || '確認中',
    entry.seatType || '区分未',
    entry.age ? `${entry.age}歳` : '年齢未',
  ];

  return chips.map((chip) => fitChip(chip));
}

function fitChip(value: string) {
  return value.length > 8 ? `${value.slice(0, 7)}…` : value;
}

function backMemo(entry: GlossaryEntry) {
  if (entry.wins || entry.seatType) {
    return `当選回数 ${entry.wins || '-'}回 / ${entry.seatType || '区分確認中'}`;
  }
  return entry.description || 'CSV確認後に詳細を追加します。';
}

function GlossaryMeta({ entry }: { entry: GlossaryEntry }) {
  const meta = [entry.partyLabel, entry.districtLabel, entry.statusLabel, entry.seatType].filter(Boolean);

  return (
    <div className="mt-5 flex flex-wrap gap-2">
      {meta.map((value) => (
        <span key={value} className="glass-chip text-slate-600">
          {value}
        </span>
      ))}
      {(entry.electionIds ?? []).map((id) => (
        <span key={id} className="glass-chip text-slate-600">
          {id}
        </span>
      ))}
      {(entry.relatedIds ?? []).slice(0, 3).map((id) => (
        <span key={id} className="glass-chip text-slate-500">
          関連 {id}
        </span>
      ))}
    </div>
  );
}

function GlossaryStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-white/70 bg-white/65 p-3 shadow-sm backdrop-blur-xl sm:rounded-3xl sm:p-4">
      <p className="text-[0.68rem] font-bold text-slate-500 sm:text-xs">{label}</p>
      <p className="mt-1 text-xl font-black text-slate-950 sm:mt-2 sm:text-2xl">{value}</p>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 min-h-12 w-full rounded-2xl border border-white/70 bg-white/75 px-3 text-sm font-bold text-slate-700 shadow-sm outline-none backdrop-blur-xl focus:ring-4 focus:ring-sky-100"
      >
        {children}
      </select>
    </label>
  );
}

type DistrictOption = {
  key: string;
  label: string;
  count: number;
  disabled?: boolean;
};

function DistrictScroller({
  districts,
  seatScope,
  selectedKey,
  onSelect,
}: {
  districts: DistrictOption[];
  seatScope: SeatScopeFilter;
  selectedKey: string;
  onSelect: (value: string) => void;
}) {
  const areaLabel = seatScope === 'proportional' ? 'blocks' : 'areas';

  return (
    <div className="min-w-0">
      <div className="flex items-end justify-between gap-3">
        <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">選挙区</span>
        <span className="text-[0.68rem] font-black text-slate-400">
          {districts.length - 1} {areaLabel}
        </span>
      </div>
      <div className="mt-2 overflow-x-auto rounded-3xl border border-white/70 bg-white/50 p-2 shadow-inner backdrop-blur-xl [scrollbar-width:thin] [scrollbar-color:rgba(148,163,184,.55)_transparent]">
        <div className="flex min-w-max gap-2">
          {districts.map((district) => {
            const isSelected = selectedKey === district.key;
            return (
              <button
                key={district.key}
                type="button"
                disabled={district.disabled}
                onClick={() => onSelect(district.key)}
                className={[
                  'flex min-h-12 min-w-20 flex-col items-center justify-center rounded-2xl border px-3 text-xs font-black transition',
                  isSelected
                    ? 'border-slate-950 bg-slate-950 text-white shadow-[0_14px_34px_rgba(15,23,42,0.22)]'
                    : 'border-sky-100 bg-white/75 text-slate-700 shadow-sm',
                  district.disabled ? 'cursor-not-allowed opacity-35 grayscale' : 'hover:-translate-y-0.5 hover:border-sky-200 hover:bg-sky-50',
                ].join(' ')}
              >
                <span>{district.label}</span>
                <span className={isSelected ? 'text-white/70' : 'text-slate-400'}>{district.count}名</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function normalizeText(value?: string): string {
  return (value ?? '').toLocaleLowerCase('ja-JP').replace(/\s+/g, '');
}

function parseDistrictLabel(label?: string): { prefecture: string; number?: number; isProportional: boolean } | undefined {
  if (!label) return undefined;
  const normalized = label.trim();
  if (!normalized) return undefined;
  if (normalized.startsWith('比')) {
    return { prefecture: normalized.replace(/^比/, ''), isProportional: true };
  }
  const match = normalized.match(/^(.+?)(\d+)区$/);
  if (!match) return { prefecture: normalized, isProportional: false };
  return { prefecture: match[1], number: Number(match[2]), isProportional: false };
}

function districtOptionKey(parsed?: { prefecture: string; number?: number; isProportional: boolean }): string {
  if (!parsed) return '';
  if (parsed.isProportional) return `proportional:${parsed.prefecture}`;
  if (parsed.number) return `${parsed.prefecture}:${parsed.number}`;
  return parsed.prefecture;
}

function buildDistrictOptions(entries: GlossaryEntry[], prefecture: string, seatScope: SeatScopeFilter): DistrictOption[] {
  if (prefecture === allPrefecturesValue) {
    const scopedEntries = entries.filter((entry) => {
      const parsed = parseDistrictLabel(entry.districtLabel);
      if (seatScope === 'single') return !parsed?.isProportional;
      if (seatScope === 'proportional') return Boolean(parsed?.isProportional);
      if (seatScope === 'female') return isFemaleCandidate(entry);
      if (seatScope === 'freshman') return isFreshmanCandidate(entry);
      return true;
    });
    const options: DistrictOption[] = [{ key: allDistrictsValue, label: 'すべて', count: scopedEntries.length }];
    if (seatScope === 'proportional') {
      const blockCounts = new Map<string, number>();
      for (const entry of scopedEntries) {
        const parsed = parseDistrictLabel(entry.districtLabel);
        if (!parsed?.prefecture) continue;
        const key = districtOptionKey(parsed);
        blockCounts.set(key, (blockCounts.get(key) ?? 0) + 1);
      }
      for (const [key, count] of [...blockCounts.entries()].sort((a, b) => a[0].localeCompare(b[0], 'ja-JP'))) {
        const blockName = key.replace(/^proportional:/, '');
        options.push({ key, label: `比${blockName}`, count, disabled: count === 0 });
      }
    }
    return options;
  }

  const counts = new Map<string, number>();
  let proportionalCount = 0;
  for (const entry of entries) {
    if (seatScope === 'female' && !isFemaleCandidate(entry)) continue;
    if (seatScope === 'freshman' && !isFreshmanCandidate(entry)) continue;
    const parsed = parseDistrictLabel(entry.districtLabel);
    if (parsed?.prefecture !== prefecture) continue;
    if (parsed.isProportional) {
      proportionalCount += 1;
      continue;
    }
    const key = districtOptionKey(parsed);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const singleTotal = [...counts.values()].reduce((sum, count) => sum + count, 0);
  const total =
    seatScope === 'single' ? singleTotal : seatScope === 'proportional' ? proportionalCount : singleTotal + proportionalCount;
  const options: DistrictOption[] = [{ key: allDistrictsValue, label: 'すべて', count: total }];

  if (seatScope !== 'single' && proportionalCount > 0) {
    options.push({
      key: `proportional:${prefecture}`,
      label: `比${prefecture}`,
      count: proportionalCount,
      disabled: proportionalCount === 0,
    });
  }

  if (seatScope !== 'proportional') {
    const maxNumber = prefecture === '東京' ? tokyoDistrictCount : Math.max(0, ...[...counts.keys()].map((key) => Number(key.split(':')[1] ?? 0)));
    for (let number = 1; number <= maxNumber; number += 1) {
      const key = `${prefecture}:${number}`;
      const count = counts.get(key) ?? 0;
      options.push({ key, label: `${prefecture}${number}区`, count, disabled: count === 0 });
    }
  }

  return options;
}

function isFemaleCandidate(entry: GlossaryEntry): boolean {
  return femaleCandidateIds.has(entry.id);
}

function isFreshmanCandidate(entry: GlossaryEntry): boolean {
  return entry.wins === '1' || entry.statusLabel === '新人';
}

function compareLocationNames(a: string, b: string): number {
  const prefectureA = japanesePrefectures.indexOf(a);
  const prefectureB = japanesePrefectures.indexOf(b);
  if (prefectureA >= 0 || prefectureB >= 0) {
    return (prefectureA >= 0 ? prefectureA : 999) - (prefectureB >= 0 ? prefectureB : 999);
  }
  const blockA = proportionalBlockOrder.indexOf(a);
  const blockB = proportionalBlockOrder.indexOf(b);
  if (blockA >= 0 || blockB >= 0) {
    return (blockA >= 0 ? blockA : 999) - (blockB >= 0 ? blockB : 999);
  }
  return a.localeCompare(b, 'ja-JP');
}

function sortGlossaryEntries(entries: GlossaryEntry[], selectedPrefecture: string): GlossaryEntry[] {
  return [...entries].sort((a, b) => {
    const aParsed = parseDistrictLabel(a.districtLabel);
    const bParsed = parseDistrictLabel(b.districtLabel);
    const aDistrictOrder = districtSortOrder(aParsed, selectedPrefecture);
    const bDistrictOrder = districtSortOrder(bParsed, selectedPrefecture);
    if (aDistrictOrder !== bDistrictOrder) return aDistrictOrder - bDistrictOrder;
    return a.id.localeCompare(b.id, 'ja-JP', { numeric: true });
  });
}

function districtSortOrder(
  parsed: { prefecture: string; number?: number; isProportional: boolean } | undefined,
  selectedPrefecture: string,
): number {
  if (selectedPrefecture === allPrefecturesValue) return 0;
  if (!parsed) return 9999;
  if (parsed.isProportional) return selectedPrefecture === allPrefecturesValue ? 9000 : 8000;
  return parsed.number ?? 7000;
}

function cycleCardIndex(nextIndex: number, count: number): number {
  if (count <= 0) return 0;
  return (nextIndex + count) % count;
}

function searchableEntryText(entry: GlossaryEntry): string {
  return normalizeText(
    [
      entry.label,
      entry.reading,
      entry.description,
      entry.districtLabel,
      entry.partyLabel,
      entry.statusLabel,
      entry.seatType,
    ].join(' '),
  );
}
