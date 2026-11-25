import mongoose from 'mongoose';
import { PAPER_SIZE_CODES, ORIENTATIONS, TEMPLATE_KEYS } from '../../../../../shared/constants/paperSizes.js';

/**
 * Invoice Mongoose Model (`invoices` collection)
 *
 * Stores user-scoped invoices with immutable `businessSnapshot`, `customerSnapshot`,
 * `bankDetailsSnapshot`, multi-size paper settings, and server-computed financial totals.
 */

const bankSnapshotSchema = new mongoose.Schema(
  {
    bankName: { type: String, trim: true, default: '' },
    accountName: { type: String, trim: true, default: '' },
    accountNumber: { type: String, trim: true, default: '' },
    routingOrSwift: { type: String, trim: true, default: '' },
    iban: { type: String, trim: true, default: '' },
    branch: { type: String, trim: true, default: '' },
    instructions: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const businessSnapshotSubSchema = new mongoose.Schema(
  {
    businessName: { type: String, trim: true, required: true },
    taxRegistrationNo: { type: String, trim: true, default: '' },
    email: { type: String, trim: true, default: '' },
    phone: { type: String, trim: true, default: '' },
    logoUrl: { type: String, trim: true, default: '' },
    address: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
    bankDetails: { type: bankSnapshotSchema, default: () => ({}) },
  },
  { _id: false }
);

const customerSnapshotSubSchema = new mongoose.Schema(
  {
    customerId: { type: String, trim: true, default: null },
    name: { type: String, trim: true, required: true },
    companyName: { type: String, trim: true, default: '' },
    email: { type: String, trim: true, default: '' },
    phone: { type: String, trim: true, default: '' },
    taxId: { type: String, trim: true, default: '' },
    billingAddress: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
    shippingAddress: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
    address: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
  },
  { _id: false }
);

const discountSubSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['percentage', 'fixed'],
      default: 'percentage',
    },
    value: {
      type: Number,
      default: 0,
      min: 0,
    },
    amount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { _id: false }
);

const invoiceSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      default: null,
    },
    invoiceNumber: {
      type: String,
      required: true,
      trim: true,
    },
    issueDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    dueDate: {
      type: Date,
      default: null,
    },
    currency: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      default: 'USD',
    },
    status: {
      type: String,
      enum: ['draft', 'sent', 'partial', 'paid', 'overdue', 'void'],
      default: 'draft',
      index: true,
    },
    pageSize: {
      type: String,
      enum: PAPER_SIZE_CODES,
      default: 'A4',
    },
    orientation: {
      type: String,
      enum: ORIENTATIONS,
      default: 'portrait',
    },
    templateKey: {
      type: String,
      enum: TEMPLATE_KEYS,
      default: 'indigo',
    },
    businessSnapshot: {
      type: businessSnapshotSubSchema,
      required: true,
    },
    customerSnapshot: {
      type: customerSnapshotSubSchema,
      required: true,
    },
    subtotal: {
      type: Number,
      required: true,
      default: 0,
    },
    itemDiscountTotal: {
      type: Number,
      required: true,
      default: 0,
    },
    discount: {
      type: discountSubSchema,
      default: () => ({ type: 'percentage', value: 0, amount: 0 }),
    },
    taxTotal: {
      type: Number,
      required: true,
      default: 0,
    },
    shippingOrAdjustment: {
      type: Number,
      default: 0,
    },
    grandTotal: {
      type: Number,
      required: true,
      default: 0,
    },
    amountPaid: {
      type: Number,
      required: true,
      default: 0,
    },
    balanceDue: {
      type: Number,
      required: true,
      default: 0,
    },
    paymentTerms: {
      type: String,
      trim: true,
      default: '',
    },
    bankDetailsSnapshot: {
      type: bankSnapshotSchema,
      default: () => ({}),
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
    sourceQuotationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Quotation',
      default: null,
    },
  },
  {
    collection: 'invoices',
    timestamps: true,
  }
);

invoiceSchema.index({ userId: 1, invoiceNumber: 1 }, { unique: true });
invoiceSchema.index({ userId: 1, createdAt: -1 });

export const Invoice =
  mongoose.models.Invoice || mongoose.model('Invoice', invoiceSchema);

export default Invoice;
