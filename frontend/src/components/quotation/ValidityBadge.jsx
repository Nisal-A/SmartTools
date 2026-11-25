import React from 'react';
import {
  ArrowRightCircle,
  CheckCircle2,
  Clock,
  FileEdit,
  Send,
  XCircle,
} from 'lucide-react';

const STATUS_MAP = {
  draft: {
    label: 'Draft',
    classes: 'border-slate-200 bg-slate-100 text-slate-700',
    Icon: FileEdit,
  },
  sent: {
    label: 'Sent',
    classes: 'border-sky-200 bg-sky-50 text-sky-700',
    Icon: Send,
  },
  accepted: {
    label: 'Accepted',
    classes: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    Icon: CheckCircle2,
  },
  rejected: {
    label: 'Rejected',
    classes: 'border-rose-200 bg-rose-50 text-rose-700',
    Icon: XCircle,
  },
  expired: {
    label: 'Expired',
    classes: 'border-amber-200 bg-amber-50 text-amber-700',
    Icon: Clock,
  },
  converted: {
    label: 'Converted',
    classes: 'border-indigo-200 bg-indigo-50 text-indigo-700',
    Icon: ArrowRightCircle,
  },
};

export function ValidityBadge({ status = 'draft', validUntil = null, className = '' }) {
  const key = String(status || 'draft').toLowerCase();
  const cfg = STATUS_MAP[key] || STATUS_MAP.draft;
  const Icon = cfg.Icon;

  let validityHint = '';
  if (validUntil && key !== 'converted' && key !== 'rejected') {
    const msDiff = new Date(validUntil).getTime() - Date.now();
    const daysLeft = Math.ceil(msDiff / (1000 * 60 * 60 * 24));
    if (Number.isFinite(daysLeft)) {
      validityHint = daysLeft < 0 ? ' · Past Due' : ` · ${daysLeft}d left`;
    }
  }

  return (
    <span
      data-testid="quotation-validity-badge"
      data-status={key}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide ${cfg.classes} ${className}`}
    >
      <Icon className="h-3.5 w-3.5" />
      <span>
        {cfg.label}
        {validityHint}
      </span>
    </span>
  );
}

export default ValidityBadge;
