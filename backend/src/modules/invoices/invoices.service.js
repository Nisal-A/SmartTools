import mongoose from 'mongoose';
import {
  invoiceSchema as zodInvoiceSchema,
  invoicePaymentSchema as zodInvoicePaymentSchema,
} from '../../../../shared/schemas/invoice.schema.js';
import {
  calculateDocumentTotals,
  fromCents,
  toCents,
} from '../../../../shared/utils/financialMath.js';
import { isSizeSupportedForTool } from '../../../../shared/constants/paperSizes.js';
import { AppError } from '../../utils/AppError.js';
import { getNextDocumentNumber } from '../../utils/counterService.js';
import { renderDocumentToPdfBuffer } from '../pdf-engine/pdfEngine.service.js';
import { Invoice } from './models/invoice.model.js';
import { InvoiceItem } from './models/invoiceItem.model.js';
import { InvoicePayment } from './models/invoicePayment.model.js';

/**
 * Invoice Generator Service (`invoices`, `invoice_items`, `invoice_payments`)
 *
 * Enforces:
 * - Strict user isolation (`userId === req.user.id`), returning 404 for unauthorized IDs
 * - Atomic `INV-YYYY-XXXX` numbering via `counters` collection
 * - Server-side deterministic financial math via `shared/utils/financialMath.js`
 * - Immutable `businessSnapshot`, `customerSnapshot`, and `bankDetailsSnapshot`
 * - Deep-clone duplication and automated payment status transitions (`partial` -> `paid`)
 */

function toObjectId(id, label = 'Resource') {
  if (!id || !mongoose.Types.ObjectId.isValid(String(id))) {
    throw new AppError(`${label} not found`, 404);
  }
  return new mongoose.Types.ObjectId(String(id));
}

function normalizeBusinessSnapshot(raw = {}, topLevelBankDetails = null) {
  const bank = topLevelBankDetails || raw.bankDetails || {};
  return {
    businessName: String(raw.businessName || raw.name || '').trim(),
    taxRegistrationNo: String(raw.taxRegistrationNo || '').trim(),
    email: String(raw.email || '').trim(),
    phone: String(raw.phone || '').trim(),
    logoUrl: String(raw.logoUrl || '').trim(),
    address: raw.address || {},
    bankDetails: {
      bankName: String(bank.bankName || '').trim(),
      accountName: String(bank.accountName || '').trim(),
      accountNumber: String(bank.accountNumber || '').trim(),
      routingOrSwift: String(bank.routingOrSwift || '').trim(),
      iban: String(bank.iban || '').trim(),
      branch: String(bank.branch || '').trim(),
      instructions: String(bank.instructions || '').trim(),
    },
  };
}

function normalizeCustomerSnapshot(raw = {}) {
  return {
    customerId: raw.customerId ? String(raw.customerId).trim() : null,
    name: String(raw.name || raw.customerName || raw.companyName || '').trim(),
    companyName: String(raw.companyName || '').trim(),
    email: String(raw.email || '').trim(),
    phone: String(raw.phone || '').trim(),
    taxId: String(raw.taxId || '').trim(),
    billingAddress: raw.billingAddress || raw.address || {},
    shippingAddress: raw.shippingAddress || {},
    address: raw.address || raw.billingAddress || {},
  };
}

function resolveDiscountInput(payload = {}) {
  if (payload.discount && typeof payload.discount === 'object') {
    return {
      type: payload.discount.type === 'fixed' ? 'fixed' : 'percentage',
      value: Number(payload.discount.value) || 0,
    };
  }
  return {
    type: payload.globalDiscountType === 'fixed' ? 'fixed' : 'percentage',
    value: Number(payload.globalDiscountValue) || 0,
  };
}

function resolveInvoiceStatus(requestedStatus, amountPaid, balanceDue, grandTotal) {
  if (requestedStatus === 'void') {
    return 'void';
  }
  if (grandTotal > 0 && amountPaid > 0) {
    if (balanceDue <= 0) {
      return 'paid';
    }
    return 'partial';
  }
  return requestedStatus || 'draft';
}

function validateInvoiceInput(rawPayload = {}) {
  const merged = {
    ...rawPayload,
    ...(rawPayload.paperConfig
      ? {
          pageSize: rawPayload.paperConfig.pageSize || rawPayload.pageSize,
          orientation: rawPayload.paperConfig.orientation || rawPayload.orientation,
          templateKey: rawPayload.paperConfig.templateKey || rawPayload.templateKey,
        }
      : {}),
  };

  const parsed = zodInvoiceSchema.safeParse(merged);
  if (!parsed.success) {
    const message = parsed.error.issues
      .map((i) => `${i.path.join('.') || 'invoice'}: ${i.message}`)
      .join('; ');
    throw new AppError(message, 400, parsed.error.issues);
  }
  return parsed.data;
}

/**
 * Lists paginated invoices strictly scoped to `authUserId`.
 */
export async function listInvoices(authUserId, query = {}) {
  const userId = toObjectId(authUserId, 'User');
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  const skip = (page - 1) * limit;

  const filter = { userId };

  if (query.status && typeof query.status === 'string') {
    filter.status = query.status.trim().toLowerCase();
  }

  if (query.search && typeof query.search === 'string' && query.search.trim()) {
    const escaped = query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [
      { invoiceNumber: { $regex: escaped, $options: 'i' } },
      { 'customerSnapshot.name': { $regex: escaped, $options: 'i' } },
      { 'customerSnapshot.companyName': { $regex: escaped, $options: 'i' } },
      { 'customerSnapshot.email': { $regex: escaped, $options: 'i' } },
    ];
  }

  const startDate = query.startDate || query.fromDate;
  const endDate = query.endDate || query.toDate;
  if (startDate || endDate) {
    filter.issueDate = {};
    if (startDate) filter.issueDate.$gte = new Date(startDate);
    if (endDate) filter.issueDate.$lte = new Date(endDate);
  }

  const [invoices, total] = await Promise.all([
    Invoice.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Invoice.countDocuments(filter),
  ]);

  return {
    invoices,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

/**
 * Creates a new invoice with atomic `INV-YYYY-XXXX` numbering, immutable snapshots,
 * and server-computed financial totals.
 */
export async function createInvoice(authUserId, rawPayload = {}, options = {}) {
  const userId = toObjectId(authUserId, 'User');
  const validated = validateInvoiceInput(rawPayload);

  const issueDateObj = new Date(validated.issueDate);
  const issueYear = !Number.isNaN(issueDateObj.getTime())
    ? issueDateObj.getUTCFullYear()
    : new Date().getUTCFullYear();

  const invoiceNumber =
    validated.invoiceNumber && validated.invoiceNumber.trim()
      ? validated.invoiceNumber.trim()
      : await getNextDocumentNumber(userId, 'invoice', {
          year: issueYear,
          session: options.session,
        });

  const discountInput = resolveDiscountInput(validated);
  const totals = calculateDocumentTotals({
    items: validated.items,
    globalDiscountType: discountInput.type,
    globalDiscountValue: discountInput.value,
    shippingOrAdjustment: validated.shippingOrAdjustment || 0,
    amountPaid: validated.amountPaid || 0,
  });

  const businessSnapshot = normalizeBusinessSnapshot(
    validated.businessSnapshot,
    validated.bankDetails
  );
  const customerSnapshot = normalizeCustomerSnapshot(validated.customerSnapshot);

  const effectiveStatus = resolveInvoiceStatus(
    validated.status,
    totals.amountPaid,
    totals.balanceDue,
    totals.grandTotal
  );

  const customerIdObj =
    validated.customerId && mongoose.Types.ObjectId.isValid(validated.customerId)
      ? new mongoose.Types.ObjectId(validated.customerId)
      : null;

  const sourceQuotationIdObj =
    validated.sourceQuotationId &&
    mongoose.Types.ObjectId.isValid(validated.sourceQuotationId)
      ? new mongoose.Types.ObjectId(validated.sourceQuotationId)
      : null;

  const invoiceDoc = await Invoice.create({
    userId,
    customerId: customerIdObj,
    invoiceNumber,
    issueDate: issueDateObj,
    dueDate: validated.dueDate ? new Date(validated.dueDate) : null,
    currency: validated.currency || 'USD',
    status: effectiveStatus,
    pageSize: validated.pageSize || 'A4',
    orientation: validated.orientation || 'portrait',
    templateKey: validated.templateKey || 'indigo',
    businessSnapshot,
    customerSnapshot,
    subtotal: totals.subtotal,
    itemDiscountTotal: totals.itemDiscountTotal,
    discount: {
      type: discountInput.type,
      value: discountInput.value,
      amount: totals.globalDiscountAmount,
    },
    taxTotal: totals.taxTotal,
    shippingOrAdjustment: totals.shippingOrAdjustment,
    grandTotal: totals.grandTotal,
    amountPaid: totals.amountPaid,
    balanceDue: totals.balanceDue,
    paymentTerms: validated.paymentTerms || '',
    bankDetailsSnapshot: businessSnapshot.bankDetails,
    notes: validated.notes || '',
    sourceQuotationId: sourceQuotationIdObj,
  });

  const itemDocsToInsert = totals.lineResults.map((line, idx) => ({
    userId,
    invoiceId: invoiceDoc._id,
    sortOrder: typeof line.sortOrder === 'number' ? line.sortOrder : idx,
    name: line.name,
    description: line.description || '',
    quantity: line.quantity,
    unit: line.unit || 'pcs',
    unitPrice: line.unitPrice,
    discountType: line.discountType,
    discountValue: line.discountValue,
    discount: line.discountAmount,
    taxRate: line.taxRate,
    taxAmount: line.taxAmount,
    lineTotal: line.lineTotal,
  }));

  const createdItems = await InvoiceItem.insertMany(itemDocsToInsert);

  return {
    ...invoiceDoc.toObject(),
    items: createdItems
      .map((item) => (typeof item.toObject === 'function' ? item.toObject() : item))
      .sort((a, b) => a.sortOrder - b.sortOrder),
    payments: [],
  };
}

/**
 * Retrieves a single invoice with sorted `items` and `payments`.
 * Strictly enforces `userId === authUserId` unless `options.allowAdmin` is true for an admin.
 */
export async function getInvoiceById(authUserId, invoiceId, options = {}) {
  const invoiceObjectId = toObjectId(invoiceId, 'Invoice');
  const userId = toObjectId(authUserId, 'User');

  const queryFilter =
    options.allowAdmin === true && options.requesterRole === 'admin'
      ? { _id: invoiceObjectId }
      : { _id: invoiceObjectId, userId };

  const invoice = await Invoice.findOne(queryFilter).lean();
  if (!invoice) {
    throw new AppError('Invoice not found', 404);
  }

  const [items, payments] = await Promise.all([
    InvoiceItem.find({ invoiceId: invoice._id }).sort({ sortOrder: 1 }).lean(),
    InvoicePayment.find({ invoiceId: invoice._id }).sort({ paymentDate: -1, createdAt: -1 }).lean(),
  ]);

  return {
    ...invoice,
    items,
    payments,
  };
}

/**
 * Updates an existing invoice, replaces/syncs `invoice_items`, and recalculates totals.
 */
export async function updateInvoice(authUserId, invoiceId, rawPayload = {}) {
  const invoiceObjectId = toObjectId(invoiceId, 'Invoice');
  const userId = toObjectId(authUserId, 'User');

  const existing = await Invoice.findOne({ _id: invoiceObjectId, userId }).lean();
  if (!existing) {
    throw new AppError('Invoice not found', 404);
  }

  const existingItems = await InvoiceItem.find({ invoiceId: existing._id })
    .sort({ sortOrder: 1 })
    .lean();
  const existingPayments = await InvoicePayment.find({ invoiceId: existing._id })
    .sort({ paymentDate: -1 })
    .lean();

  const mergedPayload = {
    invoiceNumber: rawPayload.invoiceNumber ?? existing.invoiceNumber,
    issueDate: rawPayload.issueDate ?? existing.issueDate,
    dueDate: rawPayload.dueDate !== undefined ? rawPayload.dueDate : existing.dueDate,
    currency: rawPayload.currency ?? existing.currency,
    status: rawPayload.status ?? existing.status,
    paymentTerms:
      rawPayload.paymentTerms !== undefined ? rawPayload.paymentTerms : existing.paymentTerms,
    businessSnapshot: rawPayload.businessSnapshot ?? existing.businessSnapshot,
    customerSnapshot: rawPayload.customerSnapshot ?? existing.customerSnapshot,
    items: rawPayload.items ?? existingItems,
    globalDiscountType:
      rawPayload.globalDiscountType ??
      rawPayload.discount?.type ??
      existing.discount?.type ??
      'percentage',
    globalDiscountValue:
      rawPayload.globalDiscountValue ??
      rawPayload.discount?.value ??
      existing.discount?.value ??
      0,
    shippingOrAdjustment:
      rawPayload.shippingOrAdjustment !== undefined
        ? rawPayload.shippingOrAdjustment
        : existing.shippingOrAdjustment,
    bankDetails: rawPayload.bankDetails ?? existing.bankDetailsSnapshot,
    notes: rawPayload.notes !== undefined ? rawPayload.notes : existing.notes,
    pageSize: rawPayload.paperConfig?.pageSize ?? rawPayload.pageSize ?? existing.pageSize,
    orientation:
      rawPayload.paperConfig?.orientation ?? rawPayload.orientation ?? existing.orientation,
    templateKey:
      rawPayload.paperConfig?.templateKey ?? rawPayload.templateKey ?? existing.templateKey,
  };

  const validated = validateInvoiceInput(mergedPayload);
  const discountInput = resolveDiscountInput(validated);

  // Authoritative amountPaid from recorded payments if any exist
  const recordedPaidCents = existingPayments.reduce(
    (sum, p) => sum + toCents(p.amount),
    0
  );
  const authoritativeAmountPaid =
    existingPayments.length > 0
      ? fromCents(recordedPaidCents)
      : rawPayload.amountPaid !== undefined
        ? Number(rawPayload.amountPaid) || 0
        : existing.amountPaid || 0;

  const totals = calculateDocumentTotals({
    items: validated.items,
    globalDiscountType: discountInput.type,
    globalDiscountValue: discountInput.value,
    shippingOrAdjustment: validated.shippingOrAdjustment || 0,
    amountPaid: authoritativeAmountPaid,
  });

  const businessSnapshot = normalizeBusinessSnapshot(
    validated.businessSnapshot,
    validated.bankDetails
  );
  const customerSnapshot = normalizeCustomerSnapshot(validated.customerSnapshot);

  const effectiveStatus = resolveInvoiceStatus(
    validated.status,
    totals.amountPaid,
    totals.balanceDue,
    totals.grandTotal
  );

  const updatedInvoice = await Invoice.findOneAndUpdate(
    { _id: invoiceObjectId, userId },
    {
      $set: {
        invoiceNumber: validated.invoiceNumber || existing.invoiceNumber,
        issueDate: new Date(validated.issueDate),
        dueDate: validated.dueDate ? new Date(validated.dueDate) : null,
        currency: validated.currency,
        status: effectiveStatus,
        pageSize: validated.pageSize,
        orientation: validated.orientation,
        templateKey: validated.templateKey,
        businessSnapshot,
        customerSnapshot,
        subtotal: totals.subtotal,
        itemDiscountTotal: totals.itemDiscountTotal,
        discount: {
          type: discountInput.type,
          value: discountInput.value,
          amount: totals.globalDiscountAmount,
        },
        taxTotal: totals.taxTotal,
        shippingOrAdjustment: totals.shippingOrAdjustment,
        grandTotal: totals.grandTotal,
        amountPaid: totals.amountPaid,
        balanceDue: totals.balanceDue,
        paymentTerms: validated.paymentTerms || '',
        bankDetailsSnapshot: businessSnapshot.bankDetails,
        notes: validated.notes || '',
      },
    },
    { new: true }
  ).lean();

  // Replace / sync invoice_items
  await InvoiceItem.deleteMany({ invoiceId: invoiceObjectId, userId });

  const syncedItems = await InvoiceItem.insertMany(
    totals.lineResults.map((line, idx) => ({
      userId,
      invoiceId: invoiceObjectId,
      sortOrder: typeof line.sortOrder === 'number' ? line.sortOrder : idx,
      name: line.name,
      description: line.description || '',
      quantity: line.quantity,
      unit: line.unit || 'pcs',
      unitPrice: line.unitPrice,
      discountType: line.discountType,
      discountValue: line.discountValue,
      discount: line.discountAmount,
      taxRate: line.taxRate,
      taxAmount: line.taxAmount,
      lineTotal: line.lineTotal,
    }))
  );

  return {
    ...updatedInvoice,
    items: syncedItems
      .map((item) => (typeof item.toObject === 'function' ? item.toObject() : item))
      .sort((a, b) => a.sortOrder - b.sortOrder),
    payments: existingPayments,
  };
}

/**
 * Deletes an invoice and all child `invoice_items` and `invoice_payments`.
 */
export async function deleteInvoice(authUserId, invoiceId) {
  const invoiceObjectId = toObjectId(invoiceId, 'Invoice');
  const userId = toObjectId(authUserId, 'User');

  const deleted = await Invoice.findOneAndDelete({
    _id: invoiceObjectId,
    userId,
  }).lean();

  if (!deleted) {
    throw new AppError('Invoice not found', 404);
  }

  await Promise.all([
    InvoiceItem.deleteMany({ invoiceId: invoiceObjectId, userId }),
    InvoicePayment.deleteMany({ invoiceId: invoiceObjectId, userId }),
  ]);

  return {
    deleted: true,
    id: String(invoiceObjectId),
  };
}

/**
 * Deep-clones an invoice and its `invoice_items`, assigns a new atomic `INV-YYYY-XXXX`,
 * sets status to `'draft'`, resets `amountPaid = 0`, and clears `sourceQuotationId`.
 */
export async function duplicateInvoice(authUserId, invoiceId) {
  const source = await getInvoiceById(authUserId, invoiceId);

  const duplicatePayload = {
    issueDate: new Date().toISOString().slice(0, 10),
    dueDate: source.dueDate,
    currency: source.currency,
    status: 'draft',
    paymentTerms: source.paymentTerms || '',
    customerId: source.customerId ? String(source.customerId) : null,
    sourceQuotationId: null,
    businessSnapshot: source.businessSnapshot,
    customerSnapshot: source.customerSnapshot,
    items: source.items.map((item, idx) => ({
      sortOrder: idx,
      name: item.name,
      description: item.description || '',
      quantity: item.quantity,
      unit: item.unit || 'pcs',
      unitPrice: item.unitPrice,
      discountType: item.discountType || 'percentage',
      discountValue: item.discountValue || 0,
      taxRate: item.taxRate || 0,
    })),
    globalDiscountType: source.discount?.type || 'percentage',
    globalDiscountValue: source.discount?.value || 0,
    shippingOrAdjustment: source.shippingOrAdjustment || 0,
    amountPaid: 0,
    bankDetails: source.bankDetailsSnapshot || source.businessSnapshot?.bankDetails || {},
    notes: source.notes || '',
    pageSize: source.pageSize || 'A4',
    orientation: source.orientation || 'portrait',
    templateKey: source.templateKey || 'indigo',
  };

  return createInvoice(authUserId, duplicatePayload);
}

/**
 * Records a payment in `invoice_payments`, recalculates `amountPaid` & `balanceDue`,
 * and auto-transitions status (`balanceDue <= 0` -> `'paid'`, else `'partial'`).
 */
export async function recordPayment(authUserId, invoiceId, rawPaymentData = {}) {
  const invoiceObjectId = toObjectId(invoiceId, 'Invoice');
  const userId = toObjectId(authUserId, 'User');

  const paymentParse = zodInvoicePaymentSchema.safeParse(rawPaymentData);
  if (!paymentParse.success) {
    const message = paymentParse.error.issues
      .map((i) => `${i.path.join('.') || 'payment'}: ${i.message}`)
      .join('; ');
    throw new AppError(message, 400, paymentParse.error.issues);
  }

  const invoice = await Invoice.findOne({ _id: invoiceObjectId, userId }).lean();
  if (!invoice) {
    throw new AppError('Invoice not found', 404);
  }

  if (invoice.status === 'void') {
    throw new AppError('Cannot record a payment on a voided invoice', 400);
  }

  const paymentDoc = await InvoicePayment.create({
    userId,
    invoiceId: invoiceObjectId,
    amount: fromCents(toCents(paymentParse.data.amount)),
    paymentDate: new Date(paymentParse.data.paymentDate),
    method: paymentParse.data.method,
    referenceNo: paymentParse.data.referenceNo || '',
    notes: paymentParse.data.notes || '',
  });

  const allPayments = await InvoicePayment.find({ invoiceId: invoiceObjectId })
    .sort({ paymentDate: -1, createdAt: -1 })
    .lean();

  const totalPaidCents = allPayments.reduce((sum, p) => sum + toCents(p.amount), 0);
  const grandTotalCents = toCents(invoice.grandTotal);
  const balanceDueCents = Math.max(0, grandTotalCents - totalPaidCents);

  const amountPaid = fromCents(totalPaidCents);
  const balanceDue = fromCents(balanceDueCents);
  const nextStatus = balanceDueCents <= 0 ? 'paid' : 'partial';

  const updatedInvoice = await Invoice.findOneAndUpdate(
    { _id: invoiceObjectId, userId },
    {
      $set: {
        amountPaid,
        balanceDue,
        status: nextStatus,
      },
    },
    { new: true }
  ).lean();

  const items = await InvoiceItem.find({ invoiceId: invoiceObjectId })
    .sort({ sortOrder: 1 })
    .lean();

  return {
    payment: typeof paymentDoc.toObject === 'function' ? paymentDoc.toObject() : paymentDoc,
    invoice: {
      ...updatedInvoice,
      items,
      payments: allPayments,
    },
  };
}

/**
 * Generates a multi-size PDF buffer for a saved invoice.
 * Permits owner (`invoice.userId === req.user.id`) or Admin (`req.user.role === 'admin'`).
 */
export async function generateSavedInvoicePdf(requesterUser, invoiceId, query = {}) {
  const invoice = await getInvoiceById(requesterUser.id, invoiceId, {
    allowAdmin: requesterUser.role === 'admin',
    requesterRole: requesterUser.role,
  });

  const requestedSize = String(
    query.size || query.pageSize || invoice.pageSize || 'A4'
  )
    .trim()
    .toUpperCase();

  if (!isSizeSupportedForTool(requestedSize, 'invoice')) {
    throw new AppError(
      `Invalid paper size "${requestedSize}" for Invoice PDF export`,
      400
    );
  }

  const requestedOrientation = String(
    query.orientation || invoice.orientation || 'portrait'
  )
    .trim()
    .toLowerCase();

  const requestedTemplateKey = String(
    query.templateKey || invoice.templateKey || 'indigo'
  )
    .trim()
    .toLowerCase();

  const paperConfig = {
    pageSize: requestedSize,
    orientation: requestedOrientation === 'landscape' ? 'landscape' : 'portrait',
    templateKey: requestedTemplateKey,
  };

  const renderPayload = {
    invoiceNumber: invoice.invoiceNumber,
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    currency: invoice.currency,
    status: invoice.status,
    paymentTerms: invoice.paymentTerms,
    businessSnapshot: invoice.businessSnapshot,
    customerSnapshot: invoice.customerSnapshot,
    items: invoice.items,
    globalDiscountType: invoice.discount?.type || 'percentage',
    globalDiscountValue: invoice.discount?.value || 0,
    shippingOrAdjustment: invoice.shippingOrAdjustment || 0,
    amountPaid: invoice.amountPaid || 0,
    bankDetails: invoice.bankDetailsSnapshot || invoice.businessSnapshot?.bankDetails || {},
    notes: invoice.notes || '',
    sourceQuotationId: invoice.sourceQuotationId ? String(invoice.sourceQuotationId) : null,
    ...paperConfig,
  };

  const pdfBuffer = await renderDocumentToPdfBuffer(
    'invoice',
    renderPayload,
    paperConfig
  );

  const safeNumber = String(invoice.invoiceNumber || 'INV')
    .replace(/[^A-Za-z0-9_-]/g, '-');
  const filename = `${safeNumber}-${requestedSize}.pdf`;

  return {
    pdfBuffer,
    filename,
    invoice,
  };
}
