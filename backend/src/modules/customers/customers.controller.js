import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  listCustomers,
  createCustomer,
  getCustomerById,
  updateCustomer,
  deleteCustomer,
} from './customers.service.js';

/**
 * Shared Customers Controllers (`/api/v1/customers`)
 */

export const listCustomersController = asyncHandler(async (req, res) => {
  const { customers, pagination } = await listCustomers(req.user.id, req.query);
  return res.status(200).json({
    success: true,
    data: customers,
    pagination,
  });
});

export const createCustomerController = asyncHandler(async (req, res) => {
  const customer = await createCustomer(req.user.id, req.body);
  return res.status(201).json({
    success: true,
    data: customer,
  });
});

export const getCustomerByIdController = asyncHandler(async (req, res) => {
  const customer = await getCustomerById(req.user.id, req.params.id);
  return res.status(200).json({
    success: true,
    data: customer,
  });
});

export const updateCustomerController = asyncHandler(async (req, res) => {
  const customer = await updateCustomer(req.user.id, req.params.id, req.body);
  return res.status(200).json({
    success: true,
    data: customer,
  });
});

export const deleteCustomerController = asyncHandler(async (req, res) => {
  await deleteCustomer(req.user.id, req.params.id);
  return res.status(200).json({
    success: true,
    message: 'Customer deleted successfully.',
  });
});

export default {
  listCustomersController,
  createCustomerController,
  getCustomerByIdController,
  updateCustomerController,
  deleteCustomerController,
};
