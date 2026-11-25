import mongoose from 'mongoose';
import SeoAudit from '../models/seoAudit.model.js';
import AppError from '../utils/AppError.js';
import safeFetch from './fetch/safeFetch.js';
import { analyzePage } from './seo/analyzePage.js';
import { calculateScores } from './scoring/scoreService.js';
import { generateRecommendations } from './recommendationService.js';

const MAX_LIMIT = 50;
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;

// Escapes all regex special characters to prevent ReDoS and regex injection.
export const escapeRegex = (rawSearch) =>
  String(rawSearch ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const toObjectIdOrNull = (val) => {
  if (!val) return null;
  const str = String(val);
  return mongoose.Types.ObjectId.isValid(str)
    ? new mongoose.Types.ObjectId(str)
    : null;
};

const defaultMongooseRepository = {
  async create(payload) {
    const doc = await SeoAudit.create(payload);
    return typeof doc.toObject === 'function' ? doc.toObject() : doc;
  },

  async findPaginated({ filter, skip, limit }) {
    const [items, total] = await Promise.all([
      SeoAudit.find(filter).sort({ analyzedAt: -1, createdAt: -1 }).skip(skip).limit(limit).lean(),
      SeoAudit.countDocuments(filter),
    ]);
    return { items, total };
  },

  async findById(id) {
    const objId = toObjectIdOrNull(id);
    if (!objId) return null;
    return SeoAudit.findById(objId).lean();
  },

  async findByIdAndOwner({ id, ownerId }) {
    const objId = toObjectIdOrNull(id);
    if (!objId) return null;
    return SeoAudit.findOne({ _id: objId, ownerId }).lean();
  },

  async deleteById(id) {
    const objId = toObjectIdOrNull(id);
    if (!objId) return null;
    return SeoAudit.findOneAndDelete({ _id: objId }).lean();
  },

  async deleteByIdAndUserId({ id, userId }) {
    const objId = toObjectIdOrNull(id);
    const uid = toObjectIdOrNull(userId);
    if (!objId || !uid) return null;
    return SeoAudit.findOneAndDelete({ _id: objId, userId: uid }).lean();
  },

  async deleteByIdAndOwner({ id, ownerId }) {
    const objId = toObjectIdOrNull(id);
    if (!objId) return null;
    return SeoAudit.findOneAndDelete({ _id: objId, ownerId }).lean();
  },

  /**
   * Platform-wide aggregate across all completed audits (no userId filter).
   * Projects ONLY numeric totals, overall averages, and category averages — zero URLs or PII.
   * Works identically on real MongoDB and the local in-memory Mongoose fallback engine.
   */
  async aggregateGlobalStats() {
    const docs = await SeoAudit.find({ status: 'completed' }).lean();
    if (!docs || docs.length === 0) return null;

    let totalAudits = 0;
    let scoreSum = 0;
    let coverageSum = 0;
    let passed = 0;
    let warning = 0;
    let failed = 0;
    let notTested = 0;

    const categoryBuckets = new Map();

    for (const doc of docs) {
      totalAudits += 1;
      scoreSum += Number(doc.overallScore) || 0;
      coverageSum += Number(doc.scoreCoverage) || 0;
      passed += Number(doc.summary?.passed) || 0;
      warning += Number(doc.summary?.warning) || 0;
      failed += Number(doc.summary?.failed) || 0;
      notTested += Number(doc.summary?.notTested) || 0;

      if (Array.isArray(doc.categoryScores)) {
        for (const cat of doc.categoryScores) {
          if (cat && cat.category && typeof cat.score === 'number') {
            const existing = categoryBuckets.get(cat.category) || {
              category: cat.category,
              label: cat.label || cat.category,
              sum: 0,
              count: 0,
            };
            existing.sum += cat.score;
            existing.count += 1;
            categoryBuckets.set(cat.category, existing);
          }
        }
      }
    }

    const categoryAverages = Array.from(categoryBuckets.values()).map((bucket) => ({
      category: bucket.category,
      label: bucket.label,
      averageScore: bucket.count > 0 ? Math.round(bucket.sum / bucket.count) : null,
    }));

    return {
      totalAudits,
      averageScore: totalAudits > 0 ? scoreSum / totalAudits : null,
      averageCoverage: totalAudits > 0 ? coverageSum / totalAudits : null,
      passed,
      warning,
      failed,
      notTested,
      categoryAverages,
    };
  },
};

let activeDependencies = {
  repository: defaultMongooseRepository,
  fetcher: safeFetch,
  fetchOptions: {},
};

export const setAuditServiceDependencies = (overrides = {}) => {
  activeDependencies = {
    repository: overrides.repository ?? defaultMongooseRepository,
    fetcher: overrides.fetcher ?? safeFetch,
    fetchOptions: overrides.fetchOptions ?? {},
  };
};

export const resetAuditServiceDependencies = () => {
  activeDependencies = {
    repository: defaultMongooseRepository,
    fetcher: safeFetch,
    fetchOptions: {},
  };
};

const parsePositiveIntQuery = (rawValue, defaultValue, fieldName) => {
  if (rawValue === undefined || rawValue === '') return defaultValue;

  const str = String(rawValue).trim();
  if (!/^\d+$/.test(str)) {
    throw new AppError(
      'VALIDATION_ERROR',
      `Query parameter "${fieldName}" must be a positive integer.`
    );
  }

  const parsed = Number.parseInt(str, 10);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new AppError(
      'VALIDATION_ERROR',
      `Query parameter "${fieldName}" must be a positive integer.`
    );
  }

  return parsed;
};

/**
 * Full analysis pipeline: safeFetch -> analyzePage -> scoreService -> recommendationService -> save SeoAudit.
 * Stores `userId: req.user?.id || null` and `isGuestAudit: !req.user`.
 */
export const createAudit = async (
  { url, userId = null, clientId = 'anonymous-public', ownerId },
  options = {}
) => {
  const repository = options.repository ?? activeDependencies.repository;
  const fetcher = options.fetcher ?? activeDependencies.fetcher;
  const fetchOptions = options.fetchOptions ?? activeDependencies.fetchOptions;

  const analysis = await analyzePage(url, { fetcher, fetchOptions });
  const scored = calculateScores(analysis.seoChecks);
  const recommendations = generateRecommendations(scored.seoChecks);

  const normalizedUserId = toObjectIdOrNull(userId);
  const isGuestAudit = !normalizedUserId;
  const resolvedClientId = String(clientId || ownerId || 'anonymous-public').trim();
  const resolvedOwnerId = normalizedUserId
    ? String(normalizedUserId)
    : resolvedClientId;

  const auditPayload = {
    schemaVersion: 1,
    userId: normalizedUserId,
    isGuestAudit,
    clientId: resolvedClientId,
    ownerId: resolvedOwnerId,
    url: analysis.url,
    finalUrl: analysis.finalUrl,
    redirectChain: (analysis.redirectChain ?? []).slice(0, 10),
    responseStatus: analysis.responseStatus,
    status: 'completed',
    analyzedAt: new Date(),
    pageTitle: analysis.pageTitle,
    metaDescription: analysis.metaDescription,
    overallScore: scored.overallScore,
    scoreCoverage: scored.scoreCoverage,
    categoryScores: scored.categoryScores,
    summary: scored.summary,
    seoChecks: scored.seoChecks,
    recommendations,
    details: analysis.details,
  };

  return repository.create(auditPayload);
};

/**
 * Lists audits strictly scoped to an authenticated user's `userId` (or legacy `ownerId` for unit tests).
 * Completely ignores any client-sent `userId`.
 */
export const listAudits = async (
  { userId, ownerId, page, limit, search = '' },
  options = {}
) => {
  const repository = options.repository ?? activeDependencies.repository;

  const pageNum = parsePositiveIntQuery(page, DEFAULT_PAGE, 'page');
  const rawLimit = parsePositiveIntQuery(limit, DEFAULT_LIMIT, 'limit');
  const effectiveLimit = Math.min(rawLimit, MAX_LIMIT);

  if (search !== undefined && typeof search !== 'string') {
    throw new AppError('VALIDATION_ERROR', 'Query parameter "search" must be a string.');
  }

  const trimmedSearch = String(search ?? '').trim();
  if (trimmedSearch.length > 200) {
    throw new AppError(
      'VALIDATION_ERROR',
      'Query parameter "search" cannot exceed 200 characters.'
    );
  }

  const filter = {};
  if (userId) {
    const uid = toObjectIdOrNull(userId);
    if (!uid) {
      throw new AppError('VALIDATION_ERROR', 'Invalid authenticated user identifier.');
    }
    filter.userId = uid;
  } else if (ownerId) {
    filter.ownerId = ownerId;
  } else {
    throw new AppError('UNAUTHORIZED', 'Authentication is required to list audits.');
  }

  if (trimmedSearch.length > 0) {
    const safeRegex = new RegExp(escapeRegex(trimmedSearch), 'i');
    filter.$or = [{ url: safeRegex }, { finalUrl: safeRegex }, { pageTitle: safeRegex }];
  }

  const skip = (pageNum - 1) * effectiveLimit;
  const { items, total } = await repository.findPaginated({
    filter,
    skip,
    limit: effectiveLimit,
  });

  const totalPages = total === 0 ? 0 : Math.ceil(total / effectiveLimit);

  return {
    items,
    meta: {
      page: pageNum,
      limit: effectiveLimit,
      total,
      totalPages,
    },
  };
};

/**
 * Retrieves a single saved audit by `_id` enforcing strict SmartTools access rules:
 * - Allowed if `doc.userId === requesterUser.id`
 * - Allowed if `requesterUser.role === 'admin'` (or `options.allowAdmin`)
 * - Allowed if `doc.isGuestAudit && doc.clientId === clientId` (guest viewing their just-generated audit)
 * - Otherwise throws 404 NOT_FOUND to prevent ID enumeration.
 */
export const getAuditById = async (
  { id, requesterUser = null, clientId = null, ownerId = null },
  options = {}
) => {
  const repository = options.repository ?? activeDependencies.repository;

  let audit = null;
  if (typeof repository.findById === 'function') {
    audit = await repository.findById(id);
  } else if (typeof repository.findByIdAndOwner === 'function') {
    audit = await repository.findByIdAndOwner({
      id,
      ownerId: ownerId || requesterUser?.id || clientId,
    });
    if (!audit) throw new AppError('NOT_FOUND');
    return audit;
  }

  if (!audit) {
    throw new AppError('NOT_FOUND');
  }

  const isAdmin =
    options.allowAdmin === true || requesterUser?.role === 'admin';
  const isOwnerUser =
    Boolean(requesterUser?.id) &&
    Boolean(audit.userId) &&
    String(audit.userId) === String(requesterUser.id);
  const isMatchingGuestSession =
    audit.isGuestAudit === true &&
    Boolean(clientId) &&
    (audit.clientId === clientId || audit.ownerId === clientId);

  if (isAdmin || isOwnerUser || isMatchingGuestSession) {
    return audit;
  }

  throw new AppError('NOT_FOUND');
};

/**
 * Deletes a single saved audit by `_id`.
 * Requires authentication; allows owner (`doc.userId === requesterUser.id`) or `admin`.
 */
export const deleteAuditById = async (
  { id, requesterUser = null, ownerId = null },
  options = {}
) => {
  const repository = options.repository ?? activeDependencies.repository;

  if (!requesterUser && ownerId && typeof repository.deleteByIdAndOwner === 'function') {
    const deleted = await repository.deleteByIdAndOwner({ id, ownerId });
    if (!deleted) throw new AppError('NOT_FOUND');
    return deleted;
  }

  if (!requesterUser?.id) {
    throw new AppError('UNAUTHORIZED', 'Authentication is required to delete audits.');
  }

  let deleted = null;
  if (requesterUser.role === 'admin') {
    deleted = await repository.deleteById(id);
  } else {
    deleted = await repository.deleteByIdAndUserId({
      id,
      userId: requesterUser.id,
    });
  }

  if (!deleted) {
    throw new AppError('NOT_FOUND');
  }

  return deleted;
};

const toNonNegativeInteger = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? Math.round(numeric) : 0;
};

const toPercentOrNull = (value) => {
  if (value === null || value === undefined) return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return Math.min(100, Math.max(0, Math.round(numeric)));
};

/**
 * Anonymized platform-wide metrics across all completed audits (no userId filter).
 * Built from an explicit whitelist so zero URLs, titles, IDs, or user PII can ever leak.
 */
export const getGlobalAuditStats = async (options = {}) => {
  const repository = options.repository ?? activeDependencies.repository;
  const raw = (await repository.aggregateGlobalStats()) ?? {};

  const totalAudits = toNonNegativeInteger(raw.totalAudits);
  const hasAudits = totalAudits > 0;

  const categoryAverages =
    hasAudits && Array.isArray(raw.categoryAverages)
      ? raw.categoryAverages.map((c) => ({
          category: String(c.category || ''),
          label: String(c.label || c.category || ''),
          averageScore: toPercentOrNull(c.averageScore),
        }))
      : [];

  return {
    totalAudits,
    averageScore: hasAudits ? toPercentOrNull(raw.averageScore) : null,
    averageCoverage: hasAudits ? toPercentOrNull(raw.averageCoverage) : null,
    categoryAverages,
    totals: {
      passed: hasAudits ? toNonNegativeInteger(raw.passed) : 0,
      warning: hasAudits ? toNonNegativeInteger(raw.warning) : 0,
      failed: hasAudits ? toNonNegativeInteger(raw.failed) : 0,
      notTested: hasAudits ? toNonNegativeInteger(raw.notTested) : 0,
    },
  };
};

export default {
  createAudit,
  listAudits,
  getAuditById,
  deleteAuditById,
  getGlobalAuditStats,
  escapeRegex,
  setAuditServiceDependencies,
  resetAuditServiceDependencies,
};
