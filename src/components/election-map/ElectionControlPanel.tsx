import type { ChangeEvent, ReactNode } from 'react';
import type { ElectionBundle, ResultStatus } from '../../types/election';
import type { ElectionFilters, MapMode } from '../../utils/resultFilters';
import { statusLabels } from './statusLabels';

type ElectionControlPanelProps = {
  bundle: ElectionBundle;
  filters: ElectionFilters;
  onChange: (filters: ElectionFilters) => void;
};

const mapModes: Array<{ id: MapMode; label: string }> = [
  { id: 'single', label: '小選挙区' },
  { id: 'proportional', label: '比例区' },
  { id: 'both', label: '両方' },
];

const statusOptions: Array<{ id: 'all' | ResultStatus; label: string }> = [
  { id: 'all', label: 'すべて' },
  { id: 'elected', label: statusLabels.elected },
  { id: 'proportionalRevival', label: statusLabels.proportionalRevival },
  { id: 'runnerUp', label: statusLabels.runnerUp },
  { id: 'counting', label: statusLabels.counting },
  { id: 'pending', label: statusLabels.pending },
];

export function ElectionControlPanel({ bundle, filters, onChange }: ElectionControlPanelProps) {
  const update = (patch: Partial<ElectionFilters>) => onChange({ ...filters, ...patch });
  const handleSelect =
    (key: keyof ElectionFilters) =>
    (event: ChangeEvent<HTMLSelectElement>): void => {
      update({ [key]: event.target.value } as Partial<ElectionFilters>);
    };

  return (
    <aside className="glass-panel space-y-5 p-4 sm:p-5">
      <section>
        <p className="text-xs font-bold text-slate-500">表示レイヤー</p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {mapModes.map((mode) => (
            <button
              key={mode.id}
              type="button"
              onClick={() => update({ mapMode: mode.id })}
              className={`min-h-11 rounded-2xl px-3 text-sm font-bold transition ${
                filters.mapMode === mode.id
                  ? 'bg-slate-950 text-white shadow-[0_0_24px_rgba(14,165,233,0.28)]'
                  : 'bg-white/55 text-slate-600 hover:bg-white/80'
              }`}
            >
              {mode.label}
            </button>
          ))}
        </div>
      </section>

      <section className="grid gap-3">
        <FilterSelect label="都道府県" value={filters.prefectureId} onChange={handleSelect('prefectureId')}>
          <option value="all">すべて</option>
          {bundle.prefectures.map((prefecture) => (
            <option key={prefecture.id} value={prefecture.id}>
              {prefecture.name}
            </option>
          ))}
        </FilterSelect>

        <FilterSelect label="政党" value={filters.partyId} onChange={handleSelect('partyId')}>
          <option value="all">すべて</option>
          {bundle.parties.map((party) => (
            <option key={party.id} value={party.id}>
              {party.name}
            </option>
          ))}
        </FilterSelect>

        <FilterSelect label="開票状況" value={filters.status} onChange={handleSelect('status')}>
          {statusOptions.map((status) => (
            <option key={status.id} value={status.id}>
              {status.label}
            </option>
          ))}
        </FilterSelect>
      </section>

      <section>
        <p className="text-xs font-bold text-slate-500">政党凡例</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {bundle.parties.map((party) => (
            <span key={party.id} className="glass-chip text-slate-700">
              <span className="mr-2 h-2.5 w-2.5 rounded-full" style={{ backgroundColor: party.color }} />
              {party.shortName ?? party.name}
            </span>
          ))}
        </div>
      </section>
    </aside>
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
  onChange: (event: ChangeEvent<HTMLSelectElement>) => void;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-xs font-bold text-slate-500">{label}</span>
      <select
        value={value}
        onChange={onChange}
        className="mt-1 min-h-11 w-full rounded-2xl border border-white/70 bg-white/70 px-3 text-sm font-bold text-slate-700 shadow-sm outline-none backdrop-blur-xl focus:ring-4 focus:ring-sky-100"
      >
        {children}
      </select>
    </label>
  );
}
