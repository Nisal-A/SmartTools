import crypto from 'node:crypto';
import mongoose from 'mongoose';

/**
 * Purchase Order Model (`purchase_orders` collection) & Atomic `PO-YYYY-XXXX` Counter
 *
 * `userId` is nullable so guests can generate POs (Guest Ready mode).
 * All monetary fields are computed server-side in `computePurchaseOrderTotals()`.
 */

const purchaseOrderCounterSchema = new mongoose.Schema(
  {
    year: { type: Number, required: true },
    seq: { type: Number, required: true, default: 0 },
  },
  {
    collection: 'purchase_order_counters',
    timestamps: true,
  }
);

purchaseOrderCounterSchema.index({ year: 1 }, { unique: true });

export const PurchaseOrderCounter =
  mongoose.models.PurchaseOrderCounter ||
  mongoose.model('PurchaseOrderCounter', purchaseOrderCounterSchema);

export const PO_APPROVAL_STATUSES = ['Pending', 'Approved'];

const partySubSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, default: '' },
    address: { type: String, trim: true, default: '' },
    phone: { type: String, trim: true, default: '' },
    email: { type: String, trim: true, default: '' },
    logoUrl: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const supplierSnapshotSubSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, default: '' },
    contactPerson: { type: String, trim: true, default: '' },
    email: { type: String, trim: true, default: '' },
    phone: { type: String, trim: true, default: '' },
    address: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const lineItemSubSchema = new mongoose.Schema(
  {
    description: { type: String, trim: true, required: true },
    sku: { type: String, trim: true, default: '' },
    quantity: { type: Number, required: true, min: 0 },
    unitPrice: { type: Number, required: true, min: 0 },
    lineTotal: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const preparedBySubSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, default: '' },
    title: { type: String, trim: true, default: '' },
    date: { type: Date, default: null },
  },
  { _id: false }
);

const approvedBySubSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, default: '' },
    title: { type: String, trim: true, default: '' },
    date: { type: Date, default: null },
    status: { type: String, enum: PO_APPROVAL_STATUSES, default: 'Pending' },
  },
  { _id: false }
);

const approvalsSubSchema = new mongoose.Schema(
  {
    preparedBy: { type: preparedBySubSchema, default: () => ({}) },
    approvedBy: { type: approvedBySubSchema, default: () => ({}) },
  },
  { _id: false }
);

function buildFallbackPoNumber(date = new Date()) {
  const year =
    date instanceof Date && !Number.isNaN(date.getTime())
      ? date.getUTCFullYear()
      : new Date().getUTCFullYear();
  const suffix = String(crypto.randomInt(1, 10000)).padStart(4, '0');
  return `PO-${year}-${suffix}`;
}

const purchaseOrderSchema = new mongoose.Schema(
  {
    poNumber: {
      type: String,
      required: true,
      trim: true,
      default: () => buildFallbackPoNumber(),
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    supplierId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Supplier',
      default: null,
    },
    buyer: { type: partySubSchema, default: () => ({}) },
    supplier: { type: supplierSnapshotSubSchema, default: () => ({}) },
    issueDate: { type: Date, default: Date.now },
    expectedDeliveryDate: { type: Date, default: null },
    deliveryAddress: { type: String, trim: true, default: '' },
    shippingMethod: { type: String, trim: true, default: '' },
    deliveryNotes: { type: String, trim: true, default: '' },
    currency: { type: String, trim: true, uppercase: true, default: 'LKR' },
    items: { type: [lineItemSubSchema], default: [] },
    subtotal: { type: Number, default: 0, min: 0 },
    taxRate: { type: Number, default: 0, min: 0, max: 100 },
    taxAmount: { type: Number, default: 0, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    grandTotal: { type: Number, default: 0, min: 0 },
    approvals: { type: approvalsSubSchema, default: () => ({}) },
    terms: { type: String, trim: true, default: '' },
  },
  {
    collection: 'purchase_orders',
    timestamps: true,
  }
);

purchaseOrderSchema.index({ poNumber: 1 }, { unique: true });
purchaseOrderSchema.index({ userId: 1, createdAt: -1 });
purchaseOrderSchema.index({ createdAt: -1 });

purchaseOrderSchema.pre('validate', function preValidatePurchaseOrder(next) {
  if (!this.poNumber || !String(this.poNumber).trim()) {
    this.poNumber = buildFallbackPoNumber(this.issueDate);
  }

  const rawItems = Array.isArray(this.items) ? this.items : [];
  const totals = computePurchaseOrderTotals(
    rawItems.map((item) => (typeof item.toObject === 'function' ? item.toObject() : item)),
    { taxRate: this.taxRate, discount: this.discount }
  );

  for (let i = 0; i < rawItems.length; i += 1) {
    rawItems[i].lineTotal = totals.items[i].lineTotal;
  }
  this.subtotal = totals.subtotal;
  this.discount = totals.discount;
  this.taxAmount = totals.taxAmount;
  this.grandTotal = totals.grandTotal;

  next();
});

export const PurchaseOrder =
  mongoose.models.PurchaseOrder ||
  mongoose.model('PurchaseOrder', purchaseOrderSchema);

const round2 = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

/**
 * Deterministic server-side PO math (ignores any client-sent totals):
 *   lineTotal  = quantity × unitPrice
 *   subtotal   = Σ lineTotal
 *   taxAmount  = (subtotal − discount) × taxRate / 100
 *   grandTotal = subtotal − discount + taxAmount
 *
 * @param {Array<{ quantity: number, unitPrice: number }>} items
 * @param {{ taxRate?: number, discount?: number }} [options]
 */
export function computePurchaseOrderTotals(items = [], { taxRate = 0, discount = 0 } = {}) {
  const computedItems = items.map((item) => ({
    ...item,
    lineTotal: round2(Number(item.quantity) * Number(item.unitPrice)),
  }));
  const subtotal = round2(computedItems.reduce((sum, item) => sum + item.lineTotal, 0));
  const safeDiscount = round2(Math.max(0, Number(discount) || 0));
  const taxableBase = Math.max(0, subtotal - safeDiscount);
  const taxAmount = round2((taxableBase * (Number(taxRate) || 0)) / 100);
  const grandTotal = round2(taxableBase + taxAmount);

  return {
    items: computedItems,
    subtotal,
    discount: safeDiscount,
    taxAmount,
    grandTotal,
  };
}

/**
 * Atomically generates the next `PO-YYYY-XXXX` number, skipping any number
 * already claimed by a custom user-entered PO number.
 *
 * @param {Date} [referenceDate]
 * @returns {Promise<string>}
 */
export async function generateNextPoNumber(referenceDate = new Date()) {
  const validDate =
    referenceDate instanceof Date && !Number.isNaN(referenceDate.getTime())
      ? referenceDate
      : new Date();
  const year = validDate.getUTCFullYear();

  for (let attempt = 0; attempt < 25; attempt += 1) {
    const counter = await PurchaseOrderCounter.findOneAndUpdate(
      { year },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
    const seqNum = Number(counter?.seq) || attempt + 1;
    const candidate = `PO-${year}-${String(seqNum).padStart(4, '0')}`;

    const collision = await PurchaseOrder.findOne({ poNumber: candidate }).lean();
    if (!collision) return candidate;
  }

  return `PO-${year}-${Date.now().toString().slice(-6)}`;
}

export default PurchaseOrder;
