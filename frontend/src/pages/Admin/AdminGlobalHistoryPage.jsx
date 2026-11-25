import React, { useCallback, useEffect, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  Globe,
  Loader2,
  Search,
  Shield,
} from 'lucide-react';
import { formatCurrency } from '../../../../shared/utils/financialMath.js';
import { PAPER_SIZES } from '../../../../shared/constants/paperSizes.js';
import { getAdminGlobalHistoryApi } from '../../services/admin.api.js';
import {
  exportDocumentPdfApi,
  triggerPdfBlobDownload,
} from '../../services/history.api.js';
import { useAuth } from '../../app/AuthContext.jsx';
import { AdminDocumentPreviewModal } from '../../components/admin/AdminDocumentPreviewModal.jsx';

const STATUS_OPTIONS = [
  'all',
  'draft',
  'sent',
  'partial',
  'paid',
  'overdue',
  'void',
  'accepted',
  'rejected',
  'expired',
  'converted',
];

export function AdminGlobalHistoryPage() {
  const { showToast } = useAuth();
  const [ownerEmail, setOwnerEmail] = useState('');
  const [toolType, setToolType] = useState('all');
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);

  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [inspectTarget, setInspectTarget] = useState(null);
  const [exportingId, setExportingId] = useState(null);

  const fetchGlobalHistory = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = {
        toolType,
        page,
        limit: 20,
        ...(ownerEmail.trim() ? { ownerEmail: ownerEmail.trim() } : {}),
        ...(status !== 'all' ? { status } : {}),
        ...(search.trim() ? { search: search.trim() } : {}),
        ...(dateFrom ? { dateFrom } : {}),
        ...(dateTo ? { dateTo } : {}),
      };
      const res = await getAdminGlobalHistoryApi(params);
      setItems(res.items);
      setPagination(res.pagination);
    } catch (err) {
      showToast(
        err.response?.data?.message || 'Unable to load global history.',
        'error'
      );
    } finally {
      setIsLoading(false);
    }
  }, [ownerEmail, toolType, status, search, dateFrom, dateTo, page, showToast]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      fetchGlobalHistory();
    }, 220);
    return () => window.clearTimeout(timer);
  }, [fetchGlobalHistory]);

  const handleExportPdf = async (doc) => {
    setExportingId(doc.id);
    try {
      const res = await exportDocumentPdfApi(doc.toolType, doc.id, {
        size: doc.pageSize || 'A4',
        orientation: doc.orientation || 'portrait',
      });
      triggerPdfBlobDownload(res, `${doc.documentNumber || doc.toolType}.pdf`);
      showToast(`Exported ${doc.documentNumber} PDF (audit logged).`, 'success');
    } catch (err) {
      showToast(err.response?.data?.message || 'Unable to export PDF.', 'error');
    } finally {
      setExportingId(null);
    }
  };

  return (
    <div className="space-y-5" data-testid="admin-global-history-page">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-violet-600">
              <Globe className="h-4 w-4" /> Admin Governance Console
            </div>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900">
              Global Document History
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Cross-user visibility across all registered tools. Every query and inspection is immutably logged.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-3 py-1 text-xs font-bold text-violet-700 ring-1 ring-violet-200">
            <Shield className="h-3.5 w-3.5" /> Audit Logging Active
          </span>
        </div>

        <div className="mt-5 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2 lg:grid-cols-6">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={ownerEmail}
              onChange={(e) => {
                setOwnerEmail(e.target.value);
                setPage(1);
              }}
              placeholder="Filter owner email…"
              data-testid="admin-filter-owner-email"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-8 pr-3 text-xs focus:border-violet-500 focus:bg-white focus:outline-none"
            />
          </div>

          <input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search doc # or client…"
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs focus:border-violet-500 focus:bg-white focus:outline-none"
          />

          <select
            value={toolType}
            onChange={(e) => {
              setToolType(e.target.value);
              setPage(1);
            }}
            data-testid="admin-filter-tool-type"
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700"
          >
            <option value="all">All Tools</option>
            <option value="invoice">Invoice</option>
            <option value="quotation">Quotation</option>
            <option value="seo">SEO Audit</option>
          </select>

          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700"
          >
            {STATUS_OPTIONS.map((st) => (
              <option key={st} value={st}>
                {st === 'all' ? 'All Statuses' : st.charAt(0).toUpperCase() + st.slice(1)}
              </option>
            ))}
          </select>

          <input
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setPage(1);
            }}
            aria-label="Date from"
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700"
          />

          <input
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setPage(1);
            }}
            aria-label="Date to"
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700"
          />
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-14 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin text-violet-600" /> Loading global history…
          </div>
        ) : items.length === 0 ? (
          <div className="px-6 py-14 text-center text-sm text-slate-500">
            No cross-user documents match the selected filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm" data-testid="admin-global-history-table">
              <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">Document #</th>
                  <th className="px-3 py-3">Owner</th>
                  <th className="px-3 py-3">Tool</th>
                  <th className="px-3 py-3">Customer</th>
                  <th className="px-3 py-3">Size</th>
                  <th className="px-3 py-3">Amount</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Governance Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((doc) => (
                  <tr
                    key={`${doc.toolType}-${doc.id}`}
                    data-testid={`admin-history-row-${doc.id}`}
                    className="hover:bg-slate-50/70"
                  >
                    <td className="px-4 py-3 font-semibold text-slate-900">
                      {doc.documentNumber}
                    </td>
                    <td className="px-3 py-3">
                      <p className="text-xs font-semibold text-slate-900">
                        {doc.owner?.fullName || 'Unknown'}
                      </p>
                      <p className="text-[11px] text-slate-500">{doc.owner?.email}</p>
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          doc.toolType === 'seo'
                            ? 'bg-sky-50 text-sky-700'
                            : doc.toolType === 'quotation'
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-indigo-50 text-indigo-700'
                        }`}
                      >
                        {doc.toolType === 'seo'
                          ? 'SEO Audit'
                          : doc.toolType === 'quotation'
                            ? 'Quotation'
                            : 'Invoice'}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-700">{doc.customerName}</td>
                    <td className="px-3 py-3 text-xs text-slate-600">
                      {doc.toolType === 'seo'
                        ? `Cov ${doc.scoreCoverage ?? 0}%`
                        : PAPER_SIZES[doc.pageSize]?.name || doc.pageSize}
                    </td>
                    <td className="px-3 py-3 font-semibold text-slate-900">
                      {doc.toolType === 'seo'
                        ? `${doc.overallScore ?? doc.grandTotal ?? 0}/100`
                        : formatCurrency(doc.grandTotal || 0, doc.currency || 'USD')}
                    </td>
                    <td className="px-3 py-3">
                      <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-700">
                        {doc.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setInspectTarget(doc)}
                          data-testid={`admin-inspect-btn-${doc.id}`}
                          className="inline-flex items-center gap-1 rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700 hover:bg-violet-100"
                        >
                          <Eye className="h-3.5 w-3.5" /> Inspect
                        </button>
                        {doc.toolType !== 'seo' && (
                          <button
                            type="button"
                            disabled={exportingId === doc.id}
                            onClick={() => handleExportPdf(doc)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                          >
                            {exportingId === doc.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Download className="h-3.5 w-3.5" />
                            )}
                            PDF
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs text-slate-600">
            <span>
              Page {pagination.page} of {pagination.totalPages} ({pagination.total} documents)
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 font-semibold hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Prev
              </button>
              <button
                type="button"
                disabled={page >= pagination.totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 font-semibold hover:bg-slate-50 disabled:opacity-40"
              >
                Next <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </section>

      <AdminDocumentPreviewModal
        target={inspectTarget}
        onClose={() => setInspectTarget(null)}
      />
    </div>
  );
}

export default AdminGlobalHistoryPage;
