import {
  getPaperConfig,
  isSizeSupportedForTool,
} from '../../../../shared/constants/paperSizes.js';
import {
  invoicePaperConfigSchema,
  quotationPaperConfigSchema,
} from '../../../../shared/schemas/paperConfig.schema.js';
import { invoiceSchema } from '../../../../shared/schemas/invoice.schema.js';
import { quotationSchema } from '../../../../shared/schemas/quotation.schema.js';
import { calculateDocumentTotals } from '../../../../shared/utils/financialMath.js';
import { withIsolatedPage } from '../../config/puppeteerPool.js';
import { renderInvoiceTemplate } from './templates/invoiceTemplate.js';
import { renderQuotationTemplate } from './templates/quotationTemplate.js';

/**
 * Multi-Size PDF Engine Service
 *
 * Validates document payload & paper configuration, recomputes all financial totals
 * server-side via `financialMath.js`, renders adaptive HTML, and generates a PDF buffer
 * inside an isolated Puppeteer BrowserContext.
 */

const MM_TO_PX_96DPI = 96 / 25.4;

/**
 * Validates and normalizes documentType, payload, and paperConfig.
 *
 * @param {'invoice'|'quotation'} documentType
 * @param {object} payload
 * @param {object} [paperConfig]
 */
export function validateAndPreparePdfJob(documentType, payload = {}, paperConfig = {}) {
  const normalizedType = String(documentType || '').trim().toLowerCase();
  if (normalizedType !== 'invoice' && normalizedType !== 'quotation') {
    const err = new Error(`Unsupported documentType "${documentType}". Expected "invoice" or "quotation".`);
    err.statusCode = 400;
    throw err;
  }

  const rawPageSize = String(
    paperConfig?.pageSize ||
      paperConfig?.code ||
      payload?.paperConfig?.pageSize ||
      payload?.pageSize ||
      'A4'
  )
    .trim()
    .toUpperCase();

  const rawOrientation = String(
    paperConfig?.orientation ||
      payload?.paperConfig?.orientation ||
      payload?.orientation ||
      'portrait'
  )
    .trim()
    .toLowerCase();

  const rawTemplateKey = String(
    paperConfig?.templateKey ||
      payload?.paperConfig?.templateKey ||
      payload?.templateKey ||
      'indigo'
  )
    .trim()
    .toLowerCase();

  if (!isSizeSupportedForTool(rawPageSize, normalizedType)) {
    const err = new Error(
      `Paper size "${rawPageSize}" is not allowed for documentType "${normalizedType}".`
    );
    err.statusCode = 400;
    throw err;
  }

  const paperSchema =
    normalizedType === 'invoice' ? invoicePaperConfigSchema : quotationPaperConfigSchema;

  const paperParse = paperSchema.safeParse({
    pageSize: rawPageSize,
    orientation: rawOrientation,
    templateKey: rawTemplateKey,
  });

  if (!paperParse.success) {
    const err = new Error(
      paperParse.error.issues.map((i) => i.message).join('; ')
    );
    err.statusCode = 400;
    err.issues = paperParse.error.issues;
    throw err;
  }

  const mergedPayload = {
    ...payload,
    pageSize: paperParse.data.pageSize,
    orientation: paperParse.data.orientation,
    templateKey: paperParse.data.templateKey,
    paperConfig: paperParse.data,
  };

  const docSchema = normalizedType === 'invoice' ? invoiceSchema : quotationSchema;
  const docParse = docSchema.safeParse(mergedPayload);

  if (!docParse.success) {
    const err = new Error(
      docParse.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
    );
    err.statusCode = 400;
    err.issues = docParse.error.issues;
    throw err;
  }

  const resolvedPaper = getPaperConfig(
    paperParse.data.pageSize,
    paperParse.data.orientation
  );

  // Server-side deterministic financial recalculation
  const calculatedTotals = calculateDocumentTotals(docParse.data);

  const html =
    normalizedType === 'invoice'
      ? renderInvoiceTemplate(docParse.data, resolvedPaper, calculatedTotals)
      : renderQuotationTemplate(docParse.data, resolvedPaper, calculatedTotals);

  return {
    documentType: normalizedType,
    validatedPayload: docParse.data,
    paperConfig: {
      ...resolvedPaper,
      templateKey: paperParse.data.templateKey,
    },
    calculatedTotals,
    html,
  };
}

/**
 * Renders an Invoice or Quotation payload into a PDF Buffer using the warm Puppeteer pool.
 *
 * @param {'invoice'|'quotation'} documentType
 * @param {object} payload - Invoice or Quotation payload
 * @param {object} [paperConfig] - `{ pageSize, orientation, templateKey }`
 * @returns {Promise<Buffer>} Non-empty PDF Buffer starting with `%PDF-`
 */
export async function renderDocumentToPdfBuffer(documentType, payload = {}, paperConfig = {}) {
  const { paperConfig: resolvedPaper, html } = validateAndPreparePdfJob(
    documentType,
    payload,
    paperConfig
  );

  return withIsolatedPage(async (page) => {
    const viewportWidthPx = Math.max(
      300,
      Math.ceil(resolvedPaper.widthMm * MM_TO_PX_96DPI)
    );
    const viewportHeightPx = resolvedPaper.heightMm
      ? Math.ceil(resolvedPaper.heightMm * MM_TO_PX_96DPI)
      : 800;

    await page.setViewport({
      width: viewportWidthPx,
      height: viewportHeightPx,
      deviceScaleFactor: 1,
    });

    await page.setContent(html, {
      waitUntil: 'networkidle0',
      timeout: 15000,
    });

    let pdfBytes;

    if (resolvedPaper.continuousRoll || resolvedPaper.code === 'THERMAL_80') {
      // Measure exact scrollHeight of the rendered 80mm receipt DOM for a continuous roll PDF
      const measuredHeightPx = await page.evaluate(() => {
        const mainEl = document.querySelector('.paper-sheet');
        const bodyEl = document.body;
        const docEl = document.documentElement;
        return Math.ceil(
          Math.max(
            mainEl ? mainEl.scrollHeight : 0,
            mainEl ? mainEl.offsetHeight : 0,
            bodyEl ? bodyEl.scrollHeight : 0,
            docEl ? docEl.scrollHeight : 0
          )
        );
      });

      const exactHeightMm = Math.max(
        60,
        Math.ceil(measuredHeightPx / MM_TO_PX_96DPI) + 4
      );

      pdfBytes = await page.pdf({
        width: `${resolvedPaper.widthMm}mm`,
        height: `${exactHeightMm}mm`,
        printBackground: true,
        preferCSSPageSize: false,
        margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' },
      });
    } else {
      pdfBytes = await page.pdf({
        width: `${resolvedPaper.widthMm}mm`,
        height: `${resolvedPaper.heightMm}mm`,
        printBackground: true,
        preferCSSPageSize: true,
        margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' },
      });
    }

    const pdfBuffer = Buffer.from(pdfBytes);

    if (!pdfBuffer || pdfBuffer.length < 5 || pdfBuffer.subarray(0, 5).toString('ascii') !== '%PDF-') {
      throw new Error('Failed to generate valid PDF buffer');
    }

    return pdfBuffer;
  });
}
