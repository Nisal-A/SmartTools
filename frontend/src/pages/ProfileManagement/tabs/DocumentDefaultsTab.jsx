import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CheckCircle2, FileText, Loader2, Save, SlidersHorizontal } from 'lucide-react';
import { getSupportedSizesForTool } from '../../../../../shared/constants/paperSizes.js';
import { updateBusinessProfileApi } from '../../../services/profiles.api.js';
import { useAuth } from '../../../app/AuthContext.jsx';

const CURRENCIES = [
  { code: 'USD', label: 'USD — US Dollar ($)' },
  { code: 'LKR', label: 'LKR — Sri Lankan Rupee (Rs)' },
  { code: 'EUR', label: 'EUR — Euro (€)' },
  { code: 'GBP', label: 'GBP — British Pound (£)' },
  { code: 'AUD', label: 'AUD — Australian Dollar (A$)' },
  { code: 'CAD', label: 'CAD — Canadian Dollar (C$)' },
];

const INVOICE_SIZES = getSupportedSizesForTool('invoice');
const QUOTATION_SIZES = getSupportedSizesForTool('quotation');

const defaultsSchema = z.object({
  defaultCurrency: z.enum(['USD', 'LKR', 'EUR', 'GBP', 'AUD', 'CAD']),
  defaultTaxRate: z.coerce
    .number()
    .min(0, 'Tax rate cannot be negative')
    .max(100, 'Tax rate cannot exceed 100%'),
  defaultPaymentTerms: z.string().trim().min(1, 'Payment terms are required').max(120),
  defaultInvoiceSize: z.enum(['A4', 'A5', 'LETTER', 'LEGAL', 'B5', 'THERMAL_80']),
  defaultQuotationSize: z.enum(['A4', 'A5', 'LETTER', 'LEGAL', 'B5']),
});

export function DocumentDefaultsTab({ businessProfile, onUpdated }) {
  const { showToast } = useAuth();
  const [savedNotice, setSavedNotice] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(defaultsSchema),
    defaultValues: {
      defaultCurrency: businessProfile?.defaultCurrency || 'USD',
      defaultTaxRate: businessProfile?.defaultTaxRate ?? 0,
      defaultPaymentTerms: businessProfile?.defaultPaymentTerms || 'Net 30 days',
      defaultInvoiceSize: businessProfile?.defaultInvoiceSize || 'A4',
      defaultQuotationSize: businessProfile?.defaultQuotationSize || 'A4',
    },
  });

  useEffect(() => {
    reset({
      defaultCurrency: CURRENCIES.some((c) => c.code === businessProfile?.defaultCurrency)
        ? businessProfile.defaultCurrency
        : 'USD',
      defaultTaxRate: businessProfile?.defaultTaxRate ?? 0,
      defaultPaymentTerms: businessProfile?.defaultPaymentTerms || 'Net 30 days',
      defaultInvoiceSize: businessProfile?.defaultInvoiceSize || 'A4',
      defaultQuotationSize: businessProfile?.defaultQuotationSize || 'A4',
    });
  }, [businessProfile, reset]);

  const selectedInvoiceSize = watch('defaultInvoiceSize');
  const selectedQuotationSize = watch('defaultQuotationSize');

  const onSubmit = async (values) => {
    setErrorMsg('');
    setSavedNotice(false);
    try {
      const updated = await updateBusinessProfileApi(values);
      onUpdated?.(updated);
      setSavedNotice(true);
      showToast('Document defaults saved.', 'success');
    } catch (err) {
      setErrorMsg(
        err.response?.data?.message || 'Unable to save document defaults.'
      );
    }
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-6"
      data-testid="profile-defaults-tab"
    >
      <div className="border-b border-slate-100 pb-4">
        <div className="flex items-center gap-2 text-indigo-600">
          <SlidersHorizontal className="h-4 w-4" />
          <span className="text-xs font-bold uppercase tracking-wider">Generator Presets</span>
        </div>
        <h2 className="mt-1 text-lg font-bold text-slate-900">Document Defaults</h2>
        <p className="text-sm text-slate-500">
          Pre-select currency, tax rate, payment terms, and physical paper sizes for new documents.
        </p>
      </div>

      {errorMsg && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700">
          {errorMsg}
        </div>
      )}

      {savedNotice && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-700">
          <CheckCircle2 className="h-4 w-4" /> Document defaults updated.
        </div>
      )}

      <div className="grid gap-5 sm:grid-cols-3">
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-700">
            Default Currency
          </label>
          <select
            data-testid="default-currency-select"
            {...register('defaultCurrency')}
            className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          >
            {CURRENCIES.map((cur) => (
              <option key={cur.code} value={cur.code}>
                {cur.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-700">
            Default Tax Rate (%)
          </label>
          <input
            type="number"
            step="0.1"
            min="0"
            max="100"
            data-testid="default-tax-rate-input"
            {...register('defaultTaxRate')}
            className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
          {errors.defaultTaxRate && (
            <p className="mt-1 text-xs text-rose-600">{errors.defaultTaxRate.message}</p>
          )}
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-700">
            Default Payment Terms
          </label>
          <input
            type="text"
            placeholder="Net 30 days"
            data-testid="default-payment-terms-input"
            {...register('defaultPaymentTerms')}
            className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
          {errors.defaultPaymentTerms && (
            <p className="mt-1 text-xs text-rose-600">
              {errors.defaultPaymentTerms.message}
            </p>
          )}
        </div>
      </div>

      {/* Default Invoice Paper Size */}
      <div className="space-y-3 border-t border-slate-100 pt-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-800">Default Invoice Paper Size</h3>
            <p className="text-xs text-slate-500">
              Supports standard sheets plus 80mm POS thermal receipts.
            </p>
          </div>
          <select
            data-testid="default-invoice-size-select"
            {...register('defaultInvoiceSize')}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
          >
            {INVOICE_SIZES.map((s) => (
              <option key={s.code} value={s.code}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
          {INVOICE_SIZES.map((size) => {
            const active = selectedInvoiceSize === size.code;
            return (
              <button
                key={size.code}
                type="button"
                onClick={() => setValue('defaultInvoiceSize', size.code, { shouldDirty: true })}
                data-testid={`invoice-size-card-${size.code}`}
                className={`flex flex-col items-start rounded-xl border p-3 text-left transition ${
                  active
                    ? 'border-indigo-600 bg-indigo-50/70 ring-1 ring-indigo-600'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <FileText
                  className={`h-4 w-4 ${active ? 'text-indigo-600' : 'text-slate-400'}`}
                />
                <span className="mt-2 text-xs font-bold text-slate-900">{size.name || size.code}</span>
                <span className="text-[10px] text-slate-500">
                  {size.continuousRoll ? `${size.widthMm}mm roll` : `${size.widthMm}×${size.heightMm}mm`}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Default Quotation Paper Size */}
      <div className="space-y-3 border-t border-slate-100 pt-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-800">Default Quotation Paper Size</h3>
            <p className="text-xs text-slate-500">
              Standard business sizes for commercial proposals & quotes.
            </p>
          </div>
          <select
            data-testid="default-quotation-size-select"
            {...register('defaultQuotationSize')}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
          >
            {QUOTATION_SIZES.map((s) => (
              <option key={s.code} value={s.code}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
          {QUOTATION_SIZES.map((size) => {
            const active = selectedQuotationSize === size.code;
            return (
              <button
                key={size.code}
                type="button"
                onClick={() => setValue('defaultQuotationSize', size.code, { shouldDirty: true })}
                data-testid={`quotation-size-card-${size.code}`}
                className={`flex flex-col items-start rounded-xl border p-3 text-left transition ${
                  active
                    ? 'border-emerald-600 bg-emerald-50/70 ring-1 ring-emerald-600'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <FileText
                  className={`h-4 w-4 ${active ? 'text-emerald-600' : 'text-slate-400'}`}
                />
                <span className="mt-2 text-xs font-bold text-slate-900">{size.name || size.code}</span>
                <span className="text-[10px] text-slate-500">
                  {size.widthMm}×{size.heightMm}mm
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex justify-end border-t border-slate-100 pt-4">
        <button
          type="submit"
          disabled={isSubmitting}
          data-testid="save-defaults-btn"
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-60"
        >
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save Document Defaults
        </button>
      </div>
    </form>
  );
}

export default DocumentDefaultsTab;
