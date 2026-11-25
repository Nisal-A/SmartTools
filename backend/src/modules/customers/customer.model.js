import mongoose from 'mongoose';

/**
 * Shared Customers Model (`customers` collection)
 *
 * Shared between Invoice Generator and Quotation Generator.
 * Strictly isolated per user (`userId`).
 */

const customerSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    companyName: {
      type: String,
      trim: true,
      default: '',
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: '',
    },
    phone: {
      type: String,
      trim: true,
      default: '',
    },
    billingAddress: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({
        street: '',
        city: '',
        state: '',
        postalCode: '',
        country: '',
      }),
    },
    shippingAddress: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({
        street: '',
        city: '',
        state: '',
        postalCode: '',
        country: '',
      }),
    },
    taxId: {
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
    collection: 'customers',
    timestamps: true,
  }
);

customerSchema.index({ userId: 1, name: 1 });
customerSchema.index({ userId: 1, email: 1 });

export const Customer =
  mongoose.models.Customer || mongoose.model('Customer', customerSchema);

export default Customer;
