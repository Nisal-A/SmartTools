import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  History,
  ListPlus,
  Loader2,
  Package,
  Plus,
  Printer,
  RotateCcw,
  Trash2,
  Truck,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../../app/AuthContext.jsx';
import { GuestModeBanner } from '../../components/shared/GuestModeBanner.jsx';
import { getMyProfilesApi } from '../../services/profiles.api.js';
import { listSuppliersApi } from '../../services/suppliers.api.js';
import {
  createPurchaseOrderApi,
  deletePurchaseOrderApi,
  getMyPurchaseOrdersApi,
} from '../../services/purchaseOrders.api.js';
import {
  PurchaseOrderPreviewCanvas,
  computePoPreviewTotals,
  formatPoMoney,
} from './PurchaseOrderPreviewCanvas.jsx';
import { SupplierDirectoryDrawer } from './SupplierDirectoryDrawer.jsx';

const GUEST_PO_DRAFT_KEY = 'smarttools_guest_po_draft';
const CURRENCY_OPTIONS = ['LKR', 'USD', 'EUR', 'GBP', 'INR', 'AUD', 'SGD', 'AED'];

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

function buildEmptyLineItem() {
  return {
    description: '',
    sku: '',
    quantity: 1,
    unitPrice: '',
  };
}

function buildInitialPoForm(buyerDefaults = null, preparerName = '') {
  const today = new Date().toISOString().slice(0, 10);
  const buyerAddr = formatProfileAddress(buyerDefaults?.address);
  return {
    customPoNumber: '',
    supplierId: '',
    buyer: {
      name: buyerDefaults?.businessName || '',
      address: buyerAddr,
      phone: buyerDefaults?.phone || '',
      email: buyerDefaults?.email || '',
      logoUrl: buyerDefaults?.logoUrl || '',
    },
    supplier: {
      name: '',
      contactPerson: '',
      email: '',
      phone: '',
      address: '',
    },
    issueDate: today,
    expectedDeliveryDate: '',
    deliveryAddress: buyerAddr,
    shippingMethod: '',
    deliveryNotes: '',
    currency: buyerDefaults?.defaultCurrency || 'LKR',
    items: [buildEmptyLineItem()],
    taxRate: 0,
    discount: 0,
    approvals: {
      preparedBy: {
        name: preparerName || '',
        title: '',
        date: today,
      },
      approvedBy: {
        name: '',
        title: '',
        date: '',
        status: 'Pending',
      },
    },
    terms: '',
  };
}

function loadGuestPoDraft() {
  try {
    const raw = window.localStorage.getItem(GUEST_PO_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function clearGuestPoDraft() {
  try {
    window.localStorage.removeItem(GUEST_PO_DRAFT_KEY);
  } catch {
    // Ignore storage quota errors
  }
}

export function PurchaseOrderGeneratorPage() {
  const { user, isAuthenticated, openAuthModal, showToast } = useAuth();

  const [buyerDefaults, setBuyerDefaults] = useState(null);
  const [form, setForm] = useState(() => {
    const draft = loadGuestPoDraft();
    return draft
      ? {
          ...buildInitialPoForm(),
          ...draft,
          items:
            Array.isArray(draft.items) && draft.items.length > 0
              ? draft.items
              : [buildEmptyLineItem()],
        }
      : buildInitialPoForm();
  });
  const [savedPoNumber, setSavedPoNumber] = useState('');

  // Authenticated Supplier Directory state
  const [suppliers, setSuppliers] = useState([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);
  const [supplierDrawerOpen, setSupplierDrawerOpen] = useState(false);

  // Authenticated PO History state
  const [myPurchaseOrders, setMyPurchaseOrders] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyDrawerOpen, setHistoryDrawerOpen] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  // Submit & error state
  const [savingAndExporting, setSavingAndExporting] = useState(false);
  const [formError, setFormError] = useState('');

  const totals = useMemo(
    () => computePoPreviewTotals(form.items, form.taxRate, form.discount),
    [form.items, form.taxRate, form.discount]
  );

  // Persist guest draft automatically
  useEffect(() => {
    if (isAuthenticated) return;
    try {
      window.localStorage.setItem(GUEST_PO_DRAFT_KEY, JSON.stringify(form));
    } catch {
      // Ignore storage errors
    }
  }, [form, isAuthenticated]);

  const fetchSuppliers = useCallback(async () => {
    if (!isAuthenticated) {
      setSuppliers([]);
      return;
    }
    setLoadingSuppliers(true);
    try {
      const list = await listSuppliersApi();
      setSuppliers(Array.isArray(list) ? list : []);
    } catch {
      setSuppliers([]);
    } finally {
      setLoadingSuppliers(false);
    }
  }, [isAuthenticated]);

  const fetchMyPurchaseOrders = useCallback(async () => {
    if (!isAuthenticated) {
      setMyPurchaseOrders([]);
      return;
    }
    setLoadingHistory(true);
    try {
      const list = await getMyPurchaseOrdersApi();
      setMyPurchaseOrders(Array.isArray(list) ? list : []);
    } catch {
      setMyPurchaseOrders([]);
    } finally {
      setLoadingHistory(false);
    }
  }, [isAuthenticated]);

  // Hydrate Business defaults, Supplier Directory & Saved PO History when logged in
  useEffect(() => {
    if (!isAuthenticated) {
      setSuppliers([]);
      setMyPurchaseOrders([]);
      return;
    }

    let active = true;

    (async () => {
      try {
        const profileData = await getMyProfilesApi();
        const biz = profileData?.businessProfile || null;
        const personal = profileData?.personalProfile || null;
        if (!active || !biz) return;
        setBuyerDefaults(biz);

        const bizAddr = formatProfileAddress(biz.address);
        const preparer = personal?.fullName || user?.fullName || '';

        setForm((prev) => ({
          ...prev,
          currency: prev.currency || biz.defaultCurrency || 'LKR',
          deliveryAddress: prev.deliveryAddress || bizAddr,
          buyer: {
            name: prev.buyer.name || biz.businessName || '',
            address: prev.buyer.address || bizAddr,
            phone: prev.buyer.phone || biz.phone || '',
            email: prev.buyer.email || biz.email || '',
            logoUrl: prev.buyer.logoUrl || biz.logoUrl || '',
          },
          approvals: {
            ...prev.approvals,
            preparedBy: {
              ...prev.approvals.preparedBy,
              name: prev.approvals.preparedBy.name || preparer,
            },
          },
        }));
      } catch {
        // Non-blocking profile autofill
      }
    })();

    fetchSuppliers();
    fetchMyPurchaseOrders();

    return () => {
      active = false;
    };
  }, [isAuthenticated, user?.fullName, fetchSuppliers, fetchMyPurchaseOrders]);

  const clearSavedBadgeOnEdit = () => {
    setFormError('');
    if (savedPoNumber) setSavedPoNumber('');
  };

  const updateField = (key, value) => {
    clearSavedBadgeOnEdit();
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const updateNestedField = (section, key, value) => {
    clearSavedBadgeOnEdit();
    setForm((prev) => ({
      ...prev,
      [section]: { ...prev[section], [key]: value },
    }));
  };

  const updateApprovalField = (roleKey, fieldKey, value) => {
    clearSavedBadgeOnEdit();
    setForm((prev) => ({
      ...prev,
      approvals: {
        ...prev.approvals,
        [roleKey]: {
          ...prev.approvals[roleKey],
          [fieldKey]: value,
        },
      },
    }));
  };

  const handleApplySupplier = (supplier) => {
    clearSavedBadgeOnEdit();
    if (!supplier) {
      setForm((prev) => ({ ...prev, supplierId: '' }));
      return;
    }

    setForm((prev) => ({
      ...prev,
      supplierId: String(supplier._id || ''),
      supplier: {
        name: supplier.name || '',
        contactPerson: supplier.contactPerson || '',
        email: supplier.email || '',
        phone: supplier.phone || '',
        address: supplier.address || '',
      },
      terms:
        !prev.terms && supplier.paymentTerms
          ? `Payment Terms: ${supplier.paymentTerms}`
          : prev.terms,
    }));
  };

  const handleItemChange = (index, key, value) => {
    clearSavedBadgeOnEdit();
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((item, idx) =>
        idx === index ? { ...item, [key]: value } : item
      ),
    }));
  };

  const handleAddItem = () => {
    clearSavedBadgeOnEdit();
    setForm((prev) => ({
      ...prev,
      items: [...prev.items, buildEmptyLineItem()],
    }));
  };

  const handleRemoveItem = (index) => {
    clearSavedBadgeOnEdit();
    setForm((prev) => {
      if (prev.items.length <= 1) return prev;
      return {
        ...prev,
        items: prev.items.filter((_, idx) => idx !== index),
      };
    });
  };

  const triggerPrintAfterRender = () => {
    window.requestAnimationFrame(() => {
      window.setTimeout(() => {
        window.print();
      }, 120);
    });
  };

  const handleSaveAndExport = async (e) => {
    e?.preventDefault?.();
    setFormError('');

    const cleanedItems = form.items.map((item) => ({
      description: String(item.description || '').trim(),
      sku: String(item.sku || '').trim(),
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice === '' ? 0 : item.unitPrice),
    }));

    if (cleanedItems.length === 0 || cleanedItems.some((i) => !i.description)) {
      setFormError('Every line item requires an item description.');
      return;
    }

    if (
      cleanedItems.some(
        (i) =>
          !Number.isFinite(i.quantity) ||
          i.quantity < 0 ||
          !Number.isFinite(i.unitPrice) ||
          i.unitPrice < 0
      )
    ) {
      setFormError('Item quantities and unit prices must be non-negative numbers.');
      return;
    }

    setSavingAndExporting(true);
    try {
      const payload = {
        ...(form.customPoNumber.trim() ? { poNumber: form.customPoNumber.trim() } : {}),
        ...(isAuthenticated && form.supplierId ? { supplierId: form.supplierId } : {}),
        buyer: form.buyer,
        supplier: form.supplier,
        issueDate: form.issueDate || new Date().toISOString(),
        expectedDeliveryDate: form.expectedDeliveryDate || null,
        deliveryAddress: form.deliveryAddress.trim(),
        shippingMethod: form.shippingMethod.trim(),
        deliveryNotes: form.deliveryNotes.trim(),
        currency: form.currency,
        items: cleanedItems,
        taxRate: Number(form.taxRate) || 0,
        discount: Number(form.discount) || 0,
        approvals: {
          preparedBy: {
            name: form.approvals.preparedBy.name.trim(),
            title: form.approvals.preparedBy.title.trim(),
            date: form.approvals.preparedBy.date || null,
          },
          approvedBy: {
            name: form.approvals.approvedBy.name.trim(),
            title: form.approvals.approvedBy.title.trim(),
            date: form.approvals.approvedBy.date || null,
            status: form.approvals.approvedBy.status || 'Pending',
          },
        },
        terms: form.terms.trim(),
      };

      const saved = await createPurchaseOrderApi(payload);
      setSavedPoNumber(saved.poNumber || '');

      if (isAuthenticated) {
        fetchMyPurchaseOrders();
      } else {
        clearGuestPoDraft();
      }

      showToast?.(
        `Purchase Order ${saved.poNumber || ''} saved — opening A4 PDF / Print dialog.`,
        'success'
      );

      triggerPrintAfterRender();
    } catch (err) {
      setFormError(
        err.response?.data?.message ||
          err.message ||
          'Failed to save purchase order. Please check your inputs and try again.'
      );
    } finally {
      setSavingAndExporting(false);
    }
  };

  const handleResetForm = () => {
    setFormError('');
    setSavedPoNumber('');
    clearGuestPoDraft();
    setForm(
      buildInitialPoForm(
        isAuthenticated ? buyerDefaults : null,
        isAuthenticated ? user?.fullName || '' : ''
      )
    );
    showToast?.('Purchase Order form reset.', 'info');
  };

  const handleLoadSavedPo = (saved, shouldPrint = false) => {
    setFormError('');
    setSavedPoNumber(saved.poNumber || '');
    setForm({
      customPoNumber: '',
      supplierId: saved.supplierId ? String(saved.supplierId) : '',
      buyer: {
        name: saved.buyer?.name || '',
        address: saved.buyer?.address || '',
        phone: saved.buyer?.phone || '',
        email: saved.buyer?.email || '',
        logoUrl: saved.buyer?.logoUrl || '',
      },
      supplier: {
        name: saved.supplier?.name || '',
        contactPerson: saved.supplier?.contactPerson || '',
        email: saved.supplier?.email || '',
        phone: saved.supplier?.phone || '',
        address: saved.supplier?.address || '',
      },
      issueDate: saved.issueDate
        ? String(saved.issueDate).slice(0, 10)
        : new Date().toISOString().slice(0, 10),
      expectedDeliveryDate: saved.expectedDeliveryDate
        ? String(saved.expectedDeliveryDate).slice(0, 10)
        : '',
      deliveryAddress: saved.deliveryAddress || '',
      shippingMethod: saved.shippingMethod || '',
      deliveryNotes: saved.deliveryNotes || '',
      currency: saved.currency || 'LKR',
      items:
        Array.isArray(saved.items) && saved.items.length > 0
          ? saved.items.map((item) => ({
              description: item.description || '',
              sku: item.sku || '',
              quantity: item.quantity ?? 1,
              unitPrice: item.unitPrice ?? 0,
            }))
          : [buildEmptyLineItem()],
      taxRate: saved.taxRate ?? 0,
      discount: saved.discount ?? 0,
      approvals: {
        preparedBy: {
          name: saved.approvals?.preparedBy?.name || '',
          title: saved.approvals?.preparedBy?.title || '',
          date: saved.approvals?.preparedBy?.date
            ? String(saved.approvals.preparedBy.date).slice(0, 10)
            : '',
        },
        approvedBy: {
          name: saved.approvals?.approvedBy?.name || '',
          title: saved.approvals?.approvedBy?.title || '',
          date: saved.approvals?.approvedBy?.date
            ? String(saved.approvals.approvedBy.date).slice(0, 10)
            : '',
          status: saved.approvals?.approvedBy?.status || 'Pending',
        },
      },
      terms: saved.terms || '',
    });
    setHistoryDrawerOpen(false);

    if (shouldPrint) {
      triggerPrintAfterRender();
    }
  };

  const handleDeleteSavedPo = async (poId) => {
    setDeletingId(poId);
    try {
      await deletePurchaseOrderApi(poId);
      setMyPurchaseOrders((prev) =>
        prev.filter((item) => String(item._id) !== String(poId))
      );
      showToast?.('Purchase Order deleted.', 'info');
    } catch (err) {
      showToast?.(
        err.response?.data?.message || err.message || 'Failed to delete Purchase Order.',
        'error'
      );
    } finally {
      setDeletingId(null);
    }
  };

  const displayPoNumber = form.customPoNumber.trim() || savedPoNumber;

  return (
    <div className="space-y-5 pb-10" data-testid="purchase-order-generator-page">
      {/* Guest Ready Banner */}
      <GuestModeBanner
        isAuthenticated={isAuthenticated}
        onSignInClick={() =>
          openAuthModal({
            mode: 'login',
            title: 'Sign in to unlock your Supplier Directory & PO History',
            subtitle:
              'Guests can create and export A4 Purchase Orders immediately. Sign in anytime to manage saved vendors and track past POs.',
          })
        }
      />

      {/* Top Action Bar */}
      <section className="no-print flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-600 ring-1 ring-sky-200">
            <Package className="h-5 w-5" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-extrabold tracking-tight text-slate-900">
                Purchase Order Generator
              </h1>
              {savedPoNumber ? (
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">
                  Saved · {savedPoNumber}
                </span>
              ) : (
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-semibold text-slate-500">
                  Auto # PO-YYYY-XXXX
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">
              Create structured vendor purchase orders with delivery schedules, approval blocks,
              and clean A4 PDF export.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isAuthenticated && (
            <>
              <button
                type="button"
                onClick={() => setSupplierDrawerOpen(true)}
                data-testid="po-manage-suppliers-btn"
                className="inline-flex items-center gap-1.5 rounded-xl border border-sky-200 bg-sky-50 px-3.5 py-2 text-xs font-semibold text-sky-800 shadow-sm transition hover:bg-sky-100"
              >
                <Users className="h-4 w-4 text-sky-700" />
                Manage Suppliers
                <span className="rounded-full bg-white px-1.5 py-0.5 text-[10px] font-bold text-sky-700">
                  {suppliers.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setHistoryDrawerOpen(true)}
                data-testid="po-history-toggle"
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                <History className="h-4 w-4 text-slate-500" />
                My POs
                <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-700">
                  {myPurchaseOrders.length}
                </span>
              </button>
            </>
          )}

          <button
            type="button"
            onClick={handleResetForm}
            data-testid="po-reset-btn"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            <RotateCcw className="h-3.5 w-3.5 text-slate-500" />
            Reset
          </button>

          {savedPoNumber ? (
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-sky-300 bg-sky-50 px-3.5 py-2 text-xs font-semibold text-sky-900 shadow-sm transition hover:bg-sky-100"
            >
              <Printer className="h-4 w-4 text-sky-700" />
              Reprint {savedPoNumber}
            </button>
          ) : null}

          <button
            type="button"
            onClick={handleSaveAndExport}
            disabled={savingAndExporting}
            data-testid="po-save-export-btn"
            className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-sky-700 disabled:opacity-60"
          >
            {savingAndExporting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <Printer className="h-4 w-4" />
                Save &amp; Export PDF
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

      {/* Split-Screen Workspace: Left Form + Right Live A4 Preview */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start">
        {/* LEFT PANEL */}
        <form
          onSubmit={handleSaveAndExport}
          className="no-print space-y-5 lg:col-span-5"
          noValidate
        >
          {/* 1. Buyer / Company Header */}
          <div className="space-y-3.5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
              <Building2 className="h-4 w-4 text-sky-600" />
              <h2 className="text-sm font-bold text-slate-900">Buyer / Company Details</h2>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Buyer / Company Name
              </label>
              <input
                type="text"
                value={form.buyer.name}
                onChange={(e) => updateNestedField('buyer', 'name', e.target.value)}
                placeholder="Apex Construction Group"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Phone
                </label>
                <input
                  type="text"
                  value={form.buyer.phone}
                  onChange={(e) => updateNestedField('buyer', 'phone', e.target.value)}
                  placeholder="+94 11 200 3000"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Email
                </label>
                <input
                  type="email"
                  value={form.buyer.email}
                  onChange={(e) => updateNestedField('buyer', 'email', e.target.value)}
                  placeholder="procurement@company.com"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Company Address
              </label>
              <input
                type="text"
                value={form.buyer.address}
                onChange={(e) => updateNestedField('buyer', 'address', e.target.value)}
                placeholder="55 Union Place, Colombo 02"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Logo URL (Optional)
              </label>
              <input
                type="url"
                value={form.buyer.logoUrl}
                onChange={(e) => updateNestedField('buyer', 'logoUrl', e.target.value)}
                placeholder="https://res.cloudinary.com/.../logo.png"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
              />
            </div>
          </div>

          {/* 2. Supplier Selector (Auth) & Editable Supplier Details */}
          <div className="space-y-3.5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-sky-600" />
                <h2 className="text-sm font-bold text-slate-900">Supplier / Vendor</h2>
              </div>
              {isAuthenticated && (
                <button
                  type="button"
                  onClick={() => setSupplierDrawerOpen(true)}
                  className="text-xs font-semibold text-sky-600 hover:text-sky-700"
                >
                  + Add / Edit Suppliers
                </button>
              )}
            </div>

            {isAuthenticated && (
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Supplier Directory
                </label>
                <select
                  value={form.supplierId}
                  disabled={loadingSuppliers}
                  data-testid="po-supplier-select"
                  onChange={(e) => {
                    const selected = suppliers.find(
                      (s) => String(s._id) === String(e.target.value)
                    );
                    handleApplySupplier(selected || null);
                  }}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                >
                  <option value="">
                    {loadingSuppliers
                      ? 'Loading saved suppliers…'
                      : '— Select saved supplier or enter inline below —'}
                  </option>
                  {suppliers.map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.name}
                      {s.contactPerson ? ` (${s.contactPerson})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Supplier Name
              </label>
              <input
                type="text"
                value={form.supplier.name}
                onChange={(e) => updateNestedField('supplier', 'name', e.target.value)}
                placeholder="Lanka Cement Distributors"
                data-testid="po-supplier-name-input"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Contact Person
                </label>
                <input
                  type="text"
                  value={form.supplier.contactPerson}
                  onChange={(e) =>
                    updateNestedField('supplier', 'contactPerson', e.target.value)
                  }
                  placeholder="Kasun Silva"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Phone
                </label>
                <input
                  type="text"
                  value={form.supplier.phone}
                  onChange={(e) => updateNestedField('supplier', 'phone', e.target.value)}
                  placeholder="+94 11 555 4433"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Supplier Email
                </label>
                <input
                  type="email"
                  value={form.supplier.email}
                  onChange={(e) => updateNestedField('supplier', 'email', e.target.value)}
                  placeholder="orders@vendor.com"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Supplier Address
                </label>
                <input
                  type="text"
                  value={form.supplier.address}
                  onChange={(e) => updateNestedField('supplier', 'address', e.target.value)}
                  placeholder="Industrial Zone, Biyagama"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                />
              </div>
            </div>
          </div>

          {/* 3. Order & Delivery Schedule */}
          <div className="space-y-3.5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
              <Truck className="h-4 w-4 text-sky-600" />
              <h2 className="text-sm font-bold text-slate-900">
                Order &amp; Delivery Schedule
              </h2>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  PO # (Optional)
                </label>
                <input
                  type="text"
                  value={form.customPoNumber}
                  onChange={(e) => updateField('customPoNumber', e.target.value)}
                  placeholder="Auto (PO-YYYY-XXXX)"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Issue Date
                </label>
                <input
                  type="date"
                  value={form.issueDate}
                  onChange={(e) => updateField('issueDate', e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Expected Delivery
                </label>
                <input
                  type="date"
                  value={form.expectedDeliveryDate}
                  onChange={(e) => updateField('expectedDeliveryDate', e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Delivery Address (Ship To)
                </label>
                <input
                  type="text"
                  value={form.deliveryAddress}
                  onChange={(e) => updateField('deliveryAddress', e.target.value)}
                  placeholder="Site Warehouse B, Port City"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Shipping Method
                </label>
                <input
                  type="text"
                  value={form.shippingMethod}
                  onChange={(e) => updateField('shippingMethod', e.target.value)}
                  placeholder="Flatbed Truck / Courier"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Delivery Instructions
              </label>
              <textarea
                rows={2}
                value={form.deliveryNotes}
                onChange={(e) => updateField('deliveryNotes', e.target.value)}
                placeholder="Call site supervisor 1 hour before offloading…"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
              />
            </div>
          </div>

          {/* 4. Dynamic Line Items Table & Totals */}
          <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <ListPlus className="h-4 w-4 text-sky-600" />
                <h2 className="text-sm font-bold text-slate-900">
                  Line Items &amp; Totals
                </h2>
              </div>
              <button
                type="button"
                onClick={handleAddItem}
                data-testid="po-add-item-btn"
                className="inline-flex items-center gap-1 rounded-lg bg-sky-50 px-2.5 py-1.5 text-xs font-bold text-sky-700 ring-1 ring-sky-200 hover:bg-sky-100"
              >
                <Plus className="h-3.5 w-3.5" /> Add Row
              </button>
            </div>

            <div className="space-y-3">
              {form.items.map((item, idx) => {
                const rowTotal =
                  Math.round(
                    ((Number(item.quantity) || 0) * (Number(item.unitPrice) || 0) +
                      Number.EPSILON) *
                      100
                  ) / 100;

                return (
                  <div
                    key={idx}
                    className="space-y-2.5 rounded-xl border border-slate-200 bg-slate-50/70 p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Item #{idx + 1}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold tabular-nums text-slate-800">
                          {formatPoMoney(rowTotal, form.currency)}
                        </span>
                        {form.items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            aria-label={`Remove item ${idx + 1}`}
                            className="rounded-md p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                      <div className="sm:col-span-2">
                        <input
                          type="text"
                          required
                          value={item.description}
                          onChange={(e) =>
                            handleItemChange(idx, 'description', e.target.value)
                          }
                          placeholder="Item or Material Description *"
                          data-testid={`po-item-desc-${idx}`}
                          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                        />
                      </div>
                      <div>
                        <input
                          type="text"
                          value={item.sku}
                          onChange={(e) => handleItemChange(idx, 'sku', e.target.value)}
                          placeholder="SKU (Optional)"
                          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="mb-0.5 block text-[11px] font-medium text-slate-500">
                          Qty
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={item.quantity}
                          onChange={(e) =>
                            handleItemChange(idx, 'quantity', e.target.value)
                          }
                          data-testid={`po-item-qty-${idx}`}
                          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm tabular-nums text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                        />
                      </div>
                      <div>
                        <label className="mb-0.5 block text-[11px] font-medium text-slate-500">
                          Unit Price ({form.currency})
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unitPrice}
                          onChange={(e) =>
                            handleItemChange(idx, 'unitPrice', e.target.value)
                          }
                          placeholder="0.00"
                          data-testid={`po-item-price-${idx}`}
                          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm tabular-nums text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Currency, Tax %, Discount */}
            <div className="grid grid-cols-3 gap-2.5 border-t border-slate-100 pt-3.5">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Currency
                </label>
                <select
                  value={form.currency}
                  onChange={(e) => updateField('currency', e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none"
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
                  Tax (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={form.taxRate}
                  onChange={(e) => updateField('taxRate', e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm tabular-nums text-slate-900 focus:border-sky-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Discount ({form.currency})
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.discount}
                  onChange={(e) => updateField('discount', e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm tabular-nums text-slate-900 focus:border-sky-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Live Subtotal & Grand Total Readout */}
            <div className="space-y-1 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs tabular-nums">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal</span>
                <span className="font-semibold text-slate-900">
                  {formatPoMoney(totals.subtotal, form.currency)}
                </span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Tax ({totals.taxRate}%)</span>
                <span className="font-semibold text-slate-900">
                  {formatPoMoney(totals.taxAmount, form.currency)}
                </span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-1.5 text-sm font-extrabold text-sky-800">
                <span>Grand Total</span>
                <span data-testid="po-computed-grand-total">
                  {formatPoMoney(totals.grandTotal, form.currency)}
                </span>
              </div>
            </div>
          </div>

          {/* 5. Approvals & Terms */}
          <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
              <ClipboardCheck className="h-4 w-4 text-sky-600" />
              <h2 className="text-sm font-bold text-slate-900">
                Approvals &amp; Terms
              </h2>
            </div>

            {/* Prepared By */}
            <div className="space-y-2.5 rounded-xl border border-slate-100 bg-slate-50/70 p-3">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Prepared By
              </div>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <input
                  type="text"
                  value={form.approvals.preparedBy.name}
                  onChange={(e) =>
                    updateApprovalField('preparedBy', 'name', e.target.value)
                  }
                  placeholder="Name"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-sky-500 focus:outline-none"
                />
                <input
                  type="text"
                  value={form.approvals.preparedBy.title}
                  onChange={(e) =>
                    updateApprovalField('preparedBy', 'title', e.target.value)
                  }
                  placeholder="Title (e.g. Procurement Lead)"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-sky-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-0.5 block text-[11px] font-medium text-slate-500">
                  Prepared Date
                </label>
                <input
                  type="date"
                  value={form.approvals.preparedBy.date}
                  onChange={(e) =>
                    updateApprovalField('preparedBy', 'date', e.target.value)
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-sky-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Approved By */}
            <div className="space-y-2.5 rounded-xl border border-slate-100 bg-slate-50/70 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Approved By
                </span>
                <select
                  value={form.approvals.approvedBy.status}
                  onChange={(e) =>
                    updateApprovalField('approvedBy', 'status', e.target.value)
                  }
                  className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-800 focus:border-sky-500 focus:outline-none"
                >
                  <option value="Pending">Pending</option>
                  <option value="Approved">Approved</option>
                </select>
              </div>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <input
                  type="text"
                  value={form.approvals.approvedBy.name}
                  onChange={(e) =>
                    updateApprovalField('approvedBy', 'name', e.target.value)
                  }
                  placeholder="Approver Name"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-sky-500 focus:outline-none"
                />
                <input
                  type="text"
                  value={form.approvals.approvedBy.title}
                  onChange={(e) =>
                    updateApprovalField('approvedBy', 'title', e.target.value)
                  }
                  placeholder="Title (e.g. Finance Director)"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-sky-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-0.5 block text-[11px] font-medium text-slate-500">
                  Approval Date
                </label>
                <input
                  type="date"
                  value={form.approvals.approvedBy.date}
                  onChange={(e) =>
                    updateApprovalField('approvedBy', 'date', e.target.value)
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-sky-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Terms &amp; Conditions (Optional)
              </label>
              <textarea
                rows={2}
                value={form.terms}
                onChange={(e) => updateField('terms', e.target.value)}
                placeholder="Payment terms, warranty, or inspection clauses…"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
              />
            </div>
          </div>
        </form>

        {/* RIGHT PANEL: Live A4 Preview */}
        <div className="lg:sticky lg:top-20 lg:col-span-7">
          <PurchaseOrderPreviewCanvas
            poData={form}
            displayPoNumber={displayPoNumber}
          />
        </div>
      </div>

      {/* Authenticated Inline Saved PO History Table */}
      {isAuthenticated && (
        <section
          className="no-print rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          data-testid="my-purchase-orders-section"
        >
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-sky-600" />
              <h2 className="text-sm font-bold text-slate-900">
                My Saved Purchase Orders
              </h2>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">
                {myPurchaseOrders.length}
              </span>
            </div>
            {loadingHistory && (
              <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
            )}
          </div>

          {myPurchaseOrders.length === 0 ? (
            <p className="py-6 text-center text-xs text-slate-500">
              No saved purchase orders yet. Click{' '}
              <strong>Save &amp; Export PDF</strong> above to issue your first
              purchase order.
            </p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    <th className="py-2 pr-3">PO #</th>
                    <th className="px-3 py-2">Supplier</th>
                    <th className="px-3 py-2">Approval</th>
                    <th className="px-3 py-2 text-right">Grand Total</th>
                    <th className="px-3 py-2 text-right">Issue Date</th>
                    <th className="py-2 pl-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {myPurchaseOrders.slice(0, 10).map((po) => {
                    const isApproved =
                      po.approvals?.approvedBy?.status === 'Approved';
                    return (
                      <tr key={po._id} className="hover:bg-slate-50/70">
                        <td className="py-2.5 pr-3 font-bold text-slate-900">
                          {po.poNumber}
                        </td>
                        <td className="px-3 py-2.5 text-slate-700">
                          {po.supplier?.name || 'Supplier'}
                        </td>
                        <td className="px-3 py-2.5">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                              isApproved
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-amber-50 text-amber-700'
                            }`}
                          >
                            {isApproved && <CheckCircle2 className="h-2.5 w-2.5" />}
                            {isApproved ? 'Approved' : 'Pending'}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right font-bold tabular-nums text-sky-700">
                          {formatPoMoney(po.grandTotal, po.currency)}
                        </td>
                        <td className="px-3 py-2.5 text-right text-slate-500">
                          {po.issueDate ? String(po.issueDate).slice(0, 10) : '—'}
                        </td>
                        <td className="py-2.5 pl-3 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleLoadSavedPo(po, false)}
                              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              Load
                            </button>
                            <button
                              type="button"
                              onClick={() => handleLoadSavedPo(po, true)}
                              className="inline-flex items-center gap-1 rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1 font-semibold text-sky-800 hover:bg-sky-100"
                            >
                              <Printer className="h-3 w-3" /> Reprint
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteSavedPo(po._id)}
                              disabled={deletingId === po._id}
                              aria-label={`Delete ${po.poNumber}`}
                              className="rounded-lg p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Supplier Directory Slide-Over Drawer (Authenticated Users Only) */}
      {isAuthenticated && (
        <SupplierDirectoryDrawer
          isOpen={supplierDrawerOpen}
          onClose={() => setSupplierDrawerOpen(false)}
          suppliers={suppliers}
          loading={loadingSuppliers}
          onSuppliersChange={setSuppliers}
          onSelectSupplier={handleApplySupplier}
        />
      )}

      {/* Slide-Over My Purchase Orders Drawer (Authenticated Users Only) */}
      {isAuthenticated && historyDrawerOpen && (
        <div
          className="no-print fixed inset-0 z-50 flex justify-end bg-slate-900/45 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="My Saved Purchase Orders Drawer"
          data-testid="po-history-drawer"
        >
          <div className="flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div className="flex items-center gap-2">
                <History className="h-5 w-5 text-sky-600" />
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    My Saved Purchase Orders
                  </h2>
                  <p className="text-xs text-slate-500">
                    Load any purchase order to view or reprint
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setHistoryDrawerOpen(false)}
                aria-label="Close PO history drawer"
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 space-y-2.5 overflow-y-auto p-4">
              {loadingHistory ? (
                <div className="flex items-center justify-center py-12 text-xs text-slate-500">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading POs…
                </div>
              ) : myPurchaseOrders.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-500">
                  You haven&apos;t saved any purchase orders yet.
                </div>
              ) : (
                myPurchaseOrders.map((po) => {
                  const isApproved =
                    po.approvals?.approvedBy?.status === 'Approved';
                  return (
                    <div
                      key={po._id}
                      className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm transition hover:border-sky-300"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-extrabold text-slate-900">
                              {po.poNumber}
                            </span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                                isApproved
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : 'bg-amber-50 text-amber-700'
                              }`}
                            >
                              {isApproved ? 'Approved' : 'Pending'}
                            </span>
                          </div>
                          <p className="mt-0.5 text-xs font-medium text-slate-700">
                            {po.supplier?.name || 'Supplier'}
                          </p>
                          <p className="text-[11px] text-slate-400">
                            {po.issueDate ? String(po.issueDate).slice(0, 10) : ''} ·{' '}
                            {Array.isArray(po.items) ? po.items.length : 0} item(s)
                          </p>
                        </div>
                        <div className="text-right text-xs font-extrabold tabular-nums text-slate-900">
                          {formatPoMoney(po.grandTotal, po.currency)}
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-end gap-2 border-t border-slate-100 pt-2.5">
                        <button
                          type="button"
                          onClick={() => handleLoadSavedPo(po, false)}
                          className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Load
                        </button>
                        <button
                          type="button"
                          onClick={() => handleLoadSavedPo(po, true)}
                          className="inline-flex items-center gap-1 rounded-lg bg-sky-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-sky-700"
                        >
                          <Printer className="h-3 w-3" /> Reprint
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteSavedPo(po._id)}
                          disabled={deletingId === po._id}
                          aria-label={`Delete ${po.poNumber}`}
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

export default PurchaseOrderGeneratorPage;
