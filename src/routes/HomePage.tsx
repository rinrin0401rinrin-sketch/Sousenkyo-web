import { Link } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { ElectionSelector } from '../components/ElectionSelector';
import { ElectionVisualGallery } from '../components/ElectionVisualGallery';
import { EmptyState } from '../components/EmptyState';
import { ErrorScreen } from '../components/ErrorScreen';
import { LoadingScreen } from '../components/LoadingScreen';
import { Panel } from '../components/Panel';
import { PartyBadge } from '../components/PartyBadge';
import { StatCard } from '../components/StatCard';
import { specialPages } from '../data/specialPages';
import { useAsyncData } from '../hooks/useAsyncData';
import type { GlossaryEntry } from '../types/glossary';
import {
  loadActiveElection,
  loadElectionBundle,
  loadElectionsIndex,
  loadGlossaryCandidatesAndParties,
} from '../utils/dataLoader';
import { getPartySeats, getUndecidedDistrictCount } from '../utils/electionHelpers';
import { getElectionReadiness } from '../utils/electionReadiness';
import { publicPath } from '../utils/publicPath';

export function HomePage() {
  const state = useAsyncData(async () => {
    const [active, index, glossary] = await Promise.all([
      loadActiveElection(),
      loadElectionsIndex(),
      loadGlossaryCandidatesAndParties(),
    ]);
    const bundle = await loadElectionBundle(active.currentId);
    return { active, index, bundle, glossary };
  }, []);

  if (state.status === 'loading') {
    return <LoadingScreen />;
  }

  if (state.status === 'error') {
    return <ErrorScreen message={state.error.message} />;
  }

  const { active, index, bundle, glossary } = state.data;
  const partySeats = getPartySeats(bundle);
  const undecidedDistrictCount = getUndecidedDistrictCount(bundle);
  const readiness = getElectionReadiness(bundle);
  const totalSeats = bundle.summary.totalSeats;
  const heroVisual = bundle.meta.visuals?.find((visual) => visual.role === 'hero') ?? bundle.meta.visuals?.[0];
  const glossaryCandidates = glossary.candidates.filter((entry) => entry.electionIds?.includes(active.currentId));
  const glossaryParties = glossary.parties.filter((entry) => entry.electionIds?.includes(active.currentId));
  const singleMemberCandidates = glossaryCandidates.filter((entry) => entry.seatType === '小選挙区');
  const proportionalCandidates = glossaryCandidates.filter((entry) => entry.seatType === '比例');
  const photoReadyCandidates = glossaryCandidates.filter((entry) => Boolean(entry.photoUrl));
  const partyRoster = getGlossaryPartyRoster(glossaryCandidates, glossaryParties);
  const previewCandidates = getGlossaryPreviewCandidates(glossaryCandidates);
  const glossarySearchPath = `/glossary?category=candidate&election=${encodeURIComponent(active.currentId)}`;

  return (
    <AppShell>
      <div className="space-y-5 sm:space-y-7">
        <section className="glass-panel overflow-hidden p-5 sm:p-8">
          <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-stretch">
            <div className="lg:col-span-2">
              <p className="mb-3 inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                {bundle.meta.type} / {readiness.modeLabel}
              </p>
              <h1 className="whitespace-nowrap text-[clamp(3rem,6.4vw,5.9rem)] font-black leading-[0.94] tracking-tight text-slate-950 max-sm:text-[clamp(2.4rem,12vw,3.4rem)]">
                {bundle.meta.name}
              </h1>
            </div>
            <div>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
                {readiness.isCandidateRosterMode
                  ? '候補者名、政党、選挙区、比例区分をJSONで差し替えられる候補者データビューです。開票結果は公式データ確認後に反映します。'
                  : bundle.meta.description}
              </p>
              {readiness.isCandidateRosterMode ? (
                <p className="mt-3 max-w-2xl rounded-2xl border border-sky-100 bg-sky-50/70 px-4 py-3 text-sm font-bold leading-6 text-sky-900">
                  {readiness.resultNotice}
                </p>
              ) : null}
              <div className="mt-6">
                <Link
                  to={readiness.isCandidateRosterMode ? glossarySearchPath : `/elections/${active.currentId}`}
                  className="inline-flex min-h-12 items-center justify-center rounded-full bg-slate-950 px-6 text-sm font-bold text-white"
                >
                  {readiness.isCandidateRosterMode ? '候補者を探す' : '現在の選挙を見る'}
                </Link>
                {readiness.isCandidateRosterMode ? (
                  <Link
                    to={`/elections/${active.currentId}`}
                    className="ml-2 inline-flex min-h-12 items-center justify-center rounded-full border border-slate-200 bg-white/70 px-5 text-sm font-bold text-slate-700"
                  >
                    地図で見る
                  </Link>
                ) : null}
              </div>
            </div>
            <div className="grid gap-3">
              {heroVisual ? (
                <div className="relative min-h-64 overflow-hidden rounded-[1.75rem] border border-white/70 bg-white/60 shadow-sm">
                  <img src={publicPath(heroVisual.imageUrl)} alt={heroVisual.alt} className="h-full min-h-64 w-full object-cover" />
                  <div className="absolute inset-x-3 bottom-3 rounded-2xl border border-white/60 bg-white/75 p-3 shadow-sm backdrop-blur-xl">
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">{heroVisual.role}</p>
                    <p className="mt-1 text-base font-black text-slate-950">{heroVisual.title}</p>
                  </div>
                </div>
              ) : null}
              <div className="grid grid-cols-2 gap-3">
                <StatCard label="総議席" value={bundle.summary.totalSeats} />
                <StatCard label="小選挙区" value={bundle.summary.districtSeats ?? '-'} />
                <StatCard label="比例代表" value={bundle.summary.proportionalSeats ?? '-'} />
                <StatCard
                  label={readiness.isCandidateRosterMode ? '結果未反映' : '未確定選挙区'}
                  value={readiness.isCandidateRosterMode ? undecidedDistrictCount : undecidedDistrictCount}
                  detail={readiness.isCandidateRosterMode ? '区分' : '総数'}
                />
              </div>
            </div>
          </div>
        </section>

        <section className="glass-surface-rich p-5 sm:p-6">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Official Glossary</p>
              <h2 className="mt-1 text-2xl font-black text-slate-950">第51回 単語帳データ</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                PDF確認後の候補者名、政党名、選挙区、比例区分、写真を軽量JSONとして読み込みます。
              </p>
            </div>
            <Link to={glossarySearchPath} className="glass-chip text-slate-700 transition hover:bg-white/80">
              単語帳を開く
            </Link>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="候補者単語帳" value={glossaryCandidates.length} detail="第51回" />
            <StatCard label="小選挙区" value={singleMemberCandidates.length} detail="候補者カード" />
            <StatCard label="比例" value={proportionalCandidates.length} detail="候補者カード" />
            <StatCard label="顔写真" value={photoReadyCandidates.length} detail="確認済み" />
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="rounded-[1.75rem] border border-white/70 bg-white/55 p-4 shadow-sm backdrop-blur-xl">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Party Master</p>
                  <h3 className="mt-1 text-lg font-black text-slate-950">政党名マスター</h3>
                </div>
                <span className="rounded-full bg-white/70 px-3 py-1 text-xs font-black text-slate-600">
                  {partyRoster.length} parties
                </span>
              </div>
              <div className="grid gap-2">
                {partyRoster.map((party) => (
                  <div key={party.label} className="flex items-center justify-between rounded-2xl border border-white/70 bg-white/55 px-3 py-2">
                    <span className="text-sm font-black text-slate-800">{party.label}</span>
                    <span className="text-xs font-bold text-slate-500">{party.count}名</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {previewCandidates.map((candidate) => (
                <Link
                  key={candidate.id}
                  to={`/glossary?category=candidate&election=${encodeURIComponent(active.currentId)}&q=${encodeURIComponent(candidate.label)}`}
                  className="group flex gap-3 rounded-[1.5rem] border border-white/70 bg-white/55 p-3 shadow-sm backdrop-blur-xl transition hover:-translate-y-0.5 hover:bg-white/75"
                >
                  <div className="h-20 w-16 shrink-0 overflow-hidden rounded-2xl bg-slate-200">
                    {candidate.photoUrl ? (
                      <img
                        src={publicPath(candidate.photoUrl)}
                        alt={candidate.label}
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-lg font-black text-slate-400">
                        {candidate.label.slice(0, 1)}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-base font-black text-slate-950">{candidate.label}</p>
                    <p className="mt-1 truncate text-xs font-bold text-slate-500">{candidate.reading}</p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {[candidate.partyLabel, candidate.districtLabel, candidate.seatType].filter(Boolean).map((item) => (
                        <span key={item} className="rounded-full bg-white/70 px-2 py-1 text-[0.65rem] font-bold text-slate-600">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="glass-surface-rich p-5 sm:p-6">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Special Pages</p>
              <h2 className="mt-1 text-2xl font-black text-slate-950">選挙特番ページ</h2>
            </div>
            <Link to={glossarySearchPath} className="glass-chip text-slate-600 transition hover:bg-white/80">
              候補者検索
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {specialPages.map((page, index) => (
              <Link
                key={page.id}
                to={page.path}
                className="glass-card shine-sweep reveal-up overflow-hidden p-2 transition hover:-translate-y-1 hover:bg-white/75"
                style={{ animationDelay: `${index * 70}ms` }}
              >
                <div className="aspect-[16/10] overflow-hidden rounded-[1.25rem] bg-slate-100">
                  <img src={publicPath(page.imageUrl)} alt={`${page.title} UI`} className="h-full w-full object-cover" />
                </div>
                <div className="p-3">
                  <p className="text-[0.65rem] font-black uppercase tracking-[0.18em] text-slate-500">{page.eyebrow}</p>
                  <p className="mt-1 text-base font-black text-slate-950">{page.title}</p>
                  <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500">{page.subtitle}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <ElectionVisualGallery visuals={bundle.meta.visuals} featuredOnly />

        <Panel>
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold text-slate-500">選挙回次</p>
              <h2 className="text-2xl font-black text-slate-950">選挙を選択</h2>
            </div>
          </div>
          {index.elections.length > 0 ? (
            <ElectionSelector elections={index.elections} currentId={active.currentId} />
          ) : (
            <EmptyState title="選挙一覧がありません" message="elections-index.json に選挙データを追加してください。" />
          )}
        </Panel>

        <Panel>
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold text-slate-500">
                {readiness.isCandidateRosterMode ? '第51回候補者マスター' : '既存政党のみ'}
              </p>
              <h2 className="text-2xl font-black text-slate-950">
                {readiness.isCandidateRosterMode ? '政党別候補者数' : '政党別議席数'}
              </h2>
            </div>
          </div>
          {readiness.isCandidateRosterMode ? (
            <div className="space-y-3">
              {partyRoster.map((party) => (
                <div key={party.label} className="rounded-3xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-sm font-black text-slate-800">{party.label}</span>
                    <span className="text-xl font-black text-slate-950">{party.count}</span>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-sky-400"
                      style={{
                        width: glossaryCandidates.length > 0 ? `${Math.min(100, (party.count / glossaryCandidates.length) * 100)}%` : '0%',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : partySeats.length > 0 ? (
            <div className="space-y-3">
              {partySeats.map(({ partyId, seats, party }) => (
                <div key={partyId} className="rounded-3xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between gap-4">
                    <PartyBadge party={party} />
                    <span className="text-xl font-black text-slate-950">{seats}</span>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: totalSeats > 0 ? `${Math.min(100, (seats / totalSeats) * 100)}%` : '0%',
                        backgroundColor: party?.color ?? '#94a3b8',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="議席データは未反映です" message="公式結果CSV/Excelを確認後、summary.json の partySeats を反映します。" />
          )}
        </Panel>
      </div>
    </AppShell>
  );
}

function getGlossaryPartyRoster(candidates: GlossaryEntry[], parties: GlossaryEntry[]) {
  const counts = new Map<string, number>();
  for (const candidate of candidates) {
    if (!candidate.partyLabel) continue;
    counts.set(candidate.partyLabel, (counts.get(candidate.partyLabel) ?? 0) + 1);
  }

  return parties
    .map((party) => ({ label: party.label, count: counts.get(party.label) ?? 0 }))
    .filter((party) => party.count > 0)
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label, 'ja'));
}

function getGlossaryPreviewCandidates(candidates: GlossaryEntry[]) {
  return candidates
    .filter((candidate) => candidate.reviewStatus === 'ok' && candidate.photoUrl)
    .sort((left, right) => left.label.localeCompare(right.label, 'ja') || left.id.localeCompare(right.id))
    .slice(0, 4);
}
