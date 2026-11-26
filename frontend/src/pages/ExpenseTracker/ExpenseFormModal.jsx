import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ExternalLink,
  FileText,
  Loader2,
  Paperclip,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react';
import {
  ALLOWED_RECEIPT_MIME_TYPES,
  EXPENSE_CATEGORIES,
  EXPENSE_CURRENCIES,
  EXPENSE_PAYMENT_METHODS,
  MAX_RECEIPT_FILE_BYTES,
  createExpenseApi,
  updateExpenseApi,
} from '../../services/expenses.api.js';
import {
  formatBytes,
  isPdfAttachment,
  toDateInputValue,
} from './expenseHelpers.js';

export function ExpenseFormModal({
  isOpen,
  expense = null,
  defaultCurrency = 'LKR',
  defaultMonth = '',
  onClose,
  onSaved,
}) {
  const isEditing = Boolean(expense?._id);
  const fileInputRef = useRef(null);

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState(defaultCurrency);
  const [expenseDate, setExpenseDate] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Card');
  const [vendor, setVendor] = useState('');
  const [notes, setNotes] = useState('');

  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedPreviewUrl, setSelectedPreviewUrl] = useState('');
  const [removeExistingReceipt, setRemoveExistingReceipt] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;

    if (expense) {
      setTitle(expense.title || '');
      setCategory(expense.category || EXPENSE_CATEGORIES[0]);
      setAmount(
        expense.amount !== undefined && expense.amount !== null
          ? String(expense.amount)
          : ''
      );
      setCurrency(expense.currency || defaultCurrency || 'LKR');
      setExpenseDate(toDateInputValue(expense.expenseDate));
      setPaymentMethod(expense.paymentMethod || 'Card');
      setVendor(expense.vendor || '');
      setNotes(expense.notes || '');
    } else {
      const todayStr = new Date().toISOString().slice(0, 10);
      const initialDate =
        defaultMonth && !todayStr.startsWith(defaultMonth)
          ? `${defaultMonth}-01`
          : todayStr;
      setTitle('');
      setCategory(EXPENSE_CATEGORIES[0]);
      setAmount('');
      setCurrency(defaultCurrency || 'LKR');
      setExpenseDate(initialDate);
      setPaymentMethod('Card');
      setVendor('');
      setNotes('');
    }

    setSelectedFile(null);
    setRemoveExistingReceipt(false);
    setIsDragging(false);
    setError('');
  }, [isOpen, expense, defaultCurrency, defaultMonth]);

  useEffect(() => {
    if (!selectedFile || selectedFile.type === 'application/pdf') {
      setSelectedPreviewUrl('');
      return undefined;
    }

    const url = URL.createObjectURL(selectedFile);
    setSelectedPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [selectedFile]);

  if (!isOpen) return null;

  const existingReceipt =
    !removeExistingReceipt && expense?.receiptAttachment?.url
      ? expense.receiptAttachment
      : null;

  const handlePickedFile = (file) => {
    if (!file) return;
    setError('');

    if (!ALLOWED_RECEIPT_MIME_TYPES.includes(file.type)) {
      setError(
        'Unsupported receipt file type. Please choose JPEG, PNG, WEBP, or PDF.'
      );
      return;
    }

    if (file.size > MAX_RECEIPT_FILE_BYTES) {
      setError('Receipt file exceeds the 5 MB size limit.');
      return;
    }

    setSelectedFile(file);
    setRemoveExistingReceipt(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) {
      handlePickedFile(file);
    }
  };

  const clearSelectedFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError('Expense title is required.');
      return;
    }

    const numericAmount = Number(amount);
    if (amount === '' || !Number.isFinite(numericAmount) || numericAmount < 0) {
      setError('Please enter a valid non-negative expense amount.');
      return;
    }

    if (!expenseDate) {
      setError('Expense date is required.');
      return;
    }

    const formData = new FormData();
    formData.append('title', trimmedTitle);
    formData.append('category', category);
    formData.append('amount', String(numericAmount));
    formData.append('currency', currency);
    formData.append('expenseDate', expenseDate);
    formData.append('paymentMethod', paymentMethod);
    formData.append('vendor', vendor.trim());
    formData.append('notes', notes.trim());

    if (selectedFile) {
      formData.append('receipt', selectedFile);
    } else if (isEditing && removeExistingReceipt) {
      formData.append('removeReceipt', 'true');
    }

    setSaving(true);
    try {
      if (isEditing) {
        await updateExpenseApi(expense._id, formData);
      } else {
        await createExpenseApi(formData);
      }
      if (onSaved) {
        await onSaved();
      }
      onClose();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          'Failed to save expense. Please try again.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="expense-form-modal-title"
      data-testid="expense-form-modal"
    >
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-4">
          <div>
            <h2
              id="expense-form-modal-title"
              className="text-lg font-extrabold text-slate-900"
            >
              {isEditing ? 'Edit Expense' : 'Add New Expense'}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Record expense details and optionally attach a receipt image or PDF (max 5 MB).
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close expense modal"
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
            {error && (
              <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-700">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700">
                  Expense Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Airport Taxi, Figma Team Subscription"
                  data-testid="expense-title-input"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Category <span className="text-rose-500">*</span>
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  data-testid="expense-category-select"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-100"
                >
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Expense Date <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                  data-testid="expense-date-input"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Amount <span className="text-rose-500">*</span>
                </label>
                <div className="mt-1 flex gap-2">
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    aria-label="Expense currency"
                    className="w-24 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2.5 text-sm font-semibold text-slate-700 focus:border-rose-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-100"
                  >
                    {EXPENSE_CURRENCIES.map((cur) => (
                      <option key={cur} value={cur}>
                        {cur}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    data-testid="expense-amount-input"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Payment Method
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  data-testid="expense-payment-method-select"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-100"
                >
                  {EXPENSE_PAYMENT_METHODS.map((pm) => (
                    <option key={pm} value={pm}>
                      {pm}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700">
                  Vendor / Payee
                </label>
                <input
                  type="text"
                  value={vendor}
                  onChange={(e) => setVendor(e.target.value)}
                  placeholder="e.g., PickMe, AWS, Ceylon Electricity Board"
                  data-testid="expense-vendor-input"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-100"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700">
                  Notes
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional reference, project tag, or tax note…"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-100"
                />
              </div>
            </div>

            {/* Receipt Drag & Drop / File Picker */}
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Receipt Attachment (Optional)
              </label>

              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                className={`mt-1.5 rounded-2xl border-2 border-dashed p-4 transition ${
                  isDragging
                    ? 'border-rose-400 bg-rose-50/70'
                    : 'border-slate-200 bg-slate-50/70 hover:border-slate-300'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  onChange={(e) => handlePickedFile(e.target.files?.[0])}
                  data-testid="expense-receipt-file-input"
                  className="hidden"
                />

                {selectedFile ? (
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-center gap-3">
                      {selectedPreviewUrl ? (
                        <img
                          src={selectedPreviewUrl}
                          alt="Selected receipt preview"
                          className="h-14 w-14 shrink-0 rounded-xl border border-slate-200 bg-white object-cover"
                        />
                      ) : (
                        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 text-rose-600">
                          <FileText className="h-6 w-6" />
                        </span>
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-800">
                          {selectedFile.name}
                        </p>
                        <p className="text-xs text-slate-500">
                          {formatBytes(selectedFile.size)} · Ready to upload
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Replace
                      </button>
                      <button
                        type="button"
                        onClick={clearSelectedFile}
                        className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Remove
                      </button>
                    </div>
                  </div>
                ) : existingReceipt ? (
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-center gap-3">
                      {isPdfAttachment(existingReceipt) ? (
                        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-rose-600">
                          <FileText className="h-6 w-6" />
                        </span>
                      ) : (
                        <img
                          src={existingReceipt.url}
                          alt={existingReceipt.originalName || 'Attached receipt'}
                          className="h-14 w-14 shrink-0 rounded-xl border border-slate-200 bg-white object-cover"
                        />
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-800">
                          {existingReceipt.originalName || 'Attached receipt'}
                        </p>
                        <a
                          href={existingReceipt.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 hover:underline"
                        >
                          <ExternalLink className="h-3 w-3" /> View current attachment
                        </a>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Replace File
                      </button>
                      <button
                        type="button"
                        onClick={() => setRemoveExistingReceipt(true)}
                        className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-3 text-center">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-rose-600 shadow-sm ring-1 ring-slate-200">
                      <UploadCloud className="h-5 w-5" />
                    </span>
                    <p className="mt-2.5 text-xs font-semibold text-slate-700">
                      Drag and drop receipt here, or{' '}
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="text-rose-600 underline hover:text-rose-700"
                      >
                        browse files
                      </button>
                    </p>
                    <p className="mt-1 text-[11px] text-slate-400">
                      Supports JPEG, PNG, WEBP, or PDF up to 5 MB
                    </p>
                    {removeExistingReceipt && (
                      <p className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-amber-700">
                        <Paperclip className="h-3 w-3" /> Existing receipt will be removed when saved.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 border-t border-slate-100 bg-slate-50 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              data-testid="expense-form-submit"
              className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700 disabled:opacity-60"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {saving
                ? selectedFile
                  ? 'Uploading Receipt & Saving…'
                  : 'Saving Expense…'
                : isEditing
                  ? 'Save Changes'
                  : 'Add Expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ExpenseFormModal;
