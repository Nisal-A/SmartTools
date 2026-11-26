export function getCurrentMonthKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export function shiftMonthKey(monthKey, delta) {
  const match = String(monthKey || '').match(/^(\d{4})-(\d{2})$/);
  const baseDate = match
    ? new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1 + delta, 1))
    : new Date();
  const year = baseDate.getUTCFullYear();
  const month = String(baseDate.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export function formatMonthLabel(monthKey) {
  const match = String(monthKey || '').match(/^(\d{4})-(\d{2})$/);
  if (!match) return String(monthKey || '');
  const dt = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1));
  return dt.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function formatExpenseMoney(amount, currency = 'LKR') {
  const num = Number(amount);
  const safe = Number.isFinite(num) ? num : 0;
  const formatted = safe.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${String(currency || 'LKR').toUpperCase()} ${formatted}`;
}

export function formatExpenseDate(value) {
  if (!value) return '—';
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return '—';
  return dt.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function toDateInputValue(value) {
  if (!value) return new Date().toISOString().slice(0, 10);
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return new Date().toISOString().slice(0, 10);
  return dt.toISOString().slice(0, 10);
}

export function formatBytes(bytes) {
  const num = Number(bytes) || 0;
  if (num < 1024) return `${num} B`;
  if (num < 1024 * 1024) return `${(num / 1024).toFixed(1)} KB`;
  return `${(num / (1024 * 1024)).toFixed(2)} MB`;
}

export const CATEGORY_BADGE_CLASSES = {
  Travel: 'bg-sky-50 text-sky-700 ring-1 ring-sky-200',
  'Office Supplies': 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200',
  'Software & Subscriptions': 'bg-violet-50 text-violet-700 ring-1 ring-violet-200',
  Utilities: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  Marketing: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200',
  'Meals & Entertainment': 'bg-orange-50 text-orange-700 ring-1 ring-orange-200',
  Equipment: 'bg-teal-50 text-teal-700 ring-1 ring-teal-200',
  Contractors: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  Other: 'bg-slate-100 text-slate-700 ring-1 ring-slate-200',
};

export function getBudgetVisualState(spent, budgetLimit) {
  const safeSpent = Number(spent) || 0;
  const safeLimit = Number(budgetLimit) || 0;

  if (safeLimit <= 0) {
    return {
      tone: 'unbudgeted',
      barClass: 'bg-slate-400',
      badgeClass: 'bg-slate-100 text-slate-600 ring-slate-200',
      textClass: 'text-slate-600',
      cardClass: 'border-slate-200 bg-white',
      label: 'No Budget Set',
      barWidth: safeSpent > 0 ? 100 : 0,
    };
  }

  const percent = (safeSpent / safeLimit) * 100;
  const barWidth = Math.min(100, Math.max(0, percent));

  if (percent > 100) {
    return {
      tone: 'over',
      barClass: 'bg-rose-500',
      badgeClass: 'bg-rose-50 text-rose-700 ring-rose-200',
      textClass: 'text-rose-600',
      cardClass: 'border-rose-200 bg-rose-50/30',
      label: 'Over Budget (>100%)',
      barWidth: 100,
    };
  }

  if (percent > 80) {
    return {
      tone: 'warning',
      barClass: 'bg-amber-500',
      badgeClass: 'bg-amber-50 text-amber-700 ring-amber-200',
      textClass: 'text-amber-700',
      cardClass: 'border-amber-200 bg-amber-50/30',
      label: 'Near Limit (>80%)',
      barWidth,
    };
  }

  return {
    tone: 'healthy',
    barClass: 'bg-emerald-500',
    badgeClass: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    textClass: 'text-emerald-700',
    cardClass: 'border-slate-200 bg-white',
    label: 'On Track',
    barWidth,
  };
}

export function isPdfAttachment(attachment) {
  if (!attachment) return false;
  if (attachment.resourceType === 'raw') return true;
  const url = String(attachment.url || '').toLowerCase();
  const name = String(attachment.originalName || '').toLowerCase();
  return (
    url.startsWith('data:application/pdf') ||
    url.endsWith('.pdf') ||
    name.endsWith('.pdf')
  );
}
