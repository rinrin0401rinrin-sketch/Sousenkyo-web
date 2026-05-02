import { Link } from 'react-router-dom';
import type { Member, Party, Prefecture } from '../types/election';
import { PartyBadge } from './PartyBadge';

type MemberCardProps = {
  electionId: string;
  member: Member;
  party?: Party;
  prefecture?: Prefecture;
};

export function MemberCard({ electionId, member, party, prefecture }: MemberCardProps) {
  return (
    <Link
      to={`/elections/${electionId}/members/${member.id}`}
      className="flex gap-4 rounded-3xl border border-slate-200 bg-white p-4 transition hover:border-slate-300"
    >
      <img
        src={member.photoUrl}
        alt={`${member.name}の顔写真`}
        className="h-16 w-16 shrink-0 rounded-2xl bg-slate-100 object-cover"
      />
      <div className="min-w-0">
        <p className="truncate text-lg font-bold text-slate-950">{member.name}</p>
        <div className="mt-2">
          <PartyBadge party={party} />
        </div>
        <p className="mt-2 text-sm text-slate-600">{prefecture?.name ?? '都道府県未設定'}</p>
      </div>
    </Link>
  );
}
