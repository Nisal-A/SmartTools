import mongoose from 'mongoose';

const redirectHopSchema = new mongoose.Schema(
  {
    url: { type: String, required: true, trim: true, maxlength: 2048 },
    status: { type: Number, required: true },
  },
  { _id: false }
);

const categoryScoreSchema = new mongoose.Schema(
  {
    category: { type: String, required: true, trim: true, maxlength: 50 },
    label: { type: String, required: true, trim: true, maxlength: 100 },
    weight: { type: Number, required: true },
    earned: { type: Number, required: true },
    possible: { type: Number, required: true },
    score: { type: Number, default: null },
  },
  { _id: false }
);

const seoCheckSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, trim: true, maxlength: 100 },
    category: { type: String, required: true, trim: true, maxlength: 50 },
    label: { type: String, required: true, trim: true, maxlength: 150 },
    status: {
      type: String,
      required: true,
      enum: ['passed', 'warning', 'failed', 'not_tested'],
    },
    maxPoints: { type: Number, required: true },
    earnedPoints: { type: Number, required: true },
    value: { type: mongoose.Schema.Types.Mixed, default: null },
    message: { type: String, required: true, trim: true, maxlength: 500 },
    reason: { type: String, default: null, maxlength: 100 },
  },
  { _id: false }
);

const recommendationSchema = new mongoose.Schema(
  {
    checkId: { type: String, required: true, trim: true, maxlength: 100 },
    priority: {
      type: String,
      required: true,
      enum: ['high', 'medium', 'low'],
    },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, required: true, trim: true, maxlength: 600 },
  },
  { _id: false }
);

const probeDetailSchema = new mongoose.Schema(
  {
    status: { type: String, required: true, maxlength: 50 },
    httpStatus: { type: Number },
    reason: { type: String, maxlength: 100 },
    url: { type: String, maxlength: 2048 },
  },
  { _id: false }
);

/**
 * SEO Analyzer Audit Model (`seo_audits` collection in `smart_tools_db`)
 *
 * Strictly separated from Invoice and Quotation collections.
 * - Authenticated audits store `userId` (ObjectId ref `'User'`) and `isGuestAudit: false`.
 * - Guest audits store `userId: null`, `isGuestAudit: true`, and browser `clientId` / `ownerId`.
 * - Never stores raw HTML.
 */
const seoAuditSchema = new mongoose.Schema(
  {
    schemaVersion: { type: Number, default: 1, required: true },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    isGuestAudit: {
      type: Boolean,
      default: true,
    },
    clientId: {
      type: String,
      trim: true,
      maxlength: 64,
      default: 'anonymous-public',
    },
    ownerId: {
      type: String,
      required: true,
      trim: true,
      maxlength: 64,
    },
    url: { type: String, required: true, trim: true, maxlength: 2048 },
    finalUrl: { type: String, required: true, trim: true, maxlength: 2048 },
    redirectChain: {
      type: [redirectHopSchema],
      default: [],
      validate: [(arr) => arr.length <= 10, 'redirectChain cannot exceed 10 entries'],
    },
    responseStatus: { type: Number, required: true },
    status: {
      type: String,
      enum: ['completed'],
      default: 'completed',
      required: true,
    },
    analyzedAt: { type: Date, default: Date.now, required: true },

    pageTitle: { type: String, default: null, maxlength: 200 },
    metaDescription: { type: String, default: null, maxlength: 200 },

    overallScore: { type: Number, required: true, min: 0, max: 100 },
    scoreCoverage: { type: Number, required: true, min: 0, max: 100 },
    categoryScores: { type: [categoryScoreSchema], required: true },
    summary: {
      passed: { type: Number, required: true, min: 0 },
      warning: { type: Number, required: true, min: 0 },
      failed: { type: Number, required: true, min: 0 },
      notTested: { type: Number, required: true, min: 0 },
    },

    seoChecks: { type: [seoCheckSchema], required: true },
    recommendations: { type: [recommendationSchema], default: [] },

    details: {
      titleLength: { type: Number, default: 0 },
      descriptionLength: { type: Number, default: 0 },
      headings: {
        h1: { type: [String], default: [] },
        h2: { type: [String], default: [] },
        h3: { type: [String], default: [] },
        counts: {
          h1: { type: Number, default: 0 },
          h2: { type: Number, default: 0 },
          h3: { type: Number, default: 0 },
          h4: { type: Number, default: 0 },
          h5: { type: Number, default: 0 },
          h6: { type: Number, default: 0 },
        },
        levelsPresent: { type: [Number], default: [] },
      },
      images: {
        total: { type: Number, default: 0 },
        withAlt: { type: Number, default: 0 },
        missingAlt: { type: Number, default: 0 },
        emptyAlt: { type: Number, default: 0 },
        altCoverage: { type: Number, default: null },
        missingAltSamples: { type: [String], default: [] },
      },
      links: {
        internal: { type: Number, default: 0 },
        external: { type: Number, default: 0 },
        invalid: { type: Number, default: 0 },
        invalidSamples: { type: [String], default: [] },
      },
      technical: {
        https: { type: Boolean, required: true },
        canonical: { type: String, default: null, maxlength: 200 },
        canonicalValid: { type: Boolean, default: false },
        robotsMeta: { type: String, default: null, maxlength: 200 },
        viewport: { type: String, default: null, maxlength: 200 },
        lang: { type: String, default: null, maxlength: 200 },
        robotsTxt: { type: probeDetailSchema, required: true },
        sitemap: { type: probeDetailSchema, required: true },
      },
    },
  },
  {
    collection: 'seo_audits',
    timestamps: true,
  }
);

seoAuditSchema.index({ userId: 1, createdAt: -1 });
seoAuditSchema.index({ ownerId: 1, analyzedAt: -1 });
seoAuditSchema.index({ analyzedAt: -1 });

export const SeoAudit =
  mongoose.models.SeoAudit || mongoose.model('SeoAudit', seoAuditSchema);

export default SeoAudit;
