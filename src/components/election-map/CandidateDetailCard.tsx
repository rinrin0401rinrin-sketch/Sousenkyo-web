import type { Party } from '../../types/election';
import type { ElectionMapItem } from '../../utils/resultFilters';
import { PartyBadge } from '../PartyBadge';
import { statusLabels } from './statusLabels';

type CandidateDetailCardProps = {
  item?: ElectionMapItem;
  party?: Party;
};

export function CandidateDetailCard({ item, party }: CandidateDetailCardProps) {
  if (!item) {
    return (
      <section className="glass-panel p-5">
        <p className="text-xs font-bold text-slate-500">詳細</p>
        <h3 className="mt-2 text-xl font-black text-slate-950">ドットを選択</h3>
        <p className="mt-2 text-sm leading-6 text-slate-600">地図上のドットをタップすると、候補者や比例ブロックの詳細が表示されます。</p>
      </section>
    );
  }

  const isSingle = item.layer === 'single';

  return (
    <section className="glass-panel p-5">
      <div className="flex items-start gap-4">
        {isSingle ? (
          <img
            src={item.photoUrl}
            alt={`${item.label}の顔写真`}
            className="h-16 w-16 rounded-2xl border border-white/70 bg-white/70 object-cover shadow-sm"
          />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/70 bg-white/70 text-xl font-black text-slate-400 shadow-sm">
            PR
          </div>
        )}
        <div className="min-w-0">
          <p className="text-xs font-bold text-slate-500">{isSingle ? item.subLabel : '比例代表'}</p>
          <h3 className="truncate text-2xl font-black text-slate-950">{item.label}</h3>
          <div className="mt-2">
            <PartyBadge party={party} />
          </div>
        </div>
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-3">
        <Metric label="状態" value={statusLabels[item.status]} />
        <Metric label={isSingle ? '得票率' : '得票率'} value={`${item.voteRate}%`} />
        <Metric label={isSingle ? '得票数' : '議席数'} value={isSingle ? item.votes.toLocaleString() : `${item.seats}議席`} />
        <Metric label="投票率" value={item.turnout ? `${item.turnout}%` : '-'} />
      </dl>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/70 bg-white/55 p-3 shadow-sm backdrop-blur-xl">
      <dt className="text-[11px] font-bold text-slate-500">{label}</dt>
      <dd className="mt-1 text-base font-black text-slate-950">{value}</dd>
    </div>
  );
}
