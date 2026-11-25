import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Download,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  History,
  LayoutDashboard,
  Loader2,
  Pin,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { formatCurrency } from '../../../../shared/utils/financialMath.js';
import { useAuth } from '../../app/AuthContext.jsx';
import { usePinnedTools } from '../../hooks/usePinnedTools.js';
import {
  exportDocumentPdfApi,
  getDashboardSummaryApi,
  triggerPdfBlobDownload,
} from '../../services/history.api.js';
import { ToolIcon, getAccentStyles } from '../../components/navigation/toolVisuals.jsx';

const STATUS_BADGE_MAP = {
  draft: 'bg-slate-100 text-slate-700 ring-slate-200',
  sent: 'bg-sky-50 text-sky-700 ring-sky-200',
  partial: 'bg-amber-50 text-amber-700 ring-amber-200',
  paid: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  overdue: 'bg-rose-50 text-rose-700 ring-rose-200',
  void: 'bg-slate-100 text-slate-500 ring-slate-200',
  accepted: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  rejected: 'bg-rose-50 text-rose-700 ring-rose-200',
  expired: 'bg-amber-50 text-amber-700 ring-amber-200',
  converted: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
};

function StatusBadge({ status }) {
  const tone =
    STATUS_BADGE_MAP[String(status || 'draft').toLowerCase()] ||
    STATUS_BADGE_MAP.draft;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ring-1 ${tone}`}
    >
      {status || 'draft'}
    </span>
  );
}

function getEditRoute(doc) {
  if (doc.toolType === 'quotation') {
    return `/tools/quotation-generator/${doc.id}`;
  }
  return `/tools/invoice-generator/${doc.id}`;
}

export function DashboardPage() {
  const { user, showToast } = useAuth();
  const { pinnedTools } = usePinnedTools();
  const [summary, setSummary] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [downloadingId, setDownloadingId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      setErrorMsg('');
      try {
        const data = await getDashboardSummaryApi();
        if (!cancelled) setSummary(data);
      } catch (err) {
        if (!cancelled) {
          setErrorMsg(
            err.response?.data?.message || 'Unable to load dashboard summary.'
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleDownloadPdf = async (doc) => {
    setDownloadingId(doc.id);
    try {
      const res = await exportDocumentPdfApi(doc.toolType, doc.id, {
        size: doc.pageSize || 'A4',
        orientation: doc.orientation || 'portrait',
      });
      triggerPdfBlobDownload(res, `${doc.documentNumber || doc.toolType}.pdf`);
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to download PDF.', 'error');
    } finally {
      setDownloadingId(null);
    }
  };

  const recentDocs = summary?.recentDocuments || [];

  return (
    <div className="space-y-6" data-testid="dashboard-page">
      {/* Header */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-600">
              <LayoutDashboard className="h-4 w-4" /> Workspace Dashboard
            </div>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900">
              Welcome back, {user?.fullName || user?.email?.split('@')[0] || 'there'}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Your private invoicing performance, quotation pipeline, and recent documents.
            </p>
          </div>
          <Link
            to="/history"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            <History className="h-4 w-4 text-indigo-600" /> View Full History
          </Link>
        </div>
      </section>

      {errorMsg && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {errorMsg}
        </div>
      )}

      {/* KPI Cards */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" data-testid="dashboard-kpis">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Total Invoiced
            </span>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <Wallet className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-3 text-2xl font-extrabold text-slate-900" data-testid="kpi-total-invoiced">
            {isLoading ? '—' : formatCurrency(summary?.totalInvoiced || 0, 'USD')}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Across {summary?.invoiceCount ?? 0} saved invoice(s)
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Paid vs Pending
            </span>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-3 text-2xl font-extrabold text-emerald-600" data-testid="kpi-total-paid">
            {isLoading ? '—' : formatCurrency(summary?.totalPaid || 0, 'USD')}
          </p>
          <p className="mt-1 text-xs font-medium text-amber-600" data-testid="kpi-pending-balance">
            Pending: {isLoading ? '—' : formatCurrency(summary?.pendingBalance || 0, 'USD')}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Overdue Invoices
            </span>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
              <AlertCircle className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-3 text-2xl font-extrabold text-slate-900" data-testid="kpi-overdue-count">
            {isLoading ? '—' : summary?.overdueCount ?? 0}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Past due date with remaining balance
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Active Quotes & Rate
            </span>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
              <TrendingUp className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-3 text-2xl font-extrabold text-slate-900" data-testid="kpi-active-quotes">
            {isLoading ? '—' : summary?.activeQuotationsCount ?? 0}
          </p>
          <p className="mt-1 text-xs text-slate-500" data-testid="kpi-conversion-rate">
            Conversion rate: <span className="font-bold text-indigo-600">{summary?.conversionRate ?? 0}%</span>
          </p>
        </div>
      </section>

      {/* Quick Launch Bar (Pinned Tools from toolsRegistry.js) */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" data-testid="dashboard-quick-launch">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Pin className="h-4 w-4 text-indigo-600" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700">
              Quick Launch — Pinned Tools
            </h2>
          </div>
          <Link
            to="/tools"
            className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700"
          >
            Manage Tools <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {pinnedTools.map((tool) => {
            const accent = getAccentStyles(tool.accentColor);
            return (
              <Link
                key={tool.id}
                to={tool.route}
                data-testid={`quick-launch-${tool.id}`}
                className={`group flex items-center gap-3.5 rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 transition hover:bg-white hover:shadow-sm ${accent.hoverBorder}`}
              >
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${accent.iconWrap}`}>
                  <ToolIcon name={tool.iconName} className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-slate-900">{tool.name}</p>
                  <p className="truncate text-xs text-slate-500">{tool.tagline}</p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-indigo-600" />
              </Link>
            );
          })}
        </div>
      </section>

      {/* Recent Documents Table */}
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm" data-testid="dashboard-recent-documents">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">Recent Documents</h2>
            <p className="text-xs text-slate-500">
              Your latest 8 invoices and quotations across all tools.
            </p>
          </div>
          <Link
            to="/history"
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
          >
            See all →
          </Link>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin text-indigo-600" /> Loading recent documents…
          </div>
        ) : recentDocs.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <FileText className="mx-auto h-7 w-7 text-slate-300" />
            <p className="mt-2 text-sm font-semibold text-slate-700">No saved documents yet</p>
            <p className="mt-1 text-xs text-slate-500">
              Launch the Invoice Generator or Quotation Generator above to create your first document.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-5 py-3">Document #</th>
                  <th className="px-4 py-3">Tool</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentDocs.map((doc) => (
                  <tr key={`${doc.toolType}-${doc.id}`} className="hover:bg-slate-50/70">
                    <td className="px-5 py-3 font-semibold text-slate-900">
                      {doc.documentNumber}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          doc.toolType === 'quotation'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-indigo-50 text-indigo-700'
                        }`}
                      >
                        {doc.toolType === 'quotation' ? (
                          <FileSpreadsheet className="h-3 w-3" />
                        ) : (
                          <FileText className="h-3 w-3" />
                        )}
                        {doc.toolType === 'quotation' ? 'Quotation' : 'Invoice'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{doc.customerName}</td>
                    <td className="px-4 py-3 font-semibold text-slate-900">
                      {formatCurrency(doc.grandTotal || 0, doc.currency || 'USD')}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={doc.status} />
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {doc.createdAt
                        ? new Date(doc.createdAt).toLocaleDateString()
                        : '—'}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <Link
                          to={getEditRoute(doc)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          <ExternalLink className="h-3.5 w-3.5" /> Open
                        </Link>
                        <button
                          type="button"
                          disabled={downloadingId === doc.id}
                          onClick={() => handleDownloadPdf(doc)}
                          className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
                        >
                          {downloadingId === doc.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Download className="h-3.5 w-3.5" />
                          )}
                          PDF
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export default DashboardPage;
