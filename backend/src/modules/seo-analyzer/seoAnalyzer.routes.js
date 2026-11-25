import { Router } from 'express';
import {
  requireAuth,
  optionalAuth,
} from '../../middleware/auth.middleware.js';
import { analyzeRateLimiter } from './middleware/rateLimiters.js';
import { clientIdentity } from './middleware/clientIdentity.js';
import { validateAnalyzeRequest } from './middleware/validateAnalyzeRequest.js';
import { validateObjectId } from './middleware/validateObjectId.js';
import {
  analyzeUrl,
  getAudits,
  getAudit,
  getStats,
  deleteAudit,
} from './seoAnalyzer.controller.js';

/**
 * SEO Analyzer Routes (`/api/v1/seo`)
 *
 * - `POST /api/v1/seo/analyze`: Guest + Authenticated (`optionalAuth` + `clientIdentity` + rate limiter)
 * - `GET  /api/v1/seo/stats`:   Public aggregate metrics only (zero URLs or PII)
 * - `GET  /api/v1/seo/audits`:  Authenticated user's own audits (`requireAuth`, strictly scoped to `req.user.id`)
 * - `GET  /api/v1/seo/audits/:id`: Owner, Admin, or matching guest session (`optionalAuth` + `clientIdentity`)
 * - `DELETE /api/v1/seo/audits/:id`: Owner or Admin (`requireAuth`)
 */

const router = Router();

router.post(
  '/analyze',
  optionalAuth,
  clientIdentity,
  analyzeRateLimiter,
  validateAnalyzeRequest,
  analyzeUrl
);

router.get('/stats', getStats);

router.get('/audits', requireAuth, getAudits);

router.get(
  '/audits/:id',
  optionalAuth,
  clientIdentity,
  validateObjectId,
  getAudit
);

router.delete('/audits/:id', requireAuth, validateObjectId, deleteAudit);

export default router;
