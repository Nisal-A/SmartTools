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
 * Supports both:
 * - `getNextSequence(userId, sequenceType, prefix, options)`
 * - `getNextDocumentNumber(userId, sequenceType, options)`
 *
 * @param {string|mongoose.Types.ObjectId} userId
 * @param {'invoice'|'quotation'} [sequenceType='invoice']
 * @param {string|object} [prefixOrOptions]
 * @param {object} [maybeOptions]
 * @returns {Promise<string>} e.g. 'INV-2026-0001' or 'QUO-2026-0001'
 */
export async function getNextSequence(
  userId,
  sequenceType = 'invoice',
  prefixOrOptions = undefined,
  maybeOptions = {}
) {
  const normalizedType = sequenceType === 'quotation' ? 'quotation' : 'invoice';
  let prefix = normalizedType === 'quotation' ? 'QUO' : 'INV';
  let options = maybeOptions || {};

  if (typeof prefixOrOptions === 'string' && prefixOrOptions.trim()) {
    prefix = prefixOrOptions.trim().toUpperCase();
  } else if (prefixOrOptions && typeof prefixOrOptions === 'object') {
    options = prefixOrOptions;
    if (typeof options.prefix === 'string' && options.prefix.trim()) {
      prefix = options.prefix.trim().toUpperCase();
    }
  }

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

  const activePrefix = counterDoc?.prefix || prefix;
  const paddedSeq = String(counterDoc.seq).padStart(4, '0');
  return `${activePrefix}-${year}-${paddedSeq}`;
}

export const getNextDocumentNumber = getNextSequence;

export default {
  Counter,
  getNextSequence,
  getNextDocumentNumber,
};
