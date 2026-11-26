import mongoose from 'mongoose';
import { Supplier } from '../models/Supplier.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * Supplier Directory REST Controllers (`/api/suppliers`)
 *
 * Every query is hard-scoped to the authenticated user. Requests for another
 * user's supplier ID return 404 (never 403) to prevent ID enumeration.
 */

const EDITABLE_FIELDS = [
  'name',
  'contactPerson',
  'email',
  'phone',
  'address',
  'taxId',
  'paymentTerms',
  'notes',
];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function requireAuthUserId(req) {
  const rawId = req.user?._id || req.user?.id || null;
  if (!rawId || !mongoose.Types.ObjectId.isValid(String(rawId))) {
    throw new AppError('Authentication required.', 401);
  }
  return new mongoose.Types.ObjectId(String(rawId));
}

function pickSupplierFields(body = {}, { partial = false } = {}) {
  const fields = {};
  for (const key of EDITABLE_FIELDS) {
    if (body[key] === undefined) continue;
    fields[key] = String(body[key] ?? '').trim();
  }

  if (!partial || fields.name !== undefined) {
    if (!fields.name) {
      throw new AppError('Supplier name is required.', 400);
    }
  }

  if (fields.email && !EMAIL_REGEX.test(fields.email)) {
    throw new AppError('Supplier email must be a valid email address.', 400);
  }

  return fields;
}

async function findOwnedSupplierOr404(supplierId, userId) {
  if (!supplierId || !mongoose.Types.ObjectId.isValid(String(supplierId))) {
    throw new AppError('Supplier not found.', 404);
  }
  const supplier = await Supplier.findOne({
    _id: new mongoose.Types.ObjectId(String(supplierId)),
    userId,
  }).lean();
  if (!supplier) {
    throw new AppError('Supplier not found.', 404);
  }
  return supplier;
}

/** `GET /api/suppliers` — the authenticated user's supplier directory only. */
export const listSuppliers = asyncHandler(async (req, res) => {
  const userId = requireAuthUserId(req);
  const filter = { userId };

  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  if (search) {
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'i');
    filter.$or = [
      { name: regex },
      { contactPerson: regex },
      { email: regex },
      { phone: regex },
      { taxId: regex },
    ];
  }

  const suppliers = await Supplier.find(filter).sort({ name: 1 }).lean();

  return res.status(200).json({
    success: true,
    count: suppliers.length,
    data: suppliers,
  });
});

/** `POST /api/suppliers` */
export const createSupplier = asyncHandler(async (req, res) => {
  const userId = requireAuthUserId(req);
  const fields = pickSupplierFields(req.body);

  const created = await Supplier.create({ ...fields, userId });
  const supplier = typeof created.toObject === 'function' ? created.toObject() : created;

  return res.status(201).json({
    success: true,
    data: supplier,
  });
});

/** `PUT /api/suppliers/:id` — owner only. */
export const updateSupplier = asyncHandler(async (req, res) => {
  const userId = requireAuthUserId(req);
  const existing = await findOwnedSupplierOr404(req.params.id, userId);
  const fields = pickSupplierFields(req.body, { partial: true });

  if (Object.keys(fields).length === 0) {
    throw new AppError('No editable supplier fields were provided.', 400);
  }

  const updated = await Supplier.findOneAndUpdate(
    { _id: existing._id, userId },
    { $set: fields },
    { new: true, runValidators: true }
  ).lean();

  return res.status(200).json({
    success: true,
    data: updated,
  });
});

/** `DELETE /api/suppliers/:id` — owner only. */
export const deleteSupplier = asyncHandler(async (req, res) => {
  const userId = requireAuthUserId(req);
  const existing = await findOwnedSupplierOr404(req.params.id, userId);

  await Supplier.deleteOne({ _id: existing._id, userId });

  return res.status(200).json({
    success: true,
    message: 'Supplier deleted successfully.',
    data: { deleted: true, id: String(existing._id) },
  });
});

export { findOwnedSupplierOr404 };

export default {
  listSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
};
