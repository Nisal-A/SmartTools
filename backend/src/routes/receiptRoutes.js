import { Router } from 'express';
import { requireAuth, optionalAuth } from '../middleware/auth.middleware.js';
import { requireAdmin } from '../middleware/role.middleware.js';
import {
  createReceipt,
  getMyReceipts,
  getAdminReceipts,
  prefillReceiptFromInvoice,
  deleteReceipt,
} from '../controllers/receiptController.js';

const router = Router();

// Public / optional-auth: guest (`userId: null`) or authenticated user
router.post('/', optionalAuth, createReceipt);

// Protected: current user's own receipts only
router.get('/my', requireAuth, getMyReceipts);

// Admin-only: paginated global receipts across all users & guests
router.get('/admin', requireAuth, requireAdmin, getAdminReceipts);

// Protected: pre-fill receipt fields from an owned invoice (or any invoice for admin)
router.get('/prefill-invoice/:invoiceId', requireAuth, prefillReceiptFromInvoice);

// Protected: owner or admin only
router.delete('/:id', requireAuth, deleteReceipt);

export default router;
