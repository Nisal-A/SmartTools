import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware.js';
import {
  getUserHistoryController,
  getDashboardSummaryController,
  exportDocumentPdfController,
} from './documents.controller.js';

/**
 * Documents, User History & Dashboard Routes
 * Mounted at `/api/v1` in `app.js`:
 * - `GET /api/v1/history`
 * - `GET /api/v1/dashboard/summary`
 * - `GET /api/v1/documents/:type/:id/pdf`
 *
 * `requireAuth` is attached per-route (rather than router-wide) so sibling
 * public routes under `/api/v1/public/*` are never intercepted.
 */

const router = Router();

router.get('/history', requireAuth, getUserHistoryController);
router.get('/dashboard/summary', requireAuth, getDashboardSummaryController);
router.get('/dashboard', requireAuth, getDashboardSummaryController);
router.get('/documents/:type/:id/pdf', requireAuth, exportDocumentPdfController);

export default router;
