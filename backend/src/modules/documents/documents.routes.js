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
 */

const router = Router();

router.use(requireAuth);

router.get('/history', getUserHistoryController);
router.get('/dashboard/summary', getDashboardSummaryController);
router.get('/dashboard', getDashboardSummaryController);
router.get('/documents/:type/:id/pdf', exportDocumentPdfController);

export default router;
