import React, { useEffect, useState } from 'react';
import { CheckCircle2, CreditCard, Loader2, X } from 'lucide-react';
import { recordInvoicePayment } from '../../services/invoices.api.js';

function formatMoney(amount, currency = 'USD') {
  const num = Number(amount) || 0;
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: String(currency || 'USD').toUpperCase(),
    }).format(num);
  } catch {
    return `${currency} ${num.toFixed(2)}`;
  }
}

export function PaymentRecorderModal({
  isOpen = false,
  invoice = null,
  onPaymentRecorded,
  onClose,
}) {
  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState('bank_transfer');
  const [referenceNo, setReferenceNo] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const balanceDue = Number(invoice?.balanceDue ?? invoice?.grandTotal ?? 0);
  const currency = invoice?.currency || 'USD';

  useEffect(() => {
    if (isOpen && invoice) {
      setAmount(balanceDue > 0 ? String(balanceDue) : '');
      setPaymentDate(new Date().toISOString().slice(0, 10));
      setMethod('bank_transfer');
      setReferenceNo('');
      setNotes('');
      setErrorMsg('');
    }
  }, [isOpen, invoice, balanceDue]);

  if (!isOpen || !invoice) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setErrorMsg('Please enter a valid payment amount greater than 0.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await recordInvoicePayment(invoice._id, {
        amount: numericAmount,
        paymentDate,
        method,
        referenceNo: referenceNo.trim(),
        notes: notes.trim(),
      });
      const updatedInvoice = response?.data || response;
      onPaymentRecorded?.(updatedInvoice);
      onClose?.();
    } catch (err) {
      setErrorMsg(
        err.response?.data?.message || 'Unable to record payment. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="record-payment-title"
      data-testid="payment-recorder-modal"
    >
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <CreditCard className="h-5 w-5" />
            </div>
            <div>
              <h2 id="record-payment-title" className="text-base font-bold text-slate-900">
                Record Payment · {invoice.invoiceNumber}
              </h2>
              <p className="text-xs text-slate-500">
                Balance Due: <strong>{formatMoney(balanceDue, currency)}</strong> of{' '}
                {formatMoney(invoice.grandTotal, currency)}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close payment modal"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          {errorMsg ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
              {errorMsg}
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Payment Amount ({currency}) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                data-testid="payment-amount-input"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
              {balanceDue > 0 ? (
                <div className="mt-1.5 flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => setAmount(String(Number((balanceDue / 2).toFixed(2))))}
                    className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-100"
                  >
                    50% Partial
                  </button>
                  <button
                    type="button"
                    onClick={() => setAmount(String(balanceDue))}
                    className="rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100"
                  >
                    Full Balance
                  </button>
                </div>
              ) : null}
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Payment Date *
              </label>
              <input
                type="date"
                required
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Payment Method
              </label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              >
                <option value="bank_transfer">Bank Transfer</option>
                <option value="card">Credit / Debit Card</option>
                <option value="cash">Cash</option>
                <option value="online">Online Gateway</option>
                <option value="cheque">Cheque</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Reference / Transaction No
              </label>
              <input
                type="text"
                value={referenceNo}
                onChange={(e) => setReferenceNo(e.target.value)}
                placeholder="e.g., WIRE-2026-881"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">Notes</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional payment note"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>

          {Array.isArray(invoice.payments) && invoice.payments.length > 0 ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Recorded Payments ({invoice.payments.length})
              </p>
              <div className="max-h-32 space-y-1.5 overflow-y-auto text-xs">
                {invoice.payments.map((p, idx) => (
                  <div
                    key={p._id || idx}
                    className="flex items-center justify-between rounded-md bg-white px-2.5 py-1.5 border border-slate-100"
                  >
                    <span className="text-slate-600">
                      {String(p.paymentDate || '').slice(0, 10)} ·{' '}
                      <span className="capitalize">{String(p.method || '').replace('_', ' ')}</span>
                      {p.referenceNo ? ` (${p.referenceNo})` : ''}
                    </span>
                    <span className="font-bold text-emerald-700">
                      {formatMoney(p.amount, currency)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              data-testid="confirm-record-payment-btn"
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              Record Payment
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default PaymentRecorderModal;
