import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import {
  ArrowRightLeft,
  Building2,
  CheckCircle2,
  Copy,
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
  createQuotation,
  deleteQuotation,
  duplicateQuotation,
  getQuotationById,
  listQuotations,
  updateQuotation,
} from '../../services/quotations.api.js';
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
import { QuotationDocumentTemplate } from '../../components/quotation/QuotationDocumentTemplate.jsx';
import { ConvertToInvoiceModal } from '../../components/quotation/ConvertToInvoiceModal.jsx';
import { ValidityBadge } from '../../components/quotation/ValidityBadge.jsx';

const VALIDITY_PRESETS = [
  { label: '7 Days', days: 7 },
  { label: '14 Days', days: 14 },
  { label: '30 Days', days: 30 },
  { label: 'Custom', days: null },
];

function addDaysToIsoDate(baseDateStr, days) {
  const base = baseDateStr ? new Date(baseDateStr) : new Date();
  if (Number.isNaN(base.getTime())) return '';
  const target = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
  return target.toISOString().slice(0, 10);
}

function buildEmptyQuotation(overrides = {}) {
  const today = new Date().toISOString().slice(0, 10);
  return {
    quotationNumber: '',
    issueDate: today,
    validUntil: addDaysToIsoDate(today, 30),
    currency: 'USD',
    status: 'draft',
    deliveryTerms: 'Within 14 business days of signed acceptance',
    paymentTerms: '50% upfront deposit, 50% upon delivery',
    acceptanceTerms:
      'Authorized client signature confirms acceptance of quoted scope, deliverables, and pricing valid through the stated validity date.',
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
    notes: '',
    pageSize: 'A4',
    orientation: 'portrait',
    templateKey: 'emerald',
    ...overrides,
  };
}

const QUOTATION_HANDOFF_STORAGE_KEY = 'smarttools_quotation_handoff';

function applyQuotationHandoff(baseForm, handoff, taxRate = 0) {
  if (!handoff || typeof handoff !== 'object') return baseForm;
  const incomingItems = Array.isArray(handoff.items)
    ? handoff.items
        .filter((it) => it && (it.description || it.name))
        .map((it) => ({
          name: String(it.name || it.description || '').trim(),
          description: it.name && it.description ? String(it.description) : '',
          quantity: Number(it.quantity) > 0 ? Number(it.quantity) : 1,
          unit: it.unit || 'pcs',
          unitPrice: Number(it.unitPrice) >= 0 ? Number(it.unitPrice) : 0,
          discountType: 'percentage',
          discountValue: 0,
          taxRate: Number(taxRate) || 0,
        }))
    : [];

  return {
    ...baseForm,
    currency: handoff.currency || baseForm.currency,
    customerSnapshot: {
      ...baseForm.customerSnapshot,
      name: handoff.client?.name || baseForm.customerSnapshot?.name || '',
      companyName:
        handoff.client?.companyName || baseForm.customerSnapshot?.companyName || '',
      email: handoff.client?.email || baseForm.customerSnapshot?.email || '',
    },
    notes: handoff.notes || baseForm.notes || '',
    ...(incomingItems.length > 0 ? { items: incomingItems } : {}),
  };
}

function normalizeServerQuotationToForm(doc) {
  if (!doc) return buildEmptyQuotation();
  return buildEmptyQuotation({
    quotationNumber: doc.quotationNumber || '',
    issueDate: doc.issueDate ? String(doc.issueDate).slice(0, 10) : '',
    validUntil: doc.validUntil ? String(doc.validUntil).slice(0, 10) : '',
    currency: doc.currency || 'USD',
    status: doc.status || 'draft',
    deliveryTerms: doc.deliveryTerms || '',
    paymentTerms: doc.paymentTerms || '',
    acceptanceTerms: doc.acceptanceTerms || '',
    customerId: doc.customerId || null,
    convertedInvoiceId: doc.convertedInvoiceId || null,
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
        : buildEmptyQuotation().items,
    globalDiscountType: doc.discount?.type || 'percentage',
    globalDiscountValue: Number(doc.discount?.value) || 0,
    shippingOrAdjustment: Number(doc.shippingOrAdjustment) || 0,
    notes: doc.notes || '',
    pageSize: doc.pageSize && doc.pageSize !== 'THERMAL_80' ? doc.pageSize : 'A4',
    orientation: doc.orientation || 'portrait',
    templateKey: doc.templateKey || 'emerald',
  });
}

export function QuotationGeneratorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, openAuthModal } = useAuth();

  const [mobileTab, setMobileTab] = useState('edit');
  const [savedQuotation, setSavedQuotation] = useState(null);
  const [profileBusiness, setProfileBusiness] = useState(null);
  const [overrideBusiness, setOverrideBusiness] = useState(false);
  const [defaultTaxRate, setDefaultTaxRate] = useState(0);
  const [activeValidityPreset, setActiveValidityPreset] = useState(30);
  const [showAcceptanceSignature, setShowAcceptanceSignature] = useState(true);
  const [isLoadingDoc, setIsLoadingDoc] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [convertModalOpen, setConvertModalOpen] = useState(false);
  const [historyDrawerOpen, setHistoryDrawerOpen] = useState(false);
  const [quoteHistory, setQuoteHistory] = useState([]);
  const [historySearch, setHistorySearch] = useState('');
  const [historyStatusFilter, setHistoryStatusFilter] = useState('');
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [toast, setToast] = useState(null);
  const [formError, setFormError] = useState('');
  const [handoffProjectTitle, setHandoffProjectTitle] = useState('');

  const hydratedRef = useRef(false);
  const handoffRef = useRef(null);

  const {
    control,
    register,
    watch,
    setValue,
    reset,
    getValues,
    formState: { errors },
  } = useForm({
    defaultValues: buildEmptyQuotation(),
  });

  const watched = watch();
  const liveTotals = useMemo(() => calculateDocumentTotals(watched), [watched]);

  const showToast = useCallback((message, tone = 'success') => {
    setToast({ message, tone });
    setTimeout(() => {
      setToast((curr) => (curr?.message === message ? null : curr));
    }, 4500);
  }, []);

  useEffect(() => {
    if (id) return;

    let incoming = location.state?.handoffData || null;
    if (!incoming) {
      try {
        const raw = window.sessionStorage.getItem(QUOTATION_HANDOFF_STORAGE_KEY);
        if (raw) {
          incoming = JSON.parse(raw);
        }
      } catch {
        incoming = null;
      }
    }

    try {
      window.sessionStorage.removeItem(QUOTATION_HANDOFF_STORAGE_KEY);
    } catch {
      // Ignore storage removal errors
    }

    if (incoming && typeof incoming === 'object') {
      handoffRef.current = incoming;
      setHandoffProjectTitle(incoming.projectTitle || 'AI Proposal');
      if (location.state?.handoffData) {
        navigate(location.pathname, { replace: true, state: {} });
      }
    }
  }, [id, location.pathname, location.state, navigate]);

  useEffect(() => {
    if (location.state?.toastMessage) {
      showToast(location.state.toastMessage);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, location.pathname, navigate, showToast]);

  // Hydrate saved quotation OR Business Profile defaults OR Guest Quotation draft
  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      setFormError('');

      if (isAuthenticated && id) {
        setIsLoadingDoc(true);
        try {
          const doc = await getQuotationById(id);
          if (!cancelled) {
            setSavedQuotation(doc);
            reset(normalizeServerQuotationToForm(doc));
            setOverrideBusiness(true);
            setActiveValidityPreset(null);
            hydratedRef.current = true;
          }
        } catch (err) {
          if (!cancelled) {
            setFormError(err.response?.data?.message || 'Unable to load quotation.');
          }
        } finally {
          if (!cancelled) setIsLoadingDoc(false);
        }
        return;
      }

      if (isAuthenticated && !id) {
        setSavedQuotation(null);
        try {
          const res = await apiClient.get('/profiles/me');
          const biz = res.data?.data?.businessProfile || res.data?.businessProfile || null;
          if (!cancelled && biz) {
            setProfileBusiness(biz);
            setDefaultTaxRate(Number(biz.defaultTaxRate) || 0);
            const preferredSize =
              biz.defaultQuotationSize && biz.defaultQuotationSize !== 'THERMAL_80'
                ? biz.defaultQuotationSize
                : 'A4';
            reset(
              applyQuotationHandoff(
                buildEmptyQuotation({
                  currency: biz.defaultCurrency || 'USD',
                  paymentTerms: biz.defaultPaymentTerms || '50% upfront, 50% on delivery',
                  pageSize: preferredSize,
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
                }),
                handoffRef.current,
                Number(biz.defaultTaxRate) || 0
              )
            );
            setOverrideBusiness(false);
          } else if (!cancelled && handoffRef.current) {
            reset(applyQuotationHandoff(buildEmptyQuotation(), handoffRef.current, 0));
          }
        } catch {
          if (!cancelled) {
            setOverrideBusiness(true);
            if (handoffRef.current) {
              reset(applyQuotationHandoff(buildEmptyQuotation(), handoffRef.current, 0));
            }
          }
        }
        hydratedRef.current = true;
        return;
      }

      if (!isAuthenticated) {
        setSavedQuotation(null);
        setOverrideBusiness(true);
        const draft = loadDraft('quotation');
        if (handoffRef.current) {
          reset(applyQuotationHandoff(buildEmptyQuotation(), handoffRef.current, 0));
        } else if (draft?.data) {
          const sanitizedPageSize =
            draft.data.pageSize === 'THERMAL_80' ? 'A4' : draft.data.pageSize || 'A4';
          reset(buildEmptyQuotation({ ...draft.data, pageSize: sanitizedPageSize }));
          setLastSavedAt(draft.updatedAt);
        } else {
          reset(buildEmptyQuotation());
        }
        hydratedRef.current = true;
      }
    }

    hydrate();
    return () => {
      cancelled = true;
    };
  }, [id, isAuthenticated, reset]);

  // Guest Mode debounced auto-save to `smarttools_guest_quote_draft`
  useEffect(() => {
    if (isAuthenticated || !hydratedRef.current) return;
    autoSaveDraft('quotation', watched, 450, (result) => {
      if (result.saved) setLastSavedAt(result.updatedAt);
    });
  }, [isAuthenticated, watched]);

  const fetchMyQuotations = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const res = await listQuotations({
        search: historySearch || undefined,
        status: historyStatusFilter || undefined,
        limit: 50,
      });
      setQuoteHistory(Array.isArray(res?.data) ? res.data : []);
    } catch {
      // Ignore error
    }
  }, [isAuthenticated, historySearch, historyStatusFilter]);

  useEffect(() => {
    if (historyDrawerOpen && isAuthenticated) {
      fetchMyQuotations();
    }
  }, [historyDrawerOpen, isAuthenticated, fetchMyQuotations]);

  const handleApplyValidityPreset = (days) => {
    setActiveValidityPreset(days);
    if (days !== null) {
      const nextDate = addDaysToIsoDate(watched.issueDate, days);
      setValue('validUntil', nextDate, { shouldDirty: true });
    }
  };

  const buildPayloadFromValues = (vals) => ({
    ...(vals.quotationNumber?.trim() ? { quotationNumber: vals.quotationNumber.trim() } : {}),
    issueDate: vals.issueDate || new Date().toISOString().slice(0, 10),
    validUntil: vals.validUntil || null,
    currency: vals.currency || 'USD',
    status: vals.status || 'draft',
    deliveryTerms: vals.deliveryTerms || '',
    paymentTerms: vals.paymentTerms || '',
    acceptanceTerms: vals.acceptanceTerms || '',
    customerId: vals.customerId || null,
    businessSnapshot: {
      ...vals.businessSnapshot,
      businessName: vals.businessSnapshot?.businessName?.trim() || 'My Business',
    },
    customerSnapshot: {
      ...vals.customerSnapshot,
      name: vals.customerSnapshot?.name?.trim() || 'Client',
    },
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
    notes: vals.notes || '',
    pageSize: vals.pageSize === 'THERMAL_80' ? 'A4' : vals.pageSize || 'A4',
    orientation: vals.orientation || 'portrait',
    templateKey: vals.templateKey || 'emerald',
  });

  const handleSaveAuthenticated = async (overrideValues = null, silentRedirect = false) => {
    setFormError('');
    setIsSaving(true);
    try {
      const payload = buildPayloadFromValues(overrideValues || getValues());
      if (id && savedQuotation?._id) {
        const updated = await updateQuotation(id, payload);
        setSavedQuotation(updated);
        reset(normalizeServerQuotationToForm(updated));
        showToast(`Quotation ${updated.quotationNumber} updated.`);
        return updated;
      }
      const created = await createQuotation(payload);
      setSavedQuotation(created);
      clearDraft('quotation');
      if (!silentRedirect) {
        navigate(`/tools/quotation-generator/${created._id}`, {
          replace: true,
          state: { toastMessage: `Quotation ${created.quotationNumber} saved to cloud!` },
        });
      }
      return created;
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to save quotation.');
      return null;
    } finally {
      setIsSaving(false);
    }
  };

  const handleGuestSaveToCloud = () => {
    const currentSnapshot = getValues();
    openAuthModal({
      mode: 'register',
      title: 'Save Quotation to Cloud',
      subtitle: 'Sign in or register — your quotation draft will migrate automatically.',
      onSuccess: async () => {
        setIsSaving(true);
        try {
          const payload = buildPayloadFromValues(currentSnapshot);
          const created = await createQuotation(payload);
          clearDraft('quotation');
          setSavedQuotation(created);
          navigate(`/tools/quotation-generator/${created._id}`, {
            replace: true,
            state: {
              toastMessage: `Draft migrated! Quotation ${created.quotationNumber} saved to cloud.`,
            },
          });
        } catch (err) {
          setFormError(err.response?.data?.message || 'Failed to save guest quotation after sign in.');
        } finally {
          setIsSaving(false);
        }
      },
    });
  };

  const handleDuplicate = async () => {
    if (!isAuthenticated || !savedQuotation?._id) return;
    setIsSaving(true);
    try {
      const duplicated = await duplicateQuotation(savedQuotation._id);
      navigate(`/tools/quotation-generator/${duplicated._id}`, {
        state: { toastMessage: `Duplicated as ${duplicated.quotationNumber} (Draft).` },
      });
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to duplicate quotation.');
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
      await deleteQuotation(targetId);
      setQuoteHistory((prev) => prev.filter((q) => q._id !== targetId));
      if (id === targetId) {
        navigate('/tools/quotation-generator');
      }
    } catch {
      // Ignore error
    }
  };

  return (
    <div className="space-y-4" data-testid="quotation-generator-page">
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
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-extrabold tracking-tight text-slate-900">
              Quotation Generator
            </h1>
            <ValidityBadge
              status={savedQuotation?.status || watched.status || 'draft'}
              validUntil={watched.validUntil}
            />
          </div>
          <p className="text-xs text-slate-500">
            {savedQuotation?.quotationNumber
              ? `Editing ${savedQuotation.quotationNumber}`
              : isAuthenticated
                ? 'New Cloud Quotation (auto-numbered QUO-YYYY-XXXX on save)'
                : 'Build commercial proposals with validity periods and 1-click Invoice conversion'}
          </p>
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
                My Quotations
              </button>
              <button
                type="button"
                onClick={() => navigate('/tools/quotation-generator')}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                <FilePlus2 className="h-4 w-4 text-slate-500" />
                New
              </button>
              {savedQuotation?._id ? (
                <button
                  type="button"
                  onClick={handleDuplicate}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <Copy className="h-4 w-4 text-slate-500" />
                  Duplicate
                </button>
              ) : null}
            </>
          ) : null}

          {/* Convert to Invoice Button (Works in BOTH Guest and Authenticated Modes!) */}
          <button
            type="button"
            onClick={() => setConvertModalOpen(true)}
            data-testid="open-convert-modal-btn"
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 shadow-sm hover:bg-emerald-100"
          >
            <ArrowRightLeft className="h-4 w-4" />
            {savedQuotation?.status === 'converted' ? 'View Converted Invoice' : 'Convert to Invoice'}
          </button>

          <DocumentExportBar
            documentType="quotation"
            documentId={savedQuotation?._id || null}
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

      <GuestModeBanner
        isAuthenticated={isAuthenticated}
        lastSavedAt={lastSavedAt}
        onSignInClick={handleGuestSaveToCloud}
      />

      {handoffProjectTitle ? (
        <div
          role="status"
          data-testid="proposal-handoff-banner"
          className="no-print flex items-center justify-between gap-3 rounded-xl border border-violet-200 bg-violet-50 px-4 py-2.5 text-xs font-semibold text-violet-800 shadow-sm"
        >
          <span>
            Pre-filled from AI Proposal:{' '}
            <span className="font-extrabold">{handoffProjectTitle}</span>
          </span>
          <button
            type="button"
            onClick={() => setHandoffProjectTitle('')}
            aria-label="Dismiss AI proposal pre-fill banner"
            data-testid="dismiss-handoff-banner-btn"
            className="rounded-md p-1 text-violet-600 hover:bg-violet-100"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}

      {formError ? (
        <div
          role="alert"
          className="no-print rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700"
        >
          {formError}
        </div>
      ) : null}

      {/* Paper Size Selector strictly restricted to Quotation sizes (A4, A5, LETTER, LEGAL, B5) */}
      <PaperSizeSelector
        toolType="quotation"
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
            mobileTab === 'edit' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600'
          }`}
        >
          <Edit3 className="h-4 w-4" />
          Edit Quotation
        </button>
        <button
          type="button"
          onClick={() => setMobileTab('preview')}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition ${
            mobileTab === 'preview' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600'
          }`}
        >
          <Eye className="h-4 w-4" />
          Live Paper Preview ({watched.pageSize})
        </button>
      </div>

      {isLoadingDoc ? (
        <div className="flex items-center justify-center rounded-xl border border-slate-200 bg-white py-16 text-slate-500">
          <Loader2 className="mr-2 h-5 w-5 animate-spin text-emerald-600" />
          <span className="text-sm font-medium">Loading quotation...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          {/* LEFT: Quotation Editor */}
          <div
            className={`no-print space-y-4 xl:col-span-6 ${
              mobileTab === 'preview' ? 'hidden xl:block' : 'block'
            }`}
          >
            {/* Quotation Metadata & Validity Presets */}
            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Quotation Metadata &amp; Validity
                </h2>
                <div className="flex items-center gap-1">
                  {VALIDITY_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => handleApplyValidityPreset(preset.days)}
                      className={`rounded-md border px-2 py-1 text-[11px] font-semibold transition ${
                        activeValidityPreset === preset.days
                          ? 'border-emerald-600 bg-emerald-600 text-white'
                          : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Quotation Number
                  </label>
                  <input
                    type="text"
                    placeholder="Auto (QUO-YYYY-XXXX)"
                    {...register('quotationNumber')}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Issue Date
                  </label>
                  <input
                    type="date"
                    {...register('issueDate')}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Valid Until
                  </label>
                  <input
                    type="date"
                    {...register('validUntil', {
                      onChange: () => setActiveValidityPreset(null),
                    })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Currency
                  </label>
                  <select
                    {...register('currency')}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold focus:border-emerald-500 focus:outline-none"
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
                    data-testid="quotation-status-select"
                    disabled={savedQuotation?.status === 'converted'}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold focus:border-emerald-500 focus:outline-none disabled:bg-slate-100"
                  >
                    <option value="draft">Draft</option>
                    <option value="sent">Sent</option>
                    <option value="accepted">Accepted</option>
                    <option value="rejected">Rejected</option>
                    <option value="expired">Expired</option>
                    {savedQuotation?.status === 'converted' ? (
                      <option value="converted">Converted</option>
                    ) : null}
                  </select>
                </div>
                <div className="flex items-end pb-1.5">
                  <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={showAcceptanceSignature}
                      onChange={(e) => setShowAcceptanceSignature(e.target.checked)}
                      className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    Client Acceptance Signature
                  </label>
                </div>
              </div>
            </section>

            {/* Business Details */}
            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-emerald-600" />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                    Prepared By (Business Profile)
                  </h2>
                </div>
                {isAuthenticated && profileBusiness ? (
                  <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={overrideBusiness}
                      onChange={(e) => setOverrideBusiness(e.target.checked)}
                      className="rounded border-slate-300 text-emerald-600"
                    />
                    Override for This Quotation
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
                        placeholder="Your Company LLC"
                        {...register('businessSnapshot.businessName')}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-emerald-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-700">
                        Tax / VAT Reg No
                      </label>
                      <input
                        type="text"
                        placeholder="TAX-123456"
                        {...register('businessSnapshot.taxRegistrationNo')}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-emerald-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-700">
                        Business Email
                      </label>
                      <input
                        type="email"
                        placeholder="sales@company.com"
                        {...register('businessSnapshot.email')}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-emerald-500 focus:outline-none"
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
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-emerald-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2">
                    {watched.businessSnapshot?.logoUrl ? (
                      <img
                        src={watched.businessSnapshot.logoUrl}
                        alt="Logo preview"
                        className="h-9 w-9 rounded border bg-white object-contain p-0.5"
                      />
                    ) : (
                      <ImagePlus className="h-5 w-5 text-slate-400" />
                    )}
                    <label className="flex-1 cursor-pointer text-xs font-semibold text-emerald-700 hover:underline">
                      Upload Business Logo
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/svg+xml"
                        onChange={handleLocalLogoUpload}
                        className="hidden"
                      />
                    </label>
                    {watched.businessSnapshot?.logoUrl ? (
                      <button
                        type="button"
                        onClick={() => setValue('businessSnapshot.logoUrl', '')}
                        className="text-xs font-semibold text-rose-600"
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
                  <Users className="h-4 w-4 text-emerald-600" />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                    Prepared For (Client)
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setCustomerModalOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                >
                  {isAuthenticated ? 'Select / + New Customer' : 'Open Customer Form'}
                </button>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Client Name *
                  </label>
                  <input
                    type="text"
                    placeholder="Client Name"
                    {...register('customerSnapshot.name')}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Company
                  </label>
                  <input
                    type="text"
                    placeholder="Client Organization"
                    {...register('customerSnapshot.companyName')}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Client Email
                  </label>
                  <input
                    type="email"
                    placeholder="procurement@client.com"
                    {...register('customerSnapshot.email')}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Client Address
                  </label>
                  <input
                    type="text"
                    placeholder="Street, City, Country"
                    {...register('customerSnapshot.billingAddress.street')}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>
            </section>

            {/* Line Items Table */}
            <LineItemsTable
              control={control}
              register={register}
              currency={watched.currency}
              defaultTaxRate={defaultTaxRate}
              errors={errors}
            />

            {/* Commercial Terms, Acceptance & Totals */}
            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Delivery, Payment &amp; Acceptance Terms
                  </h3>
                  <input
                    type="text"
                    placeholder="Delivery terms (e.g., 14 business days)"
                    {...register('deliveryTerms')}
                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs focus:border-emerald-500 focus:outline-none"
                  />
                  <input
                    type="text"
                    placeholder="Payment terms (e.g., 50% upfront)"
                    {...register('paymentTerms')}
                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs focus:border-emerald-500 focus:outline-none"
                  />
                  <textarea
                    rows={2}
                    placeholder="Acceptance terms & scope..."
                    {...register('acceptanceTerms')}
                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs focus:border-emerald-500 focus:outline-none"
                  />
                  <textarea
                    rows={2}
                    placeholder="Additional notes..."
                    {...register('notes')}
                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Quotation Summary
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
                        className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-right text-xs focus:border-emerald-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs space-y-1">
                    <div className="flex justify-between text-slate-600">
                      <span>Subtotal</span>
                      <span className="font-semibold">{liveTotals.subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Estimated Tax</span>
                      <span className="font-semibold">{liveTotals.taxTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between border-t border-slate-200 pt-1.5 text-sm font-extrabold text-emerald-700">
                      <span>Quoted Total ({watched.currency})</span>
                      <span>{liveTotals.grandTotal.toFixed(2)}</span>
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
                documentType="quotation"
                documentData={watched}
                pageSize={watched.pageSize}
                orientation={watched.orientation}
                templateKey={watched.templateKey}
              >
                <QuotationDocumentTemplate
                  data={watched}
                  pageSize={watched.pageSize}
                  orientation={watched.orientation}
                  showAcceptanceSignature={showAcceptanceSignature}
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

      {/* Convert to Invoice Modal */}
      <ConvertToInvoiceModal
        isOpen={convertModalOpen}
        isAuthenticated={isAuthenticated}
        quotation={savedQuotation}
        quotationFormValues={watched}
        onEnsureSaved={() => handleSaveAuthenticated(null, true)}
        onConverted={({ quotation: updatedQuote, invoice }) => {
          setSavedQuotation(updatedQuote);
          navigate(`/tools/invoice-generator/${invoice._id}`, {
            state: {
              toastMessage: `Quotation converted! Opened linked Invoice ${
                invoice.invoiceNumber || ''
              }.`,
            },
          });
        }}
        onGuestHandoff={() => {
          navigate('/tools/invoice-generator', {
            state: {
              toastMessage:
                'Guest Quotation transferred into Invoice Generator! All items & details pre-filled.',
            },
          });
        }}
        onClose={() => setConvertModalOpen(false)}
      />

      {/* Slide-Over "My Quotations" History Drawer */}
      {historyDrawerOpen && isAuthenticated ? (
        <div className="no-print fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-sm">
          <div className="flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">My Quotations</h2>
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
                  placeholder="Search number or client..."
                  className="w-full rounded-lg border border-slate-300 py-1.5 pl-8 pr-3 text-xs focus:border-emerald-500 focus:outline-none"
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
                <option value="accepted">Accepted</option>
                <option value="rejected">Rejected</option>
                <option value="expired">Expired</option>
                <option value="converted">Converted</option>
              </select>
            </div>

            <div className="flex-1 divide-y divide-slate-100 overflow-y-auto">
              {quoteHistory.length === 0 ? (
                <p className="p-6 text-center text-xs text-slate-500">
                  No quotations found matching your filter.
                </p>
              ) : (
                quoteHistory.map((q) => (
                  <div
                    key={q._id}
                    className="flex items-center justify-between gap-2 px-5 py-3.5 hover:bg-slate-50"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setHistoryDrawerOpen(false);
                        navigate(`/tools/quotation-generator/${q._id}`);
                      }}
                      className="flex-1 text-left"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900">
                          {q.quotationNumber}
                        </span>
                        <ValidityBadge status={q.status} validUntil={q.validUntil} />
                      </div>
                      <p className="mt-0.5 text-xs text-slate-600">
                        {q.customerSnapshot?.name || 'Client'} · {q.currency}{' '}
                        {Number(q.grandTotal || 0).toFixed(2)}
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteFromHistory(q._id)}
                      title="Delete quotation"
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

export default QuotationGeneratorPage;
