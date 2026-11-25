import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { PaperSizeSelector } from './components/shared/PaperSizeSelector.jsx';
import { DocumentPaperCanvas } from './components/shared/DocumentPaperCanvas.jsx';
import { LineItemsTable } from './components/shared/LineItemsTable.jsx';
import { CustomerPickerModal } from './components/shared/CustomerPickerModal.jsx';
import { GuestModeBanner } from './components/shared/GuestModeBanner.jsx';
import { DocumentExportBar } from './components/shared/DocumentExportBar.jsx';
import {
  autoSaveDraft,
  loadDraft,
} from './services/guestDraft.service.js';

const DEFAULT_DEMO_DATA = {
  invoiceNumber: 'INV-2026-0001',
  quotationNumber: 'QUO-2026-0001',
  issueDate: '2026-11-25',
  dueDate: '2026-12-25',
  validUntil: '2026-12-25',
  currency: 'USD',
  status: 'draft',
  paymentTerms: 'Net 30 days via bank transfer',
  deliveryTerms: 'Within 10 business days of acceptance',
  acceptanceTerms:
    'Authorized signature confirms acceptance of scope, deliverables, and pricing valid until the expiration date.',
  businessSnapshot: {
    businessName: 'SmartTools Cloud Studio',
    taxRegistrationNo: 'US-99-441122',
    email: 'billing@smarttools.dev',
    phone: '+1 (555) 010-2026',
    address: {
      street: '742 Innovation Way',
      city: 'Austin',
      state: 'TX',
      postalCode: '78701',
      country: 'USA',
    },
    bankDetails: {
      bankName: 'First National Tech Bank',
      accountName: 'SmartTools Cloud Studio LLC',
      accountNumber: '001122334455',
      routingOrSwift: 'FNTBUS33',
    },
  },
  customerSnapshot: {
    name: 'Acme Global Enterprises',
    companyName: 'Acme Corp',
    email: 'ap@acme.example.com',
    phone: '+1 (555) 999-8888',
    billingAddress: {
      street: '100 Market Street, Suite 400',
      city: 'San Francisco',
      state: 'CA',
      postalCode: '94105',
      country: 'USA',
    },
  },
  items: [
    {
      name: 'Platform Architecture & Core Setup',
      description: 'MERN modular monolith & multi-size PDF engine',
      quantity: 2,
      unit: 'sprints',
      unitPrice: 750,
      discountType: 'percentage',
      discountValue: 10,
      taxRate: 8.25,
    },
    {
      name: 'Cloud Hosting & Support Retainer',
      description: '24/7 SLA Tier-1 Monitoring',
      quantity: 1,
      unit: 'month',
      unitPrice: 249.99,
      discountType: 'fixed',
      discountValue: 0,
      taxRate: 8.25,
    },
  ],
  globalDiscountType: 'percentage',
  globalDiscountValue: 0,
  shippingOrAdjustment: 0,
  amountPaid: 0,
  notes: 'Thank you for your business!',
  pageSize: 'A4',
  orientation: 'portrait',
  templateKey: 'indigo',
};

export function App() {
  const [toolType, setToolType] = useState('invoice');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState(null);

  const initialDraft = loadDraft('invoice')?.data || DEFAULT_DEMO_DATA;
  const { control, register, watch, setValue } = useForm({
    defaultValues: initialDraft,
  });

  const watchedValues = watch();

  useEffect(() => {
    autoSaveDraft(toolType, watchedValues, 450, (result) => {
      if (result.saved) setLastSavedAt(result.updatedAt);
    });
  }, [toolType, watchedValues]);

  const handlePaperChange = ({ pageSize, orientation, templateKey }) => {
    setValue('pageSize', pageSize);
    setValue('orientation', orientation);
    setValue('templateKey', templateKey);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="mx-auto max-w-[1600px] space-y-4">
        <header className="no-print flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-5 py-3.5 shadow-sm">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-extrabold tracking-tight text-slate-900">
              SmartTools Generator Engine
            </h1>
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setToolType('invoice')}
                className={`rounded-md px-3 py-1 transition ${
                  toolType === 'invoice' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600'
                }`}
              >
                Invoice
              </button>
              <button
                type="button"
                onClick={() => {
                  setToolType('quotation');
                  if (watchedValues.pageSize === 'THERMAL_80') {
                    setValue('pageSize', 'A4');
                  }
                }}
                className={`rounded-md px-3 py-1 transition ${
                  toolType === 'quotation' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600'
                }`}
              >
                Quotation
              </button>
            </div>
          </div>

          <DocumentExportBar
            documentType={toolType}
            documentData={watchedValues}
            paperConfig={{
              pageSize: watchedValues.pageSize,
              orientation: watchedValues.orientation,
              templateKey: watchedValues.templateKey,
            }}
            isAuthenticated={false}
            onSaveToCloud={() => setPickerOpen(false)}
          />
        </header>

        <GuestModeBanner isAuthenticated={false} lastSavedAt={lastSavedAt} />

        <PaperSizeSelector
          toolType={toolType}
          pageSize={watchedValues.pageSize}
          orientation={watchedValues.orientation}
          templateKey={watchedValues.templateKey}
          onChange={handlePaperChange}
        />

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          <div className="no-print space-y-4 xl:col-span-6">
            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Customer
                </p>
                <p className="text-sm font-bold text-slate-900">
                  {watchedValues.customerSnapshot?.name || 'No customer selected'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
              >
                Edit Customer
              </button>
            </div>

            <LineItemsTable
              control={control}
              register={register}
              currency={watchedValues.currency}
            />
          </div>

          <div className="xl:col-span-6">
            <DocumentPaperCanvas
              documentType={toolType}
              documentData={watchedValues}
              pageSize={watchedValues.pageSize}
              orientation={watchedValues.orientation}
              templateKey={watchedValues.templateKey}
            />
          </div>
        </div>

        <CustomerPickerModal
          isOpen={pickerOpen}
          isAuthenticated={false}
          initialCustomer={watchedValues.customerSnapshot}
          onSelectCustomer={(customer) => setValue('customerSnapshot', customer)}
          onClose={() => setPickerOpen(false)}
        />
      </div>
    </div>
  );
}

export default App;
