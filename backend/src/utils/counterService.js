import mongoose from 'mongoose';

/**
 * Atomic Document Sequence Counter (`counters` collection)
 *
 * Generates gap-free, per-user, per-year atomic numbers:
 * - Invoices:   `INV-YYYY-XXXX`
 * - Quotations: `QUO-YYYY-XXXX`
 */

const counterSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    sequenceType: {
      type: String,
      enum: ['invoice', 'quotation'],
      required: true,
    },
    prefix: {
      type: String,
      required: true,
      trim: true,
    },
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
    collection: 'counters',
    timestamps: true,
  }
);

counterSchema.index({ userId: 1, sequenceType: 1, year: 1 }, { unique: true });

export const Counter =
  mongoose.models.Counter || mongoose.model('Counter', counterSchema);

/**
 * Atomically increments and returns the next formatted document number for a user.
 *
 * @param {string|mongoose.Types.ObjectId} userId
 * @param {'invoice'|'quotation'} sequenceType
 * @param {object} [options]
 * @param {number} [options.year]
 * @param {mongoose.ClientSession} [options.session]
 * @returns {Promise<string>} e.g. 'INV-2026-0001' or 'QUO-2026-0001'
 */
export async function getNextDocumentNumber(userId, sequenceType = 'invoice', options = {}) {
  const normalizedType = sequenceType === 'quotation' ? 'quotation' : 'invoice';
  const prefix = normalizedType === 'quotation' ? 'QUO' : 'INV';
  const year = Number(options.year) || new Date().getUTCFullYear();

  const updateOptions = {
    new: true,
    upsert: true,
    setDefaultsOnInsert: true,
    ...(options.session ? { session: options.session } : {}),
  };

  const counterDoc = await Counter.findOneAndUpdate(
    {
      userId: new mongoose.Types.ObjectId(String(userId)),
      sequenceType: normalizedType,
      year,
    },
    {
      $inc: { seq: 1 },
      $setOnInsert: { prefix },
    },
    updateOptions
  );

  const paddedSeq = String(counterDoc.seq).padStart(4, '0');
  return `${prefix}-${year}-${paddedSeq}`;
}

export default {
  Counter,
  getNextDocumentNumber,
};
