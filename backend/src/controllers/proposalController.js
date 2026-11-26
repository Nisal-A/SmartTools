import mongoose from 'mongoose';
import {
  Proposal,
  PROPOSAL_STATUSES,
  PROPOSAL_TONES,
  generateNextProposalNumber,
} from '../models/Proposal.js';
import { User } from '../modules/authentication/user.model.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  cleanPlainText,
  generateStructuredProposal,
} from '../utils/geminiProposalGenerator.js';

/**
 * AI Proposal Writer REST Controllers (`/api/proposals`)
 *
 * - AI generation runs strictly server-side using `GEMINI_API_KEY`.
 * - Draft persistence & CRUD routes enforce strict user isolation (`req.user`).
 */

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function round2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function requireAuthUserId(req) {
  const rawId = req.user?._id || req.user?.id || null;
  if (!rawId || !mongoose.Types.ObjectId.isValid(String(rawId))) {
    throw new AppError('Authentication required.', 401);
  }
  return new mongoose.Types.ObjectId(String(rawId));
}

function normalizeStringField(value, maxLen, fieldLabel, { required = false, minLen = 0 } = {}) {
  const cleaned = cleanPlainText(value, maxLen);
  if (required && !cleaned) {
    throw new AppError(`${fieldLabel} is required.`, 400);
  }
  if (cleaned && minLen > 0 && cleaned.length < minLen) {
    throw new AppError(
      `${fieldLabel} must be at least ${minLen} characters long.`,
      400
    );
  }
  if (typeof value === 'string' && value.trim().length > maxLen) {
    throw new AppError(
      `${fieldLabel} must not exceed ${maxLen} characters.`,
      400
    );
  }
  return cleaned;
}

function sanitizeSectionsInput(rawSections = {}) {
  if (!rawSections || typeof rawSections !== 'object' || Array.isArray(rawSections)) {
    throw new AppError('Sections must be an object.', 400);
  }

  const deliverables = Array.isArray(rawSections.deliverables)
    ? rawSections.deliverables
        .map((item) => cleanPlainText(item, 500))
        .filter(Boolean)
        .slice(0, 30)
    : [];

  const timeline = Array.isArray(rawSections.timeline)
    ? rawSections.timeline
        .filter((entry) => entry && typeof entry === 'object')
        .map((entry) => ({
          phase: cleanPlainText(entry.phase, 200),
          duration: cleanPlainText(entry.duration, 120),
          summary: cleanPlainText(entry.summary, 1000),
        }))
        .filter((entry) => entry.phase || entry.duration || entry.summary)
        .slice(0, 25)
    : [];

  return {
    executiveSummary: cleanPlainText(rawSections.executiveSummary, 5000),
    problemStatement: cleanPlainText(rawSections.problemStatement, 5000),
    proposedSolution: cleanPlainText(rawSections.proposedSolution, 6000),
    deliverables,
    timeline,
    termsAndNextSteps: cleanPlainText(rawSections.termsAndNextSteps, 5000),
  };
}

function sanitizeSuggestedLineItemsInput(rawItems = []) {
  if (!Array.isArray(rawItems)) {
    throw new AppError('suggestedLineItems must be an array.', 400);
  }
  if (rawItems.length > 50) {
    throw new AppError('suggestedLineItems cannot exceed 50 items.', 400);
  }

  return rawItems.map((item, idx) => {
    const description = cleanPlainText(item?.description, 300);
    if (!description) {
      throw new AppError(`Line item #${idx + 1} description is required.`, 400);
    }
    const quantity = Number(item?.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new AppError(
        `Line item #${idx + 1} quantity must be a positive number.`,
        400
      );
    }
    const unitPrice = Number(item?.unitPrice);
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      throw new AppError(
        `Line item #${idx + 1} unitPrice must be a non-negative number.`,
        400
      );
    }
    return {
      description,
      quantity: round2(quantity),
      unitPrice: round2(unitPrice),
    };
  });
}

function parseGenerateInput(body = {}) {
  const clientName = normalizeStringField(body.clientName, 160, 'Client name', {
    required: true,
  });
  const clientCompany = normalizeStringField(
    body.clientCompany,
    160,
    'Client company'
  );
  const projectTitle = normalizeStringField(
    body.projectTitle,
    200,
    'Project title',
    { required: true }
  );
  const brief = normalizeStringField(body.brief, 4000, 'Project brief', {
    required: true,
    minLen: 10,
  });
  const budgetHint = normalizeStringField(body.budgetHint, 120, 'Budget hint');
  const timelineHint = normalizeStringField(
    body.timelineHint,
    120,
    'Timeline hint'
  );
  const currency =
    cleanPlainText(body.currency || 'LKR', 10).toUpperCase() || 'LKR';

  const tone = cleanPlainText(body.tone || 'Professional', 40) || 'Professional';
  if (!PROPOSAL_TONES.includes(tone)) {
    throw new AppError(
      `Tone must be one of: ${PROPOSAL_TONES.join(', ')}.`,
      400
    );
  }

  return {
    clientName,
    clientCompany,
    projectTitle,
    brief,
    budgetHint,
    timelineHint,
    currency,
    tone,
  };
}

function parseProposalPersistenceInput(body = {}, { partial = false } = {}) {
  const fields = {};

  if (!partial || body.clientName !== undefined) {
    fields.clientName = normalizeStringField(
      body.clientName,
      160,
      'Client name',
      { required: true }
    );
  }

  if (body.clientCompany !== undefined) {
    fields.clientCompany = normalizeStringField(
      body.clientCompany,
      160,
      'Client company'
    );
  } else if (!partial) {
    fields.clientCompany = '';
  }

  if (body.clientEmail !== undefined) {
    const email = cleanPlainText(body.clientEmail, 160).toLowerCase();
    if (email && !EMAIL_REGEX.test(email)) {
      throw new AppError('Client email must be a valid email address.', 400);
    }
    fields.clientEmail = email;
  } else if (!partial) {
    fields.clientEmail = '';
  }

  if (!partial || body.projectTitle !== undefined) {
    fields.projectTitle = normalizeStringField(
      body.projectTitle,
      200,
      'Project title',
      { required: true }
    );
  }

  if (!partial || body.brief !== undefined) {
    fields.brief = normalizeStringField(body.brief, 4000, 'Project brief', {
      required: true,
      minLen: 10,
    });
  }

  if (body.tone !== undefined) {
    const tone = cleanPlainText(body.tone, 40);
    if (!PROPOSAL_TONES.includes(tone)) {
      throw new AppError(
        `Tone must be one of: ${PROPOSAL_TONES.join(', ')}.`,
        400
      );
    }
    fields.tone = tone;
  } else if (!partial) {
    fields.tone = 'Professional';
  }

  if (body.currency !== undefined) {
    fields.currency =
      cleanPlainText(body.currency, 10).toUpperCase() || 'LKR';
  } else if (!partial) {
    fields.currency = 'LKR';
  }

  if (body.status !== undefined) {
    const status = cleanPlainText(body.status, 30);
    if (!PROPOSAL_STATUSES.includes(status)) {
      throw new AppError(
        `Status must be one of: ${PROPOSAL_STATUSES.join(', ')}.`,
        400
      );
    }
    fields.status = status;
  } else if (!partial) {
    fields.status = 'Draft';
  }

  if (body.sections !== undefined) {
    fields.sections = sanitizeSectionsInput(body.sections);
  } else if (!partial) {
    fields.sections = sanitizeSectionsInput({});
  }

  if (body.suggestedLineItems !== undefined) {
    fields.suggestedLineItems = sanitizeSuggestedLineItemsInput(
      body.suggestedLineItems
    );
  } else if (!partial) {
    fields.suggestedLineItems = [];
  }

  return fields;
}

/** `POST /api/proposals/generate` — generate strict JSON proposal via Gemini. */
export const generateProposal = asyncHandler(async (req, res) => {
  requireAuthUserId(req);
  const input = parseGenerateInput(req.body);
  const generated = await generateStructuredProposal(input);

  const payload = {
    clientName: input.clientName,
    clientCompany: input.clientCompany,
    projectTitle: input.projectTitle,
    brief: input.brief,
    currency: input.currency,
    tone: input.tone,
    sections: generated.sections,
    suggestedLineItems: generated.suggestedLineItems,
  };

  return res.status(200).json({
    success: true,
    ...payload,
    data: payload,
  });
});

/** `POST /api/proposals` — save a generated/edited proposal draft. */
export const createProposal = asyncHandler(async (req, res) => {
  const userId = requireAuthUserId(req);
  const fields = parseProposalPersistenceInput(req.body);

  const customNumber = cleanPlainText(req.body?.proposalNumber, 40);
  let proposalNumber;
  if (customNumber) {
    const conflict = await Proposal.findOne({ proposalNumber: customNumber }).lean();
    if (conflict) {
      throw new AppError(
        `Proposal number "${customNumber}" already exists.`,
        409
      );
    }
    proposalNumber = customNumber;
  } else {
    proposalNumber = await generateNextProposalNumber();
  }

  const created = await Proposal.create({
    ...fields,
    proposalNumber,
    userId,
  });
  const proposal =
    typeof created.toObject === 'function' ? created.toObject() : created;

  return res.status(201).json({
    success: true,
    data: proposal,
    proposal,
  });
});

/** `GET /api/proposals/my` — list authenticated user's own saved proposals newest first. */
export const getMyProposals = asyncHandler(async (req, res) => {
  const userId = requireAuthUserId(req);
  const filter = { userId };

  const status = cleanPlainText(req.query.status, 30);
  if (status && PROPOSAL_STATUSES.includes(status)) {
    filter.status = status;
  }

  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  if (search) {
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'i');
    filter.$or = [
      { proposalNumber: regex },
      { projectTitle: regex },
      { clientName: regex },
      { clientCompany: regex },
    ];
  }

  const proposals = await Proposal.find(filter).sort({ createdAt: -1 }).lean();

  return res.status(200).json({
    success: true,
    count: proposals.length,
    data: proposals,
    proposals,
  });
});

/** `GET /api/proposals/:id` — load single proposal (owner or admin). */
export const getProposalById = asyncHandler(async (req, res) => {
  const userId = requireAuthUserId(req);
  const { id } = req.params;
  if (!id || !mongoose.Types.ObjectId.isValid(String(id))) {
    throw new AppError('Proposal not found.', 404);
  }

  const proposal = await Proposal.findById(id).lean();
  if (!proposal) {
    throw new AppError('Proposal not found.', 404);
  }

  const isAdmin = req.user?.role === 'admin';
  if (!isAdmin && String(proposal.userId) !== String(userId)) {
    throw new AppError('Proposal not found.', 404);
  }

  return res.status(200).json({
    success: true,
    data: proposal,
    proposal,
  });
});

/** `PUT /api/proposals/:id` — owner-only update to sections, line items, or status. */
export const updateProposal = asyncHandler(async (req, res) => {
  const userId = requireAuthUserId(req);
  const { id } = req.params;
  if (!id || !mongoose.Types.ObjectId.isValid(String(id))) {
    throw new AppError('Proposal not found.', 404);
  }

  const existing = await Proposal.findOne({
    _id: new mongoose.Types.ObjectId(String(id)),
    userId,
  }).lean();
  if (!existing) {
    throw new AppError('Proposal not found.', 404);
  }

  const updates = parseProposalPersistenceInput(req.body, { partial: true });
  if (Object.keys(updates).length === 0) {
    throw new AppError('No editable proposal fields were provided.', 400);
  }

  const updated = await Proposal.findOneAndUpdate(
    { _id: existing._id, userId },
    { $set: updates },
    { new: true, runValidators: true }
  ).lean();

  return res.status(200).json({
    success: true,
    data: updated,
    proposal: updated,
  });
});

/** `DELETE /api/proposals/:id` — owner or admin only. */
export const deleteProposal = asyncHandler(async (req, res) => {
  const userId = requireAuthUserId(req);
  const { id } = req.params;
  if (!id || !mongoose.Types.ObjectId.isValid(String(id))) {
    throw new AppError('Proposal not found.', 404);
  }

  const proposal = await Proposal.findById(id).lean();
  if (!proposal) {
    throw new AppError('Proposal not found.', 404);
  }

  const isAdmin = req.user?.role === 'admin';
  const isOwner = String(proposal.userId) === String(userId);
  if (!isAdmin && !isOwner) {
    throw new AppError(
      'Forbidden: You do not have permission to delete this proposal.',
      403
    );
  }

  await Proposal.deleteOne({ _id: proposal._id });

  return res.status(200).json({
    success: true,
    message: 'Proposal deleted successfully.',
    data: { deleted: true, id: String(proposal._id) },
  });
});

/** `GET /api/proposals/admin` — admin-only paginated overview across all users. */
export const getAdminProposals = asyncHandler(async (req, res) => {
  const page = Math.max(
    1,
    Number.parseInt(String(req.query.page || '1'), 10) || 1
  );
  const limit = Math.min(
    100,
    Math.max(1, Number.parseInt(String(req.query.limit || '20'), 10) || 20)
  );
  const skip = (page - 1) * limit;

  const filter = {};
  const status = cleanPlainText(req.query.status, 30);
  if (status && PROPOSAL_STATUSES.includes(status)) {
    filter.status = status;
  }

  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  if (search) {
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'i');
    filter.$or = [
      { proposalNumber: regex },
      { projectTitle: regex },
      { clientName: regex },
      { clientCompany: regex },
      { clientEmail: regex },
    ];
  }

  const [total, rawProposals] = await Promise.all([
    Proposal.countDocuments(filter),
    Proposal.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
  ]);

  const ownerIds = [
    ...new Set(
      rawProposals
        .map((p) => (p.userId ? String(p.userId) : null))
        .filter((uid) => uid && mongoose.Types.ObjectId.isValid(uid))
    ),
  ].map((uid) => new mongoose.Types.ObjectId(uid));

  const ownerMap = new Map();
  if (ownerIds.length > 0) {
    const users = await User.find({ _id: { $in: ownerIds } }).lean();
    for (const u of users) {
      ownerMap.set(String(u._id), {
        id: String(u._id),
        email: u.email || '',
        fullName: u.fullName || '',
      });
    }
  }

  const proposals = rawProposals.map((p) => ({
    ...p,
    owner: p.userId
      ? ownerMap.get(String(p.userId)) || { id: String(p.userId) }
      : null,
  }));

  return res.status(200).json({
    success: true,
    data: proposals,
    proposals,
    pagination: {
      page,
      limit,
      total,
      totalPages: total > 0 ? Math.ceil(total / limit) : 0,
    },
  });
});

export default {
  generateProposal,
  createProposal,
  getMyProposals,
  getProposalById,
  updateProposal,
  deleteProposal,
  getAdminProposals,
};
