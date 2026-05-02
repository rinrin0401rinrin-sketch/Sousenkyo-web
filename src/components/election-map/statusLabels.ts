import type { ResultStatus } from '../../types/election';

export const statusLabels: Record<ResultStatus, string> = {
  elected: '当選',
  proportionalRevival: '比例復活',
  runnerUp: '惜敗',
  counting: '開票中',
  pending: '未確定',
};

export function statusTone(status: ResultStatus): string {
  if (status === 'elected') return 'ring-white/90 shadow-[0_0_26px_rgba(59,130,246,0.45)]';
  if (status === 'proportionalRevival') return 'ring-2 ring-white shadow-[0_0_22px_rgba(14,165,233,0.42)]';
  if (status === 'runnerUp') return 'opacity-55 grayscale';
  if (status === 'counting') return 'animate-pulse ring-2 ring-slate-300';
  return 'opacity-45';
}
