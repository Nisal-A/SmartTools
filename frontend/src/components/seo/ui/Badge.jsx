import {
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Info,
  XCircle,
} from 'lucide-react';

// Status is never shown by colour alone: every badge includes an icon + text label (ADR-016).
const VARIANT_CONFIG = {
  passed: {
    icon: CheckCircle2,
    classes: 'bg-green-50 text-green-800 ring-green-600/20',
    defaultLabel: 'Passed',
  },
  warning: {
    icon: AlertTriangle,
    classes: 'bg-amber-50 text-amber-800 ring-amber-600/20',
    defaultLabel: 'Warning',
  },
  failed: {
    icon: XCircle,
    classes: 'bg-red-50 text-red-800 ring-red-600/20',
    defaultLabel: 'Failed',
  },
  not_tested: {
    icon: HelpCircle,
    classes: 'bg-slate-100 text-slate-700 ring-slate-500/20',
    defaultLabel: 'Not tested',
  },
  info: {
    icon: Info,
    classes: 'bg-blue-50 text-blue-800 ring-blue-600/20',
    defaultLabel: 'Info',
  },
  neutral: {
    icon: Info,
    classes: 'bg-slate-100 text-slate-800 ring-slate-500/20',
    defaultLabel: 'Status',
  },
};

export default function Badge({ variant = 'neutral', children, className = '' }) {
  const config = VARIANT_CONFIG[variant] ?? VARIANT_CONFIG.neutral;
  const Icon = config.icon;
  const label = children ?? config.defaultLabel;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${config.classes} ${className}`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}
