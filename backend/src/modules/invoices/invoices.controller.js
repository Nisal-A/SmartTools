import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  createInvoice,
  deleteInvoice,
  duplicateInvoice,
  generateSavedInvoicePdf,
  getInvoiceById,
  listInvoices,
  recordPayment,
  updateInvoice,
} from './invoices.service.js';

/**
 * Invoice Generator REST Controller (`/api/v1/invoices`)
 * All endpoints strictly use `req.user.id` for user ownership isolation.
 */

export const listInvoicesController = asyncHandler(async (req, res) => {
  const result = await listInvoices(req.user.id, req.query);
  return res.status(200).json({
    success: true,
    data: result.invoices,
    pagination: result.pagination,
  });
});

export const createInvoiceController = asyncHandler(async (req, res) => {
  const invoice = await createInvoice(req.user.id, req.body);
  return res.status(201).json({
    success: true,
    data: invoice,
  });
});

export const getInvoiceByIdController = asyncHandler(async (req, res) => {
  const invoice = await getInvoiceById(req.user.id, req.params.id);
  return res.status(200).json({
    success: true,
    data: invoice,
  });
});

export const updateInvoiceController = asyncHandler(async (req, res) => {
  const invoice = await updateInvoice(req.user.id, req.params.id, req.body);
  return res.status(200).json({
    success: true,
    data: invoice,
  });
});

export const deleteInvoiceController = asyncHandler(async (req, res) => {
  const result = await deleteInvoice(req.user.id, req.params.id);
  return res.status(200).json({
    success: true,
    data: result,
  });
});

export const duplicateInvoiceController = asyncHandler(async (req, res) => {
  const duplicated = await duplicateInvoice(req.user.id, req.params.id);
  return res.status(201).json({
    success: true,
    data: duplicated,
  });
});

export const recordInvoicePaymentController = asyncHandler(async (req, res) => {
  const result = await recordPayment(req.user.id, req.params.id, req.body);
  return res.status(201).json({
    success: true,
    data: result.invoice,
    payment: result.payment,
  });
});

export const downloadInvoicePdfController = asyncHandler(async (req, res) => {
  const { pdfBuffer, filename } = await generateSavedInvoicePdf(
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
