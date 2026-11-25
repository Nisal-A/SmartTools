import mongoose from 'mongoose';

/**
 * Quotation Line Item Mongoose Model (`quotation_items` collection)
 */

const quotationItemSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    quotationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Quotation',
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
    collection: 'quotation_items',
    timestamps: true,
  }
);

quotationItemSchema.index({ quotationId: 1, sortOrder: 1 });
quotationItemSchema.index({ userId: 1 });

export const QuotationItem =
  mongoose.models.QuotationItem ||
  mongoose.model('QuotationItem', quotationItemSchema);

export default QuotationItem;
