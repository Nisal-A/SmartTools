import React from 'react';
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Clock,
  FileEdit,
  Send,
} from 'lucide-react';

const STATUS_STYLES = {
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
  partial: {
    label: 'Partial',
    classes: 'border-amber-200 bg-amber-50 text-amber-700',
    Icon: Clock,
  },
  paid: {
    label: 'Paid',
    classes: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    Icon: CheckCircle2,
  },
  overdue: {
    label: 'Overdue',
    classes: 'border-rose-200 bg-rose-50 text-rose-700',
    Icon: AlertTriangle,
  },
  void: {
    label: 'Void',
    classes: 'border-slate-300 bg-slate-200 text-slate-600 line-through',
    Icon: Ban,
  },
};

export function InvoiceStatusBadge({ status = 'draft', className = '' }) {
  const key = String(status || 'draft').toLowerCase();
  const cfg = STATUS_STYLES[key] || STATUS_STYLES.draft;
  const Icon = cfg.Icon;

  return (
    <span
      data-testid="invoice-status-badge"
      data-status={key}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide ${cfg.classes} ${className}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {cfg.label}
    </span>
  );
}

export default InvoiceStatusBadge;
