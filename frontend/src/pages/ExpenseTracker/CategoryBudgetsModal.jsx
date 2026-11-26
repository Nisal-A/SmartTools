import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Loader2, SlidersHorizontal, X } from 'lucide-react';
import {
  EXPENSE_CATEGORIES,
  upsertCategoryBudgetsApi,
} from '../../services/expenses.api.js';
import {
  CATEGORY_BADGE_CLASSES,
  formatExpenseMoney,
  formatMonthLabel,
} from './expenseHelpers.js';

export function CategoryBudgetsModal({
  isOpen,
  month,
  currency,
  categoriesSummary = [],
  onClose,
  onSaved,
}) {
  const [limits, setLimits] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    const summaryMap = new Map(
      categoriesSummary.map((entry) => [entry.category, entry])
    );
    const initial = {};
    for (const cat of EXPENSE_CATEGORIES) {
      const existing = summaryMap.get(cat);
      initial[cat] =
        existing && Number(existing.budgetLimit) > 0
          ? String(existing.budgetLimit)
          : '';
    }
    setLimits(initial);
    setError('');
  }, [isOpen, categoriesSummary, month]);

  const spentByCategory = useMemo(() => {
    const map = new Map();
    for (const entry of categoriesSummary) {
      map.set(entry.category, Number(entry.spent) || 0);
    }
    return map;
  }, [categoriesSummary]);

  const totalConfiguredBudget = useMemo(
    () =>
      EXPENSE_CATEGORIES.reduce((sum, cat) => {
        const val = Number(limits[cat]);
        return sum + (Number.isFinite(val) && val > 0 ? val : 0);
      }, 0),
    [limits]
  );

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const budgets = [];
    for (const category of EXPENSE_CATEGORIES) {
      const raw = String(limits[category] ?? '').trim();
      const num = raw === '' ? 0 : Number(raw);
      if (!Number.isFinite(num) || num < 0) {
        setError(`Budget limit for "${category}" must be a non-negative number.`);
        return;
      }
      budgets.push({
        category,
        limitAmount: Math.round((num + Number.EPSILON) * 100) / 100,
      });
    }

    setSaving(true);
    try {
      await upsertCategoryBudgetsApi({ month, budgets });
      if (onSaved) {
        await onSaved();
      }
      onClose();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          'Could not save category budgets.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="category-budgets-title"
      data-testid="category-budgets-modal"
    >
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-rose-600">
              <SlidersHorizontal className="h-3.5 w-3.5" /> Monthly Category Limits
            </div>
            <h2
              id="category-budgets-title"
              className="mt-1 text-lg font-extrabold text-slate-900"
            >
              Set Budgets — {formatMonthLabel(month)}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Leave blank or set 0 for categories without a spending cap. Total planned:{' '}
              <span className="font-semibold text-slate-800">
                {formatExpenseMoney(totalConfiguredBudget, currency)}
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close budgets modal"
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-3 overflow-y-auto px-6 py-4">
            {error && (
              <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-700">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
              {EXPENSE_CATEGORIES.map((category) => {
                const spent = spentByCategory.get(category) || 0;
                const badgeClass =
                  CATEGORY_BADGE_CLASSES[category] || CATEGORY_BADGE_CLASSES.Other;
                return (
                  <div
                    key={category}
                    className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${badgeClass}`}
                      >
                        {category}
                      </span>
                      <p className="mt-1 text-xs text-slate-500">
                        Spent this month:{' '}
                        <span className="font-semibold text-slate-700">
                          {formatExpenseMoney(spent, currency)}
                        </span>
                      </p>
                    </div>
                    <div className="flex items-center gap-2 sm:w-52">
                      <span className="text-xs font-semibold text-slate-400">
                        {currency}
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={limits[category] ?? ''}
                        onChange={(e) =>
                          setLimits((prev) => ({
                            ...prev,
                            [category]: e.target.value,
                          }))
                        }
                        aria-label={`${category} budget limit`}
                        data-testid={`budget-input-${category
                          .toLowerCase()
                          .replace(/[^a-z0-9]+/g, '-')}`}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-right text-sm font-medium text-slate-900 placeholder:text-slate-300 focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-100"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 border-t border-slate-100 bg-slate-50 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              data-testid="save-budgets-submit"
              className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700 disabled:opacity-60"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {saving ? 'Saving Budgets…' : 'Save Category Budgets'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CategoryBudgetsModal;
