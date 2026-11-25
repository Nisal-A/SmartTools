import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { requireAdmin } from '../../middleware/role.middleware.js';
import {
  getAdminGlobalHistoryController,
  inspectAdminUserDocumentController,
  listAdminUsersController,
  updateAdminUserRoleController,
  toggleAdminUserStatusController,
  listAdminAuditLogsController,
} from './admin.controller.js';

/**
 * Admin Governance Routes (`/api/v1/admin`)
 * Strictly protected by `requireAuth` + `requireAdmin`.
 */

const router = Router();

router.use(requireAuth, requireAdmin);

router.get('/history', getAdminGlobalHistoryController);
router.get('/history/:type/:id', inspectAdminUserDocumentController);
router.get('/users', listAdminUsersController);
router.patch('/users/:id/role', updateAdminUserRoleController);
router.patch('/users/:id/status', toggleAdminUserStatusController);
router.get('/audit-logs', listAdminAuditLogsController);

export default router;
