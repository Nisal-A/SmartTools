import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  getUserDocumentHistory,
  getUserDashboardSummary,
  exportSavedDocumentPdf,
} from './documents.service.js';

/**
 * Unified User History, Dashboard Summary & Saved Document PDF Controllers
 */

export const getUserHistoryController = asyncHandler(async (req, res) => {
  // Always passes req.user.id; service layer ignores req.query.userId
  const { items, pagination } = await getUserDocumentHistory(req.user.id, req.query);

  return res.status(200).json({
    success: true,
    data: items,
    pagination,
  });
});

export const getDashboardSummaryController = asyncHandler(async (req, res) => {
  const summary = await getUserDashboardSummary(req.user.id);

  return res.status(200).json({
    success: true,
    data: summary,
  });
});

export const exportDocumentPdfController = asyncHandler(async (req, res) => {
  const { type, id } = req.params;
  const ipAddress =
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.ip ||
    req.socket?.remoteAddress ||
    '';

  const { pdfBuffer, filename } = await exportSavedDocumentPdf(
    req.user,
    type,
    id,
    req.query,
    ipAddress
  );

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Length', String(pdfBuffer.length));

  return res.status(200).end(pdfBuffer);
});

export default {
  getUserHistoryController,
  getDashboardSummaryController,
  exportDocumentPdfController,
};
