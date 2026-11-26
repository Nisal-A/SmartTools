import mongoose from 'mongoose';

/**
 * Supplier Directory Model (`suppliers` collection)
 *
 * Strictly user-scoped: every supplier belongs to exactly one authenticated user.
 */

const supplierSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    name: { type: String, required: true, trim: true },
    contactPerson: { type: String, trim: true, default: '' },
    email: { type: String, trim: true, lowercase: true, default: '' },
    phone: { type: String, trim: true, default: '' },
    address: { type: String, trim: true, default: '' },
    taxId: { type: String, trim: true, default: '' },
    paymentTerms: { type: String, trim: true, default: '' },
    notes: { type: String, trim: true, default: '' },
  },
  {
    collection: 'suppliers',
    timestamps: true,
  }
);

supplierSchema.index({ userId: 1, name: 1 });
supplierSchema.index({ userId: 1, createdAt: -1 });

export const Supplier =
  mongoose.models.Supplier || mongoose.model('Supplier', supplierSchema);

export default Supplier;
