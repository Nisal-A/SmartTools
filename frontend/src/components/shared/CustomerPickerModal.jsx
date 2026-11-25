import React, { useEffect, useState } from 'react';
import {
  Building2,
  Check,
  Loader2,
  Mail,
  Phone,
  Plus,
  Search,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { apiClient } from '../../services/apiClient.js';

const EMPTY_CUSTOMER_FORM = {
  name: '',
  companyName: '',
  email: '',
  phone: '',
  taxId: '',
  billingStreet: '',
  billingCity: '',
  billingState: '',
  billingPostalCode: '',
  billingCountry: '',
};

/**
 * Shared Customer Picker & Inline Creator Modal
 *
 * - Authenticated users: Searches `/api/v1/customers`, selects an existing record,
 *   or creates a new customer inline via `POST /api/v1/customers`.
 * - Guests: Hides cloud directory sync and offers direct manual customer input.
 */
export function CustomerPickerModal({
  isOpen = false,
  isAuthenticated = false,
  initialCustomer = null,
  onSelectCustomer,
  onClose,
}) {
  const [activeTab, setActiveTab] = useState(isAuthenticated ? 'directory' : 'manual');
  const [searchTerm, setSearchTerm] = useState('');
  const [customers, setCustomers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [formState, setFormState] = useState(EMPTY_CUSTOMER_FORM);

  useEffect(() => {
    if (!isOpen) return;
    setErrorMessage('');
    setActiveTab(isAuthenticated ? 'directory' : 'manual');

    if (!isAuthenticated && initialCustomer) {
      const addr =
        typeof initialCustomer.billingAddress === 'object'
          ? initialCustomer.billingAddress
          : typeof initialCustomer.address === 'object'
            ? initialCustomer.address
            : { street: initialCustomer.billingAddress || initialCustomer.address || '' };

      setFormState({
        name: initialCustomer.name || '',
        companyName: initialCustomer.companyName || '',
        email: initialCustomer.email || '',
        phone: initialCustomer.phone || '',
        taxId: initialCustomer.taxId || '',
        billingStreet: addr?.street || '',
        billingCity: addr?.city || '',
        billingState: addr?.state || '',
        billingPostalCode: addr?.postalCode || '',
        billingCountry: addr?.country || '',
      });
    } else if (isAuthenticated) {
      setFormState(EMPTY_CUSTOMER_FORM);
    }
  }, [isOpen, isAuthenticated, initialCustomer]);

  // Debounced server customer directory search for authenticated users
  useEffect(() => {
    if (!isOpen || !isAuthenticated || activeTab !== 'directory') return undefined;

    let cancelled = false;
    const timer = setTimeout(async () => {
      setIsLoading(true);
      setErrorMessage('');
      try {
        const res = await apiClient.get('/customers', {
          params: searchTerm.trim() ? { search: searchTerm.trim() } : {},
        });
        if (!cancelled) {
          const list = Array.isArray(res.data?.data)
            ? res.data.data
            : Array.isArray(res.data)
              ? res.data
              : [];
          setCustomers(list);
        }
      } catch (err) {
        if (!cancelled) {
          setErrorMessage(
            err.response?.data?.message || 'Unable to load customer directory.'
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [isOpen, isAuthenticated, activeTab, searchTerm]);

  if (!isOpen) return null;

  const updateField = (key, value) => {
    setFormState((prev) => ({ ...prev, [key]: value }));
  };

  const buildCustomerPayload = () => ({
    name: formState.name.trim(),
    companyName: formState.companyName.trim(),
    email: formState.email.trim(),
    phone: formState.phone.trim(),
    taxId: formState.taxId.trim(),
    billingAddress: {
      street: formState.billingStreet.trim(),
      city: formState.billingCity.trim(),
      state: formState.billingState.trim(),
      postalCode: formState.billingPostalCode.trim(),
      country: formState.billingCountry.trim(),
    },
  });

  const handleManualOrCreateSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!formState.name.trim()) {
      setErrorMessage('Customer name is required.');
      return;
    }

    const payload = buildCustomerPayload();

    if (!isAuthenticated) {
      onSelectCustomer?.({
        customerId: null,
        ...payload,
      });
      onClose?.();
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await apiClient.post('/customers', payload);
      const created = res.data?.data || res.data;
      onSelectCustomer?.({
        customerId: created?._id || created?.id || null,
        name: created?.name || payload.name,
        companyName: created?.companyName || payload.companyName,
        email: created?.email || payload.email,
        phone: created?.phone || payload.phone,
        taxId: created?.taxId || payload.taxId,
        billingAddress: created?.billingAddress || payload.billingAddress,
      });
      onClose?.();
    } catch (err) {
      setErrorMessage(
        err.response?.data?.message || 'Failed to save customer to directory.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="customer-picker-title"
    >
      <div className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h2 id="customer-picker-title" className="text-base font-bold text-slate-900">
                {isAuthenticated ? 'Select or Add Customer' : 'Customer Details (Guest Mode)'}
              </h2>
              <p className="text-xs text-slate-500">
                {isAuthenticated
                  ? 'Pick from your Shared Customer Directory or create a new client inline'
                  : 'Enter client details manually for this document (no account required)'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Mode Tabs (Authenticated only) */}
        {isAuthenticated ? (
          <div className="flex border-b border-slate-200 bg-slate-50 px-5 pt-2">
            <button
              type="button"
              onClick={() => setActiveTab('directory')}
              className={`inline-flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-xs font-semibold transition ${
                activeTab === 'directory'
                  ? 'border-indigo-600 text-indigo-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Search className="h-3.5 w-3.5" />
              Customer Directory
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('create')}
              className={`inline-flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-xs font-semibold transition ${
                activeTab === 'create'
                  ? 'border-indigo-600 text-indigo-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <UserPlus className="h-3.5 w-3.5" />
              New Customer
            </button>
          </div>
        ) : null}

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {errorMessage ? (
            <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-700">
              {errorMessage}
            </div>
          ) : null}

          {isAuthenticated && activeTab === 'directory' ? (
            <div className="space-y-4">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search customers by name, company, or email..."
                  className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              {isLoading ? (
                <div className="flex items-center justify-center py-12 text-slate-500">
                  <Loader2 className="mr-2 h-5 w-5 animate-spin text-indigo-600" />
                  <span className="text-sm">Loading customers...</span>
                </div>
              ) : customers.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
                  <p className="text-sm font-semibold text-slate-700">
                    No matching customers found
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Create a new customer right here and reuse them across Invoices &amp; Quotations.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('create')}
                    className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add New Customer
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {customers.map((customer) => (
                    <button
                      key={customer._id || customer.id || customer.email}
                      type="button"
                      onClick={() => {
                        onSelectCustomer?.({
                          customerId: customer._id || customer.id || null,
                          name: customer.name || '',
                          companyName: customer.companyName || '',
                          email: customer.email || '',
                          phone: customer.phone || '',
                          taxId: customer.taxId || '',
                          billingAddress: customer.billingAddress || {},
                        });
                        onClose?.();
                      }}
                      className="flex flex-col items-start rounded-xl border border-slate-200 p-3.5 text-left transition hover:border-indigo-400 hover:bg-indigo-50/40"
                    >
                      <div className="flex w-full items-center justify-between gap-2">
                        <span className="text-sm font-bold text-slate-900">
                          {customer.name}
                        </span>
                        <Check className="h-4 w-4 text-indigo-500 opacity-0 transition group-hover:opacity-100" />
                      </div>
                      {customer.companyName ? (
                        <span className="mt-0.5 inline-flex items-center gap-1 text-xs text-slate-600">
                          <Building2 className="h-3 w-3 text-slate-400" />
                          {customer.companyName}
                        </span>
                      ) : null}
                      {customer.email ? (
                        <span className="mt-1 inline-flex items-center gap-1 text-xs text-slate-500">
                          <Mail className="h-3 w-3 text-slate-400" />
                          {customer.email}
                        </span>
                      ) : null}
                      {customer.phone ? (
                        <span className="mt-0.5 inline-flex items-center gap-1 text-xs text-slate-500">
                          <Phone className="h-3 w-3 text-slate-400" />
                          {customer.phone}
                        </span>
                      ) : null}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* Manual Guest Form OR Authenticated Inline Customer Creation Form */
            <form onSubmit={handleManualOrCreateSubmit} className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Customer Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formState.name}
                    onChange={(e) => updateField('name', e.target.value)}
                    placeholder="e.g., Jane Doe"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Company Name
                  </label>
                  <input
                    type="text"
                    value={formState.companyName}
                    onChange={(e) => updateField('companyName', e.target.value)}
                    placeholder="e.g., Acme Corp"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Email
                  </label>
                  <input
                    type="email"
                    value={formState.email}
                    onChange={(e) => updateField('email', e.target.value)}
                    placeholder="billing@client.com"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Phone
                  </label>
                  <input
                    type="text"
                    value={formState.phone}
                    onChange={(e) => updateField('phone', e.target.value)}
                    placeholder="+1 (555) 000-0000"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Tax / VAT ID
                  </label>
                  <input
                    type="text"
                    value={formState.taxId}
                    onChange={(e) => updateField('taxId', e.target.value)}
                    placeholder="Optional tax registration number"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              </div>

              <div className="border-t border-slate-200 pt-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Billing Address
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <input
                      type="text"
                      value={formState.billingStreet}
                      onChange={(e) => updateField('billingStreet', e.target.value)}
                      placeholder="Street address"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                  <input
                    type="text"
                    value={formState.billingCity}
                    onChange={(e) => updateField('billingCity', e.target.value)}
                    placeholder="City"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                  <input
                    type="text"
                    value={formState.billingState}
                    onChange={(e) => updateField('billingState', e.target.value)}
                    placeholder="State / Province"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                  <input
                    type="text"
                    value={formState.billingPostalCode}
                    onChange={(e) => updateField('billingPostalCode', e.target.value)}
                    placeholder="Postal Code"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                  <input
                    type="text"
                    value={formState.billingCountry}
                    onChange={(e) => updateField('billingCountry', e.target.value)}
                    placeholder="Country"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              </div>

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
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-60"
                >
                  {isSubmitting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Check className="h-3.5 w-3.5" />
                  )}
                  {isAuthenticated ? 'Save & Select Customer' : 'Apply Customer Details'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default CustomerPickerModal;
