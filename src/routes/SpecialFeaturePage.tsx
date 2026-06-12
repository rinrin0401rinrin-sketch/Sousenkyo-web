import { Link } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { EmptyState } from '../components/EmptyState';
import { ErrorScreen } from '../components/ErrorScreen';
import { LoadingScreen } from '../components/LoadingScreen';
import { StatCard } from '../components/StatCard';
import { getSpecialPage, type SpecialPageId } from '../data/specialPages';
import { useAsyncData } from '../hooks/useAsyncData';
import { loadActiveElection, loadElectionBundle, loadElectionsIndex } from '../utils/dataLoader';
import { getUndecidedDistrictCount } from '../utils/electionHelpers';
import { getElectionReadiness } from '../utils/electionReadiness';
import { getBundleCaucusCandidateCounts, getCaucusSeatCounts, type CaucusCount } from '../utils/caucusGroups';
import { publicPath } from '../utils/publicPath';

type SpecialFeaturePageProps = {
  pageId: SpecialPageId;
};

export function SpecialFeaturePage({ pageId }: SpecialFeaturePageProps) {
  const page = getSpecialPage(pageId);
  const state = useAsyncData(async () => {
    const [active, index] = await Promise.all([loadActiveElection(), loadElectionsIndex()]);
    const bundle = await loadElectionBundle(active.currentId);
    return { active, index, bundle };
  }, []);

  if (state.status === 'loading') return <LoadingScreen />;
  if (state.status === 'error') return <ErrorScreen message={state.error.message} />;

  const { active, index, bundle } = state.data;
  const caucusSeats = getCaucusSeatCounts(bundle.summary.partySeats, bundle.parties);
  const caucusCandidateCounts = getBundleCaucusCandidateCounts(bundle.members, bundle.parties);
  const readiness = getElectionReadiness(bundle);
  const undecidedDistrictCount = getUndecidedDistrictCount(bundle);
  const proportionalBlocks = bundle.proportionalBlocks.slice(0, 11);
  const visualUrl = publicPath(page.imageUrl);

  return (
    <AppShell>
      <div className="space-y-6 sm:space-y-8">
        <section className="special-hero reveal-up overflow-hidden p-4 sm:p-6 lg:p-8">
          <div className="grid gap-6 lg:grid-cols-[0.92fr_1.08fr] lg:items-center">
            <div className="relative z-10">
              <Link to="/" className="glass-chip text-slate-600 transition hover:bg-white/80">
                トップへ戻る
              </Link>
              <p className="mt-6 text-xs font-black uppercase tracking-[0.28em] text-slate-500">{page.eyebrow}</p>
              <h1 className="mt-3 text-4xl font-black tracking-tight text-slate-950 sm:text-6xl lg:text-7xl">{page.title}</h1>
              <p className="mt-5 max-w-xl text-base leading-8 text-slate-600 sm:text-lg">{page.subtitle}</p>
              <div className="mt-6 flex flex-wrap gap-2">
                <span className="glass-chip text-slate-600">現在表示: {bundle.meta.shortName ?? bundle.meta.name}</span>
                <span className="glass-chip text-slate-600">{readiness.modeLabel}</span>
                <span className="glass-chip text-slate-600">
                  {readiness.isCandidateRosterMode ? '結果未反映' : `開票率 ${bundle.summary.reportingRate ?? 0}%`}
                </span>
                <span className="glass-chip text-slate-600">
                  {readiness.isCandidateRosterMode ? `確認区分 ${undecidedDistrictCount}` : `未確定 ${undecidedDistrictCount}`}
                </span>
              </div>
              {readiness.isCandidateRosterMode ? (
                <p className="mt-4 max-w-xl rounded-2xl border border-sky-100 bg-sky-50/75 px-4 py-3 text-sm font-bold leading-6 text-sky-900">
                  {readiness.resultNotice}
                </p>
              ) : null}
            </div>

            <div className="visual-stage float-soft">
              <img src={visualUrl} alt={`${page.title} UIモック`} className="h-full w-full object-cover" />
              <div className="visual-caption">
                <p className="text-xs font-black uppercase tracking-[0.24em] text-slate-500">UI PREVIEW</p>
                <p className="mt-1 text-lg font-black text-slate-950">{page.title}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-3">
          {page.metrics.map((metric, index) => (
            <div key={metric.label} className="reveal-up" style={{ animationDelay: `${index * 80}ms` }}>
              <StatCard label={metric.label} value={metric.value} detail={metric.detail} />
            </div>
          ))}
        </section>

        <section className="grid gap-5 lg:grid-cols-[1fr_0.9fr]">
          <div className="glass-surface-rich p-5 sm:p-6">
            <div className="mb-5 flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Feature Layout</p>
                <h2 className="mt-1 text-2xl font-black text-slate-950">ページ内セクション</h2>
              </div>
              <span className="pulse-dot-rich h-3 w-3 rounded-full" style={{ backgroundColor: page.accent }} />
            </div>
            <div className="grid gap-3">
              {page.panels.map((panel) => (
                <article key={panel.title} className="glass-card shine-sweep overflow-hidden p-4">
                  <h3 className="text-lg font-black text-slate-950">{panel.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{panel.description}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {panel.tags.map((tag) => (
                      <span key={tag} className="glass-chip text-slate-600">
                        {tag}
                      </span>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </div>

          <ContextPanel
            pageId={pageId}
            activeId={active.currentId}
            caucusSeats={caucusSeats}
            caucusCandidateCounts={caucusCandidateCounts}
            isCandidateRosterMode={readiness.isCandidateRosterMode}
            elections={index.elections}
            blocks={proportionalBlocks}
          />
        </section>
      </div>
    </AppShell>
  );
}

function ContextPanel({
  pageId,
  activeId,
  caucusSeats,
  caucusCandidateCounts,
  isCandidateRosterMode,
  elections,
  blocks,
}: {
  pageId: SpecialPageId;
  activeId: string;
  caucusSeats: CaucusCount[];
  caucusCandidateCounts: CaucusCount[];
  isCandidateRosterMode: boolean;
  elections: Awaited<ReturnType<typeof loadElectionsIndex>>['elections'];
  blocks: Awaited<ReturnType<typeof loadElectionBundle>>['proportionalBlocks'];
}) {
  if (pageId === 'archive') {
    return (
      <aside className="glass-surface-rich p-5 sm:p-6">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Election Archive</p>
        <h2 className="mt-1 text-2xl font-black text-slate-950">選挙回次</h2>
        <div className="mt-5 grid gap-3">
          {elections.map((election) => (
            <Link
              key={election.id}
              to={election.isDataReady === false ? '/archive' : `/elections/${election.id}`}
              className={`rounded-3xl border p-4 transition hover:-translate-y-0.5 ${
                election.id === activeId ? 'border-sky-200 bg-sky-50/70' : 'border-white/70 bg-white/55'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-bold text-slate-500">{election.type}</p>
                <span className="rounded-full bg-white/70 px-2 py-1 text-[0.65rem] font-black text-slate-500">
                  {election.isDataReady === false ? '準備中' : '表示可'}
                </span>
              </div>
              <p className="mt-1 text-lg font-black text-slate-950">{election.name}</p>
              <p className="mt-3 text-xs font-bold text-slate-500">
                {election.status === 'current'
                  ? isCandidateRosterMode && election.id === activeId
                    ? '候補者データ公開中'
                    : '現在表示中'
                  : election.status === 'past'
                    ? '過去選挙'
                    : '今後の選挙'}
              </p>
            </Link>
          ))}
        </div>
        <Link to="/glossary" className="mt-4 inline-flex min-h-11 items-center justify-center rounded-full bg-slate-950 px-5 text-sm font-black text-white">
          単語帳で用語を確認
        </Link>
      </aside>
    );
  }

  if (pageId === 'proportional') {
    return (
      <aside className="glass-surface-rich p-5 sm:p-6">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Blocks</p>
        <h2 className="mt-1 text-2xl font-black text-slate-950">比例ブロック</h2>
        {blocks.length > 0 ? (
          <div className="mt-5 grid grid-cols-2 gap-2">
            {blocks.map((block) => (
              <span key={block.id} className="glass-chip justify-between text-slate-700">
                {block.name}
                <b>{isCandidateRosterMode ? '未確定' : block.seats ?? '-'}</b>
              </span>
            ))}
          </div>
        ) : (
          <EmptyState title="比例ブロックがありません" message="proportional-blocks.json を確認してください。" />
        )}
      </aside>
    );
  }

  return (
    <aside className="glass-surface-rich p-5 sm:p-6">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
        {isCandidateRosterMode ? 'Caucus Roster' : 'Caucus Seats'}
      </p>
      <h2 className="mt-1 text-2xl font-black text-slate-950">
        {isCandidateRosterMode ? '会派別候補者数' : '会派別議席'}
      </h2>
      {isCandidateRosterMode ? (
        <div className="mt-5 space-y-3">
          {caucusCandidateCounts.map((caucus) => (
            <div key={caucus.id} className="rounded-3xl border border-white/70 bg-white/60 p-4">
              <div className="flex items-center justify-between gap-4">
                <span className="inline-flex min-w-0 items-center gap-2 rounded-full border border-white/70 bg-white/65 px-3 py-1 text-xs font-bold text-slate-700 shadow-sm backdrop-blur-xl">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: caucus.color }} />
                  <span className="truncate">{caucus.label}</span>
                </span>
                <span className="shrink-0 text-xl font-black text-slate-950">{caucus.count}</span>
              </div>
            </div>
          ))}
        </div>
      ) : caucusSeats.length > 0 ? (
        <div className="mt-5 space-y-3">
          {caucusSeats.map((caucus) => (
            <div key={caucus.id} className="rounded-3xl border border-white/70 bg-white/60 p-4">
              <div className="flex items-center justify-between gap-4">
                <span className="inline-flex min-w-0 items-center gap-2 rounded-full border border-white/70 bg-white/65 px-3 py-1 text-xs font-bold text-slate-700 shadow-sm backdrop-blur-xl">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: caucus.color }} />
                  <span className="truncate">{caucus.label}</span>
                </span>
                <span className="shrink-0 text-xl font-black text-slate-950">{caucus.count}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState title="会派別議席は未反映です" message="公式結果CSV/Excelを確認後、会派別の議席内訳を反映します。" />
      )}
    </aside>
  );
}
