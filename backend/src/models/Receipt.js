import crypto from 'node:crypto';
import mongoose from 'mongoose';

/**
 * Receipt Mongoose Model (`receipts` collection) & Atomic `RCP-YYYY-XXXX` Counter
 */

const receiptCounterSchema = new mongoose.Schema(
  {
    year: {
      type: Number,
      required: true,
    },
    seq: {
      type: Number,
      required: true,
      default: 0,
    },
  },
  {
    collection: 'receipt_counters',
    timestamps: true,
  }
);

receiptCounterSchema.index({ year: 1 }, { unique: true });

export const ReceiptCounter =
  mongoose.models.ReceiptCounter ||
  mongoose.model('ReceiptCounter', receiptCounterSchema);

const businessSubSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, default: '' },
    address: { type: String, trim: true, default: '' },
    phone: { type: String, trim: true, default: '' },
    email: { type: String, trim: true, default: '' },
    logoUrl: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const customerSubSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, default: '' },
    email: { type: String, trim: true, default: '' },
    phone: { type: String, trim: true, default: '' },
    address: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

export const RECEIPT_PAYMENT_METHODS = ['Cash', 'Card', 'Bank Transfer'];
export const RECEIPT_FORMATS = ['thermal', 'a5'];

export function computeReceiptBalanceDue(invoiceTotal, amountPaid) {
  const paid = Number(amountPaid) || 0;
  const total = Number(invoiceTotal) || 0;
  const rawBalance = Math.max(0, (total || paid) - paid);
  return Math.round((rawBalance + Number.EPSILON) * 100) / 100;
}

function buildFallbackReceiptNumber(date = new Date()) {
  const year = date instanceof Date && !Number.isNaN(date.getTime())
    ? date.getUTCFullYear()
    : new Date().getUTCFullYear();
  const suffix = String(crypto.randomInt(1, 10000)).padStart(4, '0');
  return `RCP-${year}-${suffix}`;
}

const receiptSchema = new mongoose.Schema(
  {
    receiptNumber: {
      type: String,
      required: true,
      trim: true,
      default: () => buildFallbackReceiptNumber(),
    },
    linkedInvoiceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Invoice',
      default: null,
    },
    linkedInvoiceNumber: {
      type: String,
      trim: true,
      default: '',
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    business: {
      type: businessSubSchema,
      default: () => ({}),
    },
    customer: {
      type: customerSubSchema,
      default: () => ({}),
    },
    paymentMethod: {
      type: String,
      enum: RECEIPT_PAYMENT_METHODS,
      default: 'Cash',
    },
    paymentReference: {
      type: String,
      trim: true,
      default: '',
    },
    currency: {
      type: String,
      trim: true,
      uppercase: true,
      default: 'LKR',
    },
    invoiceTotal: {
      type: Number,
      default: 0,
      min: 0,
    },
    amountPaid: {
      type: Number,
      required: true,
      min: 0,
    },
    balanceDue: {
      type: Number,
      default: function defaultBalanceDue() {
        return computeReceiptBalanceDue(this.invoiceTotal, this.amountPaid);
      },
      min: 0,
    },
    issuedDate: {
      type: Date,
      default: Date.now,
    },
    format: {
      type: String,
      enum: RECEIPT_FORMATS,
      default: 'a5',
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    collection: 'receipts',
    timestamps: true,
  }
);

receiptSchema.index({ receiptNumber: 1 }, { unique: true });
receiptSchema.index({ userId: 1, createdAt: -1 });
receiptSchema.index({ createdAt: -1 });

receiptSchema.pre('validate', function preValidateReceipt(next) {
  if (!this.receiptNumber || !String(this.receiptNumber).trim()) {
    this.receiptNumber = buildFallbackReceiptNumber(this.issuedDate);
  }
  this.balanceDue = computeReceiptBalanceDue(this.invoiceTotal, this.amountPaid);
  next();
});

export const Receipt =
  mongoose.models.Receipt || mongoose.model('Receipt', receiptSchema);

/**
 * Generates the next sequential `RCP-YYYY-XXXX` receipt number atomically,
 * skipping any number already claimed by a custom user-entered receipt number.
 *
 * @param {Date} [referenceDate]
 * @returns {Promise<string>}
 */
export async function generateNextReceiptNumber(referenceDate = new Date()) {
  const validDate =
    referenceDate instanceof Date && !Number.isNaN(referenceDate.getTime())
      ? referenceDate
      : new Date();
  const year = validDate.getUTCFullYear();

  for (let attempt = 0; attempt < 25; attempt += 1) {
    const counter = await ReceiptCounter.findOneAndUpdate(
      { year },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
    const seqNum = Number(counter?.seq) || attempt + 1;
    const candidate = `RCP-${year}-${String(seqNum).padStart(4, '0')}`;

    const collision = await Receipt.findOne({ receiptNumber: candidate }).lean();
    if (!collision) {
      return candidate;
    }
  }

  return `RCP-${year}-${Date.now().toString().slice(-6)}`;
}

export default Receipt;
