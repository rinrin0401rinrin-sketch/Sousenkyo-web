import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { CandidateDetailCard } from '../components/election-map/CandidateDetailCard';
import { ElectionControlPanel } from '../components/election-map/ElectionControlPanel';
import { JapanElectionDotMap } from '../components/election-map/JapanElectionDotMap';
import { StatusLegend } from '../components/election-map/StatusLegend';
import { ElectionVisualGallery } from '../components/ElectionVisualGallery';
import { EmptyState } from '../components/EmptyState';
import { ErrorScreen } from '../components/ErrorScreen';
import { LoadingScreen } from '../components/LoadingScreen';
import { MemberCard } from '../components/MemberCard';
import { Panel } from '../components/Panel';
import { StatCard } from '../components/StatCard';
import { useAsyncData } from '../hooks/useAsyncData';
import type { ElectionBundle, ElectionIndexItem } from '../types/election';
import { loadElectionBundle, loadElectionsIndex } from '../utils/dataLoader';
import { findParty, findPrefecture } from '../utils/electionHelpers';
import {
  buildMapItems,
  defaultElectionFilters,
  filterMapItems,
  type ElectionMapItem,
} from '../utils/resultFilters';

export function ElectionDetailPage() {
  const { electionId } = useParams();
  const state = useAsyncData(async () => {
    const electionsIndex = await loadElectionsIndex();
    const election = electionsIndex.elections.find((item) => item.id === electionId);

    if (election?.isDataReady === false) {
      return { election, bundle: undefined };
    }

    return { election, bundle: await loadElectionBundle(electionId ?? '') };
  }, [electionId]);

  if (!electionId) {
    return <ErrorScreen title="選挙IDがありません" message="URLを確認してください。" />;
  }

  if (state.status === 'loading') {
    return <LoadingScreen />;
  }

  if (state.status === 'error') {
    return <ErrorScreen message={state.error.message} />;
  }

  if (!state.data.bundle) {
    return <ElectionPreparingPage election={state.data.election} />;
  }

  return <ElectionDetailContent bundle={state.data.bundle} electionId={electionId} />;
}

function ElectionPreparingPage({ election }: { election?: ElectionIndexItem }) {
  return (
    <AppShell>
      <Panel>
        <Link to="/" className="text-sm font-bold text-sky-700">
          トップへ戻る
        </Link>
        <p className="mt-5 text-xs font-bold text-slate-500">データ準備中</p>
        <h1 className="mt-2 text-4xl font-black text-slate-950">{election?.name ?? '選挙データ'}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
          この選挙回次は一覧に登録されていますが、詳細JSONはまだ公開前です。データが用意できたら
          elections-index.json の isDataReady を true にして、該当フォルダへJSONを追加してください。
        </p>
      </Panel>
    </AppShell>
  );
}

function ElectionDetailContent({ bundle, electionId }: { bundle: ElectionBundle; electionId: string }) {
  const [filters, setFilters] = useState(defaultElectionFilters);
  const [selectedItem, setSelectedItem] = useState<ElectionMapItem | undefined>(undefined);
  const mapItems = useMemo(() => buildMapItems(bundle), [bundle]);
  const filteredMapItems = useMemo(() => filterMapItems(mapItems, filters), [mapItems, filters]);
  const selectedMapItem = selectedItem && filteredMapItems.some((item) => item.id === selectedItem.id)
    ? selectedItem
    : filteredMapItems[0];
  const filteredMembers = useMemo(() => {
    return bundle.members.filter((member) => {
      if (filters.partyId !== 'all' && member.partyId !== filters.partyId) return false;
      if (filters.prefectureId !== 'all' && member.prefectureId !== filters.prefectureId) return false;
      if (filters.status !== 'all' && member.status !== filters.status) return false;
      if (filters.mapMode === 'single') return Boolean(member.districtId);
      if (filters.mapMode === 'proportional') return Boolean(member.proportionalBlockId);
      return true;
    });
  }, [bundle.members, filters]);

  return (
    <AppShell>
      <div className="space-y-5 sm:space-y-7">
        <section className="overflow-hidden rounded-[2.4rem] border border-white/70 bg-white/50 p-5 shadow-panel backdrop-blur-2xl ring-1 ring-white/40 sm:p-7">
          <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
            <div>
              <p className="glass-chip text-slate-600">{bundle.meta.shortName ?? bundle.meta.type}</p>
              <h1 className="mt-4 text-4xl font-black tracking-tight text-slate-950 sm:text-6xl">{bundle.meta.name}</h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
                小選挙区と比例区を政党カラーの発光ドットで重ね、JSON差し替えで長期運用できる選挙結果マップです。
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <span className="glass-chip text-slate-600">開票率 {bundle.summary.reportingRate ?? 0}%</span>
                <span className="glass-chip text-slate-600">更新 {formatUpdatedAt(bundle.summary.updatedAt)}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="総議席" value={bundle.summary.totalSeats} />
              <StatCard label="小選挙区" value={bundle.results.singleMemberDistricts.length} detail="表示データ" />
              <StatCard label="比例区" value={bundle.results.proportionalSeats.length} detail="表示データ" />
              <StatCard label="表示中" value={filteredMapItems.length} detail="フィルター後" />
            </div>
          </div>
        </section>

        <div className="grid gap-5 xl:grid-cols-[18rem_minmax(0,1fr)_20rem]">
          <ElectionControlPanel bundle={bundle} filters={filters} onChange={setFilters} />

          <section className="space-y-4">
            {filteredMapItems.length > 0 ? (
              <JapanElectionDotMap
                items={filteredMapItems}
                parties={bundle.parties}
                selectedItemId={selectedMapItem?.id}
                onSelect={setSelectedItem}
              />
            ) : (
              <EmptyState title="表示できる結果がありません" message="フィルター条件を変更するか、results系JSONを確認してください。" />
            )}
            <StatusLegend />
          </section>

          <CandidateDetailCard
            item={selectedMapItem}
            party={selectedMapItem ? findParty(bundle.parties, selectedMapItem.partyId) : undefined}
          />
        </div>

        <ElectionVisualGallery visuals={bundle.meta.visuals} />

        <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <Panel>
            <h2 className="text-2xl font-black text-slate-950">都道府県リンク</h2>
            {bundle.prefectures.length > 0 ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {bundle.prefectures.map((prefecture) => (
                  <Link
                    key={prefecture.id}
                    to={`/elections/${electionId}/prefectures/${prefecture.id}`}
                    className="glass-card p-4 transition hover:-translate-y-0.5 hover:bg-white/70"
                  >
                    <p className="text-lg font-black text-slate-950">{prefecture.name}</p>
                    <p className="mt-1 text-sm text-slate-500">{prefecture.region ?? '地域未設定'}</p>
                    <p className="mt-4 text-xs font-bold text-slate-500">小選挙区 {prefecture.districtCount ?? 0}</p>
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyState title="都道府県データがありません" message="prefectures.json を確認してください。" />
            )}
          </Panel>

          <Panel>
            <h2 className="text-2xl font-black text-slate-950">議員一覧</h2>
            {filteredMembers.length > 0 ? (
              <div className="mt-4 grid gap-3">
                {filteredMembers.map((member) => (
                  <MemberCard
                    key={member.id}
                    electionId={electionId}
                    member={member}
                    party={findParty(bundle.parties, member.partyId)}
                    prefecture={findPrefecture(bundle.prefectures, member.prefectureId)}
                  />
                ))}
              </div>
            ) : (
              <EmptyState title="議員データがありません" message="members.json を追加するか、フィルター条件を変更してください。" />
            )}
          </Panel>
        </div>
      </div>
    </AppShell>
  );
}

function formatUpdatedAt(updatedAt?: string): string {
  if (!updatedAt) return '未取得';

  const date = new Date(updatedAt);
  if (Number.isNaN(date.getTime())) return updatedAt;

  return new Intl.DateTimeFormat('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}
