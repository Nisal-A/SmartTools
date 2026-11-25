import { z } from 'zod';
import {
  getPaperConfigShape,
  invoicePaperConfigSchema,
} from './paperConfig.schema.js';

export const INVOICE_STATUS_VALUES = Object.freeze([
  'draft',
  'sent',
  'partial',
  'paid',
  'overdue',
  'void',
]);

export const DISCOUNT_TYPE_VALUES = Object.freeze(['percentage', 'fixed']);

export const addressSchema = z.object({
  street: z.string().trim().max(250).optional().default(''),
  city: z.string().trim().max(120).optional().default(''),
  state: z.string().trim().max(120).optional().default(''),
  postalCode: z.string().trim().max(40).optional().default(''),
  country: z.string().trim().max(120).optional().default(''),
});

export const bankDetailsSchema = z.object({
  bankName: z.string().trim().max(150).optional().default(''),
  accountName: z.string().trim().max(150).optional().default(''),
  accountNumber: z.string().trim().max(100).optional().default(''),
  routingOrSwift: z.string().trim().max(100).optional().default(''),
  iban: z.string().trim().max(100).optional().default(''),
  branch: z.string().trim().max(150).optional().default(''),
  instructions: z.string().trim().max(500).optional().default(''),
});

export const businessSnapshotSchema = z
  .object({
    businessName: z.string().trim().min(1, 'Business name is required').max(200).optional(),
    name: z.string().trim().min(1).max(200).optional(),
    email: z.string().trim().email('Invalid business email').optional().or(z.literal('')).default(''),
    phone: z.string().trim().max(50).optional().default(''),
    taxRegistrationNo: z.string().trim().max(100).optional().default(''),
    logoUrl: z.string().trim().max(1000).optional().default(''),
    address: z.union([addressSchema, z.string().trim().max(500)]).optional(),
    bankDetails: bankDetailsSchema.optional(),
  })
  .refine((data) => Boolean((data.businessName || data.name || '').trim()), {
    message: 'Business name is required in businessSnapshot',
    path: ['businessName'],
  });

export const customerSnapshotSchema = z
  .object({
    customerId: z.string().trim().optional().nullable(),
    name: z.string().trim().min(1, 'Customer name is required').max(200).optional(),
    customerName: z.string().trim().min(1).max(200).optional(),
    companyName: z.string().trim().max(200).optional().default(''),
    email: z.string().trim().email('Invalid customer email').optional().or(z.literal('')).default(''),
    phone: z.string().trim().max(50).optional().default(''),
    taxId: z.string().trim().max(100).optional().default(''),
    billingAddress: z.union([addressSchema, z.string().trim().max(500)]).optional(),
    shippingAddress: z.union([addressSchema, z.string().trim().max(500)]).optional(),
    address: z.union([addressSchema, z.string().trim().max(500)]).optional(),
  })
  .refine(
    (data) => Boolean((data.name || data.customerName || data.companyName || '').trim()),
    {
      message: 'Customer name is required in customerSnapshot',
      path: ['name'],
    }
  );

export const discountObjectSchema = z.object({
  type: z.enum(DISCOUNT_TYPE_VALUES).default('percentage'),
  value: z.coerce.number().min(0, 'Discount cannot be negative').default(0),
});

export const invoiceLineItemSchema = z.object({
  sortOrder: z.coerce.number().int().min(0).optional().default(0),
  name: z.string().trim().min(1, 'Item name is required').max(250),
  description: z.string().trim().max(1000).optional().default(''),
  quantity: z.coerce.number().positive('Quantity must be greater than 0'),
  unit: z.string().trim().max(40).optional().default('pcs'),
  unitPrice: z.coerce.number().min(0, 'Unit price cannot be negative'),
  discountType: z.enum(DISCOUNT_TYPE_VALUES).optional().default('percentage'),
  discountValue: z.coerce.number().min(0, 'Discount cannot be negative').optional().default(0),
  discount: z.union([z.coerce.number().min(0), discountObjectSchema]).optional(),
  taxRate: z.coerce
    .number()
    .min(0, 'Tax rate cannot be negative')
    .max(100, 'Tax rate cannot exceed 100%')
    .optional()
    .default(0),
  lineTotal: z.coerce.number().min(0).optional(),
});

const dateInputSchema = z.union([
  z.string().trim().min(1, 'Date is required'),
  z.date(),
]);

const invoicePaperShape = getPaperConfigShape('invoice');

export const invoiceSchema = z.object({
  // Invoice Metadata
  invoiceNumber: z.string().trim().min(1).max(60).optional(),
  issueDate: dateInputSchema.default(() => new Date().toISOString().slice(0, 10)),
  dueDate: dateInputSchema.optional().nullable(),
  currency: z.string().trim().min(3, 'Currency code is required').max(10).default('USD'),
  paymentTerms: z.string().trim().max(500).optional().default(''),
  status: z.enum(INVOICE_STATUS_VALUES).default('draft'),

  // Snapshots & Relational Links
  customerId: z.string().trim().optional().nullable(),
  sourceQuotationId: z.string().trim().optional().nullable(),
  businessSnapshot: businessSnapshotSchema,
  customerSnapshot: customerSnapshotSchema,

  // Line Items (min 1 required)
  items: z
    .array(invoiceLineItemSchema)
    .min(1, 'Invoice must contain at least 1 line item'),

  // Global Discount & Adjustments
  globalDiscountType: z.enum(DISCOUNT_TYPE_VALUES).optional().default('percentage'),
  globalDiscountValue: z.coerce.number().min(0).optional().default(0),
  discount: discountObjectSchema.optional(),
  shippingOrAdjustment: z.coerce.number().optional().default(0),
  amountPaid: z.coerce.number().min(0).optional().default(0),

  // Bank Details & Notes
  bankDetails: bankDetailsSchema.optional(),
  notes: z.string().trim().max(2000).optional().default(''),

  // Multi-Size Paper Configuration (Supports A4, A5, LETTER, LEGAL, B5, THERMAL_80)
  pageSize: invoicePaperShape.pageSize,
  orientation: invoicePaperShape.orientation,
  templateKey: invoicePaperShape.templateKey,
  paperConfig: invoicePaperConfigSchema.optional(),
});

export const invoicePaymentSchema = z.object({
  amount: z.coerce.number().positive('Payment amount must be greater than 0'),
  paymentDate: dateInputSchema.default(() => new Date().toISOString().slice(0, 10)),
  method: z
    .enum(['bank_transfer', 'cash', 'card', 'cheque', 'online', 'other'])
    .default('bank_transfer'),
  referenceNo: z.string().trim().max(120).optional().default(''),
  notes: z.string().trim().max(500).optional().default(''),
});

export default invoiceSchema;
