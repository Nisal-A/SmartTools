import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware.js';
import {
  listCustomersController,
  createCustomerController,
  getCustomerByIdController,
  updateCustomerController,
  deleteCustomerController,
} from './customers.controller.js';
import { Customer } from './customer.model.js';

export { Customer };

const router = Router();

router.use(requireAuth);

router.get('/', listCustomersController);
router.post('/', createCustomerController);
router.get('/:id', getCustomerByIdController);
router.put('/:id', updateCustomerController);
router.delete('/:id', deleteCustomerController);

export default router;
