import mongoose from 'mongoose';
import { AppError } from '../../utils/AppError.js';
import { Customer } from './customer.model.js';

/**
 * Shared Customers Service (`customers` collection)
 *
 * All operations strictly enforce `userId === req.user.id` in queries and return
 * `404 Not Found` for any unauthorized or non-existent customer ID to prevent
 * cross-user ID enumeration.
 */

function toObjectId(id, label = 'Customer') {
  if (!id || !mongoose.Types.ObjectId.isValid(String(id))) {
    throw new AppError(`${label} not found`, 404);
  }
  return new mongoose.Types.ObjectId(String(id));
}

function normalizeAddress(addr = {}) {
  if (!addr) {
    return {
      street: '',
      city: '',
      state: '',
      postalCode: '',
      country: '',
    };
  }
  if (typeof addr === 'string') {
    return {
      street: addr.trim(),
      city: '',
      state: '',
      postalCode: '',
      country: '',
    };
  }
  return {
    street: String(addr.street || '').trim(),
    city: String(addr.city || '').trim(),
    state: String(addr.state || '').trim(),
    postalCode: String(addr.postalCode || '').trim(),
    country: String(addr.country || '').trim(),
  };
}

/**
 * Lists the authenticated user's customers with search and pagination.
 */
export async function listCustomers(userId, query = {}) {
  const uid = toObjectId(userId, 'User');
  const filter = { userId: uid };

  const search = String(query.search || '').trim();
  if (search) {
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [
      { name: { $regex: escaped, $options: 'i' } },
      { companyName: { $regex: escaped, $options: 'i' } },
      { email: { $regex: escaped, $options: 'i' } },
      { phone: { $regex: escaped, $options: 'i' } },
      { taxId: { $regex: escaped, $options: 'i' } },
    ];
  }

  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(query.limit, 10) || 50));
  const skip = (page - 1) * limit;

  const [customers, total] = await Promise.all([
    Customer.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Customer.countDocuments(filter),
  ]);

  return {
    customers,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

/**
 * Creates a new customer scoped to `userId`.
 */
export async function createCustomer(userId, payload = {}) {
  const uid = toObjectId(userId, 'User');
  const name = String(payload.name || '').trim();

  if (!name) {
    throw new AppError('Customer name is required.', 400);
  }

  const created = await Customer.create({
    userId: uid,
    name,
    companyName: String(payload.companyName || '').trim(),
    email: String(payload.email || '').trim().toLowerCase(),
    phone: String(payload.phone || '').trim(),
    billingAddress: normalizeAddress(payload.billingAddress || payload.address),
    shippingAddress: normalizeAddress(payload.shippingAddress),
    taxId: String(payload.taxId || '').trim(),
    notes: String(payload.notes || '').trim(),
  });

  return typeof created.toObject === 'function' ? created.toObject() : created;
}

/**
 * Retrieves a single customer by ID, strictly scoped to `userId`.
 * Returns 404 if the customer does not exist or belongs to another user.
 */
export async function getCustomerById(userId, customerId) {
  const uid = toObjectId(userId, 'User');
  const cid = toObjectId(customerId, 'Customer');

  const customer = await Customer.findOne({ _id: cid, userId: uid }).lean();
  if (!customer) {
    throw new AppError('Customer not found.', 404);
  }

  return customer;
}

/**
 * Updates an existing customer by ID, strictly scoped to `userId`.
 * Returns 404 if the customer does not exist or belongs to another user.
 */
export async function updateCustomer(userId, customerId, payload = {}) {
  const uid = toObjectId(userId, 'User');
  const cid = toObjectId(customerId, 'Customer');

  const existing = await Customer.findOne({ _id: cid, userId: uid }).lean();
  if (!existing) {
    throw new AppError('Customer not found.', 404);
  }

  const nextName =
    payload.name !== undefined ? String(payload.name || '').trim() : existing.name;

  if (!nextName) {
    throw new AppError('Customer name cannot be empty.', 400);
  }

  const updated = await Customer.findOneAndUpdate(
    { _id: cid, userId: uid },
    {
      $set: {
        name: nextName,
        companyName:
          payload.companyName !== undefined
            ? String(payload.companyName || '').trim()
            : existing.companyName,
        email:
          payload.email !== undefined
            ? String(payload.email || '').trim().toLowerCase()
            : existing.email,
        phone:
          payload.phone !== undefined
            ? String(payload.phone || '').trim()
            : existing.phone,
        billingAddress:
          payload.billingAddress !== undefined
            ? normalizeAddress(payload.billingAddress)
            : existing.billingAddress,
        shippingAddress:
          payload.shippingAddress !== undefined
            ? normalizeAddress(payload.shippingAddress)
            : existing.shippingAddress,
        taxId:
          payload.taxId !== undefined
            ? String(payload.taxId || '').trim()
            : existing.taxId,
        notes:
          payload.notes !== undefined
            ? String(payload.notes || '').trim()
            : existing.notes,
      },
    },
    { new: true }
  ).lean();

  if (!updated) {
    throw new AppError('Customer not found.', 404);
  }

  return updated;
}

/**
 * Deletes a customer by ID, strictly scoped to `userId`.
 * Returns 404 if the customer does not exist or belongs to another user.
 */
export async function deleteCustomer(userId, customerId) {
  const uid = toObjectId(userId, 'User');
  const cid = toObjectId(customerId, 'Customer');

  const deleted = await Customer.findOneAndDelete({ _id: cid, userId: uid }).lean();
  if (!deleted) {
    throw new AppError('Customer not found.', 404);
  }

  return deleted;
}

export default {
  listCustomers,
  createCustomer,
  getCustomerById,
  updateCustomer,
  deleteCustomer,
};
