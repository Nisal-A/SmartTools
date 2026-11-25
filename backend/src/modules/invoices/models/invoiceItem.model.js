import mongoose from 'mongoose';

/**
 * Invoice Line Item Mongoose Model (`invoice_items` collection)
 */

const invoiceItemSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    invoiceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Invoice',
      required: true,
    },
    sortOrder: {
      type: Number,
      required: true,
      default: 0,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    quantity: {
      type: Number,
      required: true,
      min: 0,
    },
    unit: {
      type: String,
      trim: true,
      default: 'pcs',
    },
    unitPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    discountType: {
      type: String,
      enum: ['percentage', 'fixed'],
      default: 'percentage',
    },
    discountValue: {
      type: Number,
      default: 0,
      min: 0,
    },
    discount: {
      type: Number,
      default: 0,
      min: 0,
    },
    taxRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    taxAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    lineTotal: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
  },
  {
    collection: 'invoice_items',
    timestamps: true,
  }
);

invoiceItemSchema.index({ invoiceId: 1, sortOrder: 1 });
invoiceItemSchema.index({ userId: 1 });

export const InvoiceItem =
  mongoose.models.InvoiceItem || mongoose.model('InvoiceItem', invoiceItemSchema);

export default InvoiceItem;
