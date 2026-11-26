import crypto from 'node:crypto';
import mongoose from 'mongoose';

/**
 * Proposal Model (`proposals` collection) & Atomic `PRP-YYYY-XXXX` Counter
 */

const proposalCounterSchema = new mongoose.Schema(
  {
    year: { type: Number, required: true },
    seq: { type: Number, required: true, default: 0 },
  },
  {
    collection: 'proposal_counters',
    timestamps: true,
  }
);

proposalCounterSchema.index({ year: 1 }, { unique: true });

export const ProposalCounter =
  mongoose.models.ProposalCounter ||
  mongoose.model('ProposalCounter', proposalCounterSchema);

export const PROPOSAL_TONES = [
  'Professional',
  'Consultative',
  'Executive',
  'Friendly',
];

export const PROPOSAL_STATUSES = ['Draft', 'Sent', 'Handed Off'];

const timelinePhaseSchema = new mongoose.Schema(
  {
    phase: { type: String, trim: true, default: '' },
    duration: { type: String, trim: true, default: '' },
    summary: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const sectionsSchema = new mongoose.Schema(
  {
    executiveSummary: { type: String, trim: true, default: '' },
    problemStatement: { type: String, trim: true, default: '' },
    proposedSolution: { type: String, trim: true, default: '' },
    deliverables: { type: [String], default: [] },
    timeline: { type: [timelinePhaseSchema], default: [] },
    termsAndNextSteps: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const suggestedLineItemSchema = new mongoose.Schema(
  {
    description: { type: String, trim: true, required: true },
    quantity: { type: Number, required: true, min: 0 },
    unitPrice: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

function buildFallbackProposalNumber(date = new Date()) {
  const year =
    date instanceof Date && !Number.isNaN(date.getTime())
      ? date.getUTCFullYear()
      : new Date().getUTCFullYear();
  const suffix = String(crypto.randomInt(1, 10000)).padStart(4, '0');
  return `PRP-${year}-${suffix}`;
}

const proposalSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    proposalNumber: {
      type: String,
      required: true,
      trim: true,
      default: () => buildFallbackProposalNumber(),
    },
    clientName: { type: String, required: true, trim: true },
    clientCompany: { type: String, trim: true, default: '' },
    clientEmail: { type: String, trim: true, lowercase: true, default: '' },
    projectTitle: { type: String, required: true, trim: true },
    brief: { type: String, required: true, trim: true },
    tone: {
      type: String,
      enum: PROPOSAL_TONES,
      default: 'Professional',
    },
    currency: {
      type: String,
      trim: true,
      uppercase: true,
      default: 'LKR',
    },
    sections: {
      type: sectionsSchema,
      default: () => ({
        executiveSummary: '',
        problemStatement: '',
        proposedSolution: '',
        deliverables: [],
        timeline: [],
        termsAndNextSteps: '',
      }),
    },
    suggestedLineItems: {
      type: [suggestedLineItemSchema],
      default: [],
    },
    status: {
      type: String,
      enum: PROPOSAL_STATUSES,
      default: 'Draft',
    },
  },
  {
    collection: 'proposals',
    timestamps: true,
  }
);

proposalSchema.index({ proposalNumber: 1 }, { unique: true });
proposalSchema.index({ userId: 1, createdAt: -1 });
proposalSchema.index({ createdAt: -1 });

proposalSchema.pre('validate', function preValidateProposal(next) {
  if (!this.proposalNumber || !String(this.proposalNumber).trim()) {
    this.proposalNumber = buildFallbackProposalNumber();
  }
  next();
});

export const Proposal =
  mongoose.models.Proposal || mongoose.model('Proposal', proposalSchema);

/**
 * Atomically generates the next `PRP-YYYY-XXXX` number without colliding with
 * any custom proposalNumber saved by users.
 */
export async function generateNextProposalNumber(referenceDate = new Date()) {
  const validDate =
    referenceDate instanceof Date && !Number.isNaN(referenceDate.getTime())
      ? referenceDate
      : new Date();
  const year = validDate.getUTCFullYear();

  for (let attempt = 0; attempt < 25; attempt += 1) {
    const counter = await ProposalCounter.findOneAndUpdate(
      { year },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
    const seqNum = Number(counter?.seq) || attempt + 1;
    const candidate = `PRP-${year}-${String(seqNum).padStart(4, '0')}`;

    const collision = await Proposal.findOne({ proposalNumber: candidate }).lean();
    if (!collision) return candidate;
  }

  return `PRP-${year}-${Date.now().toString().slice(-6)}`;
}

export default Proposal;
