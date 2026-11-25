import React, { useEffect, useState } from 'react';
import {
  Building2,
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  Shield,
  User,
  X,
} from 'lucide-react';
import { formatCurrency } from '../../../../shared/utils/financialMath.js';
import { inspectAdminDocumentApi } from '../../services/admin.api.js';
import {
  exportDocumentPdfApi,
  triggerPdfBlobDownload,
} from '../../services/history.api.js';
import { useAuth } from '../../app/AuthContext.jsx';

/**
 * Read-Only Admin Document Inspection Modal
 * Calls `GET /api/v1/admin/history/:type/:id` (automatically writes VIEW_USER_DOCUMENT audit log).
 */
export function AdminDocumentPreviewModal({ target, onClose }) {
  const { showToast } = useAuth();
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    if (!target) return undefined;
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      setErrorMsg('');
      setData(null);
      try {
        const res = await inspectAdminDocumentApi(target.toolType, target.id);
        if (!cancelled) setData(res);
      } catch (err) {
        if (!cancelled) {
          setErrorMsg(
            err.response?.data?.message || 'Unable to load document inspection details.'
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [target]);

  if (!target) return null;

  const doc = data?.document || null;
  const owner = data?.owner || target.owner || null;
  const isQuote = target.toolType === 'quotation';
  const docNumber = doc?.invoiceNumber || doc?.quotationNumber || target.documentNumber;

  const handleExportPdf = async () => {
    setIsExporting(true);
    try {
      const res = await exportDocumentPdfApi(target.toolType, target.id, {
        size: doc?.pageSize || target.pageSize || 'A4',
        orientation: doc?.orientation || target.orientation || 'portrait',
      });
      triggerPdfBlobDownload(res, `${docNumber || target.toolType}.pdf`);
      showToast('Exported document PDF (logged to audit trail).', 'success');
    } catch (err) {
      showToast(err.response?.data?.message || 'PDF export failed.', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      data-testid="admin-document-preview-modal"
    >
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-200 bg-slate-50 px-5 py-4">
          <div className="flex items-center gap-3">
            <span
              className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                isQuote
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-indigo-100 text-indigo-700'
              }`}
            >
              {isQuote ? (
                <FileSpreadsheet className="h-5 w-5" />
              ) : (
                <FileText className="h-5 w-5" />
              )}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">
                  {docNumber || 'Document Inspection'}
                </h2>
                <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-violet-700">
                  <Shield className="h-3 w-3" /> Read-Only Audit View
                </span>
              </div>
              {owner && (
                <p className="mt-0.5 text-xs text-slate-500">
                  Owner: <span className="font-semibold text-slate-700">{owner.fullName}</span> ({owner.email})
                </p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close inspection modal"
            data-testid="close-admin-preview-btn"
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin text-indigo-600" /> Loading full document snapshot…
            </div>
          ) : errorMsg ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {errorMsg}
            </div>
          ) : doc ? (
            <div className="space-y-5">
              {/* Metadata summary */}
              <div className="grid gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-[10px] font-bold uppercase text-slate-400">Status</p>
                  <p className="mt-1 text-sm font-bold uppercase text-slate-800">{doc.status}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-[10px] font-bold uppercase text-slate-400">Paper Size</p>
                  <p className="mt-1 text-sm font-bold text-slate-800">
                    {doc.pageSize} ({doc.orientation})
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-[10px] font-bold uppercase text-slate-400">Currency</p>
                  <p className="mt-1 text-sm font-bold text-slate-800">{doc.currency}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-[10px] font-bold uppercase text-slate-400">Grand Total</p>
                  <p className="mt-1 text-sm font-bold text-indigo-700">
                    {formatCurrency(doc.grandTotal || 0, doc.currency || 'USD')}
                  </p>
                </div>
              </div>

              {/* Snapshots */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400">
                    <Building2 className="h-3.5 w-3.5" /> Business Snapshot
                  </div>
                  <p className="mt-2 text-sm font-bold text-slate-900">
                    {doc.businessSnapshot?.businessName || '—'}
                  </p>
                  {doc.businessSnapshot?.email && (
                    <p className="text-xs text-slate-500">{doc.businessSnapshot.email}</p>
                  )}
                  {doc.businessSnapshot?.taxRegistrationNo && (
                    <p className="text-xs text-slate-500">
                      Tax ID: {doc.businessSnapshot.taxRegistrationNo}
                    </p>
                  )}
                </div>

                <div className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400">
                    <User className="h-3.5 w-3.5" /> Customer Snapshot
                  </div>
                  <p className="mt-2 text-sm font-bold text-slate-900">
                    {doc.customerSnapshot?.name || '—'}
                  </p>
                  {doc.customerSnapshot?.companyName && (
                    <p className="text-xs text-slate-600">
                      {doc.customerSnapshot.companyName}
                    </p>
                  )}
                  {doc.customerSnapshot?.email && (
                    <p className="text-xs text-slate-500">{doc.customerSnapshot.email}</p>
                  )}
                </div>
              </div>

              {/* Line items */}
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50 font-bold uppercase text-slate-500">
                    <tr>
                      <th className="px-3.5 py-2.5">Item</th>
                      <th className="px-3 py-2.5 text-right">Qty</th>
                      <th className="px-3 py-2.5 text-right">Unit Price</th>
                      <th className="px-3 py-2.5 text-right">Tax %</th>
                      <th className="px-3.5 py-2.5 text-right">Line Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(doc.items || []).map((item, idx) => (
                      <tr key={item._id || idx}>
                        <td className="px-3.5 py-2.5">
                          <p className="font-semibold text-slate-800">{item.name}</p>
                          {item.description && (
                            <p className="text-[11px] text-slate-500">{item.description}</p>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right text-slate-700">
                          {item.quantity} {item.unit || ''}
                        </td>
                        <td className="px-3 py-2.5 text-right text-slate-700">
                          {formatCurrency(item.unitPrice || 0, doc.currency || 'USD')}
                        </td>
                        <td className="px-3 py-2.5 text-right text-slate-600">
                          {item.taxRate || 0}%
                        </td>
                        <td className="px-3.5 py-2.5 text-right font-semibold text-slate-900">
                          {formatCurrency(item.lineTotal || 0, doc.currency || 'USD')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Financial breakdown */}
              <div className="flex justify-end">
                <div className="w-full max-w-xs space-y-1.5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal</span>
                    <span>{formatCurrency(doc.subtotal || 0, doc.currency || 'USD')}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Tax Total</span>
                    <span>{formatCurrency(doc.taxTotal || 0, doc.currency || 'USD')}</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-200 pt-1.5 text-sm font-bold text-slate-900">
                    <span>Grand Total</span>
                    <span>{formatCurrency(doc.grandTotal || 0, doc.currency || 'USD')}</span>
                  </div>
                  {!isQuote && (
                    <>
                      <div className="flex justify-between text-emerald-700">
                        <span>Amount Paid</span>
                        <span>{formatCurrency(doc.amountPaid || 0, doc.currency || 'USD')}</span>
                      </div>
                      <div className="flex justify-between font-semibold text-amber-700">
                        <span>Balance Due</span>
                        <span>{formatCurrency(doc.balanceDue || 0, doc.currency || 'USD')}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-5 py-3">
          <span className="text-[11px] text-slate-500">
            This inspection is logged in <code className="font-mono">admin_audit_logs</code>.
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Close
            </button>
            <button
              type="button"
              disabled={isExporting || isLoading}
              onClick={handleExportPdf}
              data-testid="admin-modal-export-pdf-btn"
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
            >
              {isExporting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              Export PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminDocumentPreviewModal;
