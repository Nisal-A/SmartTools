import mongoose from 'mongoose';

/**
 * Expense Model (`expenses` collection)
 *
 * Strictly user-scoped business expenses with optional Cloudinary receipt attachment.
 */

export const EXPENSE_CATEGORIES = [
  'Travel',
  'Office Supplies',
  'Software & Subscriptions',
  'Utilities',
  'Marketing',
  'Meals & Entertainment',
  'Equipment',
  'Contractors',
  'Other',
];

export const EXPENSE_PAYMENT_METHODS = [
  'Cash',
  'Card',
  'Bank Transfer',
  'Other',
];

const receiptAttachmentSchema = new mongoose.Schema(
  {
    url: { type: String, trim: true, default: '' },
    publicId: { type: String, trim: true, default: '' },
    originalName: { type: String, trim: true, default: '' },
    resourceType: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const expenseSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      required: true,
      enum: EXPENSE_CATEGORIES,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      trim: true,
      uppercase: true,
      default: 'LKR',
    },
    expenseDate: {
      type: Date,
      required: true,
      index: true,
    },
    paymentMethod: {
      type: String,
      enum: EXPENSE_PAYMENT_METHODS,
      default: 'Card',
    },
    vendor: {
      type: String,
      trim: true,
      default: '',
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
    receiptAttachment: {
      type: receiptAttachmentSchema,
      default: () => ({
        url: '',
        publicId: '',
        originalName: '',
        resourceType: '',
      }),
    },
  },
  {
    collection: 'expenses',
    timestamps: true,
  }
);

expenseSchema.index({ userId: 1, expenseDate: -1 });

export const Expense =
  mongoose.models.Expense || mongoose.model('Expense', expenseSchema);

export default Expense;
