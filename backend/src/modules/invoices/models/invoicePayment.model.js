import mongoose from 'mongoose';

/**
 * Invoice Payment Mongoose Model (`invoice_payments` collection)
 */

const invoicePaymentSchema = new mongoose.Schema(
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
    amount: {
      type: Number,
      required: true,
      min: 0.01,
    },
    paymentDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    method: {
      type: String,
      enum: ['bank_transfer', 'cash', 'card', 'cheque', 'online', 'other'],
      default: 'bank_transfer',
    },
    referenceNo: {
      type: String,
      trim: true,
      default: '',
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    collection: 'invoice_payments',
    timestamps: true,
  }
);

invoicePaymentSchema.index({ invoiceId: 1, paymentDate: -1 });
invoicePaymentSchema.index({ userId: 1 });

export const InvoicePayment =
  mongoose.models.InvoicePayment ||
  mongoose.model('InvoicePayment', invoicePaymentSchema);

export default InvoicePayment;
