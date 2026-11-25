import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import {
  convertQuotationToInvoiceController,
  createQuotationController,
  deleteQuotationController,
  downloadQuotationPdfController,
  duplicateQuotationController,
  getQuotationByIdController,
  listQuotationsController,
  updateQuotationController,
} from './quotations.controller.js';

/**
 * Quotation Generator Routes (`/api/v1/quotations`)
 * All routes protected by `requireAuth`.
 */

const router = Router();

router.use(requireAuth);

router.get('/', listQuotationsController);
router.post('/', createQuotationController);
router.get('/:id', getQuotationByIdController);
router.put('/:id', updateQuotationController);
router.delete('/:id', deleteQuotationController);
router.post('/:id/duplicate', duplicateQuotationController);
router.post('/:id/convert-to-invoice', convertQuotationToInvoiceController);
router.get('/:id/pdf', downloadQuotationPdfController);

export default router;
