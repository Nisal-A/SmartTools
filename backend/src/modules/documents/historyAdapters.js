import mongoose from 'mongoose';
import { Invoice } from '../invoices/models/invoice.model.js';
import {
  getInvoiceById,
  generateSavedInvoicePdf,
} from '../invoices/invoices.service.js';
import { Quotation } from '../quotations/models/quotation.model.js';
import {
  getQuotationById,
  generateSavedQuotationPdf,
  applyExpiredValidityFlag,
} from '../quotations/quotations.service.js';

/**
 * Extensible Document History Adapter Registry (`historyAdapters.js`)
 *
 * Maps each independent tool collection (`invoices`, `quotations`, and any future tool)
 * into a normalized History DTO:
 * `{ id, toolType, documentNumber, customerName, currency, grandTotal, pageSize, status, createdAt, updatedAt, owner?: { id, email, fullName } }`
 *
 * Future tools plug into Unified Document History and Admin Global History simply by calling
 * `registerHistoryAdapter(...)` without modifying controller or pagination logic.
 */

const adapterRegistry = new Map();

function buildCommonMongoFilter(adapter, options = {}) {
  const filter = {};

  // Strict user isolation when lockedUserId is supplied (Standard User History)
  if (options.lockedUserId) {
    filter.userId = new mongoose.Types.ObjectId(String(options.lockedUserId));
  } else if (Array.isArray(options.filterUserIds)) {
    // Used ONLY by Admin Global History when filtering by userId or ownerEmail
    filter.userId = {
      $in: options.filterUserIds.map(
        (id) => new mongoose.Types.ObjectId(String(id))
      ),
    };
  }

  if (options.status && String(options.status).trim() && options.status !== 'all') {
    filter.status = String(options.status).trim().toLowerCase();
  }

  if (options.dateFrom || options.dateTo) {
    const dateCond = {};
    if (options.dateFrom) {
      const fromDate = new Date(options.dateFrom);
      if (!Number.isNaN(fromDate.getTime())) {
        dateCond.$gte = fromDate;
      }
    }
    if (options.dateTo) {
      const toDate = new Date(options.dateTo);
      if (!Number.isNaN(toDate.getTime())) {
        // If only YYYY-MM-DD was provided, extend to end of that day
        if (String(options.dateTo).length <= 10) {
          toDate.setUTCHours(23, 59, 59, 999);
        }
        dateCond.$lte = toDate;
      }
    }
    if (Object.keys(dateCond).length > 0) {
      filter.$or = [
        { createdAt: dateCond },
        { [adapter.dateField || 'issueDate']: dateCond },
      ];
    }
  }

  if (options.search && String(options.search).trim()) {
    const escaped = String(options.search)
      .trim()
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const searchClauses = [
      { [adapter.numberField]: { $regex: escaped, $options: 'i' } },
      { 'customerSnapshot.name': { $regex: escaped, $options: 'i' } },
      { 'customerSnapshot.companyName': { $regex: escaped, $options: 'i' } },
      { 'customerSnapshot.email': { $regex: escaped, $options: 'i' } },
      { 'businessSnapshot.businessName': { $regex: escaped, $options: 'i' } },
    ];

    if (filter.$or) {
      filter.$and = [{ $or: filter.$or }, { $or: searchClauses }];
      delete filter.$or;
    } else {
      filter.$or = searchClauses;
    }
  }

  return filter;
}

/**
 * Registers a tool history adapter.
 *
 * @param {{
 *   toolType: string,
 *   aliases?: string[],
 *   model: mongoose.Model,
 *   numberField: string,
 *   dateField?: string,
 *   postProcessDoc?: (doc: object) => Promise<object>|object,
 *   toHistoryDTO: (doc: object, owner?: object|null) => object,
 *   getById: (requesterUser: object, id: string, options?: object) => Promise<object>,
 *   generatePdf: (requesterUser: object, id: string, query?: object) => Promise<{ pdfBuffer: Buffer, filename: string, document: object }>
 * }} adapter
 */
export function registerHistoryAdapter(adapter) {
  if (!adapter || !adapter.toolType || !adapter.model) {
    throw new Error('Invalid history adapter registration');
  }
  const normalizedType = String(adapter.toolType).trim().toLowerCase();
  adapterRegistry.set(normalizedType, {
    ...adapter,
    toolType: normalizedType,
    buildFilter(options = {}) {
      return buildCommonMongoFilter(adapter, options);
    },
  });
}

/**
 * Resolves a single registered adapter by `toolType` or plural alias (`invoices` -> `invoice`).
 */
export function getHistoryAdapter(toolType) {
  if (!toolType) return null;
  const normalized = String(toolType).trim().toLowerCase();
  if (adapterRegistry.has(normalized)) {
    return adapterRegistry.get(normalized);
  }
  for (const adapter of adapterRegistry.values()) {
    if (Array.isArray(adapter.aliases) && adapter.aliases.includes(normalized)) {
      return adapter;
    }
  }
  return null;
}

/**
 * Returns all registered adapters, or filters to a specific `toolType` when requested.
 */
export function getActiveHistoryAdapters(toolType = 'all') {
  if (!toolType || String(toolType).toLowerCase() === 'all') {
    return Array.from(adapterRegistry.values());
  }
  const single = getHistoryAdapter(toolType);
  return single ? [single] : [];
}

// ============================================================================
// Register Built-in Tool 01: Invoice Generator Adapter (`invoice`)
// ============================================================================
registerHistoryAdapter({
  toolType: 'invoice',
  aliases: ['invoices', 'invoice-generator'],
  model: Invoice,
  numberField: 'invoiceNumber',
  dateField: 'issueDate',
  toHistoryDTO(doc, owner = null) {
    const id = String(doc._id);
    const dto = {
      id,
      _id: id,
      userId: String(doc.userId),
      toolType: 'invoice',
      documentNumber: doc.invoiceNumber || '',
      customerName:
        doc.customerSnapshot?.name ||
        doc.customerSnapshot?.companyName ||
        'Unnamed Customer',
      customerEmail: doc.customerSnapshot?.email || '',
      businessName: doc.businessSnapshot?.businessName || '',
      currency: doc.currency || 'USD',
      grandTotal: Number(doc.grandTotal) || 0,
      amountPaid: Number(doc.amountPaid) || 0,
      balanceDue: Number(doc.balanceDue) || 0,
      pageSize: doc.pageSize || 'A4',
      orientation: doc.orientation || 'portrait',
      status: doc.status || 'draft',
      issueDate: doc.issueDate || doc.createdAt,
      dueDate: doc.dueDate || null,
      sourceQuotationId: doc.sourceQuotationId ? String(doc.sourceQuotationId) : null,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };

    if (owner) {
      dto.owner = owner;
    }

    return dto;
  },
  async getById(requesterUser, documentId, options = {}) {
    return getInvoiceById(requesterUser.id, documentId, {
      allowAdmin: options.allowAdmin === true,
      requesterRole: requesterUser.role,
    });
  },
  async generatePdf(requesterUser, documentId, query = {}) {
    const result = await generateSavedInvoicePdf(requesterUser, documentId, query);
    return {
      pdfBuffer: result.pdfBuffer,
      filename: result.filename,
      document: result.invoice,
    };
  },
});

// ============================================================================
// Register Built-in Tool 02: Quotation Generator Adapter (`quotation`)
// ============================================================================
registerHistoryAdapter({
  toolType: 'quotation',
  aliases: ['quotations', 'quotation-generator', 'quote', 'quotes'],
  model: Quotation,
  numberField: 'quotationNumber',
  dateField: 'issueDate',
  async postProcessDoc(doc) {
    return applyExpiredValidityFlag(doc);
  },
  toHistoryDTO(doc, owner = null) {
    const id = String(doc._id);
    const dto = {
      id,
      _id: id,
      userId: String(doc.userId),
      toolType: 'quotation',
      documentNumber: doc.quotationNumber || '',
      customerName:
        doc.customerSnapshot?.name ||
        doc.customerSnapshot?.companyName ||
        'Unnamed Customer',
      customerEmail: doc.customerSnapshot?.email || '',
      businessName: doc.businessSnapshot?.businessName || '',
      currency: doc.currency || 'USD',
      grandTotal: Number(doc.grandTotal) || 0,
      pageSize: doc.pageSize || 'A4',
      orientation: doc.orientation || 'portrait',
      status: doc.status || 'draft',
      issueDate: doc.issueDate || doc.createdAt,
      validUntil: doc.validUntil || null,
      convertedInvoiceId: doc.convertedInvoiceId
        ? String(doc.convertedInvoiceId)
        : null,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };

    if (owner) {
      dto.owner = owner;
    }

    return dto;
  },
  async getById(requesterUser, documentId, options = {}) {
    return getQuotationById(requesterUser.id, documentId, {
      allowAdmin: options.allowAdmin === true,
      requesterRole: requesterUser.role,
    });
  },
  async generatePdf(requesterUser, documentId, query = {}) {
    const result = await generateSavedQuotationPdf(requesterUser, documentId, query);
    return {
      pdfBuffer: result.pdfBuffer,
      filename: result.filename,
      document: result.quotation,
    };
  },
});

export default {
  registerHistoryAdapter,
  getHistoryAdapter,
  getActiveHistoryAdapters,
};
