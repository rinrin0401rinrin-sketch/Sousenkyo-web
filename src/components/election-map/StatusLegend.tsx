import { statusLabels } from './statusLabels';

export function StatusLegend() {
  const items = [
    { id: 'elected', label: statusLabels.elected, className: 'bg-sky-500 shadow-[0_0_18px_rgba(14,165,233,0.7)]' },
    { id: 'proportionalRevival', label: statusLabels.proportionalRevival, className: 'border-2 border-sky-500 bg-white' },
    { id: 'runnerUp', label: statusLabels.runnerUp, className: 'border border-slate-300 bg-slate-100' },
    { id: 'counting', label: statusLabels.counting, className: 'animate-pulse border-2 border-slate-400 bg-white' },
  ];

  return (
    <div className="glass-panel flex flex-wrap justify-center gap-3 p-3">
      {items.map((item) => (
        <span key={item.id} className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-bold text-slate-600">
          <span className={`h-4 w-4 rounded-full ${item.className}`} />
          {item.label}
        </span>
      ))}
    </div>
  );
}
