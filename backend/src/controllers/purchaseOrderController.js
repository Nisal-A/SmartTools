import mongoose from 'mongoose';
import {
  PurchaseOrder,
  PO_APPROVAL_STATUSES,
  computePurchaseOrderTotals,
  generateNextPoNumber,
} from '../models/PurchaseOrder.js';
import { Supplier } from '../models/Supplier.js';
import { User } from '../modules/authentication/user.model.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * Purchase Order Generator REST Controllers (`/api/purchase-orders`)
 */

const MAX_LINE_ITEMS = 200;

function resolveAuthObjectId(req) {
  const rawId = req.user?._id || req.user?.id || null;
  if (!rawId || !mongoose.Types.ObjectId.isValid(String(rawId))) return null;
  return new mongoose.Types.ObjectId(String(rawId));
}

function str(value) {
  return value === undefined || value === null ? '' : String(value).trim();
}

function parseOptionalDate(value, fieldName) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new AppError(`${fieldName} must be a valid date.`, 400);
  }
  return parsed;
}

function parseNonNegativeNumber(value, fieldName, { max = Infinity, fallback = 0 } = {}) {
  if (value === undefined || value === null || value === '') return fallback;
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0 || num > max) {
    throw new AppError(
      max === Infinity
        ? `${fieldName} must be a valid non-negative number.`
        : `${fieldName} must be a number between 0 and ${max}.`,
      400
    );
  }
  return num;
}

function sanitizeLineItems(rawItems) {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw new AppError('At least one line item is required.', 400);
  }
  if (rawItems.length > MAX_LINE_ITEMS) {
    throw new AppError(`A purchase order may contain at most ${MAX_LINE_ITEMS} line items.`, 400);
  }

  return rawItems.map((item, idx) => {
    const position = idx + 1;
    if (!item || typeof item !== 'object') {
      throw new AppError(`Line item ${position} is invalid.`, 400);
    }
    const description = str(item.description);
    if (!description) {
      throw new AppError(`Line item ${position}: description is required.`, 400);
    }
    return {
      description,
      sku: str(item.sku),
      quantity: parseNonNegativeNumber(item.quantity, `Line item ${position}: quantity`, {
        fallback: NaN,
      }),
      unitPrice: parseNonNegativeNumber(item.unitPrice, `Line item ${position}: unitPrice`, {
        fallback: NaN,
      }),
    };
  }).map((item, idx) => {
    if (Number.isNaN(item.quantity) || Number.isNaN(item.unitPrice)) {
      throw new AppError(`Line item ${idx + 1}: quantity and unitPrice are required.`, 400);
    }
    return item;
  });
}

function sanitizeApprovals(raw = {}) {
  const prepared = raw?.preparedBy || {};
  const approved = raw?.approvedBy || {};
  const status = str(approved.status) || 'Pending';

  if (!PO_APPROVAL_STATUSES.includes(status)) {
    throw new AppError(
      `approvals.approvedBy.status must be one of: ${PO_APPROVAL_STATUSES.join(', ')}.`,
      400
    );
  }

  return {
    preparedBy: {
      name: str(prepared.name),
      title: str(prepared.title),
      date: parseOptionalDate(prepared.date, 'approvals.preparedBy.date'),
    },
    approvedBy: {
      name: str(approved.name),
      title: str(approved.title),
      date: parseOptionalDate(approved.date, 'approvals.approvedBy.date'),
      status,
    },
  };
}

/**
 * `POST /api/purchase-orders`
 * Public / optional-auth. All monetary totals are recomputed server-side;
 * client-sent `lineTotal`, `subtotal`, `taxAmount`, and `grandTotal` are ignored.
 */
export const createPurchaseOrder = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const userId = resolveAuthObjectId(req);

  const items = sanitizeLineItems(body.items);
  const taxRate = parseNonNegativeNumber(body.taxRate, 'taxRate', { max: 100 });
  const discount = parseNonNegativeNumber(body.discount, 'discount');
  const issueDate = parseOptionalDate(body.issueDate, 'issueDate') || new Date();
  const expectedDeliveryDate = parseOptionalDate(body.expectedDeliveryDate, 'expectedDeliveryDate');
  const approvals = sanitizeApprovals(body.approvals);

  const rawSupplier = body.supplier && typeof body.supplier === 'object' ? body.supplier : {};
  const supplierSnapshot = {
    name: str(rawSupplier.name),
    contactPerson: str(rawSupplier.contactPerson),
    email: str(rawSupplier.email),
    phone: str(rawSupplier.phone),
    address: str(rawSupplier.address),
  };

  // Link to the user's own Supplier Directory entry (authenticated users only).
  // Guests have no directory, so any supplierId they send is ignored.
  let supplierId = null;
  if (userId && body.supplierId) {
    const rawSupplierId = String(body.supplierId).trim();
    if (!mongoose.Types.ObjectId.isValid(rawSupplierId)) {
      throw new AppError('supplierId must be a valid ObjectId.', 400);
    }
    const directoryEntry = await Supplier.findOne({
      _id: new mongoose.Types.ObjectId(rawSupplierId),
      userId,
    }).lean();
    if (!directoryEntry) {
      throw new AppError('Supplier not found.', 404);
    }
    supplierId = directoryEntry._id;
    for (const key of ['name', 'contactPerson', 'email', 'phone', 'address']) {
      if (!supplierSnapshot[key]) supplierSnapshot[key] = directoryEntry[key] || '';
    }
  }

  const totals = computePurchaseOrderTotals(items, { taxRate, discount });

  const rawBuyer = body.buyer && typeof body.buyer === 'object' ? body.buyer : {};
  const explicitPoNumber = str(body.poNumber);

  if (explicitPoNumber) {
    const existing = await PurchaseOrder.findOne({ poNumber: explicitPoNumber }).lean();
    if (existing) {
      throw new AppError(`A purchase order with number "${explicitPoNumber}" already exists.`, 409);
    }
  }

  const baseDoc = {
    userId,
    supplierId,
    buyer: {
      name: str(rawBuyer.name),
      address: str(rawBuyer.address),
      phone: str(rawBuyer.phone),
      email: str(rawBuyer.email),
      logoUrl: str(rawBuyer.logoUrl),
    },
    supplier: supplierSnapshot,
    issueDate,
    expectedDeliveryDate,
    deliveryAddress: str(body.deliveryAddress),
    shippingMethod: str(body.shippingMethod),
    deliveryNotes: str(body.deliveryNotes),
    currency: str(body.currency).toUpperCase() || 'LKR',
    items: totals.items,
    subtotal: totals.subtotal,
    taxRate,
    taxAmount: totals.taxAmount,
    discount: totals.discount,
    grandTotal: totals.grandTotal,
    approvals,
    terms: str(body.terms),
  };

  let createdDoc = null;
  const maxAttempts = explicitPoNumber ? 1 : 5;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const poNumber = explicitPoNumber || (await generateNextPoNumber(issueDate));
    try {
      createdDoc = await PurchaseOrder.create({ ...baseDoc, poNumber });
      break;
    } catch (err) {
      if (!explicitPoNumber && err?.code === 11000 && attempt < maxAttempts - 1) continue;
      if (err?.code === 11000) throw new AppError('Duplicate poNumber conflict.', 409);
      throw err;
    }
  }

  const saved = typeof createdDoc.toObject === 'function' ? createdDoc.toObject() : createdDoc;

  return res.status(201).json({
    success: true,
    data: saved,
    purchaseOrder: saved,
  });
});

/** `GET /api/purchase-orders/my` — the authenticated user's own POs only. */
export const getMyPurchaseOrders = asyncHandler(async (req, res) => {
  const userId = resolveAuthObjectId(req);
  if (!userId) throw new AppError('Authentication required.', 401);

  const filter = { userId };
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  if (search) {
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'i');
    filter.$or = [{ poNumber: regex }, { 'supplier.name': regex }, { 'buyer.name': regex }];
  }

  const purchaseOrders = await PurchaseOrder.find(filter).sort({ createdAt: -1 }).lean();

  return res.status(200).json({
    success: true,
    count: purchaseOrders.length,
    data: purchaseOrders,
    purchaseOrders,
  });
});

/** `GET /api/purchase-orders/admin` — admin-only paginated view across all users & guests. */
export const getAdminPurchaseOrders = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number.parseInt(String(req.query.page || '1'), 10) || 1);
  const limit = Math.min(
    100,
    Math.max(1, Number.parseInt(String(req.query.limit || '20'), 10) || 20)
  );
  const skip = (page - 1) * limit;

  const filter = {};
  const scope = typeof req.query.scope === 'string' ? req.query.scope.trim().toLowerCase() : '';
  if (scope === 'guests') filter.userId = null;
  else if (scope === 'users') filter.userId = { $ne: null };

  const approvalStatus = str(req.query.approvalStatus);
  if (PO_APPROVAL_STATUSES.includes(approvalStatus)) {
    filter['approvals.approvedBy.status'] = approvalStatus;
  }

  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  if (search) {
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'i');
    filter.$or = [
      { poNumber: regex },
      { 'supplier.name': regex },
      { 'supplier.email': regex },
      { 'buyer.name': regex },
    ];
  }

  const [total, rawOrders] = await Promise.all([
    PurchaseOrder.countDocuments(filter),
    PurchaseOrder.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
  ]);

  const ownerIds = [
    ...new Set(
      rawOrders
        .map((po) => (po.userId ? String(po.userId) : null))
        .filter((id) => id && mongoose.Types.ObjectId.isValid(id))
    ),
  ].map((id) => new mongoose.Types.ObjectId(id));

  const ownerMap = new Map();
  if (ownerIds.length > 0) {
    const users = await User.find({ _id: { $in: ownerIds } }).lean();
    for (const u of users) {
      ownerMap.set(String(u._id), {
        id: String(u._id),
        email: u.email || '',
        fullName: u.fullName || '',
      });
    }
  }

  const purchaseOrders = rawOrders.map((po) => ({
    ...po,
    isGuest: !po.userId,
    owner: po.userId ? ownerMap.get(String(po.userId)) || { id: String(po.userId) } : null,
  }));

  return res.status(200).json({
    success: true,
    data: purchaseOrders,
    purchaseOrders,
    pagination: {
      page,
      limit,
      total,
      totalPages: total > 0 ? Math.ceil(total / limit) : 0,
    },
  });
});

/** `DELETE /api/purchase-orders/:id` — owner or admin only. */
export const deletePurchaseOrder = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!id || !mongoose.Types.ObjectId.isValid(String(id))) {
    throw new AppError('Purchase order not found.', 404);
  }

  const po = await PurchaseOrder.findById(id).lean();
  if (!po) throw new AppError('Purchase order not found.', 404);

  const userId = resolveAuthObjectId(req);
  const isAdmin = req.user?.role === 'admin';
  const isOwner = Boolean(po.userId) && Boolean(userId) && String(po.userId) === String(userId);

  if (!isAdmin && !isOwner) {
    throw new AppError('Forbidden: You do not have permission to delete this purchase order.', 403);
  }

  await PurchaseOrder.deleteOne({ _id: po._id });

  return res.status(200).json({
    success: true,
    message: 'Purchase order deleted successfully.',
    data: { deleted: true, id: String(po._id) },
  });
});

export default {
  createPurchaseOrder,
  getMyPurchaseOrders,
  getAdminPurchaseOrders,
  deletePurchaseOrder,
};
