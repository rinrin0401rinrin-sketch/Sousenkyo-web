type StatCardProps = {
  label: string;
  value: string | number;
  detail?: string;
};

export function StatCard({ label, value, detail }: StatCardProps) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-bold text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-black tracking-tight text-slate-950">{value}</p>
      {detail ? <p className="mt-1 text-xs font-medium text-slate-500">{detail}</p> : null}
    </div>
  );
}
