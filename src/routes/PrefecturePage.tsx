import { Link, useParams } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { EmptyState } from '../components/EmptyState';
import { ErrorScreen } from '../components/ErrorScreen';
import { LoadingScreen } from '../components/LoadingScreen';
import { Panel } from '../components/Panel';
import { PartyBadge } from '../components/PartyBadge';
import { useAsyncData } from '../hooks/useAsyncData';
import { loadElectionBundle } from '../utils/dataLoader';
import { districtsForPrefecture, findMember, findParty, findPrefecture } from '../utils/electionHelpers';

export function PrefecturePage() {
  const { electionId, prefectureId } = useParams();
  const state = useAsyncData(() => loadElectionBundle(electionId ?? ''), [electionId]);

  if (!electionId || !prefectureId) {
    return <ErrorScreen title="URLが不完全です" message="選挙IDまたは都道府県IDがありません。" />;
  }

  if (state.status === 'loading') {
    return <LoadingScreen />;
  }

  if (state.status === 'error') {
    return <ErrorScreen message={state.error.message} />;
  }

  const bundle = state.data;
  const prefecture = findPrefecture(bundle.prefectures, prefectureId);
  const districts = districtsForPrefecture(bundle.districts, prefectureId);

  if (!prefecture) {
    return <ErrorScreen title="都道府県が見つかりません" message={`${prefectureId} のデータがありません。`} />;
  }

  return (
    <AppShell>
      <div className="space-y-5 sm:space-y-7">
        <Panel>
          <Link to={`/elections/${electionId}`} className="text-sm font-bold text-sky-700">
            選挙詳細へ戻る
          </Link>
          <h1 className="mt-3 text-4xl font-black text-slate-950">{prefecture.name}</h1>
          <p className="mt-2 text-sm text-slate-600">{bundle.meta.name} / 小選挙区一覧</p>
        </Panel>

        <Panel>
          <h2 className="text-2xl font-black text-slate-950">小選挙区と当選者</h2>
          <div className="mt-4 grid gap-3">
            {districts.length > 0 ? (
              districts.map((district) => {
                const winner = findMember(bundle.members, district.winnerMemberId);
                const party = winner ? findParty(bundle.parties, winner.partyId) : undefined;
                return (
                  <div key={district.id} className="rounded-3xl border border-slate-200 bg-white p-4">
                    <p className="text-lg font-black text-slate-950">{district.name}</p>
                    {winner ? (
                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        <Link
                          to={`/elections/${electionId}/members/${winner.id}`}
                          className="font-bold text-slate-800 underline-offset-4 hover:underline"
                        >
                          {winner.name}
                        </Link>
                        <PartyBadge party={party} />
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-slate-500">当選者データ未取得</p>
                    )}
                  </div>
                );
              })
            ) : (
              <EmptyState title="小選挙区データがありません" message="districts.json を確認してください。" />
            )}
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}
