import React, { useState } from 'react';
import { ArrowRight, FileCheck2, Loader2, X } from 'lucide-react';
import { convertQuotationToInvoice } from '../../services/quotations.api.js';
import { handoffQuoteToInvoiceDraft } from '../../services/guestDraft.service.js';

export function ConvertToInvoiceModal({
  isOpen = false,
  isAuthenticated = false,
  quotation = null,
  quotationFormValues = null,
  onEnsureSaved,
  onConverted,
  onGuestHandoff,
  onClose,
}) {
  const [dueDate, setDueDate] = useState(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  );
  const [converting, setConverting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const isAlreadyConverted =
    Boolean(quotation?.convertedInvoiceId) || quotation?.status === 'converted';

  const handleConfirm = async () => {
    setErrorMsg('');

    // Guest workflow: localStorage handoff to Invoice Generator
    if (!isAuthenticated) {
      const transferredDraft = handoffQuoteToInvoiceDraft({
        ...(quotationFormValues || quotation || {}),
        dueDate,
      });
      onGuestHandoff?.(transferredDraft);
      onClose?.();
      return;
    }

    // Authenticated workflow: server-side transactional conversion
    setConverting(true);
    try {
      let targetQuotationId = quotation?._id;
      if (!targetQuotationId && typeof onEnsureSaved === 'function') {
        const saved = await onEnsureSaved();
        targetQuotationId = saved?._id;
      }

      if (!targetQuotationId) {
        setErrorMsg('Please save the quotation before converting it to an invoice.');
        setConverting(false);
        return;
      }

      const result = await convertQuotationToInvoice(targetQuotationId, {
        dueDate,
      });

      onConverted?.(result);
      onClose?.();
    } catch (err) {
      if (err.response?.status === 409 && err.response?.data?.convertedInvoiceId) {
        onConverted?.({
          quotation: { ...quotation, status: 'converted', convertedInvoiceId: err.response.data.convertedInvoiceId },
          invoice: { _id: err.response.data.convertedInvoiceId },
        });
        onClose?.();
        return;
      }
      setErrorMsg(
        err.response?.data?.message || 'Failed to convert quotation to invoice.'
      );
    } finally {
      setConverting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="convert-quote-title"
      data-testid="convert-to-invoice-modal"
    >
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              <FileCheck2 className="h-5 w-5" />
            </div>
            <div>
              <h2 id="convert-quote-title" className="text-base font-bold text-slate-900">
                Convert Quotation to Invoice
              </h2>
              <p className="text-xs text-slate-500">
                {isAuthenticated
                  ? 'Creates a linked Draft Invoice with a fresh INV-YYYY-XXXX number'
                  : 'Transfers all items & client details into the Guest Invoice Generator'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close convert modal"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          {errorMsg ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
              {errorMsg}
            </div>
          ) : null}

          {isAlreadyConverted ? (
            <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-3.5 text-xs text-indigo-900">
              This quotation has already been converted to an invoice. Click below to open the
              linked invoice.
            </div>
          ) : (
            <>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-700 space-y-1">
                <p>
                  <strong>Business:</strong>{' '}
                  {quotationFormValues?.businessSnapshot?.businessName ||
                    quotation?.businessSnapshot?.businessName ||
                    'Configured Business'}
                </p>
                <p>
                  <strong>Customer:</strong>{' '}
                  {quotationFormValues?.customerSnapshot?.name ||
                    quotation?.customerSnapshot?.name ||
                    'Client'}
                </p>
                <p>
                  <strong>Line Items:</strong>{' '}
                  {(quotationFormValues?.items || quotation?.items || []).length} item(s) will be
                  copied
                </p>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Invoice Due Date
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
            </>
          )}

          <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={converting}
              data-testid="confirm-convert-to-invoice-btn"
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-60"
            >
              {converting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowRight className="h-4 w-4" />
              )}
              {isAlreadyConverted
                ? 'Open Linked Invoice'
                : isAuthenticated
                  ? 'Convert & Open Invoice'
                  : 'Transfer to Invoice Generator'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ConvertToInvoiceModal;
