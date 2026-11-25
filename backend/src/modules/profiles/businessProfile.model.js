import mongoose from 'mongoose';

/**
 * Business Profile Model (`business_profiles` collection)
 * Stores reusable business details, logo references, bank details, tax rate,
 * default currency, payment terms, and default paper sizes for Invoices & Quotations.
 */

const businessProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    businessName: {
      type: String,
      trim: true,
      default: '',
    },
    logoUrl: {
      type: String,
      trim: true,
      default: '',
    },
    logoFileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FileMetadata',
      default: null,
    },
    taxRegistrationNo: {
      type: String,
      trim: true,
      default: '',
    },
    email: {
      type: String,
      trim: true,
      default: '',
    },
    phone: {
      type: String,
      trim: true,
      default: '',
    },
    website: {
      type: String,
      trim: true,
      default: '',
    },
    address: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({
        street: '',
        city: '',
        state: '',
        postalCode: '',
        country: '',
      }),
    },
    bankDetails: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({
        bankName: '',
        accountName: '',
        accountNumber: '',
        routingOrSwift: '',
        iban: '',
        branch: '',
        instructions: '',
      }),
    },
    defaultCurrency: {
      type: String,
      trim: true,
      uppercase: true,
      default: 'USD',
    },
    defaultTaxRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    defaultPaymentTerms: {
      type: String,
      trim: true,
      default: 'Net 30 days',
    },
    defaultInvoiceSize: {
      type: String,
      enum: ['A4', 'A5', 'LETTER', 'LEGAL', 'B5', 'THERMAL_80'],
      default: 'A4',
    },
    defaultQuotationSize: {
      type: String,
      enum: ['A4', 'A5', 'LETTER', 'LEGAL', 'B5'],
      default: 'A4',
    },
  },
  {
    collection: 'business_profiles',
    timestamps: true,
  }
);

businessProfileSchema.index({ userId: 1 }, { unique: true });

export const BusinessProfile =
  mongoose.models.BusinessProfile ||
  mongoose.model('BusinessProfile', businessProfileSchema);

export default BusinessProfile;
