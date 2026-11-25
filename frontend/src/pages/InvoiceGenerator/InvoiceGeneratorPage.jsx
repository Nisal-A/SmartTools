import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import {
  Building2,
  CheckCircle2,
  Copy,
  CreditCard,
  Edit3,
  Eye,
  FilePlus2,
  History,
  ImagePlus,
  Loader2,
  Search,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { calculateDocumentTotals } from '@shared/utils/financialMath.js';
import { useAuth } from '../../app/AuthContext.jsx';
import { apiClient } from '../../services/apiClient.js';
import {
  createInvoice,
  deleteInvoice,
  duplicateInvoice,
  getInvoiceById,
  listInvoices,
  updateInvoice,
} from '../../services/invoices.api.js';
import {
  autoSaveDraft,
  clearDraft,
  loadDraft,
} from '../../services/guestDraft.service.js';
import { PaperSizeSelector } from '../../components/shared/PaperSizeSelector.jsx';
import { DocumentPaperCanvas } from '../../components/shared/DocumentPaperCanvas.jsx';
import { LineItemsTable } from '../../components/shared/LineItemsTable.jsx';
import { CustomerPickerModal } from '../../components/shared/CustomerPickerModal.jsx';
import { GuestModeBanner } from '../../components/shared/GuestModeBanner.jsx';
import { DocumentExportBar } from '../../components/shared/DocumentExportBar.jsx';
import { InvoiceDocumentTemplate } from '../../components/invoice/InvoiceDocumentTemplate.jsx';
import { InvoiceStatusBadge } from '../../components/invoice/InvoiceStatusBadge.jsx';
import { PaymentRecorderModal } from '../../components/invoice/PaymentRecorderModal.jsx';

function buildEmptyInvoice(overrides = {}) {
  const today = new Date();
  const dueDate = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
  return {
    invoiceNumber: '',
    issueDate: today.toISOString().slice(0, 10),
    dueDate: dueDate.toISOString().slice(0, 10),
    currency: 'USD',
    status: 'draft',
    paymentTerms: 'Net 30 days',
    customerId: null,
    businessSnapshot: {
      businessName: '',
      taxRegistrationNo: '',
      email: '',
      phone: '',
      logoUrl: '',
      address: { street: '', city: '', state: '', postalCode: '', country: '' },
    },
    customerSnapshot: {
      name: '',
      companyName: '',
      email: '',
      phone: '',
      taxId: '',
      billingAddress: { street: '', city: '', state: '', postalCode: '', country: '' },
    },
    bankDetails: {
      bankName: '',
      accountName: '',
      accountNumber: '',
      routingOrSwift: '',
      iban: '',
    },
    items: [
      {
        name: '',
        description: '',
        quantity: 1,
        unit: 'pcs',
        unitPrice: 0,
        discountType: 'percentage',
        discountValue: 0,
        taxRate: 0,
      },
    ],
    globalDiscountType: 'percentage',
    globalDiscountValue: 0,
    shippingOrAdjustment: 0,
    amountPaid: 0,
    notes: '',
    pageSize: 'A4',
    orientation: 'portrait',
    templateKey: 'indigo',
    ...overrides,
  };
}

function normalizeServerInvoiceToForm(doc) {
  if (!doc) return buildEmptyInvoice();
  return buildEmptyInvoice({
    invoiceNumber: doc.invoiceNumber || '',
    issueDate: doc.issueDate ? String(doc.issueDate).slice(0, 10) : '',
    dueDate: doc.dueDate ? String(doc.dueDate).slice(0, 10) : '',
    currency: doc.currency || 'USD',
    status: doc.status || 'draft',
    paymentTerms: doc.paymentTerms || '',
    customerId: doc.customerId || null,
    sourceQuotationId: doc.sourceQuotationId || null,
    businessSnapshot: {
      businessName: doc.businessSnapshot?.businessName || '',
      taxRegistrationNo: doc.businessSnapshot?.taxRegistrationNo || '',
      email: doc.businessSnapshot?.email || '',
      phone: doc.businessSnapshot?.phone || '',
      logoUrl: doc.businessSnapshot?.logoUrl || '',
      address:
        typeof doc.businessSnapshot?.address === 'object'
          ? {
              street: doc.businessSnapshot.address.street || '',
              city: doc.businessSnapshot.address.city || '',
              state: doc.businessSnapshot.address.state || '',
              postalCode: doc.businessSnapshot.address.postalCode || '',
              country: doc.businessSnapshot.address.country || '',
            }
          : {
              street: String(doc.businessSnapshot?.address || ''),
              city: '',
              state: '',
              postalCode: '',
              country: '',
            },
    },
    customerSnapshot: {
      name: doc.customerSnapshot?.name || '',
      companyName: doc.customerSnapshot?.companyName || '',
      email: doc.customerSnapshot?.email || '',
      phone: doc.customerSnapshot?.phone || '',
      taxId: doc.customerSnapshot?.taxId || '',
      billingAddress:
        typeof doc.customerSnapshot?.billingAddress === 'object'
          ? {
              street: doc.customerSnapshot.billingAddress.street || '',
              city: doc.customerSnapshot.billingAddress.city || '',
              state: doc.customerSnapshot.billingAddress.state || '',
              postalCode: doc.customerSnapshot.billingAddress.postalCode || '',
              country: doc.customerSnapshot.billingAddress.country || '',
            }
          : {
              street: String(doc.customerSnapshot?.billingAddress || doc.customerSnapshot?.address || ''),
              city: '',
              state: '',
              postalCode: '',
              country: '',
            },
    },
    bankDetails: {
      bankName: doc.bankDetailsSnapshot?.bankName || doc.businessSnapshot?.bankDetails?.bankName || '',
      accountName:
        doc.bankDetailsSnapshot?.accountName || doc.businessSnapshot?.bankDetails?.accountName || '',
      accountNumber:
        doc.bankDetailsSnapshot?.accountNumber || doc.businessSnapshot?.bankDetails?.accountNumber || '',
      routingOrSwift:
        doc.bankDetailsSnapshot?.routingOrSwift ||
        doc.businessSnapshot?.bankDetails?.routingOrSwift ||
        '',
      iban: doc.bankDetailsSnapshot?.iban || doc.businessSnapshot?.bankDetails?.iban || '',
    },
    items:
      Array.isArray(doc.items) && doc.items.length > 0
        ? doc.items.map((it) => ({
            name: it.name || '',
            description: it.description || '',
            quantity: Number(it.quantity) || 1,
            unit: it.unit || 'pcs',
            unitPrice: Number(it.unitPrice) || 0,
            discountType: it.discountType || 'percentage',
            discountValue: Number(it.discountValue) || 0,
            taxRate: Number(it.taxRate) || 0,
          }))
        : buildEmptyInvoice().items,
    globalDiscountType: doc.discount?.type || 'percentage',
    globalDiscountValue: Number(doc.discount?.value) || 0,
    shippingOrAdjustment: Number(doc.shippingOrAdjustment) || 0,
    amountPaid: Number(doc.amountPaid) || 0,
    notes: doc.notes || '',
    pageSize: doc.pageSize || 'A4',
    orientation: doc.orientation || 'portrait',
    templateKey: doc.templateKey || 'indigo',
  });
}

export function InvoiceGeneratorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, openAuthModal } = useAuth();

  const [mobileTab, setMobileTab] = useState('edit');
  const [savedInvoice, setSavedInvoice] = useState(null);
  const [profileBusiness, setProfileBusiness] = useState(null);
  const [overrideBusiness, setOverrideBusiness] = useState(false);
  const [defaultTaxRate, setDefaultTaxRate] = useState(0);
  const [isLoadingDoc, setIsLoadingDoc] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [historyDrawerOpen, setHistoryDrawerOpen] = useState(false);
  const [invoiceHistory, setInvoiceHistory] = useState([]);
  const [historySearch, setHistorySearch] = useState('');
  const [historyStatusFilter, setHistoryStatusFilter] = useState('');
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [toast, setToast] = useState(null);
  const [formError, setFormError] = useState('');

  const hydratedRef = useRef(false);

  const {
    control,
    register,
    watch,
    setValue,
    reset,
    getValues,
    formState: { errors },
  } = useForm({
    defaultValues: buildEmptyInvoice(),
  });

  const watched = watch();
  const liveTotals = useMemo(() => calculateDocumentTotals(watched), [watched]);

  const showToast = useCallback((message, tone = 'success') => {
    setToast({ message, tone });
    setTimeout(() => {
      setToast((curr) => (curr?.message === message ? null : curr));
    }, 4500);
  }, []);

  // Show incoming navigation toast (e.g., from Guest-to-Cloud migration or Quote Conversion)
  useEffect(() => {
    if (location.state?.toastMessage) {
      showToast(location.state.toastMessage);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, location.pathname, navigate, showToast]);

  // Load existing saved invoice (if `:id` present & authenticated) OR auto-fill Business Profile OR load Guest Draft
  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      setFormError('');

      if (isAuthenticated && id) {
        setIsLoadingDoc(true);
        try {
          const doc = await getInvoiceById(id);
          if (!cancelled) {
            setSavedInvoice(doc);
            reset(normalizeServerInvoiceToForm(doc));
            setOverrideBusiness(true);
            hydratedRef.current = true;
          }
        } catch (err) {
          if (!cancelled) {
            setFormError(err.response?.data?.message || 'Unable to load invoice.');
          }
        } finally {
          if (!cancelled) setIsLoadingDoc(false);
        }
        return;
      }

      if (isAuthenticated && !id) {
        setSavedInvoice(null);
        try {
          const res = await apiClient.get('/profiles/me');
          const biz = res.data?.data?.businessProfile || res.data?.businessProfile || null;
          if (!cancelled && biz) {
            setProfileBusiness(biz);
            setDefaultTaxRate(Number(biz.defaultTaxRate) || 0);
            const defaults = buildEmptyInvoice({
              currency: biz.defaultCurrency || 'USD',
              paymentTerms: biz.defaultPaymentTerms || 'Net 30 days',
              pageSize: biz.defaultInvoiceSize || 'A4',
              businessSnapshot: {
                businessName: biz.businessName || '',
                taxRegistrationNo: biz.taxRegistrationNo || '',
                email: biz.email || '',
                phone: biz.phone || '',
                logoUrl: biz.logoUrl || '',
                address: biz.address || {
                  street: '',
                  city: '',
                  state: '',
                  postalCode: '',
                  country: '',
                },
              },
              bankDetails: biz.bankDetails || {
                bankName: '',
                accountName: '',
                accountNumber: '',
                routingOrSwift: '',
                iban: '',
              },
              items: [
                {
                  name: '',
                  description: '',
                  quantity: 1,
                  unit: 'pcs',
                  unitPrice: 0,
                  discountType: 'percentage',
                  discountValue: 0,
                  taxRate: Number(biz.defaultTaxRate) || 0,
                },
              ],
            });
            reset(defaults);
            setOverrideBusiness(false);
          }
        } catch {
          // Profile may not be created yet; allow direct entry
          if (!cancelled) setOverrideBusiness(true);
        }
        hydratedRef.current = true;
        return;
      }

      // Guest Mode: hydrate from smarttools_guest_invoice_draft
      if (!isAuthenticated) {
        setSavedInvoice(null);
        setOverrideBusiness(true);
        const draft = loadDraft('invoice');
        if (draft?.data) {
          reset(buildEmptyInvoice(draft.data));
          setLastSavedAt(draft.updatedAt);
        } else {
          reset(buildEmptyInvoice());
        }
        hydratedRef.current = true;
      }
    }

    hydrate();
    return () => {
      cancelled = true;
    };
  }, [id, isAuthenticated, reset]);

  // Guest Mode debounced localStorage auto-save
  useEffect(() => {
    if (isAuthenticated || !hydratedRef.current) return;
    autoSaveDraft('invoice', watched, 450, (result) => {
      if (result.saved) setLastSavedAt(result.updatedAt);
    });
  }, [isAuthenticated, watched]);

  const fetchMyInvoices = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const res = await listInvoices({
        search: historySearch || undefined,
        status: historyStatusFilter || undefined,
        limit: 50,
      });
      setInvoiceHistory(Array.isArray(res?.data) ? res.data : []);
    } catch {
      // Ignore drawer fetch error
    }
  }, [isAuthenticated, historySearch, historyStatusFilter]);

  useEffect(() => {
    if (historyDrawerOpen && isAuthenticated) {
      fetchMyInvoices();
    }
  }, [historyDrawerOpen, isAuthenticated, fetchMyInvoices]);

  const buildPayloadFromValues = (vals) => ({
    ...(vals.invoiceNumber?.trim() ? { invoiceNumber: vals.invoiceNumber.trim() } : {}),
    issueDate: vals.issueDate || new Date().toISOString().slice(0, 10),
    dueDate: vals.dueDate || null,
    currency: vals.currency || 'USD',
    status: vals.status || 'draft',
    paymentTerms: vals.paymentTerms || '',
    customerId: vals.customerId || null,
    businessSnapshot: {
      ...vals.businessSnapshot,
      businessName: vals.businessSnapshot?.businessName?.trim() || 'My Business',
    },
    customerSnapshot: {
      ...vals.customerSnapshot,
      name: vals.customerSnapshot?.name?.trim() || 'Customer',
    },
    bankDetails: vals.bankDetails || {},
    items: (vals.items || []).map((item, idx) => ({
      sortOrder: idx,
      name: item.name?.trim() || `Item ${idx + 1}`,
      description: item.description || '',
      quantity: Number(item.quantity) > 0 ? Number(item.quantity) : 1,
      unit: item.unit || 'pcs',
      unitPrice: Number(item.unitPrice) >= 0 ? Number(item.unitPrice) : 0,
      discountType: item.discountType || 'percentage',
      discountValue: Number(item.discountValue) || 0,
      taxRate: Number(item.taxRate) || 0,
    })),
    globalDiscountType: vals.globalDiscountType || 'percentage',
    globalDiscountValue: Number(vals.globalDiscountValue) || 0,
    shippingOrAdjustment: Number(vals.shippingOrAdjustment) || 0,
    amountPaid: Number(vals.amountPaid) || 0,
    notes: vals.notes || '',
    pageSize: vals.pageSize || 'A4',
    orientation: vals.orientation || 'portrait',
    templateKey: vals.templateKey || 'indigo',
  });

  const handleSaveAuthenticated = async (overrideValues = null) => {
    setFormError('');
    setIsSaving(true);
    try {
      const payload = buildPayloadFromValues(overrideValues || getValues());
      if (id && savedInvoice?._id) {
        const updated = await updateInvoice(id, payload);
        setSavedInvoice(updated);
        reset(normalizeServerInvoiceToForm(updated));
        showToast(`Invoice ${updated.invoiceNumber} updated in cloud.`);
      } else {
        const created = await createInvoice(payload);
        setSavedInvoice(created);
        clearDraft('invoice');
        navigate(`/tools/invoice-generator/${created._id}`, {
          replace: true,
          state: { toastMessage: `Invoice ${created.invoiceNumber} saved to cloud!` },
        });
      }
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to save invoice.');
    } finally {
      setIsSaving(false);
    }
  };

  // Seamless Guest-to-Cloud migration flow via AuthModal
  const handleGuestSaveToCloud = () => {
    const currentSnapshot = getValues();
    openAuthModal({
      mode: 'register',
      title: 'Save Invoice to Cloud',
      subtitle: 'Sign in or create an account — your current invoice draft will save automatically.',
      onSuccess: async () => {
        setIsSaving(true);
        try {
          const payload = buildPayloadFromValues(currentSnapshot);
          const created = await createInvoice(payload);
          clearDraft('invoice');
          setSavedInvoice(created);
          navigate(`/tools/invoice-generator/${created._id}`, {
            replace: true,
            state: {
              toastMessage: `Draft migrated! Invoice ${created.invoiceNumber} saved to cloud.`,
            },
          });
        } catch (err) {
          setFormError(err.response?.data?.message || 'Failed to save guest draft after sign in.');
        } finally {
          setIsSaving(false);
        }
      },
    });
  };

  const handleDuplicate = async () => {
    if (!isAuthenticated || !savedInvoice?._id) return;
    setIsSaving(true);
    try {
      const duplicated = await duplicateInvoice(savedInvoice._id);
      navigate(`/tools/invoice-generator/${duplicated._id}`, {
        state: { toastMessage: `Duplicated as ${duplicated.invoiceNumber} (Draft).` },
      });
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to duplicate invoice.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLocalLogoUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setValue('businessSnapshot.logoUrl', reader.result, { shouldDirty: true });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDeleteFromHistory = async (targetId) => {
    try {
      await deleteInvoice(targetId);
      setInvoiceHistory((prev) => prev.filter((item) => item._id !== targetId));
      if (id === targetId) {
        navigate('/tools/invoice-generator');
      }
    } catch {
      // Ignore error
    }
  };

  return (
    <div className="space-y-4" data-testid="invoice-generator-page">
      {/* Toast Banner */}
      {toast ? (
        <div
          role="status"
          data-testid="toast-banner"
          className="no-print flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-800 shadow-sm"
        >
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            {toast.message}
          </span>
          <button type="button" onClick={() => setToast(null)}>
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      {/* Top Action Header */}
      <div className="no-print flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-extrabold tracking-tight text-slate-900">
                Invoice Generator
              </h1>
              <InvoiceStatusBadge status={savedInvoice?.status || watched.status || 'draft'} />
            </div>
            <p className="text-xs text-slate-500">
              {savedInvoice?.invoiceNumber
                ? `Editing ${savedInvoice.invoiceNumber}`
                : isAuthenticated
                  ? 'New Cloud Invoice (auto-numbered INV-YYYY-XXXX on save)'
                  : 'Create, preview & download multi-size invoices without an account'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isAuthenticated ? (
            <>
              <button
                type="button"
                onClick={() => setHistoryDrawerOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                <History className="h-4 w-4 text-slate-500" />
                My Invoices
              </button>
              <button
                type="button"
                onClick={() => navigate('/tools/invoice-generator')}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                <FilePlus2 className="h-4 w-4 text-slate-500" />
                New
              </button>
              {savedInvoice?._id ? (
                <>
                  <button
                    type="button"
                    onClick={handleDuplicate}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <Copy className="h-4 w-4 text-slate-500" />
                    Duplicate
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentModalOpen(true)}
                    data-testid="open-payment-modal-btn"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                  >
                    <CreditCard className="h-4 w-4" />
                    Record Payment
                  </button>
                </>
              ) : null}
            </>
          ) : null}

          <DocumentExportBar
            documentType="invoice"
            documentId={savedInvoice?._id || null}
            documentData={watched}
            paperConfig={{
              pageSize: watched.pageSize,
              orientation: watched.orientation,
              templateKey: watched.templateKey,
            }}
            isAuthenticated={isAuthenticated}
            isSaving={isSaving}
            onSave={() => handleSaveAuthenticated()}
            onSaveToCloud={handleGuestSaveToCloud}
          />
        </div>
      </div>

      {/* Guest Banner */}
      <GuestModeBanner
        isAuthenticated={isAuthenticated}
        lastSavedAt={lastSavedAt}
        onSignInClick={handleGuestSaveToCloud}
      />

      {formError ? (
        <div
          role="alert"
          className="no-print rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700"
        >
          {formError}
        </div>
      ) : null}

      {/* Paper Size, Orientation & Theme Controls */}
      <PaperSizeSelector
        toolType="invoice"
        pageSize={watched.pageSize}
        orientation={watched.orientation}
        templateKey={watched.templateKey}
        onChange={({ pageSize, orientation, templateKey }) => {
          setValue('pageSize', pageSize);
          setValue('orientation', orientation);
          setValue('templateKey', templateKey);
        }}
      />

      {/* Mobile Edit / Preview Switcher */}
      <div className="no-print flex rounded-xl border border-slate-200 bg-white p-1 xl:hidden">
        <button
          type="button"
          onClick={() => setMobileTab('edit')}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition ${
            mobileTab === 'edit' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600'
          }`}
        >
          <Edit3 className="h-4 w-4" />
          Edit Invoice
        </button>
        <button
          type="button"
          onClick={() => setMobileTab('preview')}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition ${
            mobileTab === 'preview' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600'
          }`}
        >
          <Eye className="h-4 w-4" />
          Live Paper Preview ({watched.pageSize})
        </button>
      </div>

      {isLoadingDoc ? (
        <div className="flex items-center justify-center rounded-xl border border-slate-200 bg-white py-16 text-slate-500">
          <Loader2 className="mr-2 h-5 w-5 animate-spin text-indigo-600" />
          <span className="text-sm font-medium">Loading invoice...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          {/* LEFT: Structured Invoice Editor */}
          <div
            className={`no-print space-y-4 xl:col-span-6 ${
              mobileTab === 'preview' ? 'hidden xl:block' : 'block'
            }`}
          >
            {/* Metadata Card */}
            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">
                Invoice Metadata
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Invoice Number
                  </label>
                  <input
                    type="text"
                    placeholder="Auto (INV-YYYY-XXXX)"
                    {...register('invoiceNumber')}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Issue Date
                  </label>
                  <input
                    type="date"
                    {...register('issueDate')}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Due Date
                  </label>
                  <input
                    type="date"
                    {...register('dueDate')}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Currency
                  </label>
                  <select
                    {...register('currency')}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                    <option value="LKR">LKR (Rs)</option>
                    <option value="INR">INR (₹)</option>
                    <option value="AUD">AUD (A$)</option>
                    <option value="CAD">CAD (C$)</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Status
                  </label>
                  <select
                    {...register('status')}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="draft">Draft</option>
                    <option value="sent">Sent</option>
                    <option value="partial">Partial</option>
                    <option value="paid">Paid</option>
                    <option value="overdue">Overdue</option>
                    <option value="void">Void</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Payment Terms
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., Net 30 days"
                    {...register('paymentTerms')}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>
            </section>

            {/* Business Details Card (Auto-filled for Auth with Override Toggle; Editable + FileReader Logo for Guest) */}
            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-indigo-600" />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                    From (Business Profile)
                  </h2>
                </div>

                {isAuthenticated && profileBusiness ? (
                  <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={overrideBusiness}
                      onChange={(e) => setOverrideBusiness(e.target.checked)}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    Override Business Details for This Invoice
                  </label>
                ) : null}
              </div>

              {isAuthenticated && profileBusiness && !overrideBusiness ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
                  <p className="font-bold text-slate-900">
                    {watched.businessSnapshot?.businessName || profileBusiness.businessName}
                  </p>
                  <p className="mt-0.5 text-slate-500">
                    {[watched.businessSnapshot?.email, watched.businessSnapshot?.phone]
                      .filter(Boolean)
                      .join(' • ')}
                  </p>
                  <p className="mt-1 text-[11px] text-indigo-600">
                    Auto-filled from your saved Business Profile. Toggle override above to customize this invoice only.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-700">
                        Business Name *
                      </label>
                      <input
                        type="text"
                        placeholder="Acme Studio LLC"
                        {...register('businessSnapshot.businessName')}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-700">
                        Tax / VAT Registration No
                      </label>
                      <input
                        type="text"
                        placeholder="TAX-123456"
                        {...register('businessSnapshot.taxRegistrationNo')}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-700">
                        Business Email
                      </label>
                      <input
                        type="email"
                        placeholder="billing@company.com"
                        {...register('businessSnapshot.email')}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-700">
                        Business Phone
                      </label>
                      <input
                        type="text"
                        placeholder="+1 (555) 000-0000"
                        {...register('businessSnapshot.phone')}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="mb-1 block text-xs font-semibold text-slate-700">
                        Business Address
                      </label>
                      <input
                        type="text"
                        placeholder="Street, City, Country"
                        {...register('businessSnapshot.address.street')}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Local FileReader Logo Upload */}
                  <div className="flex flex-wrap items-center gap-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2.5">
                    {watched.businessSnapshot?.logoUrl ? (
                      <img
                        src={watched.businessSnapshot.logoUrl}
                        alt="Logo preview"
                        className="h-10 w-10 rounded border border-slate-200 bg-white object-contain p-0.5"
                      />
                    ) : (
                      <ImagePlus className="h-5 w-5 text-slate-400" />
                    )}
                    <div className="flex-1">
                      <label className="cursor-pointer text-xs font-semibold text-indigo-700 hover:underline">
                        Upload Business Logo (PNG/JPG/SVG)
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/svg+xml"
                          onChange={handleLocalLogoUpload}
                          className="hidden"
                        />
                      </label>
                      <p className="text-[11px] text-slate-500">
                        Embedded directly into preview and PDF export
                      </p>
                    </div>
                    {watched.businessSnapshot?.logoUrl ? (
                      <button
                        type="button"
                        onClick={() => setValue('businessSnapshot.logoUrl', '')}
                        className="text-xs font-semibold text-rose-600 hover:underline"
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                </div>
              )}
            </section>

            {/* Customer Card */}
            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-indigo-600" />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                    Bill To (Customer)
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setCustomerModalOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
                >
                  {isAuthenticated ? 'Select / + New Customer' : 'Open Customer Form'}
                </button>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Customer Name *
                  </label>
                  <input
                    type="text"
                    placeholder="Client Name"
                    {...register('customerSnapshot.name')}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Company
                  </label>
                  <input
                    type="text"
                    placeholder="Client Company"
                    {...register('customerSnapshot.companyName')}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Customer Email
                  </label>
                  <input
                    type="email"
                    placeholder="accounts@client.com"
                    {...register('customerSnapshot.email')}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Billing Address
                  </label>
                  <input
                    type="text"
                    placeholder="Street, City, Postal Code"
                    {...register('customerSnapshot.billingAddress.street')}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>
            </section>

            {/* Dynamic Line Items Table */}
            <LineItemsTable
              control={control}
              register={register}
              currency={watched.currency}
              defaultTaxRate={defaultTaxRate}
              errors={errors}
            />

            {/* Global Discount, Shipping, Bank Details & Notes */}
            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Bank Details &amp; Notes
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Bank Name"
                      {...register('bankDetails.bankName')}
                      className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs focus:border-indigo-500 focus:outline-none"
                    />
                    <input
                      type="text"
                      placeholder="Account Name"
                      {...register('bankDetails.accountName')}
                      className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs focus:border-indigo-500 focus:outline-none"
                    />
                    <input
                      type="text"
                      placeholder="Account Number"
                      {...register('bankDetails.accountNumber')}
                      className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs focus:border-indigo-500 focus:outline-none"
                    />
                    <input
                      type="text"
                      placeholder="SWIFT / Routing"
                      {...register('bankDetails.routingOrSwift')}
                      className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                  <textarea
                    rows={3}
                    placeholder="Notes or payment instructions..."
                    {...register('notes')}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Totals &amp; Discounts
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold text-slate-600">
                        Global Discount
                      </label>
                      <div className="flex overflow-hidden rounded-lg border border-slate-300">
                        <select
                          {...register('globalDiscountType')}
                          className="border-r border-slate-200 bg-slate-50 px-2 py-1.5 text-xs font-semibold"
                        >
                          <option value="percentage">%</option>
                          <option value="fixed">{watched.currency}</option>
                        </select>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          {...register('globalDiscountValue', { valueAsNumber: true })}
                          className="w-full px-2.5 py-1.5 text-right text-xs focus:outline-none"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold text-slate-600">
                        Shipping / Adjustment
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        {...register('shippingOrAdjustment', { valueAsNumber: true })}
                        className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-right text-xs focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs space-y-1">
                    <div className="flex justify-between text-slate-600">
                      <span>Subtotal</span>
                      <span className="font-semibold">{liveTotals.subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Tax Total</span>
                      <span className="font-semibold">{liveTotals.taxTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between border-t border-slate-200 pt-1.5 text-sm font-extrabold text-indigo-700">
                      <span>Grand Total ({watched.currency})</span>
                      <span>{liveTotals.grandTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xs font-bold text-slate-700">
                      <span>Balance Due</span>
                      <span>{liveTotals.balanceDue.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>

          {/* RIGHT: Live Multi-Size Document Paper Canvas */}
          <div
            className={`xl:col-span-6 ${
              mobileTab === 'edit' ? 'hidden xl:block' : 'block'
            }`}
          >
            <div className="xl:sticky xl:top-20">
              <DocumentPaperCanvas
                documentType="invoice"
                documentData={watched}
                pageSize={watched.pageSize}
                orientation={watched.orientation}
                templateKey={watched.templateKey}
              >
                <InvoiceDocumentTemplate
                  data={watched}
                  pageSize={watched.pageSize}
                  orientation={watched.orientation}
                />
              </DocumentPaperCanvas>
            </div>
          </div>
        </div>
      )}

      {/* Customer Picker Modal */}
      <CustomerPickerModal
        isOpen={customerModalOpen}
        isAuthenticated={isAuthenticated}
        initialCustomer={watched.customerSnapshot}
        onSelectCustomer={(customer) => {
          setValue('customerId', customer.customerId || null);
          setValue('customerSnapshot', customer);
        }}
        onClose={() => setCustomerModalOpen(false)}
      />

      {/* Payment Recorder Modal */}
      <PaymentRecorderModal
        isOpen={paymentModalOpen}
        invoice={savedInvoice}
        onPaymentRecorded={(updatedInv) => {
          setSavedInvoice(updatedInv);
          reset(normalizeServerInvoiceToForm(updatedInv));
          showToast(
            `Payment recorded! Status is now "${String(updatedInv.status).toUpperCase()}".`
          );
        }}
        onClose={() => setPaymentModalOpen(false)}
      />

      {/* Slide-Over "My Invoices" History Drawer (Authenticated Only) */}
      {historyDrawerOpen && isAuthenticated ? (
        <div className="no-print fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-sm">
          <div className="flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">My Invoices</h2>
                <p className="text-xs text-slate-500">Strictly scoped to your account</p>
              </div>
              <button
                type="button"
                onClick={() => setHistoryDrawerOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex gap-2 border-b border-slate-200 p-4">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  placeholder="Search number or customer..."
                  className="w-full rounded-lg border border-slate-300 py-1.5 pl-8 pr-3 text-xs focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <select
                value={historyStatusFilter}
                onChange={(e) => setHistoryStatusFilter(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs"
              >
                <option value="">All Status</option>
                <option value="draft">Draft</option>
                <option value="sent">Sent</option>
                <option value="partial">Partial</option>
                <option value="paid">Paid</option>
                <option value="overdue">Overdue</option>
              </select>
            </div>

            <div className="flex-1 divide-y divide-slate-100 overflow-y-auto">
              {invoiceHistory.length === 0 ? (
                <p className="p-6 text-center text-xs text-slate-500">
                  No invoices found matching your filter.
                </p>
              ) : (
                invoiceHistory.map((inv) => (
                  <div
                    key={inv._id}
                    className="flex items-center justify-between gap-2 px-5 py-3.5 hover:bg-slate-50"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setHistoryDrawerOpen(false);
                        navigate(`/tools/invoice-generator/${inv._id}`);
                      }}
                      className="flex-1 text-left"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900">
                          {inv.invoiceNumber}
                        </span>
                        <InvoiceStatusBadge status={inv.status} />
                      </div>
                      <p className="mt-0.5 text-xs text-slate-600">
                        {inv.customerSnapshot?.name || 'Customer'} · {inv.currency}{' '}
                        {Number(inv.grandTotal || 0).toFixed(2)}
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteFromHistory(inv._id)}
                      title="Delete invoice"
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default InvoiceGeneratorPage;
