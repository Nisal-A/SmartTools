import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  convertToInvoice,
  createQuotation,
  deleteQuotation,
  duplicateQuotation,
  generateSavedQuotationPdf,
  getQuotationById,
  listQuotations,
  updateQuotation,
} from './quotations.service.js';

/**
 * Quotation Generator REST Controller (`/api/v1/quotations`)
 * All endpoints strictly use `req.user.id` for user ownership isolation.
 */

export const listQuotationsController = asyncHandler(async (req, res) => {
  const result = await listQuotations(req.user.id, req.query);
  return res.status(200).json({
    success: true,
    data: result.quotations,
    pagination: result.pagination,
  });
});

export const createQuotationController = asyncHandler(async (req, res) => {
  const quotation = await createQuotation(req.user.id, req.body);
  return res.status(201).json({
    success: true,
    data: quotation,
  });
});

export const getQuotationByIdController = asyncHandler(async (req, res) => {
  const quotation = await getQuotationById(req.user.id, req.params.id);
  return res.status(200).json({
    success: true,
    data: quotation,
  });
});

export const updateQuotationController = asyncHandler(async (req, res) => {
  const quotation = await updateQuotation(req.user.id, req.params.id, req.body);
  return res.status(200).json({
    success: true,
    data: quotation,
  });
});

export const deleteQuotationController = asyncHandler(async (req, res) => {
  const result = await deleteQuotation(req.user.id, req.params.id);
  return res.status(200).json({
    success: true,
    data: result,
  });
});

export const duplicateQuotationController = asyncHandler(async (req, res) => {
  const duplicated = await duplicateQuotation(req.user.id, req.params.id);
  return res.status(201).json({
    success: true,
    data: duplicated,
  });
});

export const convertQuotationToInvoiceController = asyncHandler(async (req, res) => {
  const result = await convertToInvoice(req.user.id, req.params.id, req.body || {});
  return res.status(201).json({
    success: true,
    data: result,
  });
});

export const downloadQuotationPdfController = asyncHandler(async (req, res) => {
  const { pdfBuffer, filename } = await generateSavedQuotationPdf(
    req.user,
    req.params.id,
    req.query
  );

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Length', String(pdfBuffer.length));
  res.setHeader('Cache-Control', 'no-store');

  return res.status(200).end(pdfBuffer);
});
