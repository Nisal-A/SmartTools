import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRightLeft,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  FileSpreadsheet,
  FileText,
  History,
  Loader2,
  Pencil,
  Search,
  Trash2,
} from 'lucide-react';
import { formatCurrency } from '../../../../shared/utils/financialMath.js';
import {
  PAPER_SIZES,
  getSupportedSizeCodesForTool,
} from '../../../../shared/constants/paperSizes.js';
import { useAuth } from '../../app/AuthContext.jsx';
import {
  exportDocumentPdfApi,
  getUserHistoryApi,
  triggerPdfBlobDownload,
} from '../../services/history.api.js';
import {
  deleteInvoice,
  duplicateInvoice,
} from '../../services/invoices.api.js';
import {
  convertQuotationToInvoice,
  deleteQuotation,
  duplicateQuotation,
} from '../../services/quotations.api.js';

const TOOL_TABS = [
  { id: 'all', label: 'All Documents' },
  { id: 'invoice', label: 'Invoices' },
  { id: 'quotation', label: 'Quotations' },
];

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

function getPaperLabel(sizeCode) {
  return PAPER_SIZES[sizeCode]?.name || sizeCode || 'A4';
}

export function DocumentHistoryPage() {
  const navigate = useNavigate();
  const { showToast } = useAuth();

  const [toolType, setToolType] = useState('all');
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);

  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 15,
    total: 0,
    totalPages: 1,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [busyKey, setBusyKey] = useState('');
  const [pdfSizeMenuDocId, setPdfSizeMenuDocId] = useState(null);
  const [confirmDeleteDoc, setConfirmDeleteDoc] = useState(null);

  const fetchHistory = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = {
        toolType,
        page,
        limit: 15,
        ...(status !== 'all' ? { status } : {}),
        ...(search.trim() ? { search: search.trim() } : {}),
        ...(dateFrom ? { dateFrom } : {}),
        ...(dateTo ? { dateTo } : {}),
      };
      const res = await getUserHistoryApi(params);
      setItems(res.items);
      setPagination(res.pagination);
    } catch (err) {
      showToast(err.response?.data?.message || 'Unable to load document history.', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [toolType, status, search, dateFrom, dateTo, page, showToast]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      fetchHistory();
    }, 200);
    return () => window.clearTimeout(timer);
  }, [fetchHistory]);

  const handleDownloadPdf = async (doc, sizeOverride = null) => {
    setPdfSizeMenuDocId(null);
    const chosenSize = sizeOverride || doc.pageSize || 'A4';
    setBusyKey(`pdf-${doc.id}`);
    try {
      const res = await exportDocumentPdfApi(doc.toolType, doc.id, {
        size: chosenSize,
        orientation: doc.orientation || 'portrait',
      });
      triggerPdfBlobDownload(res, `${doc.documentNumber || doc.toolType}-${chosenSize}.pdf`);
      showToast(`Downloaded ${doc.documentNumber} (${chosenSize}) PDF.`, 'success');
    } catch (err) {
      showToast(err.response?.data?.message || 'PDF download failed.', 'error');
    } finally {
      setBusyKey('');
    }
  };

  const handleDuplicate = async (doc) => {
    setBusyKey(`dup-${doc.id}`);
    try {
      if (doc.toolType === 'quotation') {
        await duplicateQuotation(doc.id);
      } else {
        await duplicateInvoice(doc.id);
      }
      showToast(`Duplicated ${doc.documentNumber}.`, 'success');
      fetchHistory();
    } catch (err) {
      showToast(err.response?.data?.message || 'Unable to duplicate document.', 'error');
    } finally {
      setBusyKey('');
    }
  };

  const handleConvertToInvoice = async (doc) => {
    setBusyKey(`conv-${doc.id}`);
    try {
      const result = await convertQuotationToInvoice(doc.id);
      const newInvoiceId = result?.invoice?._id || result?.invoice?.id;
      showToast(`Converted ${doc.documentNumber} to an Invoice.`, 'success');
      if (newInvoiceId) {
        navigate(`/tools/invoice-generator/${newInvoiceId}`);
      } else {
        fetchHistory();
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Conversion to invoice failed.', 'error');
    } finally {
      setBusyKey('');
    }
  };

  const handleConfirmDelete = async () => {
    if (!confirmDeleteDoc) return;
    const target = confirmDeleteDoc;
    setBusyKey(`del-${target.id}`);
    try {
      if (target.toolType === 'quotation') {
        await deleteQuotation(target.id);
      } else {
        await deleteInvoice(target.id);
      }
      setConfirmDeleteDoc(null);
      showToast(`Deleted ${target.documentNumber}.`, 'info');
      fetchHistory();
    } catch (err) {
      showToast(err.response?.data?.message || 'Unable to delete document.', 'error');
    } finally {
      setBusyKey('');
    }
  };

  return (
    <div className="space-y-5" data-testid="document-history-page">
      {/* Header */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-600">
              <History className="h-4 w-4" /> My Documents
            </div>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900">
              Document History
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Strictly scoped to your account — search, filter, duplicate, convert, or export PDFs in any paper size.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/tools/invoice-generator"
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700"
            >
              <FileText className="h-3.5 w-3.5" /> New Invoice
            </Link>
            <Link
              to="/tools/quotation-generator"
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" /> New Quotation
            </Link>
          </div>
        </div>

        {/* Tool Tabs + Filters */}
        <div className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-4">
          <div className="flex flex-wrap items-center gap-2">
            {TOOL_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setToolType(tab.id);
                  setPage(1);
                }}
                data-testid={`history-tab-${tab.id}`}
                className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
                  toolType === tab.id
                    ? 'border-indigo-600 bg-indigo-600 text-white shadow-sm'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search # or customer…"
                data-testid="history-search-input"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-none"
              />
            </div>

            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
              data-testid="history-status-select"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 focus:border-indigo-500 focus:outline-none"
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
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 focus:border-indigo-500 focus:outline-none"
            />

            <input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPage(1);
              }}
              aria-label="Date to"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 focus:border-indigo-500 focus:outline-none"
            />
          </div>
        </div>
      </section>

      {/* Table */}
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-14 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin text-indigo-600" /> Loading history…
          </div>
        ) : items.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <History className="mx-auto h-7 w-7 text-slate-300" />
            <p className="mt-2 text-sm font-semibold text-slate-700">
              No matching documents found
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Try clearing your filters or create a new invoice or quotation.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm" data-testid="history-table">
              <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">Document #</th>
                  <th className="px-3 py-3">Tool</th>
                  <th className="px-3 py-3">Customer</th>
                  <th className="px-3 py-3">Paper Size</th>
                  <th className="px-3 py-3">Amount</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Date</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((doc) => {
                  const tone =
                    STATUS_BADGE_MAP[String(doc.status || 'draft').toLowerCase()] ||
                    STATUS_BADGE_MAP.draft;
                  const editPath =
                    doc.toolType === 'quotation'
                      ? `/tools/quotation-generator/${doc.id}`
                      : `/tools/invoice-generator/${doc.id}`;
                  const allowedSizes = getSupportedSizeCodesForTool(doc.toolType);

                  return (
                    <tr
                      key={`${doc.toolType}-${doc.id}`}
                      data-testid={`history-row-${doc.id}`}
                      className="hover:bg-slate-50/70"
                    >
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        {doc.documentNumber}
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            doc.toolType === 'quotation'
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-indigo-50 text-indigo-700'
                          }`}
                        >
                          {doc.toolType === 'quotation' ? 'Quotation' : 'Invoice'}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-slate-700">{doc.customerName}</td>
                      <td className="px-3 py-3">
                        <span className="inline-flex rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                          {getPaperLabel(doc.pageSize)}
                        </span>
                      </td>
                      <td className="px-3 py-3 font-semibold text-slate-900">
                        {formatCurrency(doc.grandTotal || 0, doc.currency || 'USD')}
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ring-1 ${tone}`}
                        >
                          {doc.status}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-500">
                        {doc.createdAt
                          ? new Date(doc.createdAt).toLocaleDateString()
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          <Link
                            to={editPath}
                            title="Edit document"
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600"
                          >
                            <Pencil className="h-4 w-4" />
                          </Link>

                          {/* Download PDF with optional paper size override */}
                          <div className="relative">
                            <button
                              type="button"
                              disabled={busyKey === `pdf-${doc.id}`}
                              onClick={() =>
                                setPdfSizeMenuDocId((prev) =>
                                  prev === doc.id ? null : doc.id
                                )
                              }
                              title="Download PDF (choose paper size)"
                              className="rounded-lg p-1.5 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 disabled:opacity-50"
                            >
                              {busyKey === `pdf-${doc.id}` ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Download className="h-4 w-4" />
                              )}
                            </button>

                            {pdfSizeMenuDocId === doc.id && (
                              <div className="absolute right-0 top-full z-30 mt-1 w-40 rounded-xl border border-slate-200 bg-white py-1 text-left shadow-xl">
                                <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                  Export Size
                                </div>
                                {allowedSizes.map((sizeCode) => (
                                  <button
                                    key={sizeCode}
                                    type="button"
                                    onClick={() => handleDownloadPdf(doc, sizeCode)}
                                    className="flex w-full items-center justify-between px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-indigo-50 hover:text-indigo-700"
                                  >
                                    <span>{getPaperLabel(sizeCode)}</span>
                                    {sizeCode === doc.pageSize && (
                                      <span className="text-[10px] font-bold text-indigo-600">
                                        Default
                                      </span>
                                    )}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>

                          <button
                            type="button"
                            disabled={busyKey === `dup-${doc.id}`}
                            onClick={() => handleDuplicate(doc)}
                            title="Duplicate"
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-50"
                          >
                            <Copy className="h-4 w-4" />
                          </button>

                          {doc.toolType === 'quotation' &&
                            doc.status !== 'converted' && (
                              <button
                                type="button"
                                disabled={busyKey === `conv-${doc.id}`}
                                onClick={() => handleConvertToInvoice(doc)}
                                title="Convert Quotation to Invoice"
                                className="rounded-lg p-1.5 text-emerald-600 hover:bg-emerald-50 disabled:opacity-50"
                              >
                                <ArrowRightLeft className="h-4 w-4" />
                              </button>
                            )}

                          <button
                            type="button"
                            onClick={() => setConfirmDeleteDoc(doc)}
                            title="Delete"
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
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

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs text-slate-600">
            <span>
              Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
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

      {/* Delete Confirmation Modal */}
      {confirmDeleteDoc && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
            <h3 className="text-base font-bold text-slate-900">Delete document?</h3>
            <p className="mt-1 text-sm text-slate-600">
              Permanently delete <span className="font-semibold">{confirmDeleteDoc.documentNumber}</span>? This cannot be undone.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteDoc(null)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busyKey === `del-${confirmDeleteDoc.id}`}
                onClick={handleConfirmDelete}
                className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
              >
                {busyKey === `del-${confirmDeleteDoc.id}` && (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                )}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DocumentHistoryPage;
