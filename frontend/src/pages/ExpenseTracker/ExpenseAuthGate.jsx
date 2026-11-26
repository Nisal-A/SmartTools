import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Lock,
  Paperclip,
  ShieldCheck,
  Wallet,
} from 'lucide-react';

const RETURN_TO = encodeURIComponent('/tools/expense-tracker');

export function ExpenseAuthGate() {
  return (
    <div
      className="mx-auto max-w-3xl py-6 sm:py-10"
      data-testid="expense-auth-gate"
    >
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-gradient-to-br from-rose-50/70 via-white to-slate-50 px-6 py-8 sm:px-10">
          <div className="inline-flex items-center gap-2 rounded-full bg-rose-100/80 px-3 py-1 text-xs font-bold uppercase tracking-wider text-rose-700">
            <Lock className="h-3.5 w-3.5" /> Account Required
          </div>

          <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
                Expense Tracker &amp; Budgets
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
                Expense Tracker saves your monthly category budgets, spending breakdowns, and receipt
                images/PDFs privately to your SmartTools account. Sign in or create a free account to
                start logging expenses.
              </p>
            </div>
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-rose-600 text-white shadow-sm">
              <Wallet className="h-7 w-7" />
            </span>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              to={`/login?returnTo=${RETURN_TO}`}
              data-testid="expense-auth-login-link"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700"
            >
              Sign In to Expense Tracker <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to={`/register?returnTo=${RETURN_TO}`}
              data-testid="expense-auth-register-link"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              Create Free Account
            </Link>
            <Link
              to="/tools"
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-500 transition hover:text-slate-800 sm:ml-auto"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back to Tools Hub
            </Link>
          </div>
        </div>

        <div className="grid gap-4 px-6 py-6 sm:grid-cols-3 sm:px-10">
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <BarChart3 className="h-5 w-5 text-rose-600" />
            <h2 className="mt-2.5 text-sm font-bold text-slate-900">Monthly Category Budgets</h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              Set monthly spending caps per category with amber (&gt;80%) and red (&gt;100%) warnings.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <Paperclip className="h-5 w-5 text-rose-600" />
            <h2 className="mt-2.5 text-sm font-bold text-slate-900">Cloud Receipt Attachments</h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              Upload JPEG, PNG, WEBP, or PDF receipts up to 5 MB and preview them anytime.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <ShieldCheck className="h-5 w-5 text-rose-600" />
            <h2 className="mt-2.5 text-sm font-bold text-slate-900">Strict Private Isolation</h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              Your expense ledger and receipt uploads are scoped strictly to your authenticated workspace.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ExpenseAuthGate;
