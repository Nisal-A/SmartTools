import { Router } from 'express';
import { requireAuth, optionalAuth } from '../middleware/auth.middleware.js';
import { requireAdmin } from '../middleware/role.middleware.js';
import {
  createPurchaseOrder,
  getMyPurchaseOrders,
  getAdminPurchaseOrders,
  deletePurchaseOrder,
} from '../controllers/purchaseOrderController.js';

const router = Router();

// Public / optional-auth: guest (`userId: null`) or authenticated user
router.post('/', optionalAuth, createPurchaseOrder);

// Protected: current user's own purchase orders only
router.get('/my', requireAuth, getMyPurchaseOrders);

// Admin-only: paginated purchase orders across all users & guests
router.get('/admin', requireAuth, requireAdmin, getAdminPurchaseOrders);

// Protected: owner or admin only
router.delete('/:id', requireAuth, deletePurchaseOrder);

export default router;
