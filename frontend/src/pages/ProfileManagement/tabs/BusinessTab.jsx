import React, { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Building2,
  CheckCircle2,
  ImagePlus,
  Landmark,
  Loader2,
  Save,
  UploadCloud,
} from 'lucide-react';
import {
  updateBusinessProfileApi,
  uploadBusinessLogoApi,
} from '../../../services/profiles.api.js';
import { useAuth } from '../../../app/AuthContext.jsx';

const businessSchema = z.object({
  businessName: z.string().trim().min(1, 'Business name is required'),
  taxRegistrationNo: z.string().trim().optional().or(z.literal('')),
  email: z.string().trim().email('Enter a valid business email').optional().or(z.literal('')),
  phone: z.string().trim().optional().or(z.literal('')),
  website: z.string().trim().optional().or(z.literal('')),
  address: z.object({
    street: z.string().trim().optional().or(z.literal('')),
    city: z.string().trim().optional().or(z.literal('')),
    state: z.string().trim().optional().or(z.literal('')),
    postalCode: z.string().trim().optional().or(z.literal('')),
    country: z.string().trim().optional().or(z.literal('')),
  }),
  bankDetails: z.object({
    bankName: z.string().trim().optional().or(z.literal('')),
    accountName: z.string().trim().optional().or(z.literal('')),
    accountNumber: z.string().trim().optional().or(z.literal('')),
    routingOrSwift: z.string().trim().optional().or(z.literal('')),
    iban: z.string().trim().optional().or(z.literal('')),
    branch: z.string().trim().optional().or(z.literal('')),
    instructions: z.string().trim().optional().or(z.literal('')),
  }),
});

function buildFormDefaults(biz) {
  const addr = typeof biz?.address === 'object' && biz?.address ? biz.address : {};
  const bank =
    typeof biz?.bankDetails === 'object' && biz?.bankDetails ? biz.bankDetails : {};
  return {
    businessName: biz?.businessName || '',
    taxRegistrationNo: biz?.taxRegistrationNo || '',
    email: biz?.email || '',
    phone: biz?.phone || '',
    website: biz?.website || '',
    address: {
      street: addr.street || '',
      city: addr.city || '',
      state: addr.state || '',
      postalCode: addr.postalCode || '',
      country: addr.country || '',
    },
    bankDetails: {
      bankName: bank.bankName || '',
      accountName: bank.accountName || '',
      accountNumber: bank.accountNumber || '',
      routingOrSwift: bank.routingOrSwift || '',
      iban: bank.iban || '',
      branch: bank.branch || '',
      instructions: bank.instructions || '',
    },
  };
}

export function BusinessTab({ businessProfile, onUpdated }) {
  const { showToast } = useAuth();
  const fileInputRef = useRef(null);
  const [logoPreview, setLogoPreview] = useState(businessProfile?.logoUrl || '');
  const [isDragging, setIsDragging] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [savedNotice, setSavedNotice] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(businessSchema),
    defaultValues: buildFormDefaults(businessProfile),
  });

  useEffect(() => {
    reset(buildFormDefaults(businessProfile));
    setLogoPreview(businessProfile?.logoUrl || '');
  }, [businessProfile, reset]);

  const handleLogoFile = async (file) => {
    if (!file) return;
    setErrorMsg('');

    if (!file.type.startsWith('image/')) {
      setErrorMsg('Please select a valid image file (PNG, JPG, WEBP, or SVG).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg('Logo file must be 5 MB or smaller.');
      return;
    }

    setIsUploadingLogo(true);
    try {
      const result = await uploadBusinessLogoApi(file);
      const nextUrl = result?.logoUrl || result?.businessProfile?.logoUrl || '';
      setLogoPreview(nextUrl);
      if (result?.businessProfile) {
        onUpdated?.(result.businessProfile);
      }
      showToast('Business logo uploaded and saved.', 'success');
    } catch (err) {
      setErrorMsg(
        err.response?.data?.message || 'Unable to upload business logo.'
      );
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) handleLogoFile(file);
  };

  const onSubmit = async (values) => {
    setErrorMsg('');
    setSavedNotice(false);
    try {
      const updated = await updateBusinessProfileApi({
        ...values,
        logoUrl: logoPreview,
      });
      onUpdated?.(updated);
      setSavedNotice(true);
      showToast('Business profile and bank details saved.', 'success');
    } catch (err) {
      setErrorMsg(
        err.response?.data?.message || 'Unable to save business profile.'
      );
    }
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-6"
      data-testid="profile-business-tab"
    >
      <div className="border-b border-slate-100 pb-4">
        <div className="flex items-center gap-2 text-indigo-600">
          <Building2 className="h-4 w-4" />
          <span className="text-xs font-bold uppercase tracking-wider">Reusable Branding</span>
        </div>
        <h2 className="mt-1 text-lg font-bold text-slate-900">Business Profile & Bank Details</h2>
        <p className="text-sm text-slate-500">
          Automatically populates your Invoice Generator and Quotation Generator headers and payment blocks.
        </p>
      </div>

      {errorMsg && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700">
          {errorMsg}
        </div>
      )}

      {savedNotice && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-700">
          <CheckCircle2 className="h-4 w-4" /> Business profile saved and synced to generators.
        </div>
      )}

      {/* Drag & Drop Logo Uploader */}
      <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5">
        <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-600">
          Business Logo
        </label>
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
            {logoPreview ? (
              <img
                src={logoPreview}
                alt="Business logo preview"
                data-testid="business-logo-preview"
                className="max-h-full max-w-full object-contain"
              />
            ) : (
              <ImagePlus className="h-8 w-8 text-slate-300" />
            )}
          </div>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            data-testid="business-logo-dropzone"
            className={`flex flex-1 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-5 text-center transition ${
              isDragging
                ? 'border-indigo-500 bg-indigo-50/60'
                : 'border-slate-300 bg-white hover:border-indigo-400'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
              data-testid="business-logo-input"
              className="hidden"
              onChange={(e) => handleLogoFile(e.target.files?.[0])}
            />
            {isUploadingLogo ? (
              <div className="flex items-center gap-2 text-sm font-semibold text-indigo-600">
                <Loader2 className="h-4 w-4 animate-spin" /> Uploading logo…
              </div>
            ) : (
              <>
                <UploadCloud className="h-6 w-6 text-indigo-500" />
                <p className="mt-1.5 text-sm font-semibold text-slate-700">
                  Drag & drop your logo here, or <span className="text-indigo-600">browse</span>
                </p>
                <p className="mt-0.5 text-xs text-slate-400">
                  PNG, JPG, WEBP, or SVG up to 5 MB
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Business Identity */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-700">
            Business Name *
          </label>
          <input
            type="text"
            placeholder="Acme Digital Studio LLC"
            data-testid="business-name-input"
            {...register('businessName')}
            className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
          {errors.businessName && (
            <p className="mt-1 text-xs text-rose-600">{errors.businessName.message}</p>
          )}
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-700">
            Tax / VAT / Business Registration No.
          </label>
          <input
            type="text"
            placeholder="EIN-12-3456789"
            data-testid="business-tax-input"
            {...register('taxRegistrationNo')}
            className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-700">
            Business Email
          </label>
          <input
            type="email"
            placeholder="billing@company.com"
            data-testid="business-email-input"
            {...register('email')}
            className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
          {errors.email && (
            <p className="mt-1 text-xs text-rose-600">{errors.email.message}</p>
          )}
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-700">
            Business Phone
          </label>
          <input
            type="tel"
            placeholder="+1 (555) 200-3000"
            data-testid="business-phone-input"
            {...register('phone')}
            className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-xs font-semibold text-slate-700">
            Website
          </label>
          <input
            type="text"
            placeholder="https://company.com"
            {...register('website')}
            className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>
      </div>

      {/* Business Address */}
      <div className="space-y-3 border-t border-slate-100 pt-5">
        <h3 className="text-sm font-bold text-slate-800">Business Address</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-semibold text-slate-600">Street Address</label>
            <input
              type="text"
              placeholder="100 Innovation Way, Suite 400"
              {...register('address.street')}
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">City</label>
            <input
              type="text"
              placeholder="San Francisco"
              {...register('address.city')}
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">State / Province</label>
            <input
              type="text"
              placeholder="CA"
              {...register('address.state')}
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Postal Code</label>
            <input
              type="text"
              placeholder="94105"
              {...register('address.postalCode')}
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Country</label>
            <input
              type="text"
              placeholder="United States"
              {...register('address.country')}
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
        </div>
      </div>

      {/* Bank Account Details */}
      <div className="space-y-3 border-t border-slate-100 pt-5">
        <div className="flex items-center gap-2">
          <Landmark className="h-4 w-4 text-indigo-600" />
          <h3 className="text-sm font-bold text-slate-800">Bank Account Details</h3>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Bank Name</label>
            <input
              type="text"
              placeholder="Silicon Commercial Bank"
              data-testid="bank-name-input"
              {...register('bankDetails.bankName')}
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Account Name</label>
            <input
              type="text"
              placeholder="Acme Digital Studio LLC"
              data-testid="bank-account-name-input"
              {...register('bankDetails.accountName')}
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Account Number</label>
            <input
              type="text"
              placeholder="001122334455"
              data-testid="bank-account-number-input"
              {...register('bankDetails.accountNumber')}
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">SWIFT / Routing Code</label>
            <input
              type="text"
              placeholder="SCBUS33XXX"
              data-testid="bank-swift-input"
              {...register('bankDetails.routingOrSwift')}
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Branch</label>
            <input
              type="text"
              placeholder="Downtown Financial District"
              data-testid="bank-branch-input"
              {...register('bankDetails.branch')}
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">IBAN (Optional)</label>
            <input
              type="text"
              placeholder="GB29 NWBK 6016 1331 9268 19"
              {...register('bankDetails.iban')}
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-semibold text-slate-600">
              Payment Instructions (Optional)
            </label>
            <textarea
              rows={2}
              placeholder="Please include the invoice number as your wire reference."
              {...register('bankDetails.instructions')}
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end border-t border-slate-100 pt-4">
        <button
          type="submit"
          disabled={isSubmitting}
          data-testid="save-business-btn"
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-60"
        >
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save Business Profile
        </button>
      </div>
    </form>
  );
}

export default BusinessTab;
