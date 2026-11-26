import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import {
  listSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
} from '../controllers/supplierController.js';

const router = Router();

// Entire Supplier Directory is private to the authenticated user
router.use(requireAuth);

router.get('/', listSuppliers);
router.post('/', createSupplier);
router.put('/:id', updateSupplier);
router.delete('/:id', deleteSupplier);

export default router;
