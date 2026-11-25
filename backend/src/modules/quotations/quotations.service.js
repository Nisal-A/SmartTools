import mongoose from 'mongoose';
import { quotationSchema as zodQuotationSchema } from '../../../../shared/schemas/quotation.schema.js';
import { calculateDocumentTotals } from '../../../../shared/utils/financialMath.js';
import { isSizeSupportedForTool } from '../../../../shared/constants/paperSizes.js';
import { AppError } from '../../utils/AppError.js';
import { getNextDocumentNumber } from '../../utils/counterService.js';
import { renderDocumentToPdfBuffer } from '../pdf-engine/pdfEngine.service.js';
import { createInvoice, deleteInvoice } from '../invoices/invoices.service.js';
import { Quotation } from './models/quotation.model.js';
import { QuotationItem } from './models/quotationItem.model.js';

/**
 * Quotation Generator Service (`quotations`, `quotation_items`)
 *
 * Independent from Invoices with a loosely coupled Convert-to-Invoice pipeline
 * that delegates invoice creation to `invoices.service.js`.
 */

function toObjectId(id, label = 'Resource') {
  if (!id || !mongoose.Types.ObjectId.isValid(String(id))) {
    throw new AppError(`${label} not found`, 404);
  }
  return new mongoose.Types.ObjectId(String(id));
}

function normalizeBusinessSnapshot(raw = {}) {
  const bank = raw.bankDetails || {};
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

function validateQuotationInput(rawPayload = {}) {
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

  const parsed = zodQuotationSchema.safeParse(merged);
  if (!parsed.success) {
    const message = parsed.error.issues
      .map((i) => `${i.path.join('.') || 'quotation'}: ${i.message}`)
      .join('; ');
    throw new AppError(message, 400, parsed.error.issues);
  }

  return parsed.data;
}

/**
 * Automatically flags `sent` quotations whose `validUntil` timestamp has passed as `expired`.
 */
export async function applyExpiredValidityFlag(quotationDoc) {
  if (!quotationDoc) return quotationDoc;

  if (
    quotationDoc.status === 'sent' &&
    quotationDoc.validUntil &&
    new Date(quotationDoc.validUntil).getTime() < Date.now()
  ) {
    await Quotation.findOneAndUpdate(
      { _id: quotationDoc._id, userId: quotationDoc.userId, status: 'sent' },
      { $set: { status: 'expired' } },
      { new: true }
    );
    return {
      ...quotationDoc,
      status: 'expired',
    };
  }

  return quotationDoc;
}

/**
 * Lists paginated quotations strictly scoped to `authUserId`.
 */
export async function listQuotations(authUserId, query = {}) {
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
      { quotationNumber: { $regex: escaped, $options: 'i' } },
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

  const [rawQuotations, total] = await Promise.all([
    Quotation.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Quotation.countDocuments(filter),
  ]);

  const quotations = await Promise.all(
    rawQuotations.map((q) => applyExpiredValidityFlag(q))
  );

  return {
    quotations,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

/**
 * Creates a new quotation with atomic `QUO-YYYY-XXXX` numbering, immutable snapshots,
 * and server-computed financial totals. Strictly rejects `THERMAL_80`.
 */
export async function createQuotation(authUserId, rawPayload = {}) {
  const userId = toObjectId(authUserId, 'User');
  const validated = validateQuotationInput(rawPayload);

  const issueDateObj = new Date(validated.issueDate);
  const issueYear = !Number.isNaN(issueDateObj.getTime())
    ? issueDateObj.getUTCFullYear()
    : new Date().getUTCFullYear();

  const quotationNumber =
    validated.quotationNumber && validated.quotationNumber.trim()
      ? validated.quotationNumber.trim()
      : await getNextDocumentNumber(userId, 'quotation', { year: issueYear });

  const discountInput = resolveDiscountInput(validated);
  const totals = calculateDocumentTotals({
    items: validated.items,
    globalDiscountType: discountInput.type,
    globalDiscountValue: discountInput.value,
    shippingOrAdjustment: validated.shippingOrAdjustment || 0,
    amountPaid: 0,
  });

  const businessSnapshot = normalizeBusinessSnapshot(validated.businessSnapshot);
  const customerSnapshot = normalizeCustomerSnapshot(validated.customerSnapshot);

  const customerIdObj =
    validated.customerId && mongoose.Types.ObjectId.isValid(validated.customerId)
      ? new mongoose.Types.ObjectId(validated.customerId)
      : null;

  const validUntilObj = validated.validUntil ? new Date(validated.validUntil) : null;
  const effectiveStatus =
    validated.status === 'sent' &&
    validUntilObj &&
    validUntilObj.getTime() < Date.now()
      ? 'expired'
      : validated.status || 'draft';

  const quotationDoc = await Quotation.create({
    userId,
    customerId: customerIdObj,
    quotationNumber,
    issueDate: issueDateObj,
    validUntil: validUntilObj,
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
    deliveryTerms: validated.deliveryTerms || '',
    paymentTerms: validated.paymentTerms || '',
    acceptanceTerms: validated.acceptanceTerms || '',
    notes: validated.notes || '',
    convertedInvoiceId: null,
  });

  const itemDocsToInsert = totals.lineResults.map((line, idx) => ({
    userId,
    quotationId: quotationDoc._id,
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

  const createdItems = await QuotationItem.insertMany(itemDocsToInsert);

  return {
    ...quotationDoc.toObject(),
    items: createdItems
      .map((item) => (typeof item.toObject === 'function' ? item.toObject() : item))
      .sort((a, b) => a.sortOrder - b.sortOrder),
  };
}

/**
 * Retrieves a quotation with sorted `items`.
 * Strictly enforces `userId === authUserId` unless `options.allowAdmin` is true for an admin.
 */
export async function getQuotationById(authUserId, quotationId, options = {}) {
  const quotationObjectId = toObjectId(quotationId, 'Quotation');
  const userId = toObjectId(authUserId, 'User');

  const queryFilter =
    options.allowAdmin === true && options.requesterRole === 'admin'
      ? { _id: quotationObjectId }
      : { _id: quotationObjectId, userId };

  let quotation = await Quotation.findOne(queryFilter).lean();
  if (!quotation) {
    throw new AppError('Quotation not found', 404);
  }

  quotation = await applyExpiredValidityFlag(quotation);

  const items = await QuotationItem.find({ quotationId: quotation._id })
    .sort({ sortOrder: 1 })
    .lean();

  return {
    ...quotation,
    items,
  };
}

/**
 * Updates an existing quotation, replaces/syncs `quotation_items`, and recalculates totals.
 */
export async function updateQuotation(authUserId, quotationId, rawPayload = {}) {
  const quotationObjectId = toObjectId(quotationId, 'Quotation');
  const userId = toObjectId(authUserId, 'User');

  const existing = await Quotation.findOne({ _id: quotationObjectId, userId }).lean();
  if (!existing) {
    throw new AppError('Quotation not found', 404);
  }

  const existingItems = await QuotationItem.find({ quotationId: existing._id })
    .sort({ sortOrder: 1 })
    .lean();

  const mergedPayload = {
    quotationNumber: rawPayload.quotationNumber ?? existing.quotationNumber,
    issueDate: rawPayload.issueDate ?? existing.issueDate,
    validUntil:
      rawPayload.validUntil !== undefined ? rawPayload.validUntil : existing.validUntil,
    currency: rawPayload.currency ?? existing.currency,
    status: rawPayload.status ?? existing.status,
    deliveryTerms:
      rawPayload.deliveryTerms !== undefined
        ? rawPayload.deliveryTerms
        : existing.deliveryTerms,
    paymentTerms:
      rawPayload.paymentTerms !== undefined
        ? rawPayload.paymentTerms
        : existing.paymentTerms,
    acceptanceTerms:
      rawPayload.acceptanceTerms !== undefined
        ? rawPayload.acceptanceTerms
        : existing.acceptanceTerms,
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
    notes: rawPayload.notes !== undefined ? rawPayload.notes : existing.notes,
    pageSize: rawPayload.paperConfig?.pageSize ?? rawPayload.pageSize ?? existing.pageSize,
    orientation:
      rawPayload.paperConfig?.orientation ?? rawPayload.orientation ?? existing.orientation,
    templateKey:
      rawPayload.paperConfig?.templateKey ?? rawPayload.templateKey ?? existing.templateKey,
  };

  const validated = validateQuotationInput(mergedPayload);
  const discountInput = resolveDiscountInput(validated);

  const totals = calculateDocumentTotals({
    items: validated.items,
    globalDiscountType: discountInput.type,
    globalDiscountValue: discountInput.value,
    shippingOrAdjustment: validated.shippingOrAdjustment || 0,
    amountPaid: 0,
  });

  const businessSnapshot = normalizeBusinessSnapshot(validated.businessSnapshot);
  const customerSnapshot = normalizeCustomerSnapshot(validated.customerSnapshot);
  const validUntilObj = validated.validUntil ? new Date(validated.validUntil) : null;

  const effectiveStatus =
    validated.status === 'sent' &&
    validUntilObj &&
    validUntilObj.getTime() < Date.now()
      ? 'expired'
      : validated.status;

  const updatedQuotation = await Quotation.findOneAndUpdate(
    { _id: quotationObjectId, userId },
    {
      $set: {
        quotationNumber: validated.quotationNumber || existing.quotationNumber,
        issueDate: new Date(validated.issueDate),
        validUntil: validUntilObj,
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
        deliveryTerms: validated.deliveryTerms || '',
        paymentTerms: validated.paymentTerms || '',
        acceptanceTerms: validated.acceptanceTerms || '',
        notes: validated.notes || '',
      },
    },
    { new: true }
  ).lean();

  await QuotationItem.deleteMany({ quotationId: quotationObjectId, userId });

  const syncedItems = await QuotationItem.insertMany(
    totals.lineResults.map((line, idx) => ({
      userId,
      quotationId: quotationObjectId,
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
    ...updatedQuotation,
    items: syncedItems
      .map((item) => (typeof item.toObject === 'function' ? item.toObject() : item))
      .sort((a, b) => a.sortOrder - b.sortOrder),
  };
}

/**
 * Deletes a quotation and all child `quotation_items`.
 */
export async function deleteQuotation(authUserId, quotationId) {
  const quotationObjectId = toObjectId(quotationId, 'Quotation');
  const userId = toObjectId(authUserId, 'User');

  const deleted = await Quotation.findOneAndDelete({
    _id: quotationObjectId,
    userId,
  }).lean();

  if (!deleted) {
    throw new AppError('Quotation not found', 404);
  }

  await QuotationItem.deleteMany({ quotationId: quotationObjectId, userId });

  return {
    deleted: true,
    id: String(quotationObjectId),
  };
}

/**
 * Deep-clones a quotation and its `quotation_items`, assigns a fresh atomic `QUO-YYYY-XXXX`,
 * sets status to `'draft'`, and clears `convertedInvoiceId`.
 */
export async function duplicateQuotation(authUserId, quotationId) {
  const source = await getQuotationById(authUserId, quotationId);

  const duplicatePayload = {
    issueDate: new Date().toISOString().slice(0, 10),
    validUntil: source.validUntil,
    currency: source.currency,
    status: 'draft',
    deliveryTerms: source.deliveryTerms || '',
    paymentTerms: source.paymentTerms || '',
    acceptanceTerms: source.acceptanceTerms || '',
    customerId: source.customerId ? String(source.customerId) : null,
    convertedInvoiceId: null,
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
    notes: source.notes || '',
    pageSize: source.pageSize || 'A4',
    orientation: source.orientation || 'portrait',
    templateKey: source.templateKey || 'indigo',
  };

  return createQuotation(authUserId, duplicatePayload);
}

/**
 * Converts a Quotation into a linked draft Invoice via `invoices.service.js`.
 *
 * - Rejects with `409 Conflict` (including `convertedInvoiceId`) if already converted.
 * - Uses a MongoDB session transaction when supported, with graceful sequential fallback
 *   and compensating rollback on standalone MongoDB instances.
 */
export async function convertToInvoice(authUserId, quotationId, overrides = {}) {
  const quotationObjectId = toObjectId(quotationId, 'Quotation');
  const userId = toObjectId(authUserId, 'User');

  const source = await getQuotationById(authUserId, quotationId);

  if (source.status === 'converted' || source.convertedInvoiceId) {
    const err = new AppError(
      'Quotation has already been converted to an invoice',
      409
    );
    err.meta = {
      convertedInvoiceId: source.convertedInvoiceId
        ? String(source.convertedInvoiceId)
        : null,
    };
    throw err;
  }

  const defaultDueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const invoicePayload = {
    invoiceNumber: overrides.invoiceNumber || undefined,
    issueDate: overrides.issueDate || new Date().toISOString().slice(0, 10),
    dueDate: overrides.dueDate !== undefined ? overrides.dueDate : defaultDueDate,
    currency: overrides.currency || source.currency || 'USD',
    status: 'draft',
    customerId: source.customerId ? String(source.customerId) : null,
    sourceQuotationId: String(source._id),
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
    paymentTerms:
      overrides.paymentTerms !== undefined
        ? overrides.paymentTerms
        : source.paymentTerms || '',
    bankDetails:
      overrides.bankDetails || source.businessSnapshot?.bankDetails || {},
    notes: overrides.notes !== undefined ? overrides.notes : source.notes || '',
    pageSize: overrides.pageSize || source.pageSize || 'A4',
    orientation: overrides.orientation || source.orientation || 'portrait',
    templateKey: overrides.templateKey || source.templateKey || 'indigo',
  };

  async function executeConversionSteps(session = null) {
    const newInvoice = await createInvoice(authUserId, invoicePayload, {
      ...(session ? { session } : {}),
    });

    const updatedQuotation = await Quotation.findOneAndUpdate(
      {
        _id: quotationObjectId,
        userId,
        status: { $ne: 'converted' },
      },
      {
        $set: {
          status: 'converted',
          convertedInvoiceId: newInvoice._id,
        },
      },
      {
        new: true,
        ...(session ? { session } : {}),
      }
    ).lean();

    if (!updatedQuotation) {
      await deleteInvoice(authUserId, newInvoice._id).catch(() => {});
      const fresh = await Quotation.findOne({ _id: quotationObjectId, userId }).lean();
      const err = new AppError(
        'Quotation has already been converted to an invoice',
        409
      );
      err.meta = {
        convertedInvoiceId: fresh?.convertedInvoiceId
          ? String(fresh.convertedInvoiceId)
          : null,
      };
      throw err;
    }

    return {
      quotation: {
        ...updatedQuotation,
        items: source.items,
      },
      invoice: newInvoice,
    };
  }

  // Try MongoDB session transaction first; gracefully fallback on standalone MongoDB
  let session = null;
  try {
    session = await mongoose.startSession();
    let result = null;
    await session.withTransaction(async () => {
      result = await executeConversionSteps(session);
    });
    return result;
  } catch (err) {
    const isStandaloneTxError =
      err?.code === 20 ||
      /Transaction numbers are only allowed on a replica set/i.test(err?.message || '') ||
      /does not support transactions/i.test(err?.message || '');

    if (!isStandaloneTxError) {
      throw err;
    }

    // Sequential fallback with explicit compensating rollback
    let createdInvoice = null;
    try {
      createdInvoice = await createInvoice(authUserId, invoicePayload);
      const updatedQuotation = await Quotation.findOneAndUpdate(
        {
          _id: quotationObjectId,
          userId,
          status: { $ne: 'converted' },
        },
        {
          $set: {
            status: 'converted',
            convertedInvoiceId: createdInvoice._id,
          },
        },
        { new: true }
      ).lean();

      if (!updatedQuotation) {
        await deleteInvoice(authUserId, createdInvoice._id).catch(() => {});
        const fresh = await Quotation.findOne({ _id: quotationObjectId, userId }).lean();
        const err409 = new AppError(
          'Quotation has already been converted to an invoice',
          409
        );
        err409.meta = {
          convertedInvoiceId: fresh?.convertedInvoiceId
            ? String(fresh.convertedInvoiceId)
            : null,
        };
        throw err409;
      }

      return {
        quotation: {
          ...updatedQuotation,
          items: source.items,
        },
        invoice: createdInvoice,
      };
    } catch (fallbackErr) {
      if (createdInvoice?._id) {
        await deleteInvoice(authUserId, createdInvoice._id).catch(() => {});
      }
      throw fallbackErr;
    }
  } finally {
    if (session) {
      await session.endSession?.();
    }
  }
}

/**
 * Generates a multi-size PDF buffer for a saved quotation.
 * Strictly validates quotation-allowed sizes (rejects `THERMAL_80`).
 * Permits owner (`quotation.userId === req.user.id`) or Admin (`req.user.role === 'admin'`).
 */
export async function generateSavedQuotationPdf(requesterUser, quotationId, query = {}) {
  const quotation = await getQuotationById(requesterUser.id, quotationId, {
    allowAdmin: requesterUser.role === 'admin',
    requesterRole: requesterUser.role,
  });

  const requestedSize = String(
    query.size || query.pageSize || quotation.pageSize || 'A4'
  )
    .trim()
    .toUpperCase();

  if (!isSizeSupportedForTool(requestedSize, 'quotation')) {
    throw new AppError(
      `Invalid paper size "${requestedSize}" for Quotation PDF export`,
      400
    );
  }

  const requestedOrientation = String(
    query.orientation || quotation.orientation || 'portrait'
  )
    .trim()
    .toLowerCase();

  const requestedTemplateKey = String(
    query.templateKey || quotation.templateKey || 'indigo'
  )
    .trim()
    .toLowerCase();

  const paperConfig = {
    pageSize: requestedSize,
    orientation: requestedOrientation === 'landscape' ? 'landscape' : 'portrait',
    templateKey: requestedTemplateKey,
  };

  const renderPayload = {
    quotationNumber: quotation.quotationNumber,
    issueDate: quotation.issueDate,
    validUntil: quotation.validUntil,
    currency: quotation.currency,
    status: quotation.status,
    deliveryTerms: quotation.deliveryTerms,
    paymentTerms: quotation.paymentTerms,
    acceptanceTerms: quotation.acceptanceTerms,
    businessSnapshot: quotation.businessSnapshot,
    customerSnapshot: quotation.customerSnapshot,
    items: quotation.items,
    globalDiscountType: quotation.discount?.type || 'percentage',
    globalDiscountValue: quotation.discount?.value || 0,
    shippingOrAdjustment: quotation.shippingOrAdjustment || 0,
    notes: quotation.notes || '',
    ...paperConfig,
  };

  const pdfBuffer = await renderDocumentToPdfBuffer(
    'quotation',
    renderPayload,
    paperConfig
  );

  const safeNumber = String(quotation.quotationNumber || 'QUO').replace(
    /[^A-Za-z0-9_-]/g,
    '-'
  );
  const filename = `${safeNumber}-${requestedSize}.pdf`;

  return {
    pdfBuffer,
    filename,
    quotation,
  };
}
