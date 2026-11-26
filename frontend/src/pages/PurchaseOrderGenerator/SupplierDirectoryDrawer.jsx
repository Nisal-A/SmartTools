import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Building2,
  Check,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import {
  createSupplierApi,
  deleteSupplierApi,
  updateSupplierApi,
} from '../../services/suppliers.api.js';

function buildEmptySupplierForm() {
  return {
    name: '',
    contactPerson: '',
    email: '',
    phone: '',
    address: '',
    taxId: '',
    paymentTerms: '',
    notes: '',
  };
}

/**
 * Slide-over Supplier Directory Management Drawer (Authenticated Users Only)
 */
export function SupplierDirectoryDrawer({
  isOpen,
  onClose,
  suppliers = [],
  loading = false,
  onSuppliersChange,
  onSelectSupplier,
}) {
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(buildEmptySupplierForm);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setShowForm(false);
      setEditingId(null);
      setErrorMsg('');
    }
  }, [isOpen]);

  const filteredSuppliers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return suppliers;
    return suppliers.filter((s) =>
      [s.name, s.contactPerson, s.email, s.phone, s.taxId]
        .filter(Boolean)
        .some((val) => String(val).toLowerCase().includes(q))
    );
  }, [suppliers, search]);

  if (!isOpen) return null;

  const startCreate = () => {
    setEditingId(null);
    setForm(buildEmptySupplierForm());
    setErrorMsg('');
    setShowForm(true);
  };

  const startEdit = (supplier) => {
    setEditingId(supplier._id);
    setForm({
      name: supplier.name || '',
      contactPerson: supplier.contactPerson || '',
      email: supplier.email || '',
      phone: supplier.phone || '',
      address: supplier.address || '',
      taxId: supplier.taxId || '',
      paymentTerms: supplier.paymentTerms || '',
      notes: supplier.notes || '',
    });
    setErrorMsg('');
    setShowForm(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    if (!form.name.trim()) {
      setErrorMsg('Supplier name is required.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        contactPerson: form.contactPerson.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        address: form.address.trim(),
        taxId: form.taxId.trim(),
        paymentTerms: form.paymentTerms.trim(),
        notes: form.notes.trim(),
      };

      if (editingId) {
        const updated = await updateSupplierApi(editingId, payload);
        onSuppliersChange?.(
          suppliers.map((s) => (String(s._id) === String(editingId) ? updated : s))
        );
      } else {
        const created = await createSupplierApi(payload);
        onSuppliersChange?.(
          [...suppliers, created].sort((a, b) =>
            String(a.name || '').localeCompare(String(b.name || ''))
          )
        );
      }

      setShowForm(false);
      setEditingId(null);
      setForm(buildEmptySupplierForm());
    } catch (err) {
      setErrorMsg(
        err.response?.data?.message || err.message || 'Failed to save supplier.'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (supplierId) => {
    setErrorMsg('');
    setDeletingId(supplierId);
    try {
      await deleteSupplierApi(supplierId);
      onSuppliersChange?.(
        suppliers.filter((s) => String(s._id) !== String(supplierId))
      );
    } catch (err) {
      setErrorMsg(
        err.response?.data?.message || err.message || 'Failed to delete supplier.'
      );
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div
      className="no-print fixed inset-0 z-50 flex justify-end bg-slate-900/45 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Supplier Directory Drawer"
      data-testid="supplier-directory-drawer"
    >
      <div className="flex h-full w-full max-w-lg flex-col bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-50 text-sky-600 ring-1 ring-sky-200">
              <Building2 className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Supplier Directory</h2>
              <p className="text-xs text-slate-500">
                Save vendors to auto-fill purchase orders
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close supplier drawer"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search & Add Bar */}
        <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search suppliers by name, contact, email…"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-8 pr-3 text-xs text-slate-900 focus:border-sky-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20"
            />
          </div>
          {!showForm && (
            <button
              type="button"
              onClick={startCreate}
              data-testid="drawer-add-supplier-btn"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-sky-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-sky-700"
            >
              <Plus className="h-3.5 w-3.5" /> Add Supplier
            </button>
          )}
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {errorMsg ? (
            <div
              role="alert"
              className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700"
            >
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          ) : null}

          {/* Create / Edit Form */}
          {showForm && (
            <form
              onSubmit={handleSave}
              className="space-y-3 rounded-2xl border border-sky-200 bg-sky-50/40 p-4"
              data-testid="supplier-form"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-sky-800">
                  {editingId ? 'Edit Supplier' : 'New Supplier'}
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditingId(null);
                    setErrorMsg('');
                  }}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-800"
                >
                  Cancel
                </button>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Supplier / Vendor Name *
                </label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Ceylon Industrial Hardware Ltd"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                />
              </div>

              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Contact Person
                  </label>
                  <input
                    type="text"
                    value={form.contactPerson}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, contactPerson: e.target.value }))
                    }
                    placeholder="Nimal Perera"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-sky-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Phone
                  </label>
                  <input
                    type="text"
                    value={form.phone}
                    onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                    placeholder="+94 11 555 4433"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-sky-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Email
                  </label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                    placeholder="orders@vendor.com"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-sky-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Tax ID / VAT #
                  </label>
                  <input
                    type="text"
                    value={form.taxId}
                    onChange={(e) => setForm((p) => ({ ...p, taxId: e.target.value }))}
                    placeholder="VAT-100293"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-sky-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Address
                </label>
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
                  placeholder="120 Industrial Zone, Biyagama"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-sky-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Default Payment Terms
                </label>
                <input
                  type="text"
                  value={form.paymentTerms}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, paymentTerms: e.target.value }))
                  }
                  placeholder="Net 30 / Due on Delivery"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-sky-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Notes
                </label>
                <textarea
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                  placeholder="Preferred courier or account notes…"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-sky-500 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={saving}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-sky-600 px-3 py-2 text-xs font-bold text-white shadow-sm hover:bg-sky-700 disabled:opacity-60"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Saving…
                  </>
                ) : editingId ? (
                  'Save Changes'
                ) : (
                  'Create Supplier'
                )}
              </button>
            </form>
          )}

          {/* Supplier Cards */}
          {loading ? (
            <div className="flex items-center justify-center py-12 text-xs text-slate-500">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading suppliers…
            </div>
          ) : filteredSuppliers.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-500">
              {suppliers.length === 0
                ? 'No saved suppliers yet. Click "Add Supplier" above to build your directory.'
                : 'No suppliers matched your search.'}
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredSuppliers.map((supplier) => (
                <div
                  key={supplier._id}
                  className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm transition hover:border-sky-300"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h4 className="truncate text-xs font-bold text-slate-900">
                        {supplier.name}
                      </h4>
                      {supplier.contactPerson ? (
                        <p className="mt-0.5 text-[11px] text-slate-600">
                          Attn: {supplier.contactPerson}
                        </p>
                      ) : null}
                      {(supplier.email || supplier.phone) && (
                        <p className="mt-0.5 truncate text-[11px] text-slate-400">
                          {[supplier.email, supplier.phone].filter(Boolean).join(' · ')}
                        </p>
                      )}
                      {supplier.address ? (
                        <p className="mt-0.5 truncate text-[11px] text-slate-400">
                          {supplier.address}
                        </p>
                      ) : null}
                    </div>

                    {supplier.paymentTerms ? (
                      <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                        {supplier.paymentTerms}
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-3 flex items-center justify-end gap-2 border-t border-slate-100 pt-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        onSelectSupplier?.(supplier);
                        onClose?.();
                      }}
                      className="inline-flex items-center gap-1 rounded-lg bg-sky-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-sky-700"
                    >
                      <Check className="h-3 w-3" /> Use in PO
                    </button>
                    <button
                      type="button"
                      onClick={() => startEdit(supplier)}
                      aria-label={`Edit ${supplier.name}`}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <Pencil className="h-3 w-3" /> Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(supplier._id)}
                      disabled={deletingId === supplier._id}
                      aria-label={`Delete ${supplier.name}`}
                      className="rounded-lg border border-rose-200 bg-rose-50 p-1 text-rose-600 hover:bg-rose-100 disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default SupplierDirectoryDrawer;
