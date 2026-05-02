import { Link, useParams } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { ErrorScreen } from '../components/ErrorScreen';
import { LoadingScreen } from '../components/LoadingScreen';
import { Panel } from '../components/Panel';
import { PartyBadge } from '../components/PartyBadge';
import { useAsyncData } from '../hooks/useAsyncData';
import { loadElectionBundle } from '../utils/dataLoader';
import { findMember, findParty, findPrefecture } from '../utils/electionHelpers';

export function MemberPage() {
  const { electionId, memberId } = useParams();
  const state = useAsyncData(() => loadElectionBundle(electionId ?? ''), [electionId]);

  if (!electionId || !memberId) {
    return <ErrorScreen title="URLが不完全です" message="選挙IDまたは議員IDがありません。" />;
  }

  if (state.status === 'loading') {
    return <LoadingScreen />;
  }

  if (state.status === 'error') {
    return <ErrorScreen message={state.error.message} />;
  }

  const bundle = state.data;
  const member = findMember(bundle.members, memberId);

  if (!member) {
    return <ErrorScreen title="議員が見つかりません" message={`${memberId} のデータがありません。`} />;
  }

  const party = findParty(bundle.parties, member.partyId);
  const prefecture = findPrefecture(bundle.prefectures, member.prefectureId);
  const district = bundle.districts.find((item) => item.id === member.districtId);

  return (
    <AppShell>
      <Panel>
        <Link to={`/elections/${electionId}`} className="text-sm font-bold text-sky-700">
          選挙詳細へ戻る
        </Link>
        <div className="mt-5 grid gap-6 sm:grid-cols-[12rem_1fr] sm:items-start">
          <img
            src={member.photoUrl}
            alt={`${member.name}の顔写真`}
            className="aspect-square w-full max-w-48 rounded-[2rem] bg-slate-100 object-cover"
          />
          <div>
            <div className="mb-4">
              <PartyBadge party={party} />
            </div>
            <h1 className="text-4xl font-black text-slate-950">{member.name}</h1>
            <dl className="mt-6 grid gap-3 sm:grid-cols-2">
              <Info label="政党" value={party?.name ?? '未設定'} />
              <Info label="都道府県" value={prefecture?.name ?? '未設定'} />
              <Info label="選挙区" value={district?.name ?? '未設定'} />
              <Info label="当選回数" value={`${member.wins ?? 0}回`} />
            </dl>
          </div>
        </div>
      </Panel>
    </AppShell>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4">
      <dt className="text-xs font-bold text-slate-500">{label}</dt>
      <dd className="mt-1 text-lg font-bold text-slate-950">{value}</dd>
    </div>
  );
}
