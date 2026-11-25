import { AlertTriangle, CheckCircle2, HelpCircle, XCircle } from 'lucide-react';

const STAT_CARDS = [
  {
    key: 'passed',
    label: 'Passed',
    icon: CheckCircle2,
    border: 'border-green-200',
    iconBg: 'bg-green-50 text-green-700',
    countColor: 'text-green-800',
  },
  {
    key: 'warning',
    label: 'Warnings',
    icon: AlertTriangle,
    border: 'border-amber-200',
    iconBg: 'bg-amber-50 text-amber-700',
    countColor: 'text-amber-800',
  },
  {
    key: 'failed',
    label: 'Failed',
    icon: XCircle,
    border: 'border-red-200',
    iconBg: 'bg-red-50 text-red-700',
    countColor: 'text-red-800',
  },
  {
    key: 'notTested',
    label: 'Not Tested',
    icon: HelpCircle,
    border: 'border-slate-200',
    iconBg: 'bg-slate-100 text-slate-700',
    countColor: 'text-slate-800',
  },
];

export default function StatusSummary({ summary }) {
  const counts = {
    passed: summary?.passed ?? 0,
    warning: summary?.warning ?? 0,
    failed: summary?.failed ?? 0,
    notTested: summary?.notTested ?? 0,
  };

  return (
    <section aria-label="Check status summary" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {STAT_CARDS.map(({ key, label, icon: Icon, border, iconBg, countColor }) => (
        <div
          key={key}
          className={`flex items-center gap-3 rounded-xl border bg-white p-4 shadow-2xs ${border}`}
        >
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${iconBg}`}
          >
            <Icon className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className={`text-2xl font-bold leading-none ${countColor}`}>{counts[key]}</p>
            <p className="mt-1 truncate text-xs font-medium text-slate-600">{label}</p>
          </div>
        </div>
      ))}
    </section>
  );
}
