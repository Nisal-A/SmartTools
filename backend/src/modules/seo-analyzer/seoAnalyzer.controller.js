import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  createAudit,
  listAudits,
  getAuditById,
  deleteAuditById,
  getGlobalAuditStats,
} from './services/auditService.js';

/**
 * SEO Analyzer Controllers (`/api/v1/seo`)
 */

export const getStats = asyncHandler(async (_req, res) => {
  const stats = await getGlobalAuditStats();
  return res.status(200).json({
    success: true,
    data: stats,
  });
});

export const analyzeUrl = asyncHandler(async (req, res) => {
  const audit = await createAudit({
    url: req.body.url,
    userId: req.user?.id || null,
    clientId: req.clientId,
  });

  return res.status(201).json({
    success: true,
    data: audit,
  });
});

export const getAudits = asyncHandler(async (req, res) => {
  // SECURITY INVARIANT: Strictly hardcode userId = req.user.id; ignore any query.userId
  const { page, limit, search } = req.query;
  const { items, meta } = await listAudits({
    userId: req.user.id,
    page,
    limit,
    search,
  });

  return res.status(200).json({
    success: true,
    data: items,
    meta,
  });
});

export const getAudit = asyncHandler(async (req, res) => {
  const audit = await getAuditById({
    id: req.params.id,
    requesterUser: req.user || null,
    clientId: req.clientId,
  });

  return res.status(200).json({
    success: true,
    data: audit,
  });
});

export const deleteAudit = asyncHandler(async (req, res) => {
  await deleteAuditById({
    id: req.params.id,
    requesterUser: req.user,
  });

  return res.status(204).send();
});

export default {
  getStats,
  analyzeUrl,
  getAudits,
  getAudit,
  deleteAudit,
};
