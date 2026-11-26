import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Paperclip,
  Pencil,
  Plus,
  Receipt,
  Search,
  SlidersHorizontal,
  Trash2,
  Wallet,
} from 'lucide-react';
import { useAuth } from '../../app/AuthContext.jsx';
import { getMyProfilesApi } from '../../services/profiles.api.js';
import {
  EXPENSE_CATEGORIES,
  deleteExpenseApi,
  getExpenseSummaryApi,
  listExpensesApi,
} from '../../services/expenses.api.js';
import { ExpenseAuthGate } from './ExpenseAuthGate.jsx';
import { CategoryBudgetsModal } from './CategoryBudgetsModal.jsx';
import { ExpenseFormModal } from './ExpenseFormModal.jsx';
import { ReceiptPreviewModal } from './ReceiptPreviewModal.jsx';
import {
  CATEGORY_BADGE_CLASSES,
  formatExpenseDate,
  formatExpenseMoney,
  formatMonthLabel,
  getBudgetVisualState,
  getCurrentMonthKey,
  shiftMonthKey,
} from './expenseHelpers.js';

export function ExpenseTrackerPage() {
  const { isAuthenticated, loading: authLoading, showToast } = useAuth();

  const [month, setMonth] = useState(getCurrentMonthKey);
  const [currency, setCurrency] = useState('LKR');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAllCategories, setShowAllCategories] = useState(false);

  const [summary, setSummary] = useState({
    month: getCurrentMonthKey(),
    totalSpent: 0,
    totalBudget: 0,
    totalRemaining: 0,
    percentUsed: 0,
    totalTransactions: 0,
    categories: [],
  });
  const [expenses, setExpenses] = useState([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [isBudgetsModalOpen, setIsBudgetsModalOpen] = useState(false);
  const [previewExpense, setPreviewExpense] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Debounce search query smoothly
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearchQuery(searchInput.trim());
    }, 220);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  // Load workspace default currency from Business Profile
  useEffect(() => {
    if (!isAuthenticated) return undefined;
    let cancelled = false;

    getMyProfilesApi()
      .then((profiles) => {
        if (cancelled) return;
        const profCurrency = profiles?.businessProfile?.defaultCurrency;
        if (profCurrency) {
          setCurrency(String(profCurrency).toUpperCase());
        }
      })
      .catch(() => {
        // Keep fallback LKR currency if profile fetch fails
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  const loadTrackerData = useCallback(async () => {
    if (!isAuthenticated) return;
    setIsLoadingData(true);
    setErrorMessage('');

    try {
      const listParams = { month };
      if (categoryFilter !== 'All') {
        listParams.category = categoryFilter;
      }
      if (searchQuery) {
        listParams.search = searchQuery;
      }

      const [summaryRes, expensesRes] = await Promise.all([
        getExpenseSummaryApi(month),
        listExpensesApi(listParams),
      ]);

      setSummary(summaryRes);
      setExpenses(Array.isArray(expensesRes) ? expensesRes : []);
    } catch (err) {
      setErrorMessage(
        err.response?.data?.message ||
          err.message ||
          'Failed to load expense tracker data.'
      );
    } finally {
      setIsLoadingData(false);
    }
  }, [isAuthenticated, month, categoryFilter, searchQuery]);

  useEffect(() => {
    loadTrackerData();
  }, [loadTrackerData]);

  const activeCategoryEntries = useMemo(() => {
    const list = Array.isArray(summary?.categories) ? summary.categories : [];
    if (showAllCategories) return list;
    return list.filter(
      (item) => (Number(item.spent) || 0) > 0 || (Number(item.budgetLimit) || 0) > 0
    );
  }, [summary, showAllCategories]);

  const warningCount = useMemo(() => {
    const list = Array.isArray(summary?.categories) ? summary.categories : [];
    return list.filter(
      (item) => item.budgetLimit > 0 && item.percentUsed > 80
    ).length;
  }, [summary]);

  const isOverMonthlyBudget =
    (Number(summary.totalBudget) || 0) > 0 &&
    (Number(summary.totalSpent) || 0) > (Number(summary.totalBudget) || 0);

  const openCreateModal = () => {
    setEditingExpense(null);
    setIsExpenseModalOpen(true);
  };

  const openEditModal = (exp) => {
    setEditingExpense(exp);
    setIsExpenseModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget?._id) return;
    setIsDeleting(true);
    try {
      await deleteExpenseApi(deleteTarget._id);
      setDeleteTarget(null);
      showToast?.('Expense deleted.', 'success');
      await loadTrackerData();
    } catch (err) {
      setErrorMessage(
        err.response?.data?.message ||
          err.message ||
          'Failed to delete expense.'
      );
    } finally {
      setIsDeleting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-[45vh] items-center justify-center gap-2 text-sm font-medium text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin text-rose-600" />
        Loading Expense Tracker…
      </div>
    );
  }

  if (!isAuthenticated) {
    return <ExpenseAuthGate />;
  }

  return (
    <div className="space-y-6" data-testid="expense-tracker-page">
      {/* Top Bar */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-rose-600">
              <Wallet className="h-4 w-4" /> Finance &amp; Billing
            </div>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900">
              Expense Tracker
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Monitor monthly spending, track category budget thresholds, and store receipts for{' '}
              <span className="font-semibold text-slate-700">{formatMonthLabel(month)}</span>.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Month Picker */}
            <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 p-1">
              <button
                type="button"
                onClick={() => setMonth((m) => shiftMonthKey(m, -1))}
                aria-label="Previous month"
                data-testid="month-prev-btn"
                className="rounded-lg p-1.5 text-slate-500 transition hover:bg-white hover:text-slate-900"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <div className="flex items-center gap-1.5 px-2">
                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                <input
                  type="month"
                  value={month}
                  onChange={(e) => {
                    if (e.target.value) setMonth(e.target.value);
                  }}
                  aria-label="Select billing month"
                  data-testid="expense-month-picker"
                  className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none"
                />
              </div>
              <button
                type="button"
                onClick={() => setMonth((m) => shiftMonthKey(m, 1))}
                aria-label="Next month"
                data-testid="month-next-btn"
                className="rounded-lg p-1.5 text-slate-500 transition hover:bg-white hover:text-slate-900"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Currency Display */}
            <span
              className="inline-flex items-center rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold uppercase tracking-wider text-slate-700"
              data-testid="expense-currency-badge"
            >
              Currency: {currency}
            </span>

            <button
              type="button"
              onClick={() => setIsBudgetsModalOpen(true)}
              data-testid="open-budgets-modal-btn"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <SlidersHorizontal className="h-4 w-4 text-slate-500" />
              Set Category Budgets
            </button>

            <button
              type="button"
              onClick={openCreateModal}
              data-testid="add-expense-cta"
              className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700"
            >
              <Plus className="h-4 w-4" />
              Add Expense
            </button>
          </div>
        </div>
      </section>

      {errorMessage && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* KPI Summary Row */}
      <section
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
        data-testid="expense-kpi-row"
      >
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Total Monthly Spend
          </p>
          <p
            className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900"
            data-testid="kpi-total-spent"
          >
            {formatExpenseMoney(summary.totalSpent, currency)}
          </p>
          <p className="mt-1 text-xs text-slate-500">{formatMonthLabel(month)}</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Total Monthly Budget
          </p>
          <p
            className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900"
            data-testid="kpi-total-budget"
          >
            {formatExpenseMoney(summary.totalBudget, currency)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {summary.totalBudget > 0
              ? `${summary.percentUsed}% of monthly cap utilized`
              : 'Click Set Category Budgets to configure'}
          </p>
        </div>

        <div
          className={`rounded-2xl border p-5 shadow-sm ${
            isOverMonthlyBudget
              ? 'border-rose-200 bg-rose-50/40'
              : 'border-slate-200 bg-white'
          }`}
        >
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Remaining Budget
          </p>
          <p
            className={`mt-2 text-2xl font-extrabold tracking-tight ${
              isOverMonthlyBudget ? 'text-rose-600' : 'text-emerald-700'
            }`}
            data-testid="kpi-remaining-budget"
          >
            {isOverMonthlyBudget
              ? `-${formatExpenseMoney(
                  (summary.totalSpent || 0) - (summary.totalBudget || 0),
                  currency
                )}`
              : formatExpenseMoney(summary.totalRemaining, currency)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {isOverMonthlyBudget
              ? 'Monthly spending exceeded total budget'
              : warningCount > 0
                ? `${warningCount} category threshold alert(s)`
                : 'Across all budgeted categories'}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Expense Count
          </p>
          <p
            className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900"
            data-testid="kpi-expense-count"
          >
            {summary.totalTransactions || 0}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Logged entries in {formatMonthLabel(month)}
          </p>
        </div>
      </section>

      {/* Category Spending & Budget Progress Section */}
      <section
        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
        data-testid="category-budget-progress-section"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-extrabold text-slate-900">
              Category Spending &amp; Budget Progress
            </h2>
            <p className="text-xs text-slate-500">
              Amber warning activates above 80%; red alert triggers above 100% of monthly budget.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowAllCategories((prev) => !prev)}
            className="self-start rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            {showAllCategories ? 'Show Active Only' : 'Show All 9 Categories'}
          </button>
        </div>

        {activeCategoryEntries.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-6 py-10 text-center">
            <SlidersHorizontal className="mx-auto h-6 w-6 text-slate-300" />
            <p className="mt-2.5 text-sm font-bold text-slate-700">
              No spending or budgets recorded for {formatMonthLabel(month)}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Set monthly category limits or add your first expense to track budget progress.
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setIsBudgetsModalOpen(true)}
                className="rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Set Category Budgets
              </button>
              <button
                type="button"
                onClick={openCreateModal}
                className="rounded-xl bg-rose-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-rose-700"
              >
                + Add Expense
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-4 grid gap-3.5 md:grid-cols-2 xl:grid-cols-3">
            {activeCategoryEntries.map((item) => {
              const visual = getBudgetVisualState(item.spent, item.budgetLimit);
              return (
                <div
                  key={item.category}
                  data-testid={`category-progress-${item.category
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, '-')}`}
                  data-budget-tone={visual.tone}
                  className={`rounded-2xl border p-4 transition ${visual.cardClass}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-slate-900">
                        {item.category}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {item.transactionCount || 0}{' '}
                        {item.transactionCount === 1 ? 'expense' : 'expenses'}
                      </p>
                    </div>
                    <span
                      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ring-1 ${visual.badgeClass}`}
                    >
                      {(visual.tone === 'warning' || visual.tone === 'over') && (
                        <AlertTriangle className="h-3 w-3" />
                      )}
                      {item.budgetLimit > 0 ? `${item.percentUsed}%` : visual.label}
                    </span>
                  </div>

                  <div className="mt-3 flex items-baseline justify-between gap-2 text-xs">
                    <span className="font-bold text-slate-800">
                      {formatExpenseMoney(item.spent, currency)}
                    </span>
                    <span className="text-slate-500">
                      {item.budgetLimit > 0
                        ? `of ${formatExpenseMoney(item.budgetLimit, currency)}`
                        : 'No budget cap'}
                    </span>
                  </div>

                  <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${visual.barClass}`}
                      style={{ width: `${visual.barWidth}%` }}
                    />
                  </div>

                  {item.budgetLimit > 0 && (
                    <p className={`mt-2 text-[11px] font-semibold ${visual.textClass}`}>
                      {visual.tone === 'over'
                        ? `Over budget by ${formatExpenseMoney(
                            item.spent - item.budgetLimit,
                            currency
                          )}`
                        : `${formatExpenseMoney(item.remaining, currency)} remaining`}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Expense Ledger Table */}
      <section
        className="rounded-2xl border border-slate-200 bg-white shadow-sm"
        data-testid="expense-ledger-section"
      >
        <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-extrabold text-slate-900">Expense Ledger</h2>
            <p className="text-xs text-slate-500">
              {expenses.length} matching {expenses.length === 1 ? 'record' : 'records'} for{' '}
              {formatMonthLabel(month)}
            </p>
          </div>

          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search title, vendor, notes…"
                data-testid="expense-search-input"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-rose-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-100 sm:w-64"
              />
            </div>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              aria-label="Filter expenses by category"
              data-testid="expense-category-filter"
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 focus:border-rose-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-100"
            >
              <option value="All">All Categories</option>
              {EXPENSE_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
        </div>

        {isLoadingData ? (
          <div className="flex items-center justify-center gap-2 py-14 text-sm font-medium text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin text-rose-600" />
            Refreshing ledger…
          </div>
        ) : expenses.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <Receipt className="mx-auto h-7 w-7 text-slate-300" />
            <p className="mt-3 text-sm font-bold text-slate-700">No expenses found</p>
            <p className="mt-1 text-xs text-slate-500">
              {searchQuery || categoryFilter !== 'All'
                ? 'Try clearing your search keyword or category filter.'
                : `No expenses logged for ${formatMonthLabel(month)} yet.`}
            </p>
            <button
              type="button"
              onClick={openCreateModal}
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700"
            >
              <Plus className="h-3.5 w-3.5" /> Add Expense
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-5 py-3">Date</th>
                  <th className="px-5 py-3">Title &amp; Vendor</th>
                  <th className="px-5 py-3">Category</th>
                  <th className="px-5 py-3">Payment Method</th>
                  <th className="px-5 py-3 text-center">Receipt</th>
                  <th className="px-5 py-3 text-right">Amount</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {expenses.map((exp) => {
                  const hasReceipt = Boolean(exp.receiptAttachment?.url);
                  const badgeClass =
                    CATEGORY_BADGE_CLASSES[exp.category] ||
                    CATEGORY_BADGE_CLASSES.Other;
                  return (
                    <tr
                      key={exp._id}
                      data-testid={`expense-row-${exp._id}`}
                      className="transition hover:bg-slate-50/70"
                    >
                      <td className="whitespace-nowrap px-5 py-3.5 text-xs font-medium text-slate-600">
                        {formatExpenseDate(exp.expenseDate)}
                      </td>
                      <td className="px-5 py-3.5">
                        <p className="font-semibold text-slate-900">{exp.title}</p>
                        {(exp.vendor || exp.notes) && (
                          <p className="mt-0.5 max-w-xs truncate text-xs text-slate-500">
                            {[exp.vendor, exp.notes].filter(Boolean).join(' · ')}
                          </p>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${badgeClass}`}
                        >
                          {exp.category}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-xs font-medium text-slate-600">
                        {exp.paymentMethod || 'Card'}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-center">
                        {hasReceipt ? (
                          <button
                            type="button"
                            onClick={() => setPreviewExpense(exp)}
                            title={
                              exp.receiptAttachment?.originalName ||
                              'Preview receipt attachment'
                            }
                            data-testid={`preview-receipt-${exp._id}`}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-rose-600 shadow-sm transition hover:border-rose-200 hover:bg-rose-50"
                          >
                            <Paperclip className="h-3.5 w-3.5" /> View
                          </button>
                        ) : (
                          <span className="text-xs text-slate-300">—</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-right font-bold tabular-nums text-slate-900">
                        {formatExpenseMoney(exp.amount, exp.currency || currency)}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEditModal(exp)}
                            aria-label={`Edit ${exp.title}`}
                            data-testid={`edit-expense-${exp._id}`}
                            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(exp)}
                            aria-label={`Delete ${exp.title}`}
                            data-testid={`delete-expense-${exp._id}`}
                            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Modals */}
      <ExpenseFormModal
        isOpen={isExpenseModalOpen}
        expense={editingExpense}
        defaultCurrency={currency}
        defaultMonth={month}
        onClose={() => {
          setIsExpenseModalOpen(false);
          setEditingExpense(null);
        }}
        onSaved={loadTrackerData}
      />

      <CategoryBudgetsModal
        isOpen={isBudgetsModalOpen}
        month={month}
        currency={currency}
        categoriesSummary={summary?.categories || []}
        onClose={() => setIsBudgetsModalOpen(false)}
        onSaved={loadTrackerData}
      />

      <ReceiptPreviewModal
        expense={previewExpense}
        onClose={() => setPreviewExpense(null)}
      />

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          data-testid="delete-expense-confirm-modal"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <h3 className="text-base font-extrabold text-slate-900">
              Delete Expense?
            </h3>
            <p className="mt-1.5 text-sm text-slate-600">
              Are you sure you want to delete{' '}
              <span className="font-semibold text-slate-900">
                {deleteTarget.title}
              </span>{' '}
              ({formatExpenseMoney(deleteTarget.amount, deleteTarget.currency || currency)})? Any
              attached receipt will also be removed.
            </p>
            <div className="mt-5 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={isDeleting}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                data-testid="confirm-delete-expense-btn"
                className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
              >
                {isDeleting && <Loader2 className="h-4 w-4 animate-spin" />}
                {isDeleting ? 'Deleting…' : 'Delete Expense'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ExpenseTrackerPage;
