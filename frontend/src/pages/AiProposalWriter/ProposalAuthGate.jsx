import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  ArrowRightLeft,
  Bot,
  FileText,
  Lock,
  Sparkles,
} from 'lucide-react';

const RETURN_TO = encodeURIComponent('/tools/ai-proposal-writer');

export function ProposalAuthGate() {
  return (
    <div
      className="mx-auto max-w-3xl py-6 sm:py-10"
      data-testid="proposal-auth-gate"
    >
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-gradient-to-br from-violet-50/80 via-white to-slate-50 px-6 py-8 sm:px-10">
          <div className="inline-flex items-center gap-2 rounded-full bg-violet-100/80 px-3 py-1 text-xs font-bold uppercase tracking-wider text-violet-700">
            <Lock className="h-3.5 w-3.5" /> Account Required
          </div>

          <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
                AI Proposal Writer
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
                Turn a short client brief into a structured, editable project proposal with pricing
                line items and hand it off to Quotation Generator in one click. Sign in to generate
                and save proposals securely.
              </p>
            </div>
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-violet-600 text-white shadow-sm">
              <Bot className="h-7 w-7" />
            </span>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              to={`/login?returnTo=${RETURN_TO}`}
              data-testid="proposal-auth-login-link"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700"
            >
              Sign In to AI Proposal Writer <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to={`/register?returnTo=${RETURN_TO}`}
              data-testid="proposal-auth-register-link"
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
            <Sparkles className="h-5 w-5 text-violet-600" />
            <h2 className="mt-2.5 text-sm font-bold text-slate-900">Structured AI Drafts</h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              Generates executive summary, problem statement, deliverables, timeline &amp; pricing.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <FileText className="h-5 w-5 text-violet-600" />
            <h2 className="mt-2.5 text-sm font-bold text-slate-900">Editable &amp; Print-Ready</h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              Refine every section and line item inline, save drafts, or export clean A4 PDFs.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <ArrowRightLeft className="h-5 w-5 text-violet-600" />
            <h2 className="mt-2.5 text-sm font-bold text-slate-900">1-Click Quotation Handoff</h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              Transfers client info, currency, scope summary, and pricing rows into Quotation Generator.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProposalAuthGate;
