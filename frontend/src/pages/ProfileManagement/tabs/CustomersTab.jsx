import React, { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Building2,
  Loader2,
  Mail,
  Pencil,
  Phone,
  Plus,
  Search,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import {
  createCustomerApi,
  deleteCustomerApi,
  listCustomersApi,
  updateCustomerApi,
} from '../../../services/customers.api.js';
import { useAuth } from '../../../app/AuthContext.jsx';

const customerSchema = z.object({
  name: z.string().trim().min(1, 'Customer name is required'),
  companyName: z.string().trim().optional().or(z.literal('')),
  email: z.string().trim().email('Invalid email address').optional().or(z.literal('')),
  phone: z.string().trim().optional().or(z.literal('')),
  taxId: z.string().trim().optional().or(z.literal('')),
  notes: z.string().trim().optional().or(z.literal('')),
  billingAddress: z.object({
    street: z.string().trim().optional().or(z.literal('')),
    city: z.string().trim().optional().or(z.literal('')),
    state: z.string().trim().optional().or(z.literal('')),
    postalCode: z.string().trim().optional().or(z.literal('')),
    country: z.string().trim().optional().or(z.literal('')),
  }),
});

const EMPTY_CUSTOMER = {
  name: '',
  companyName: '',
  email: '',
  phone: '',
  taxId: '',
  notes: '',
  billingAddress: {
    street: '',
    city: '',
    state: '',
    postalCode: '',
    country: '',
  },
};

function CustomerFormModal({ isOpen, editingCustomer, onClose, onSaved }) {
  const [serverError, setServerError] = useState('');
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(customerSchema),
    defaultValues: EMPTY_CUSTOMER,
  });

  useEffect(() => {
    if (!isOpen) return;
    setServerError('');
    if (editingCustomer) {
      const addr =
        typeof editingCustomer.billingAddress === 'object' &&
        editingCustomer.billingAddress
          ? editingCustomer.billingAddress
          : {};
      reset({
        name: editingCustomer.name || '',
        companyName: editingCustomer.companyName || '',
        email: editingCustomer.email || '',
        phone: editingCustomer.phone || '',
        taxId: editingCustomer.taxId || '',
        notes: editingCustomer.notes || '',
        billingAddress: {
          street: addr.street || '',
          city: addr.city || '',
          state: addr.state || '',
          postalCode: addr.postalCode || '',
          country: addr.country || '',
        },
      });
    } else {
      reset(EMPTY_CUSTOMER);
    }
  }, [isOpen, editingCustomer, reset]);

  if (!isOpen) return null;

  const onSubmit = async (values) => {
    setServerError('');
    try {
      const saved = editingCustomer
        ? await updateCustomerApi(editingCustomer._id, values)
        : await createCustomerApi(values);
      onSaved(saved, Boolean(editingCustomer));
      onClose();
    } catch (err) {
      setServerError(
        err.response?.data?.message || 'Unable to save customer record.'
      );
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      data-testid="customer-form-modal"
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h3 className="text-base font-bold text-slate-900">
            {editingCustomer ? 'Edit Customer' : 'Add Shared Customer'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 p-5">
          {serverError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {serverError}
            </div>
          )}

          <div className="grid gap-3.5 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Contact Name *
              </label>
              <input
                type="text"
                placeholder="Jane Doe"
                data-testid="customer-name-input"
                {...register('name')}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
              {errors.name && (
                <p className="mt-1 text-xs text-rose-600">{errors.name.message}</p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Company Name
              </label>
              <input
                type="text"
                placeholder="Acme Corp"
                data-testid="customer-company-input"
                {...register('companyName')}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Email
              </label>
              <input
                type="email"
                placeholder="ap@acmecorp.com"
                data-testid="customer-email-input"
                {...register('email')}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
              {errors.email && (
                <p className="mt-1 text-xs text-rose-600">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Phone
              </label>
              <input
                type="tel"
                placeholder="+1-555-0199"
                {...register('phone')}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Tax / VAT ID
              </label>
              <input
                type="text"
                placeholder="TAX-987654"
                {...register('taxId')}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Billing Street
              </label>
              <input
                type="text"
                placeholder="200 Market St"
                {...register('billingAddress.street')}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">City</label>
              <input
                type="text"
                placeholder="Austin"
                {...register('billingAddress.city')}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">Country</label>
              <input
                type="text"
                placeholder="USA"
                {...register('billingAddress.country')}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-semibold text-slate-700">Notes</label>
              <textarea
                rows={2}
                placeholder="Preferred billing contact or notes…"
                {...register('notes')}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              data-testid="save-customer-btn"
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-60"
            >
              {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {editingCustomer ? 'Save Changes' : 'Add Customer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function CustomersTab() {
  const { showToast } = useAuth();
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const loadCustomers = useCallback(async (searchQuery = '') => {
    setIsLoading(true);
    try {
      const { customers: list } = await listCustomersApi(
        searchQuery.trim() ? { search: searchQuery.trim() } : {}
      );
      setCustomers(list);
    } catch {
      setCustomers([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadCustomers(search);
    }, 220);
    return () => window.clearTimeout(timer);
  }, [search, loadCustomers]);

  const handleSaved = (_saved, wasEdit) => {
    showToast(wasEdit ? 'Customer updated.' : 'Customer added to directory.', 'success');
    loadCustomers(search);
  };

  const handleDelete = async (customer) => {
    setDeletingId(customer._id);
    try {
      await deleteCustomerApi(customer._id);
      setCustomers((prev) => prev.filter((c) => c._id !== customer._id));
      showToast(`Deleted customer "${customer.name}".`, 'info');
    } catch (err) {
      showToast(err.response?.data?.message || 'Unable to delete customer.', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-5" data-testid="profile-customers-tab">
      <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-indigo-600">
            <Users className="h-4 w-4" />
            <span className="text-xs font-bold uppercase tracking-wider">Shared Directory</span>
          </div>
          <h2 className="mt-1 text-lg font-bold text-slate-900">Customers Directory</h2>
          <p className="text-sm text-slate-500">
            Reusable client records available inside both the Invoice Generator and Quotation Generator.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setEditingCustomer(null);
            setModalOpen(true);
          }}
          data-testid="add-customer-btn"
          className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700"
        >
          <Plus className="h-4 w-4" /> Add Customer
        </button>
      </div>

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by customer name, company, or email…"
          data-testid="customers-search-input"
          className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin text-indigo-600" /> Loading customers…
        </div>
      ) : customers.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 px-6 py-12 text-center">
          <Users className="mx-auto h-7 w-7 text-slate-300" />
          <p className="mt-2 text-sm font-semibold text-slate-700">No customers found</p>
          <p className="mt-1 text-xs text-slate-500">
            Add your frequent clients once to auto-fill invoices and quotations in 1 click.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Billing Location</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {customers.map((customer) => {
                const locationStr = [
                  customer.billingAddress?.city,
                  customer.billingAddress?.country,
                ]
                  .filter(Boolean)
                  .join(', ');
                return (
                  <tr
                    key={customer._id}
                    data-testid={`customer-row-${customer._id}`}
                    className="hover:bg-slate-50/70"
                  >
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-900">{customer.name}</p>
                      {customer.companyName && (
                        <p className="flex items-center gap-1 text-xs text-slate-500">
                          <Building2 className="h-3 w-3" /> {customer.companyName}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {customer.email && (
                        <p className="flex items-center gap-1">
                          <Mail className="h-3 w-3 text-slate-400" /> {customer.email}
                        </p>
                      )}
                      {customer.phone && (
                        <p className="mt-0.5 flex items-center gap-1">
                          <Phone className="h-3 w-3 text-slate-400" /> {customer.phone}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {locationStr || '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingCustomer(customer);
                            setModalOpen(true);
                          }}
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600"
                          title="Edit customer"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          disabled={deletingId === customer._id}
                          onClick={() => handleDelete(customer)}
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                          title="Delete customer"
                        >
                          <Trash2 className="h-4 w-4" />
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

      <CustomerFormModal
        isOpen={modalOpen}
        editingCustomer={editingCustomer}
        onClose={() => setModalOpen(false)}
        onSaved={handleSaved}
      />
    </div>
  );
}

export default CustomersTab;
