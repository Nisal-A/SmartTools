import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  CreditCard,
  FileText,
  History,
  Link2,
  Loader2,
  Printer,
  Receipt as ReceiptIcon,
  RotateCcw,
  Trash2,
  User,
  X,
} from 'lucide-react';
import { useAuth } from '../../app/AuthContext.jsx';
import { GuestModeBanner } from '../../components/shared/GuestModeBanner.jsx';
import { listInvoices } from '../../services/invoices.api.js';
import { getMyProfilesApi } from '../../services/profiles.api.js';
import {
  createReceiptApi,
  deleteReceiptApi,
  getMyReceiptsApi,
  prefillReceiptFromInvoiceApi,
} from '../../services/receipts.api.js';
import {
  ReceiptPreviewCanvas,
  formatReceiptMoney,
} from './ReceiptPreviewCanvas.jsx';

const GUEST_RECEIPT_DRAFT_KEY = 'smarttools_guest_receipt_draft';

const CURRENCY_OPTIONS = ['LKR', 'USD', 'EUR', 'GBP', 'INR', 'AUD', 'SGD', 'AED'];
const PAYMENT_METHODS = ['Cash', 'Card', 'Bank Transfer'];

function formatProfileAddress(addr) {
  if (!addr) return '';
  if (typeof addr === 'string') return addr.trim();
  if (typeof addr === 'object') {
    return [addr.street, addr.city, addr.state, addr.postalCode, addr.country]
      .map((part) => (part ? String(part).trim() : ''))
      .filter(Boolean)
      .join(', ');
  }
  return '';
}

function buildInitialForm(businessDefaults = null) {
  const today = new Date().toISOString().slice(0, 10);
  return {
    receiptNumber: '',
    format: 'a5',
    linkedInvoiceId: '',
    linkedInvoiceNumber: '',
    business: {
      name: businessDefaults?.businessName || '',
      address: formatProfileAddress(businessDefaults?.address),
      phone: businessDefaults?.phone || '',
      email: businessDefaults?.email || '',
      logoUrl: businessDefaults?.logoUrl || '',
    },
    customer: {
      name: '',
      email: '',
      phone: '',
      address: '',
    },
    paymentMethod: 'Cash',
    paymentReference: '',
    currency: businessDefaults?.defaultCurrency || 'LKR',
    invoiceTotal: '',
    amountPaid: '',
    issuedDate: today,
    notes: '',
  };
}

function loadGuestReceiptDraft() {
  try {
    const raw = window.localStorage.getItem(GUEST_RECEIPT_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function clearGuestReceiptDraft() {
  try {
    window.localStorage.removeItem(GUEST_RECEIPT_DRAFT_KEY);
  } catch {
    // Ignore storage errors
  }
}

export function ReceiptGeneratorPage() {
  const { isAuthenticated, openAuthModal, showToast } = useAuth();

  const [businessDefaults, setBusinessDefaults] = useState(null);
  const [form, setForm] = useState(() => {
    const draft = loadGuestReceiptDraft();
    return draft ? { ...buildInitialForm(), ...draft } : buildInitialForm();
  });

  // Saved invoices for logged-in "Link to Saved Invoice" dropdown
  const [savedInvoices, setSavedInvoices] = useState([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [prefillingInvoice, setPrefillingInvoice] = useState(false);

  // Saved receipts history for logged-in users
  const [myReceipts, setMyReceipts] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyDrawerOpen, setHistoryDrawerOpen] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  // Submission & validation state
  const [savingAndPrinting, setSavingAndPrinting] = useState(false);
  const [formError, setFormError] = useState('');

  // Live computed Balance Due: Math.max(0, (invoiceTotal || amountPaid) - amountPaid)
  const computedBalanceDue = useMemo(() => {
    const paid = Math.max(0, Number(form.amountPaid) || 0);
    const invTotal = Math.max(0, Number(form.invoiceTotal) || 0);
    return Math.round(Math.max(0, (invTotal || paid) - paid + Number.EPSILON) * 100) / 100;
  }, [form.invoiceTotal, form.amountPaid]);

  // Persist guest draft in localStorage
  useEffect(() => {
    if (isAuthenticated) return;
    try {
      const { receiptNumber: _omitNum, ...draftFields } = form;
      window.localStorage.setItem(GUEST_RECEIPT_DRAFT_KEY, JSON.stringify(draftFields));
    } catch {
      // Ignore storage quota errors
    }
  }, [form, isAuthenticated]);

  const fetchMyReceipts = useCallback(async () => {
    if (!isAuthenticated) {
      setMyReceipts([]);
      return;
    }
    setLoadingHistory(true);
    try {
      const items = await getMyReceiptsApi();
      setMyReceipts(Array.isArray(items) ? items : []);
    } catch {
      // Non-blocking history fetch
    } finally {
      setLoadingHistory(false);
    }
  }, [isAuthenticated]);

  // Load Business Profile defaults, Saved Invoices dropdown, and My Receipts when authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      setSavedInvoices([]);
      setMyReceipts([]);
      return;
    }

    let active = true;

    (async () => {
      try {
        const profileData = await getMyProfilesApi();
        const biz = profileData?.businessProfile || null;
        if (!active || !biz) return;
        setBusinessDefaults(biz);

        setForm((prev) => ({
          ...prev,
          currency: prev.currency || biz.defaultCurrency || 'LKR',
          business: {
            name: prev.business.name || biz.businessName || '',
            address: prev.business.address || formatProfileAddress(biz.address),
            phone: prev.business.phone || biz.phone || '',
            email: prev.business.email || biz.email || '',
            logoUrl: prev.business.logoUrl || biz.logoUrl || '',
          },
        }));
      } catch {
        // Ignore profile autofill failure
      }
    })();

    (async () => {
      setLoadingInvoices(true);
      try {
        const res = await listInvoices({ limit: 50 });
        const list = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
        if (active) setSavedInvoices(list);
      } catch {
        if (active) setSavedInvoices([]);
      } finally {
        if (active) setLoadingInvoices(false);
      }
    })();

    fetchMyReceipts();

    return () => {
      active = false;
    };
  }, [isAuthenticated, fetchMyReceipts]);

  const updateField = (key, value) => {
    setFormError('');
    setForm((prev) => ({
      ...prev,
      // Editing fields clears any previously saved receiptNumber so next save generates a new RCP number
      receiptNumber: '',
      [key]: value,
    }));
  };

  const updateNestedField = (section, key, value) => {
    setFormError('');
    setForm((prev) => ({
      ...prev,
      receiptNumber: '',
      [section]: {
        ...prev[section],
        [key]: value,
      },
    }));
  };

  const handleSelectSavedInvoice = async (invoiceId) => {
    setFormError('');
    if (!invoiceId) {
      setForm((prev) => ({
        ...prev,
        receiptNumber: '',
        linkedInvoiceId: '',
        linkedInvoiceNumber: '',
      }));
      return;
    }

    setPrefillingInvoice(true);
    try {
      const prefill = await prefillReceiptFromInvoiceApi(invoiceId);
      setForm((prev) => ({
        ...prev,
        receiptNumber: '',
        linkedInvoiceId: prefill.linkedInvoiceId || invoiceId,
        linkedInvoiceNumber: prefill.invoiceNumber || prefill.linkedInvoiceNumber || '',
        currency: prefill.currency || prev.currency || 'LKR',
        invoiceTotal:
          prefill.invoiceTotal !== undefined ? String(prefill.invoiceTotal) : prev.invoiceTotal,
        amountPaid:
          prefill.suggestedAmountPaid !== undefined
            ? String(prefill.suggestedAmountPaid)
            : String(prefill.invoiceTotal ?? ''),
        business: {
          name: prefill.business?.name || prev.business.name,
          address: prefill.business?.address || prev.business.address,
          phone: prefill.business?.phone || prev.business.phone,
          email: prefill.business?.email || prev.business.email,
          logoUrl: prefill.business?.logoUrl || prev.business.logoUrl,
        },
        customer: {
          name: prefill.customer?.name || '',
          email: prefill.customer?.email || '',
          phone: prefill.customer?.phone || '',
          address: prefill.customer?.address || '',
        },
      }));
      showToast?.(`Linked & auto-filled from ${prefill.invoiceNumber || 'saved invoice'}.`, 'success');
    } catch (err) {
      setFormError(
        err.response?.data?.message || err.message || 'Unable to pre-fill from selected invoice.'
      );
    } finally {
      setPrefillingInvoice(false);
    }
  };

  const triggerPrintAfterRender = () => {
    window.requestAnimationFrame(() => {
      window.setTimeout(() => {
        window.print();
      }, 120);
    });
  };

  const handleSaveAndPrint = async (e) => {
    e?.preventDefault?.();
    setFormError('');

    if (form.amountPaid === '' || form.amountPaid === null || form.amountPaid === undefined) {
      setFormError('Please enter the Amount Paid before saving and printing.');
      return;
    }

    const numericPaid = Number(form.amountPaid);
    if (!Number.isFinite(numericPaid) || numericPaid < 0) {
      setFormError('Amount Paid must be a valid non-negative amount.');
      return;
    }

    const numericInvoiceTotal =
      form.invoiceTotal === '' || form.invoiceTotal === null
        ? 0
        : Number(form.invoiceTotal);

    if (!Number.isFinite(numericInvoiceTotal) || numericInvoiceTotal < 0) {
      setFormError('Invoice Total must be a valid non-negative amount.');
      return;
    }

    setSavingAndPrinting(true);
    try {
      const saved = await createReceiptApi({
        linkedInvoiceId: form.linkedInvoiceId || null,
        linkedInvoiceNumber: form.linkedInvoiceNumber.trim(),
        business: form.business,
        customer: form.customer,
        paymentMethod: form.paymentMethod,
        paymentReference: form.paymentReference.trim(),
        currency: form.currency,
        invoiceTotal: numericInvoiceTotal,
        amountPaid: numericPaid,
        issuedDate: form.issuedDate || new Date().toISOString(),
        format: form.format,
        notes: form.notes.trim(),
      });

      setForm((prev) => ({
        ...prev,
        receiptNumber: saved.receiptNumber || prev.receiptNumber,
      }));

      if (isAuthenticated) {
        fetchMyReceipts();
      } else {
        clearGuestReceiptDraft();
      }

      showToast?.(
        `Receipt ${saved.receiptNumber || ''} saved — opening Print / Export PDF dialog.`,
        'success'
      );

      triggerPrintAfterRender();
    } catch (err) {
      setFormError(
        err.response?.data?.message ||
          err.message ||
          'Failed to save receipt. Please check your inputs and try again.'
      );
    } finally {
      setSavingAndPrinting(false);
    }
  };

  const handleResetForm = () => {
    setFormError('');
    clearGuestReceiptDraft();
    setForm(buildInitialForm(isAuthenticated ? businessDefaults : null));
    showToast?.('Receipt form reset and ready for next payment.', 'info');
  };

  const handleLoadSavedReceipt = (saved, shouldPrint = false) => {
    setFormError('');
    setForm({
      receiptNumber: saved.receiptNumber || '',
      format: saved.format === 'thermal' ? 'thermal' : 'a5',
      linkedInvoiceId: saved.linkedInvoiceId ? String(saved.linkedInvoiceId) : '',
      linkedInvoiceNumber: saved.linkedInvoiceNumber || '',
      business: {
        name: saved.business?.name || '',
        address: saved.business?.address || '',
        phone: saved.business?.phone || '',
        email: saved.business?.email || '',
        logoUrl: saved.business?.logoUrl || '',
      },
      customer: {
        name: saved.customer?.name || '',
        email: saved.customer?.email || '',
        phone: saved.customer?.phone || '',
        address: saved.customer?.address || '',
      },
      paymentMethod: saved.paymentMethod || 'Cash',
      paymentReference: saved.paymentReference || '',
      currency: saved.currency || 'LKR',
      invoiceTotal: saved.invoiceTotal ? String(saved.invoiceTotal) : '',
      amountPaid: saved.amountPaid !== undefined ? String(saved.amountPaid) : '',
      issuedDate: saved.issuedDate
        ? String(saved.issuedDate).slice(0, 10)
        : new Date().toISOString().slice(0, 10),
      notes: saved.notes || '',
    });
    setHistoryDrawerOpen(false);

    if (shouldPrint) {
      triggerPrintAfterRender();
    }
  };

  const handleDeleteSavedReceipt = async (receiptId) => {
    setDeletingId(receiptId);
    try {
      await deleteReceiptApi(receiptId);
      setMyReceipts((prev) => prev.filter((item) => String(item._id) !== String(receiptId)));
      showToast?.('Receipt deleted from your history.', 'info');
    } catch (err) {
      showToast?.(
        err.response?.data?.message || err.message || 'Failed to delete receipt.',
        'error'
      );
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-5 pb-10" data-testid="receipt-generator-page">
      {/* Guest Ready Banner */}
      <GuestModeBanner
        isAuthenticated={isAuthenticated}
        onSignInClick={() =>
          openAuthModal({
            mode: 'login',
            title: 'Sign in to link invoices & save receipt history',
            subtitle:
              'Guest receipts work immediately. Sign in anytime to link saved invoices and access your cloud receipt history.',
          })
        }
      />

      {/* Top Action Header */}
      <section className="no-print flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 ring-1 ring-amber-200">
            <ReceiptIcon className="h-5 w-5" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-extrabold tracking-tight text-slate-900">
                Receipt Generator
              </h1>
              {form.receiptNumber ? (
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">
                  Saved · {form.receiptNumber}
                </span>
              ) : (
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-semibold text-slate-500">
                  Auto # RCP-YYYY-XXXX
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">
              Issue instant A5 or 80mm thermal payment receipts for cash, card, and bank transfers.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isAuthenticated && (
            <button
              type="button"
              onClick={() => setHistoryDrawerOpen(true)}
              data-testid="receipt-history-toggle"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <History className="h-4 w-4 text-slate-500" />
              My Receipts
              <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-700">
                {myReceipts.length}
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={handleResetForm}
            data-testid="receipt-reset-btn"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            <RotateCcw className="h-3.5 w-3.5 text-slate-500" />
            Reset Form
          </button>

          {form.receiptNumber ? (
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2 text-xs font-semibold text-amber-900 shadow-sm transition hover:bg-amber-100"
            >
              <Printer className="h-4 w-4 text-amber-700" />
              Reprint {form.receiptNumber}
            </button>
          ) : null}

          <button
            type="button"
            onClick={handleSaveAndPrint}
            disabled={savingAndPrinting}
            data-testid="receipt-save-print-btn"
            className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-amber-700 disabled:opacity-60"
          >
            {savingAndPrinting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <Printer className="h-4 w-4" />
                Save &amp; Print / Export PDF
              </>
            )}
          </button>
        </div>
      </section>

      {formError ? (
        <div
          role="alert"
          className="no-print flex items-center gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{formError}</span>
        </div>
      ) : null}

      {/* Split-Screen Workspace: Form (Left) + Live Preview (Right) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start">
        {/* LEFT: Form Controls */}
        <form
          onSubmit={handleSaveAndPrint}
          className="no-print space-y-5 lg:col-span-5"
          noValidate
        >
          {/* 1. Format Switcher & Invoice Link */}
          <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
                Receipt Paper Format
              </label>
              <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => updateField('format', 'a5')}
                  data-testid="format-switch-a5"
                  className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition ${
                    form.format === 'a5'
                      ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <FileText className="h-3.5 w-3.5 text-amber-600" />
                  A5 (148 × 210mm)
                </button>
                <button
                  type="button"
                  onClick={() => updateField('format', 'thermal')}
                  data-testid="format-switch-thermal"
                  className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition ${
                    form.format === 'thermal'
                      ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <ReceiptIcon className="h-3.5 w-3.5 text-amber-600" />
                  Thermal (80mm)
                </button>
              </div>
            </div>

            {isAuthenticated ? (
              <div className="space-y-3 border-t border-slate-100 pt-3.5">
                <div>
                  <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                    <Link2 className="h-3.5 w-3.5 text-amber-600" />
                    Link to Saved Invoice
                  </label>
                  <div className="relative">
                    <select
                      value={form.linkedInvoiceId}
                      onChange={(e) => handleSelectSavedInvoice(e.target.value)}
                      disabled={loadingInvoices || prefillingInvoice}
                      data-testid="link-saved-invoice-select"
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                    >
                      <option value="">
                        {loadingInvoices
                          ? 'Loading saved invoices…'
                          : '— Manual / Standalone Receipt (No linked invoice) —'}
                      </option>
                      {savedInvoices.map((inv) => {
                        const invId = inv._id || inv.id;
                        const custLabel =
                          inv.customerSnapshot?.name ||
                          inv.customerSnapshot?.companyName ||
                          'Customer';
                        return (
                          <option key={invId} value={invId}>
                            {inv.invoiceNumber} · {custLabel} ({inv.currency || 'USD'}{' '}
                            {Number(inv.grandTotal || 0).toFixed(2)})
                          </option>
                        );
                      })}
                    </select>
                    {prefillingInvoice && (
                      <Loader2 className=" absolute right-8 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-amber-600" />
                    )}
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Invoice Reference # (Optional)
                  </label>
                  <input
                    type="text"
                    value={form.linkedInvoiceNumber}
                    onChange={(e) => updateField('linkedInvoiceNumber', e.target.value)}
                    placeholder="e.g. INV-2026-0001"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                  />
                </div>
              </div>
            ) : (
              <div className="border-t border-slate-100 pt-3.5">
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Invoice Reference # (Optional)
                </label>
                <input
                  type="text"
                  value={form.linkedInvoiceNumber}
                  onChange={(e) => updateField('linkedInvoiceNumber', e.target.value)}
                  placeholder="e.g. INV-2026-0042"
                  data-testid="guest-invoice-ref-input"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                />
              </div>
            )}
          </div>

          {/* 2. Payment Details */}
          <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
              <CreditCard className="h-4 w-4 text-amber-600" />
              <h2 className="text-sm font-bold text-slate-900">Payment Details</h2>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                Payment Method
              </label>
              <div className="grid grid-cols-3 gap-2">
                {PAYMENT_METHODS.map((method) => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => updateField('paymentMethod', method)}
                    className={`rounded-xl border px-2.5 py-2 text-xs font-bold transition ${
                      form.paymentMethod === method
                        ? 'border-amber-500 bg-amber-50 text-amber-900 ring-1 ring-amber-400'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    {method}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Currency
                </label>
                <select
                  value={form.currency}
                  onChange={(e) => updateField('currency', e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                >
                  {CURRENCY_OPTIONS.map((code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Issued Date
                </label>
                <input
                  type="date"
                  value={form.issuedDate}
                  onChange={(e) => updateField('issuedDate', e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Invoice Total (Optional)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.invoiceTotal}
                  onChange={(e) => updateField('invoiceTotal', e.target.value)}
                  placeholder="0.00"
                  data-testid="receipt-invoice-total-input"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm tabular-nums text-slate-900 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Amount Paid *
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={form.amountPaid}
                  onChange={(e) => updateField('amountPaid', e.target.value)}
                  placeholder="0.00"
                  data-testid="receipt-amount-paid-input"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold tabular-nums text-slate-900 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                />
              </div>
            </div>

            {/* Auto-calculated Balance Due Strip */}
            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5">
              <div>
                <span className="text-xs font-semibold text-slate-600">
                  Auto-Calculated Balance Due
                </span>
                <p className="text-[11px] text-slate-400">
                  {computedBalanceDue > 0
                    ? 'Marked as PARTIAL receipt'
                    : Number(form.amountPaid) > 0
                      ? 'Marked as PAID in full'
                      : 'Enter payment amount'}
                </p>
              </div>
              <span
                className={`text-sm font-extrabold tabular-nums ${
                  computedBalanceDue > 0 ? 'text-amber-700' : 'text-emerald-700'
                }`}
                data-testid="receipt-computed-balance"
              >
                {formatReceiptMoney(computedBalanceDue, form.currency)}
              </span>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Reference / Transaction ID
              </label>
              <input
                type="text"
                value={form.paymentReference}
                onChange={(e) => updateField('paymentReference', e.target.value)}
                placeholder="e.g. Auth #482910 / Bank Ref SLIPS-991"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Notes (Optional)
              </label>
              <textarea
                rows={2}
                value={form.notes}
                onChange={(e) => updateField('notes', e.target.value)}
                placeholder="Optional payment note or breakdown…"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              />
            </div>
          </div>

          {/* 3. Customer / Payer Details */}
          <div className="space-y-3.5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
              <User className="h-4 w-4 text-amber-600" />
              <h2 className="text-sm font-bold text-slate-900">Customer / Payer Details</h2>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Customer / Payer Name
              </label>
              <input
                type="text"
                value={form.customer.name}
                onChange={(e) => updateNestedField('customer', 'name', e.target.value)}
                placeholder="Walk-in Customer or Client Name"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Email
                </label>
                <input
                  type="email"
                  value={form.customer.email}
                  onChange={(e) => updateNestedField('customer', 'email', e.target.value)}
                  placeholder="client@example.com"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Phone
                </label>
                <input
                  type="text"
                  value={form.customer.phone}
                  onChange={(e) => updateNestedField('customer', 'phone', e.target.value)}
                  placeholder="+94 77 000 0000"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Address
              </label>
              <input
                type="text"
                value={form.customer.address}
                onChange={(e) => updateNestedField('customer', 'address', e.target.value)}
                placeholder="Street, City"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              />
            </div>
          </div>

          {/* 4. Business Details */}
          <div className="space-y-3.5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
              <Building2 className="h-4 w-4 text-amber-600" />
              <h2 className="text-sm font-bold text-slate-900">Business Details</h2>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Business Name
              </label>
              <input
                type="text"
                value={form.business.name}
                onChange={(e) => updateNestedField('business', 'name', e.target.value)}
                placeholder="Your Company / Store Name"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Phone
                </label>
                <input
                  type="text"
                  value={form.business.phone}
                  onChange={(e) => updateNestedField('business', 'phone', e.target.value)}
                  placeholder="+94 11 234 5678"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Email
                </label>
                <input
                  type="email"
                  value={form.business.email}
                  onChange={(e) => updateNestedField('business', 'email', e.target.value)}
                  placeholder="billing@company.com"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Business Address
              </label>
              <input
                type="text"
                value={form.business.address}
                onChange={(e) => updateNestedField('business', 'address', e.target.value)}
                placeholder="100 Main Street, Colombo"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Logo URL (Optional)
              </label>
              <input
                type="url"
                value={form.business.logoUrl}
                onChange={(e) => updateNestedField('business', 'logoUrl', e.target.value)}
                placeholder="https://res.cloudinary.com/.../logo.png"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              />
            </div>
          </div>
        </form>

        {/* RIGHT: Sticky Live Document Preview */}
        <div className="lg:sticky lg:top-20 lg:col-span-7">
          <ReceiptPreviewCanvas receiptData={form} />
        </div>
      </div>

      {/* Logged-in My Saved Receipts Inline Section */}
      {isAuthenticated && (
        <section
          className="no-print rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          data-testid="my-receipts-section"
        >
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-amber-600" />
              <h2 className="text-sm font-bold text-slate-900">My Saved Receipts</h2>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">
                {myReceipts.length}
              </span>
            </div>
            {loadingHistory && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
          </div>

          {myReceipts.length === 0 ? (
            <p className="py-6 text-center text-xs text-slate-500">
              No saved receipts yet. Click <strong>Save &amp; Print / Export PDF</strong> above to issue your first cloud receipt.
            </p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    <th className="py-2 pr-3">Receipt #</th>
                    <th className="px-3 py-2">Payer</th>
                    <th className="px-3 py-2">Method / Format</th>
                    <th className="px-3 py-2 text-right">Amount Paid</th>
                    <th className="px-3 py-2 text-right">Date</th>
                    <th className="py-2 pl-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {myReceipts.slice(0, 10).map((rcp) => (
                    <tr key={rcp._id} className="hover:bg-slate-50/70">
                      <td className="py-2.5 pr-3 font-bold text-slate-900">
                        {rcp.receiptNumber}
                        {rcp.linkedInvoiceNumber ? (
                          <span className="ml-1.5 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                            {rcp.linkedInvoiceNumber}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2.5 text-slate-700">
                        {rcp.customer?.name || 'Walk-in Customer'}
                      </td>
                      <td className="px-3 py-2.5 text-slate-600">
                        {rcp.paymentMethod} ·{' '}
                        <span className="uppercase">{rcp.format || 'a5'}</span>
                      </td>
                      <td className="px-3 py-2.5 text-right font-bold tabular-nums text-emerald-700">
                        {formatReceiptMoney(rcp.amountPaid, rcp.currency)}
                      </td>
                      <td className="px-3 py-2.5 text-right text-slate-500">
                        {rcp.issuedDate ? String(rcp.issuedDate).slice(0, 10) : '—'}
                      </td>
                      <td className="py-2.5 pl-3 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleLoadSavedReceipt(rcp, false)}
                            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            View
                          </button>
                          <button
                            type="button"
                            onClick={() => handleLoadSavedReceipt(rcp, true)}
                            className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 font-semibold text-amber-800 hover:bg-amber-100"
                          >
                            <Printer className="h-3 w-3" /> Reprint
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteSavedReceipt(rcp._id)}
                            disabled={deletingId === rcp._id}
                            aria-label={`Delete ${rcp.receiptNumber}`}
                            className="rounded-lg p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
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
      )}

      {/* Slide-Over My Receipts History Drawer (Logged-in Users) */}
      {isAuthenticated && historyDrawerOpen && (
        <div
          className="no-print fixed inset-0 z-50 flex justify-end bg-slate-900/45 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="My Saved Receipts Drawer"
          data-testid="receipt-history-drawer"
        >
          <div className="flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div className="flex items-center gap-2">
                <History className="h-5 w-5 text-amber-600" />
                <div>
                  <h2 className="text-sm font-bold text-slate-900">My Saved Receipts</h2>
                  <p className="text-xs text-slate-500">
                    Click any receipt to preview or reprint instantly
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setHistoryDrawerOpen(false)}
                aria-label="Close receipts drawer"
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 space-y-2.5 overflow-y-auto p-4">
              {loadingHistory ? (
                <div className="flex items-center justify-center py-12 text-xs text-slate-500">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading receipts…
                </div>
              ) : myReceipts.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-500">
                  You haven&apos;t saved any receipts yet.
                </div>
              ) : (
                myReceipts.map((rcp) => {
                  const isPaid = Number(rcp.balanceDue || 0) <= 0;
                  return (
                    <div
                      key={rcp._id}
                      className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm transition hover:border-amber-300"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-extrabold text-slate-900">
                              {rcp.receiptNumber}
                            </span>
                            <span
                              className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                                isPaid
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : 'bg-amber-50 text-amber-700'
                              }`}
                            >
                              {isPaid && <CheckCircle2 className="h-2.5 w-2.5" />}
                              {isPaid ? 'Paid' : 'Partial'}
                            </span>
                          </div>
                          <p className="mt-0.5 text-xs font-medium text-slate-700">
                            {rcp.customer?.name || 'Walk-in Customer'}
                          </p>
                          <p className="text-[11px] text-slate-400">
                            {rcp.issuedDate ? String(rcp.issuedDate).slice(0, 10) : ''} ·{' '}
                            {rcp.paymentMethod} · {String(rcp.format || 'a5').toUpperCase()}
                          </p>
                        </div>

                        <div className="text-right">
                          <div className="text-xs font-extrabold tabular-nums text-slate-900">
                            {formatReceiptMoney(rcp.amountPaid, rcp.currency)}
                          </div>
                          {rcp.linkedInvoiceNumber ? (
                            <span className="text-[10px] font-medium text-slate-400">
                              Ref: {rcp.linkedInvoiceNumber}
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-end gap-2 border-t border-slate-100 pt-2.5">
                        <button
                          type="button"
                          onClick={() => handleLoadSavedReceipt(rcp, false)}
                          className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          View
                        </button>
                        <button
                          type="button"
                          onClick={() => handleLoadSavedReceipt(rcp, true)}
                          className="inline-flex items-center gap-1 rounded-lg bg-amber-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-amber-700"
                        >
                          <Printer className="h-3 w-3" /> Reprint
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteSavedReceipt(rcp._id)}
                          disabled={deletingId === rcp._id}
                          aria-label={`Delete ${rcp.receiptNumber}`}
                          className="rounded-lg border border-rose-200 bg-rose-50 p-1 text-rose-600 hover:bg-rose-100 disabled:opacity-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ReceiptGeneratorPage;
