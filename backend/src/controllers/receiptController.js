import mongoose from 'mongoose';
import {
  Receipt,
  RECEIPT_FORMATS,
  RECEIPT_PAYMENT_METHODS,
  computeReceiptBalanceDue,
  generateNextReceiptNumber,
} from '../models/Receipt.js';
import { Invoice } from '../modules/invoices/models/invoice.model.js';
import { User } from '../modules/authentication/user.model.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * Receipt Generator REST Controllers (`/api/receipts`)
 */

function resolveAuthObjectId(req) {
  const rawId = req.user?._id || req.user?.id || null;
  if (!rawId || !mongoose.Types.ObjectId.isValid(String(rawId))) {
    return null;
  }
  return new mongoose.Types.ObjectId(String(rawId));
}

function formatAddressField(rawAddress) {
  if (!rawAddress) return '';
  if (typeof rawAddress === 'string') return rawAddress.trim();
  if (typeof rawAddress === 'object') {
    const parts = [
      rawAddress.street,
      rawAddress.line1,
      rawAddress.line2,
      rawAddress.city,
      rawAddress.state,
      rawAddress.postalCode || rawAddress.zip,
      rawAddress.country,
    ]
      .map((part) => (typeof part === 'string' ? part.trim() : ''))
      .filter(Boolean);
    return parts.join(', ');
  }
  return '';
}

function sanitizeBusinessInput(business = {}) {
  if (!business || typeof business !== 'object') {
    return { name: '', address: '', phone: '', email: '', logoUrl: '' };
  }
  return {
    name: String(business.name || business.businessName || '').trim(),
    address: formatAddressField(business.address),
    phone: String(business.phone || '').trim(),
    email: String(business.email || '').trim(),
    logoUrl: String(business.logoUrl || '').trim(),
  };
}

function sanitizeCustomerInput(customer = {}) {
  if (!customer || typeof customer !== 'object') {
    return { name: '', email: '', phone: '', address: '' };
  }
  return {
    name: String(customer.name || customer.companyName || '').trim(),
    email: String(customer.email || '').trim(),
    phone: String(customer.phone || '').trim(),
    address:
      formatAddressField(customer.address) ||
      formatAddressField(customer.billingAddress),
  };
}

/**
 * `POST /api/receipts`
 * Public / optional-auth: saves receipt for guest (`userId: null`) or authenticated user.
 */
export const createReceipt = asyncHandler(async (req, res) => {
  const body = req.body || {};

  // Validate required `amountPaid`
  if (
    body.amountPaid === undefined ||
    body.amountPaid === null ||
    body.amountPaid === ''
  ) {
    throw new AppError('amountPaid is required.', 400);
  }

  const amountPaid = Math.round((Number(body.amountPaid) + Number.EPSILON) * 100) / 100;
  if (!Number.isFinite(amountPaid) || amountPaid < 0) {
    throw new AppError('amountPaid must be a valid non-negative number.', 400);
  }

  let invoiceTotal = 0;
  if (
    body.invoiceTotal !== undefined &&
    body.invoiceTotal !== null &&
    body.invoiceTotal !== ''
  ) {
    invoiceTotal = Math.round((Number(body.invoiceTotal) + Number.EPSILON) * 100) / 100;
    if (!Number.isFinite(invoiceTotal) || invoiceTotal < 0) {
      throw new AppError('invoiceTotal must be a valid non-negative number.', 400);
    }
  }

  const paymentMethod =
    body.paymentMethod !== undefined && String(body.paymentMethod).trim() !== ''
      ? String(body.paymentMethod).trim()
      : 'Cash';

  if (!RECEIPT_PAYMENT_METHODS.includes(paymentMethod)) {
    throw new AppError(
      `paymentMethod must be one of: ${RECEIPT_PAYMENT_METHODS.join(', ')}.`,
      400
    );
  }

  const format =
    body.format !== undefined && String(body.format).trim() !== ''
      ? String(body.format).trim().toLowerCase()
      : 'a5';

  if (!RECEIPT_FORMATS.includes(format)) {
    throw new AppError(`format must be one of: ${RECEIPT_FORMATS.join(', ')}.`, 400);
  }

  let linkedInvoiceId = null;
  if (body.linkedInvoiceId) {
    const rawLinkedId = String(body.linkedInvoiceId).trim();
    if (!mongoose.Types.ObjectId.isValid(rawLinkedId)) {
      throw new AppError('linkedInvoiceId must be a valid ObjectId.', 400);
    }
    linkedInvoiceId = new mongoose.Types.ObjectId(rawLinkedId);
  }

  let issuedDate = new Date();
  if (body.issuedDate) {
    const parsedDate = new Date(body.issuedDate);
    if (Number.isNaN(parsedDate.getTime())) {
      throw new AppError('issuedDate must be a valid date.', 400);
    }
    issuedDate = parsedDate;
  }

  const userId = resolveAuthObjectId(req);
  const balanceDue = computeReceiptBalanceDue(invoiceTotal, amountPaid);

  const explicitReceiptNumber =
    typeof body.receiptNumber === 'string' ? body.receiptNumber.trim() : '';

  if (explicitReceiptNumber) {
    const existing = await Receipt.findOne({
      receiptNumber: explicitReceiptNumber,
    }).lean();
    if (existing) {
      throw new AppError(
        `A receipt with number "${explicitReceiptNumber}" already exists.`,
        409
      );
    }
  }

  let createdDoc = null;
  const maxAttempts = explicitReceiptNumber ? 1 : 5;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const receiptNumber =
      explicitReceiptNumber || (await generateNextReceiptNumber(issuedDate));

    try {
      createdDoc = await Receipt.create({
        receiptNumber,
        linkedInvoiceId,
        linkedInvoiceNumber: String(body.linkedInvoiceNumber || '').trim(),
        userId,
        business: sanitizeBusinessInput(body.business),
        customer: sanitizeCustomerInput(body.customer),
        paymentMethod,
        paymentReference: String(body.paymentReference || '').trim(),
        currency: String(body.currency || 'LKR').trim().toUpperCase() || 'LKR',
        invoiceTotal,
        amountPaid,
        balanceDue,
        issuedDate,
        format,
        notes: String(body.notes || '').trim(),
      });
      break;
    } catch (err) {
      if (!explicitReceiptNumber && err?.code === 11000 && attempt < maxAttempts - 1) {
        continue;
      }
      if (err?.code === 11000) {
        throw new AppError('Duplicate receiptNumber conflict.', 409);
      }
      throw err;
    }
  }

  const savedReceipt =
    typeof createdDoc.toObject === 'function' ? createdDoc.toObject() : createdDoc;

  return res.status(201).json({
    success: true,
    data: savedReceipt,
    receipt: savedReceipt,
  });
});

/**
 * `GET /api/receipts/my`
 * Protected: strictly returns receipts owned by the authenticated user (`userId === req.user.id`).
 */
export const getMyReceipts = asyncHandler(async (req, res) => {
  const authUserId = resolveAuthObjectId(req);
  if (!authUserId) {
    throw new AppError('Authentication required.', 401);
  }

  const filter = { userId: authUserId };
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';

  if (search) {
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'i');
    filter.$or = [
      { receiptNumber: regex },
      { linkedInvoiceNumber: regex },
      { 'customer.name': regex },
      { 'business.name': regex },
      { paymentReference: regex },
    ];
  }

  const receipts = await Receipt.find(filter).sort({ createdAt: -1 }).lean();

  return res.status(200).json({
    success: true,
    count: receipts.length,
    data: receipts,
    receipts,
  });
});

/**
 * `GET /api/receipts/admin`
 * Admin-only: returns paginated receipts across all registered users and guests.
 */
export const getAdminReceipts = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number.parseInt(String(req.query.page || '1'), 10) || 1);
  const limit = Math.min(
    100,
    Math.max(1, Number.parseInt(String(req.query.limit || '20'), 10) || 20)
  );
  const skip = (page - 1) * limit;

  const filter = {};
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const format = typeof req.query.format === 'string' ? req.query.format.trim().toLowerCase() : '';
  const paymentMethod =
    typeof req.query.paymentMethod === 'string' ? req.query.paymentMethod.trim() : '';
  const scope = typeof req.query.scope === 'string' ? req.query.scope.trim().toLowerCase() : '';

  if (format && RECEIPT_FORMATS.includes(format)) {
    filter.format = format;
  }

  if (paymentMethod && RECEIPT_PAYMENT_METHODS.includes(paymentMethod)) {
    filter.paymentMethod = paymentMethod;
  }

  if (scope === 'guests') {
    filter.userId = null;
  } else if (scope === 'users') {
    filter.userId = { $ne: null };
  }

  if (search) {
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'i');
    filter.$or = [
      { receiptNumber: regex },
      { linkedInvoiceNumber: regex },
      { 'customer.name': regex },
      { 'customer.email': regex },
      { 'business.name': regex },
      { paymentReference: regex },
    ];
  }

  const [total, rawReceipts] = await Promise.all([
    Receipt.countDocuments(filter),
    Receipt.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
  ]);

  // Batch-attach owner metadata for authenticated receipts without relying on `.populate()`
  const ownerIds = [
    ...new Set(
      rawReceipts
        .map((r) => (r.userId ? String(r.userId) : null))
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

  const receipts = rawReceipts.map((r) => ({
    ...r,
    isGuest: !r.userId,
    owner: r.userId ? ownerMap.get(String(r.userId)) || { id: String(r.userId) } : null,
  }));

  const pagination = {
    page,
    limit,
    total,
    totalPages: total > 0 ? Math.ceil(total / limit) : 0,
  };

  return res.status(200).json({
    success: true,
    data: receipts,
    receipts,
    pagination,
  });
});

/**
 * `GET /api/receipts/prefill-invoice/:invoiceId`
 * Protected: fetches an invoice owned by `req.user` (or any invoice if admin)
 * and returns normalized business, customer, currency, invoice number, and totals.
 */
export const prefillReceiptFromInvoice = asyncHandler(async (req, res) => {
  const { invoiceId } = req.params;
  if (!invoiceId || !mongoose.Types.ObjectId.isValid(String(invoiceId))) {
    throw new AppError('Invalid invoice ID.', 400);
  }

  const authUserId = resolveAuthObjectId(req);
  const isAdmin = req.user?.role === 'admin';

  const filter = isAdmin
    ? { _id: new mongoose.Types.ObjectId(String(invoiceId)) }
    : {
        _id: new mongoose.Types.ObjectId(String(invoiceId)),
        userId: authUserId,
      };

  const invoice = await Invoice.findOne(filter).lean();
  if (!invoice) {
    throw new AppError('Invoice not found.', 404);
  }

  const grandTotal = Number(invoice.grandTotal ?? 0);
  const previouslyPaid = Number(invoice.amountPaid ?? 0);
  const remainingBalance =
    invoice.balanceDue !== undefined && invoice.balanceDue !== null
      ? Number(invoice.balanceDue)
      : Math.max(0, grandTotal - previouslyPaid);

  const normalized = {
    linkedInvoiceId: String(invoice._id),
    invoiceId: String(invoice._id),
    linkedInvoiceNumber: invoice.invoiceNumber || '',
    invoiceNumber: invoice.invoiceNumber || '',
    currency: invoice.currency || 'LKR',
    invoiceTotal: grandTotal,
    totalAmount: grandTotal,
    previouslyPaid,
    remainingBalance,
    suggestedAmountPaid: remainingBalance > 0 ? remainingBalance : grandTotal,
    business: {
      name: invoice.businessSnapshot?.businessName || '',
      address: formatAddressField(invoice.businessSnapshot?.address),
      phone: invoice.businessSnapshot?.phone || '',
      email: invoice.businessSnapshot?.email || '',
      logoUrl: invoice.businessSnapshot?.logoUrl || '',
    },
    customer: {
      name:
        invoice.customerSnapshot?.name ||
        invoice.customerSnapshot?.companyName ||
        '',
      email: invoice.customerSnapshot?.email || '',
      phone: invoice.customerSnapshot?.phone || '',
      address:
        formatAddressField(invoice.customerSnapshot?.billingAddress) ||
        formatAddressField(invoice.customerSnapshot?.address),
    },
  };

  return res.status(200).json({
    success: true,
    data: normalized,
  });
});

/**
 * `DELETE /api/receipts/:id`
 * Protected: deletes a receipt only if the requester is its owner or an admin.
 */
export const deleteReceipt = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!id || !mongoose.Types.ObjectId.isValid(String(id))) {
    throw new AppError('Receipt not found.', 404);
  }

  const receipt = await Receipt.findById(id).lean();
  if (!receipt) {
    throw new AppError('Receipt not found.', 404);
  }

  const authUserId = resolveAuthObjectId(req);
  const isAdmin = req.user?.role === 'admin';
  const isOwner =
    Boolean(receipt.userId) &&
    Boolean(authUserId) &&
    String(receipt.userId) === String(authUserId);

  if (!isAdmin && !isOwner) {
    throw new AppError('Forbidden: You do not have permission to delete this receipt.', 403);
  }

  await Receipt.deleteOne({ _id: receipt._id });

  return res.status(200).json({
    success: true,
    message: 'Receipt deleted successfully.',
    data: {
      deleted: true,
      id: String(receipt._id),
    },
  });
});

export default {
  createReceipt,
  getMyReceipts,
  getAdminReceipts,
  prefillReceiptFromInvoice,
  deleteReceipt,
};
