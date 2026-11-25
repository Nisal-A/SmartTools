import { z } from 'zod';
import { paperConfigSchema } from '../../../../shared/schemas/paperConfig.schema.js';
import { renderDocumentToPdfBuffer } from './pdfEngine.service.js';

/**
 * Stateless Guest & Public PDF Render Controller
 *
 * Endpoint: POST /api/v1/public/pdf/render
 * - Validates `documentType`, `paperConfig`, and `payload` with Zod
 * - Recomputes totals server-side via `financialMath.js`
 * - Streams `application/pdf` with `Content-Disposition: attachment`
 * - Zero MongoDB writes
 */

const publicPdfRenderRequestSchema = z.object({
  documentType: z.enum(['invoice', 'quotation'], {
    errorMap: () => ({
      message: 'documentType must be either "invoice" or "quotation"',
    }),
  }),
  paperConfig: paperConfigSchema.partial().optional(),
  payload: z.record(z.any()),
});

/**
 * Normalizes request body so both `{ documentType, paperConfig, payload }`
 * and flat `{ documentType, pageSize, orientation, templateKey, ...payload }`
 * are validated consistently.
 */
function normalizeRenderRequestBody(body = {}) {
  if (!body || typeof body !== 'object') {
    return {};
  }

  if (body.payload && typeof body.payload === 'object' && !Array.isArray(body.payload)) {
    return {
      documentType: body.documentType,
      paperConfig: body.paperConfig || {
        ...(body.pageSize ? { pageSize: body.pageSize } : {}),
        ...(body.orientation ? { orientation: body.orientation } : {}),
        ...(body.templateKey ? { templateKey: body.templateKey } : {}),
      },
      payload: body.payload,
    };
  }

  const { documentType, paperConfig, ...restPayload } = body;
  return {
    documentType,
    paperConfig: paperConfig || {
      ...(restPayload.pageSize ? { pageSize: restPayload.pageSize } : {}),
      ...(restPayload.orientation ? { orientation: restPayload.orientation } : {}),
      ...(restPayload.templateKey ? { templateKey: restPayload.templateKey } : {}),
    },
    payload: restPayload,
  };
}

function buildSafeFilename(documentType, payload = {}, paperConfig = {}) {
  const rawNumber =
    documentType === 'invoice'
      ? payload.invoiceNumber || 'INV-DRAFT'
      : payload.quotationNumber || 'QUO-DRAFT';
  const rawSize = paperConfig?.pageSize || payload?.pageSize || 'A4';

  const safeNumber = String(rawNumber)
    .replace(/[^A-Za-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 40);
  const safeSize = String(rawSize)
    .replace(/[^A-Za-z0-9_-]/g, '')
    .toUpperCase();

  return `${safeNumber}-${safeSize}.pdf`;
}

export async function renderPublicPdfController(req, res, next) {
  try {
    const normalizedBody = normalizeRenderRequestBody(req.body);
    const envelopeParse = publicPdfRenderRequestSchema.safeParse(normalizedBody);

    if (!envelopeParse.success) {
      return res.status(400).json({
        success: false,
        message: 'Invalid PDF render request',
        errors: envelopeParse.error.issues,
      });
    }

    const { documentType, paperConfig, payload } = envelopeParse.data;
    const pdfBuffer = await renderDocumentToPdfBuffer(
      documentType,
      payload,
      paperConfig
    );

    const filename = buildSafeFilename(documentType, payload, paperConfig);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', String(pdfBuffer.length));
    res.setHeader('Cache-Control', 'no-store');

    return res.status(200).end(pdfBuffer);
  } catch (err) {
    if (err.statusCode === 400) {
      return res.status(400).json({
        success: false,
        message: err.message,
        errors: err.issues || [],
      });
    }
    if (typeof next === 'function') {
      return next(err);
    }
    return res.status(500).json({
      success: false,
      message: 'Failed to render PDF document',
    });
  }
}
