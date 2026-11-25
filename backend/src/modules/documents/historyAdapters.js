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
import { SeoAudit } from '../seo-analyzer/models/seoAudit.model.js';
import { getAuditById as getSeoAuditById } from '../seo-analyzer/services/auditService.js';
import { AppError } from '../../utils/AppError.js';

/**
 * Extensible Document History Adapter Registry (`historyAdapters.js`)
 *
 * Maps each independent tool collection (`invoices`, `quotations`, `seo_audits`, and any future tool)
 * into a normalized History DTO:
 * `{ id, toolType, documentNumber, customerName, currency, grandTotal, pageSize, status, createdAt, updatedAt, owner?: { id, email, fullName } }`
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

    const searchFields = Array.isArray(adapter.searchFields)
      ? adapter.searchFields
      : [
          adapter.numberField,
          'customerSnapshot.name',
          'customerSnapshot.companyName',
          'customerSnapshot.email',
          'businessSnapshot.businessName',
        ];

    const searchClauses = searchFields.map((field) => ({
      [field]: { $regex: escaped, $options: 'i' },
    }));

    if (filter.$or) {
      filter.$and = [{ $or: filter.$or }, { $or: searchClauses }];
      delete filter.$or;
    } else {
      filter.$or = searchClauses;
    }
  }

  return filter;
}

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

export function getActiveHistoryAdapters(toolType = 'all') {
  if (!toolType || String(toolType).toLowerCase() === 'all') {
    return Array.from(adapterRegistry.values());
  }
  const single = getHistoryAdapter(toolType);
  return single ? [single] : [];
}

// ============================================================================
// Tool 01: Invoice Generator Adapter (`invoice`)
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
// Tool 02: Quotation Generator Adapter (`quotation`)
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

// ============================================================================
// Tool 03: SEO Analyzer Adapter (`seo`)
// ============================================================================
function extractHostnameLabel(rawUrl = '') {
  try {
    const parsed = new URL(rawUrl);
    return parsed.hostname || rawUrl;
  } catch {
    return String(rawUrl || 'SEO Audit').slice(0, 60);
  }
}

registerHistoryAdapter({
  toolType: 'seo',
  aliases: ['seo-analyzer', 'seo_audit', 'seo-audit', 'audit', 'audits'],
  model: SeoAudit,
  numberField: 'finalUrl',
  dateField: 'analyzedAt',
  searchFields: ['url', 'finalUrl', 'pageTitle'],
  toHistoryDTO(doc, owner = null) {
    const id = String(doc._id);
    const displayHost = extractHostnameLabel(doc.finalUrl || doc.url);
    const dto = {
      id,
      _id: id,
      userId: doc.userId ? String(doc.userId) : null,
      isGuestAudit: doc.isGuestAudit === true,
      toolType: 'seo',
      documentNumber: displayHost,
      customerName: doc.pageTitle || doc.finalUrl || doc.url || 'SEO Audit',
      url: doc.url,
      finalUrl: doc.finalUrl,
      pageTitle: doc.pageTitle || '',
      currency: 'SCORE',
      grandTotal: Number(doc.overallScore) || 0,
      overallScore: Number(doc.overallScore) || 0,
      scoreCoverage: Number(doc.scoreCoverage) || 0,
      pageSize: `Score ${doc.overallScore ?? 0}/100`,
      status: doc.status || 'completed',
      analyzedAt: doc.analyzedAt || doc.createdAt,
      createdAt: doc.analyzedAt || doc.createdAt,
      updatedAt: doc.updatedAt || doc.analyzedAt || doc.createdAt,
    };

    if (owner) {
      dto.owner = owner;
    }

    return dto;
  },
  async getById(requesterUser, documentId, options = {}) {
    return getSeoAuditById(
      {
        id: documentId,
        requesterUser,
      },
      { allowAdmin: options.allowAdmin === true }
    );
  },
  async generatePdf() {
    throw new AppError(
      'Direct server PDF export is not applicable to SEO audits. Use CSV export or browser Print inside the SEO report view.',
      400
    );
  },
});

export default {
  registerHistoryAdapter,
  getHistoryAdapter,
  getActiveHistoryAdapters,
};
