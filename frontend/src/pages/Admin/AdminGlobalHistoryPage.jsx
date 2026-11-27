import React, { useCallback, useEffect, useState } from 'react';
import {
  Bot,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  Eye,
  FileText,
  Globe,
  Loader2,
  Package,
  Receipt,
  Search,
  Shield,
  Wallet,
  X,
} from 'lucide-react';
import { formatCurrency } from '../../../../shared/utils/financialMath.js';
import { PAPER_SIZES } from '../../../../shared/constants/paperSizes.js';
import {
  getAdminExpensesApi,
  getAdminGlobalHistoryApi,
  getAdminProposalsApi,
  getAdminPurchaseOrdersApi,
  getAdminReceiptsApi,
} from '../../services/admin.api.js';
import {
  exportDocumentPdfApi,
  triggerPdfBlobDownload,
} from '../../services/history.api.js';
import { EXPENSE_CATEGORIES } from '../../services/expenses.api.js';
import { PROPOSAL_STATUSES } from '../../services/proposals.api.js';
import { useAuth } from '../../app/AuthContext.jsx';
import { AdminDocumentPreviewModal } from '../../components/admin/AdminDocumentPreviewModal.jsx';

const ADMIN_HISTORY_TABS = [
  { id: 'unified', label: 'Invoices, Quotes & SEO', icon: FileText },
  { id: 'receipts', label: 'Receipts', icon: Receipt },
  { id: 'purchase-orders', label: 'Purchase Orders', icon: Package },
  { id: 'expenses', label: 'Expenses', icon: Wallet },
  { id: 'proposals', label: 'Proposals', icon: Bot },
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

function AdminModuleRecordModal({ tab, record, onClose }) {
  if (!record) return null;

  const ownerText = record.isGuest
    ? 'Walk-in Guest'
    : record.owner?.email
      ? `${record.owner.fullName || 'User'} (${record.owner.email})`
      : record.userId || 'Registered User';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      data-testid="admin-module-inspect-modal"
    >
      <div className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-200 bg-slate-50 px-5 py-4">
          <div>
            <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-violet-700">
              <Shield className="h-3 w-3" /> Read-Only Admin View
            </span>
            <h2 className="mt-1.5 text-base font-bold text-slate-900">
              {record.receiptNumber ||
                record.poNumber ||
                record.proposalNumber ||
                record.title ||
                'Record Details'}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">Owner: {ownerText}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close record inspection modal"
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5 text-xs">
          {tab === 'receipts' && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 p-3">
                <p className="font-bold uppercase text-slate-400">Business / Payer</p>
                <p className="mt-1 font-semibold text-slate-900">
                  {record.business?.name || '—'} → {record.customer?.name || '—'}
                </p>
                <p className="mt-0.5 text-slate-500">
                  Format: {String(record.format || 'a5').toUpperCase()} · {record.paymentMethod}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 p-3">
                <p className="font-bold uppercase text-slate-400">Payment Summary</p>
                <p className="mt-1 font-semibold text-slate-900">
                  Paid: {formatCurrency(record.amountPaid || 0, record.currency || 'LKR')}
                </p>
                <p className="mt-0.5 text-slate-500">
                  Balance Due: {formatCurrency(record.balanceDue || 0, record.currency || 'LKR')}
                </p>
              </div>
            </div>
          )}

          {tab === 'purchase-orders' && (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200 p-3">
                  <p className="font-bold uppercase text-slate-400">Buyer &amp; Vendor</p>
                  <p className="mt-1 font-semibold text-slate-900">
                    {record.buyer?.name || '—'} → {record.supplier?.name || '—'}
                  </p>
                  <p className="mt-0.5 text-slate-500">
                    Approval: {record.approvals?.approvedBy?.status || 'Pending'}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 p-3">
                  <p className="font-bold uppercase text-slate-400">Order Total</p>
                  <p className="mt-1 text-sm font-bold text-slate-900">
                    {formatCurrency(record.grandTotal || 0, record.currency || 'LKR')}
                  </p>
                  <p className="mt-0.5 text-slate-500">
                    Items: {Array.isArray(record.items) ? record.items.length : 0}
                  </p>
                </div>
              </div>
            </div>
          )}

          {tab === 'expenses' && (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200 p-3">
                  <p className="font-bold uppercase text-slate-400">Category &amp; Payment</p>
                  <p className="mt-1 font-semibold text-slate-900">
                    {record.category} · {record.paymentMethod}
                  </p>
                  <p className="mt-0.5 text-slate-500">Vendor: {record.vendor || '—'}</p>
                </div>
                <div className="rounded-xl border border-slate-200 p-3">
                  <p className="font-bold uppercase text-slate-400">Amount</p>
                  <p className="mt-1 text-sm font-bold text-slate-900">
                    {formatCurrency(record.amount || 0, record.currency || 'LKR')}
                  </p>
                  {record.receiptAttachment?.url && (
                    <a
                      href={record.receiptAttachment.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-flex items-center gap-1 font-semibold text-rose-600 hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" /> Open Receipt Attachment
                    </a>
                  )}
                </div>
              </div>
              {record.notes && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-700">
                  {record.notes}
                </div>
              )}
            </div>
          )}

          {tab === 'proposals' && (
            <div className="space-y-3">
              <div className="rounded-xl border border-slate-200 p-3">
                <p className="font-bold uppercase text-slate-400">Client &amp; Status</p>
                <p className="mt-1 font-semibold text-slate-900">
                  {record.clientName}
                  {record.clientCompany ? ` · ${record.clientCompany}` : ''} ({record.status})
                </p>
                <p className="mt-1 text-slate-600">Tone: {record.tone} · Currency: {record.currency}</p>
              </div>
              {record.sections?.executiveSummary && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-700">
                  <p className="mb-1 font-bold uppercase text-slate-400">Executive Summary</p>
                  {record.sections.executiveSummary}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end border-t border-slate-200 bg-slate-50 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export function AdminGlobalHistoryPage() {
  const { showToast } = useAuth();
  const [activeTab, setActiveTab] = useState('unified');

  // Shared & tab-specific filters
  const [ownerEmail, setOwnerEmail] = useState('');
  const [toolType, setToolType] = useState('all');
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [scope, setScope] = useState('all');
  const [receiptFormat, setReceiptFormat] = useState('all');
  const [poApprovalStatus, setPoApprovalStatus] = useState('all');
  const [expenseMonth, setExpenseMonth] = useState('');
  const [expenseCategory, setExpenseCategory] = useState('All');
  const [proposalStatus, setProposalStatus] = useState('all');
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
  const [moduleInspectRecord, setModuleInspectRecord] = useState(null);
  const [exportingId, setExportingId] = useState(null);

  const handleSelectTab = (tabId) => {
    setActiveTab(tabId);
    setPage(1);
    setItems([]);
  };

  const fetchTabRecords = useCallback(async () => {
    setIsLoading(true);
    try {
      let res;
      if (activeTab === 'unified') {
        res = await getAdminGlobalHistoryApi({
          toolType,
          page,
          limit: 20,
          ...(ownerEmail.trim() ? { ownerEmail: ownerEmail.trim() } : {}),
          ...(status !== 'all' ? { status } : {}),
          ...(search.trim() ? { search: search.trim() } : {}),
          ...(dateFrom ? { dateFrom } : {}),
          ...(dateTo ? { dateTo } : {}),
        });
      } else if (activeTab === 'receipts') {
        res = await getAdminReceiptsApi({
          page,
          limit: 20,
          ...(search.trim() ? { search: search.trim() } : {}),
          ...(scope !== 'all' ? { scope } : {}),
          ...(receiptFormat !== 'all' ? { format: receiptFormat } : {}),
        });
      } else if (activeTab === 'purchase-orders') {
        res = await getAdminPurchaseOrdersApi({
          page,
          limit: 20,
          ...(search.trim() ? { search: search.trim() } : {}),
          ...(scope !== 'all' ? { scope } : {}),
          ...(poApprovalStatus !== 'all' ? { approvalStatus: poApprovalStatus } : {}),
        });
      } else if (activeTab === 'expenses') {
        res = await getAdminExpensesApi({
          page,
          limit: 20,
          ...(search.trim() ? { search: search.trim() } : {}),
          ...(expenseMonth ? { month: expenseMonth } : {}),
          ...(expenseCategory !== 'All' ? { category: expenseCategory } : {}),
        });
      } else {
        res = await getAdminProposalsApi({
          page,
          limit: 20,
          ...(search.trim() ? { search: search.trim() } : {}),
          ...(proposalStatus !== 'all' ? { status: proposalStatus } : {}),
        });
      }

      setItems(res.items);
      setPagination(res.pagination);
    } catch (err) {
      showToast(
        err.response?.data?.message || 'Unable to load admin history records.',
        'error'
      );
    } finally {
      setIsLoading(false);
    }
  }, [
    activeTab,
    ownerEmail,
    toolType,
    status,
    search,
    dateFrom,
    dateTo,
    scope,
    receiptFormat,
    poApprovalStatus,
    expenseMonth,
    expenseCategory,
    proposalStatus,
    page,
    showToast,
  ]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      fetchTabRecords();
    }, 200);
    return () => window.clearTimeout(timer);
  }, [fetchTabRecords]);

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
              Cross-user visibility across all SmartTools modules — Invoices, Quotations, SEO Audits, Receipts, Purchase Orders, Expenses, and AI Proposals.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-3 py-1 text-xs font-bold text-violet-700 ring-1 ring-violet-200">
            <Shield className="h-3.5 w-3.5" /> Audit Logging Active
          </span>
        </div>

        {/* Tool Module Tabs */}
        <div
          className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4"
          role="tablist"
          aria-label="Admin History Tool Tabs"
          data-testid="admin-history-tabs"
        >
          {ADMIN_HISTORY_TABS.map(({ id, label, icon: TabIcon }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => handleSelectTab(id)}
                data-testid={`admin-tab-${id}`}
                className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-semibold transition ${
                  isActive
                    ? 'border-violet-600 bg-violet-600 text-white shadow-sm'
                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 hover:bg-white hover:text-slate-900'
                }`}
              >
                <TabIcon className="h-3.5 w-3.5" />
                {label}
              </button>
            );
          })}
        </div>

        {/* Dynamic Tab Filters */}
        {activeTab === 'unified' ? (
          <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2 lg:grid-cols-6">
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
              <option value="all">All Core Tools</option>
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
        ) : (
          <div className="mt-4 flex flex-wrap gap-3 border-t border-slate-100 pt-4">
            <div className="relative min-w-[220px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search number, title, customer, vendor…"
                data-testid="admin-module-search"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-8 pr-3 text-xs focus:border-violet-500 focus:bg-white focus:outline-none"
              />
            </div>

            {(activeTab === 'receipts' || activeTab === 'purchase-orders') && (
              <select
                value={scope}
                onChange={(e) => {
                  setScope(e.target.value);
                  setPage(1);
                }}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700"
              >
                <option value="all">All Authors (Users &amp; Guests)</option>
                <option value="users">Registered Users Only</option>
                <option value="guests">Guests Only</option>
              </select>
            )}

            {activeTab === 'receipts' && (
              <select
                value={receiptFormat}
                onChange={(e) => {
                  setReceiptFormat(e.target.value);
                  setPage(1);
                }}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700"
              >
                <option value="all">All Formats</option>
                <option value="a5">A5</option>
                <option value="thermal">Thermal (80mm)</option>
              </select>
            )}

            {activeTab === 'purchase-orders' && (
              <select
                value={poApprovalStatus}
                onChange={(e) => {
                  setPoApprovalStatus(e.target.value);
                  setPage(1);
                }}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700"
              >
                <option value="all">All Approval States</option>
                <option value="Pending">Pending</option>
                <option value="Approved">Approved</option>
              </select>
            )}

            {activeTab === 'expenses' && (
              <>
                <input
                  type="month"
                  value={expenseMonth}
                  onChange={(e) => {
                    setExpenseMonth(e.target.value);
                    setPage(1);
                  }}
                  aria-label="Filter expense month"
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700"
                />
                <select
                  value={expenseCategory}
                  onChange={(e) => {
                    setExpenseCategory(e.target.value);
                    setPage(1);
                  }}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700"
                >
                  <option value="All">All Categories</option>
                  {EXPENSE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </>
            )}

            {activeTab === 'proposals' && (
              <select
                value={proposalStatus}
                onChange={(e) => {
                  setProposalStatus(e.target.value);
                  setPage(1);
                }}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700"
              >
                <option value="all">All Proposal Statuses</option>
                {PROPOSAL_STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-14 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin text-violet-600" /> Loading records…
          </div>
        ) : items.length === 0 ? (
          <div className="px-6 py-14 text-center text-sm text-slate-500">
            No records match the selected filters in this module.
          </div>
        ) : activeTab === 'unified' ? (
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
        ) : (
          <div className="overflow-x-auto">
            <table
              className="w-full text-left text-sm"
              data-testid={`admin-table-${activeTab}`}
            >
              <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">Reference / Title</th>
                  <th className="px-3 py-3">Owner</th>
                  <th className="px-3 py-3">Counterparty / Details</th>
                  <th className="px-3 py-3">Amount / Status</th>
                  <th className="px-3 py-3">Created</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((rec) => {
                  const primaryLabel =
                    rec.receiptNumber ||
                    rec.poNumber ||
                    rec.proposalNumber ||
                    rec.title ||
                    '—';
                  const subLabel =
                    activeTab === 'proposals'
                      ? rec.projectTitle
                      : activeTab === 'expenses'
                        ? rec.category
                        : activeTab === 'receipts'
                          ? String(rec.format || 'a5').toUpperCase()
                          : rec.buyer?.name || 'Purchase Order';
                  const counterparty =
                    activeTab === 'receipts'
                      ? rec.customer?.name || rec.business?.name || 'Walk-in'
                      : activeTab === 'purchase-orders'
                        ? rec.supplier?.name || '—'
                        : activeTab === 'expenses'
                          ? rec.vendor || rec.paymentMethod || '—'
                          : rec.clientName +
                            (rec.clientCompany ? ` · ${rec.clientCompany}` : '');
                  const amountOrStatus =
                    activeTab === 'receipts'
                      ? formatCurrency(rec.amountPaid || 0, rec.currency || 'LKR')
                      : activeTab === 'purchase-orders'
                        ? `${formatCurrency(rec.grandTotal || 0, rec.currency || 'LKR')} (${
                            rec.approvals?.approvedBy?.status || 'Pending'
                          })`
                        : activeTab === 'expenses'
                          ? formatCurrency(rec.amount || 0, rec.currency || 'LKR')
                          : `${rec.status || 'Draft'} (${rec.currency || 'LKR'})`;

                  return (
                    <tr key={rec._id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-900">{primaryLabel}</p>
                        {subLabel && (
                          <p className="text-[11px] text-slate-500">{subLabel}</p>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {rec.isGuest ? (
                          <span className="inline-flex rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-bold uppercase text-sky-700">
                            Guest
                          </span>
                        ) : (
                          <>
                            <p className="text-xs font-semibold text-slate-900">
                              {rec.owner?.fullName || 'User'}
                            </p>
                            <p className="text-[11px] text-slate-500">
                              {rec.owner?.email || '—'}
                            </p>
                          </>
                        )}
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-700">
                        {counterparty}
                      </td>
                      <td className="px-3 py-3 text-xs font-semibold text-slate-900">
                        {amountOrStatus}
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-500">
                        {rec.createdAt || rec.expenseDate
                          ? new Date(rec.expenseDate || rec.createdAt).toLocaleDateString()
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => setModuleInspectRecord(rec)}
                          data-testid={`admin-module-inspect-${rec._id}`}
                          className="inline-flex items-center gap-1 rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700 hover:bg-violet-100"
                        >
                          <Eye className="h-3.5 w-3.5" /> Inspect
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs text-slate-600">
            <span>
              Page {pagination.page} of {pagination.totalPages} ({pagination.total} records)
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

      <AdminModuleRecordModal
        tab={activeTab}
        record={moduleInspectRecord}
        onClose={() => setModuleInspectRecord(null)}
      />
    </div>
  );
}

export default AdminGlobalHistoryPage;
