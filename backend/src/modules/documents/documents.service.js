import mongoose from 'mongoose';
import { AppError } from '../../utils/AppError.js';
import { fromCents, toCents } from '../../../../shared/utils/financialMath.js';
import { Invoice } from '../invoices/models/invoice.model.js';
import { Quotation } from '../quotations/models/quotation.model.js';
import { recordAdminAuditLog } from '../admin/models/adminAuditLog.model.js';
import {
  getActiveHistoryAdapters,
  getHistoryAdapter,
} from './historyAdapters.js';

/**
 * Unified Documents Service (`documents.service.js`)
 *
 * SECURITY INVARIANT:
 * Standard user endpoints (`getUserDocumentHistory` & `getUserDashboardSummary`)
 * ALWAYS hardcode `lockedUserId = authUserId` and completely ignore any `userId`
 * sent in query parameters or request bodies.
 */

function toUserIdObject(authUserId) {
  if (!authUserId || !mongoose.Types.ObjectId.isValid(String(authUserId))) {
    throw new AppError('Authentication required.', 401);
  }
  return new mongoose.Types.ObjectId(String(authUserId));
}

/**
 * Fetches unified, filterable document history strictly locked to `authUserId`.
 * Completely ignores any `query.userId` parameter.
 */
export async function getUserDocumentHistory(authUserId, query = {}) {
  const lockedUserId = toUserIdObject(authUserId);
  const requestedToolType = String(query.toolType || 'all').trim().toLowerCase();

  if (
    requestedToolType !== 'all' &&
    getActiveHistoryAdapters(requestedToolType).length === 0
  ) {
    throw new AppError(`Unsupported toolType "${query.toolType}".`, 400);
  }

  const adapters = getActiveHistoryAdapters(requestedToolType);

  const perAdapterResults = await Promise.all(
    adapters.map(async (adapter) => {
      // SECURITY INVARIANT: lockedUserId is hardcoded to the authenticated user's ID
      const filter = adapter.buildFilter({
        lockedUserId,
        status: query.status,
        search: query.search,
        dateFrom: query.dateFrom,
        dateTo: query.dateTo,
      });

      const rawDocs = await adapter.model.find(filter).sort({ createdAt: -1 }).lean();
      const processedDocs = adapter.postProcessDoc
        ? await Promise.all(rawDocs.map((d) => adapter.postProcessDoc(d)))
        : rawDocs;

      return processedDocs.map((doc) => adapter.toHistoryDTO(doc, null));
    })
  );

  const combined = perAdapterResults.flat().sort((a, b) => {
    const timeA = new Date(a.createdAt || 0).getTime();
    const timeB = new Date(b.createdAt || 0).getTime();
    return timeB - timeA;
  });

  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));
  const total = combined.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const skip = (page - 1) * limit;
  const items = combined.slice(skip, skip + limit);

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages,
    },
  };
}

/**
 * Aggregates dashboard KPIs and 8 most recent documents strictly for `authUserId`.
 */
export async function getUserDashboardSummary(authUserId) {
  const userId = toUserIdObject(authUserId);

  const [invoices, quotations, recentHistory] = await Promise.all([
    Invoice.find({ userId }).sort({ createdAt: -1 }).lean(),
    Quotation.find({ userId }).sort({ createdAt: -1 }).lean(),
    getUserDocumentHistory(userId, { page: 1, limit: 8 }),
  ]);

  const nowMs = Date.now();
  let totalInvoicedCents = 0;
  let totalPaidCents = 0;
  let pendingBalanceCents = 0;
  let overdueCount = 0;

  for (const inv of invoices) {
    if (inv.status === 'void') continue;

    totalInvoicedCents += toCents(inv.grandTotal || 0);
    totalPaidCents += toCents(inv.amountPaid || 0);

    const balanceCents = toCents(inv.balanceDue || 0);
    if (balanceCents > 0 && inv.status !== 'draft') {
      pendingBalanceCents += balanceCents;
    } else if (balanceCents > 0 && inv.status === 'draft') {
      // Include draft or keep pending balance for unpaid invoices
      pendingBalanceCents += balanceCents;
    }

    const isOverdueByDate =
      inv.dueDate &&
      new Date(inv.dueDate).getTime() < nowMs &&
      balanceCents > 0 &&
      ['sent', 'partial', 'overdue'].includes(inv.status);

    if (inv.status === 'overdue' || isOverdueByDate) {
      overdueCount += 1;
    }
  }

  const totalQuotations = quotations.length;
  let activeQuotationsCount = 0;
  let convertedQuotationsCount = 0;

  for (const quo of quotations) {
    if (['draft', 'sent', 'accepted'].includes(quo.status)) {
      activeQuotationsCount += 1;
    }
    if (quo.status === 'converted' || quo.convertedInvoiceId) {
      convertedQuotationsCount += 1;
    }
  }

  const quoteToInvoiceConversionRate =
    totalQuotations > 0
      ? Number(((convertedQuotationsCount / totalQuotations) * 100).toFixed(1))
      : 0;

  return {
    totalInvoiced: fromCents(totalInvoicedCents),
    totalPaid: fromCents(totalPaidCents),
    pendingBalance: fromCents(pendingBalanceCents),
    overdueCount,
    invoiceCount: invoices.length,
    quotationCount: totalQuotations,
    activeQuotationsCount,
    convertedQuotationsCount,
    quoteToInvoiceConversionRate,
    conversionRate: quoteToInvoiceConversionRate,
    recentDocuments: recentHistory.items,
  };
}

/**
 * Streams a multi-size PDF for a saved document (`GET /api/v1/documents/:type/:id/pdf`).
 *
 * Rules:
 * - Allows `doc.userId === req.user.id || req.user.role === 'admin'`.
 * - Standard user requesting another user's document receives `404 Not Found`.
 * - If accessed by an admin for another user's document, writes `EXPORT_USER_DOCUMENT_PDF`
 *   to `admin_audit_logs`.
 */
export async function exportSavedDocumentPdf(
  requesterUser,
  toolType,
  documentId,
  query = {},
  ipAddress = ''
) {
  const adapter = getHistoryAdapter(toolType);
  if (!adapter) {
    throw new AppError(
      `Unsupported document type "${toolType}". Expected "invoice" or "quotation".`,
      400
    );
  }

  const { pdfBuffer, filename, document } = await adapter.generatePdf(
    requesterUser,
    documentId,
    query
  );

  // If an admin exported another user's document, write immutable audit log
  if (
    requesterUser.role === 'admin' &&
    String(document.userId) !== String(requesterUser.id)
  ) {
    await recordAdminAuditLog({
      adminUserId: requesterUser.id,
      action: 'EXPORT_USER_DOCUMENT_PDF',
      targetUserId: document.userId,
      resourceType: adapter.toolType,
      resourceId: String(document._id),
      queryMeta: {
        size: query.size || query.pageSize || document.pageSize || 'A4',
        orientation: query.orientation || document.orientation || 'portrait',
      },
      ipAddress,
    });
  }

  return {
    pdfBuffer,
    filename,
    document,
  };
}

export default {
  getUserDocumentHistory,
  getUserDashboardSummary,
  exportSavedDocumentPdf,
};
