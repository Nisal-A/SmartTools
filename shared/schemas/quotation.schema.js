import { z } from 'zod';
import {
  getPaperConfigShape,
  quotationPaperConfigSchema,
} from './paperConfig.schema.js';
import {
  DISCOUNT_TYPE_VALUES,
  businessSnapshotSchema,
  customerSnapshotSchema,
  discountObjectSchema,
  invoiceLineItemSchema,
} from './invoice.schema.js';

export const QUOTATION_STATUS_VALUES = Object.freeze([
  'draft',
  'sent',
  'accepted',
  'rejected',
  'expired',
  'converted',
]);

export const quotationLineItemSchema = invoiceLineItemSchema;

const dateInputSchema = z.union([
  z.string().trim().min(1, 'Date is required'),
  z.date(),
]);

// Strictly restricts pageSize to ['A4', 'A5', 'LETTER', 'LEGAL', 'B5'] (rejects 'THERMAL_80')
const quotationPaperShape = getPaperConfigShape('quotation');

export const quotationSchema = z.object({
  // Quotation Metadata
  quotationNumber: z.string().trim().max(60).optional().or(z.literal('')),
  issueDate: dateInputSchema.default(() => new Date().toISOString().slice(0, 10)),
  validUntil: z.union([z.string().trim(), z.date()]).optional().nullable(),
  currency: z.string().trim().min(3, 'Currency code is required').max(10).default('USD'),
  deliveryTerms: z.string().trim().max(500).optional().default(''),
  paymentTerms: z.string().trim().max(500).optional().default(''),
  status: z.enum(QUOTATION_STATUS_VALUES).default('draft'),

  // Snapshots & Relational Links
  customerId: z.string().trim().optional().nullable(),
  convertedInvoiceId: z.string().trim().optional().nullable(),
  businessSnapshot: businessSnapshotSchema,
  customerSnapshot: customerSnapshotSchema,

  // Line Items (min 1 required)
  items: z
    .array(quotationLineItemSchema)
    .min(1, 'Quotation must contain at least 1 line item'),

  // Global Discount & Adjustments
  globalDiscountType: z.enum(DISCOUNT_TYPE_VALUES).optional().default('percentage'),
  globalDiscountValue: z.coerce.number().min(0).optional().default(0),
  discount: discountObjectSchema.optional(),
  shippingOrAdjustment: z.coerce.number().optional().default(0),

  // Acceptance Terms & Notes
  acceptanceTerms: z.string().trim().max(2000).optional().default(''),
  notes: z.string().trim().max(2000).optional().default(''),

  // Multi-Size Paper Configuration (Supports A4, A5, LETTER, LEGAL, B5 — rejects THERMAL_80)
  pageSize: quotationPaperShape.pageSize,
  orientation: quotationPaperShape.orientation,
  templateKey: quotationPaperShape.templateKey,
  paperConfig: quotationPaperConfigSchema.optional(),
});

export default quotationSchema;
