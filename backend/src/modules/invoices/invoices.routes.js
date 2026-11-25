import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import {
  createInvoiceController,
  deleteInvoiceController,
  downloadInvoicePdfController,
  duplicateInvoiceController,
  getInvoiceByIdController,
  listInvoicesController,
  recordInvoicePaymentController,
  updateInvoiceController,
} from './invoices.controller.js';

/**
 * Invoice Generator Routes (`/api/v1/invoices`)
 * All routes protected by `requireAuth`.
 */

const router = Router();

router.use(requireAuth);

router.get('/', listInvoicesController);
router.post('/', createInvoiceController);
router.get('/:id', getInvoiceByIdController);
router.put('/:id', updateInvoiceController);
router.delete('/:id', deleteInvoiceController);
router.post('/:id/duplicate', duplicateInvoiceController);
router.post('/:id/payments', recordInvoicePaymentController);
router.get('/:id/pdf', downloadInvoicePdfController);

export default router;
