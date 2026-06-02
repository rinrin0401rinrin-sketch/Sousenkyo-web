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
import { loadActiveElection, loadElectionBundle, loadElectionsIndex } from '../utils/dataLoader';
import { getPartySeats, getUndecidedDistrictCount } from '../utils/electionHelpers';
import { publicPath } from '../utils/publicPath';

export function HomePage() {
  const state = useAsyncData(async () => {
    const [active, index] = await Promise.all([loadActiveElection(), loadElectionsIndex()]);
    const bundle = await loadElectionBundle(active.currentId);
    return { active, index, bundle };
  }, []);

  if (state.status === 'loading') {
    return <LoadingScreen />;
  }

  if (state.status === 'error') {
    return <ErrorScreen message={state.error.message} />;
  }

  const { active, index, bundle } = state.data;
  const partySeats = getPartySeats(bundle);
  const undecidedDistrictCount = getUndecidedDistrictCount(bundle);
  const totalSeats = bundle.summary.totalSeats;
  const heroVisual = bundle.meta.visuals?.find((visual) => visual.role === 'hero') ?? bundle.meta.visuals?.[0];

  return (
    <AppShell>
      <div className="space-y-5 sm:space-y-7">
        <section className="glass-panel overflow-hidden p-5 sm:p-8">
          <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-stretch">
            <div className="lg:col-span-2">
              <p className="mb-3 inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                {bundle.meta.type} / {bundle.meta.status}
              </p>
              <h1 className="whitespace-nowrap text-[clamp(3rem,6.4vw,5.9rem)] font-black leading-[0.94] tracking-tight text-slate-950 max-sm:text-[clamp(2.4rem,12vw,3.4rem)]">
                {bundle.meta.name}
              </h1>
            </div>
            <div>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">{bundle.meta.description}</p>
              <div className="mt-6">
                <Link
                  to={`/elections/${active.currentId}`}
                  className="inline-flex min-h-12 items-center justify-center rounded-full bg-slate-950 px-6 text-sm font-bold text-white"
                >
                  現在の選挙を見る
                </Link>
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
                <StatCard label="未確定選挙区" value={undecidedDistrictCount} detail="総数" />
              </div>
            </div>
          </div>
        </section>

        <section className="glass-surface-rich p-5 sm:p-6">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Special Pages</p>
              <h2 className="mt-1 text-2xl font-black text-slate-950">選挙特番ページ</h2>
            </div>
            <Link to="/glossary" className="glass-chip text-slate-600 transition hover:bg-white/80">
              単語帳
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
              <p className="text-xs font-bold text-slate-500">既存政党のみ</p>
              <h2 className="text-2xl font-black text-slate-950">政党別議席数</h2>
            </div>
          </div>
          {partySeats.length > 0 ? (
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
            <EmptyState title="議席データがありません" message="summary.json の partySeats を確認してください。" />
          )}
        </Panel>
      </div>
    </AppShell>
  );
}
