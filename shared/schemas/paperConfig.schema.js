import { z } from 'zod';
import {
  PAPER_SIZE_CODES,
  ORIENTATIONS,
  TEMPLATE_KEYS,
  getSupportedSizeCodesForTool,
} from '../constants/paperSizes.js';

export const INVOICE_SIZE_CODES = Object.freeze(getSupportedSizeCodesForTool('invoice'));
export const QUOTATION_SIZE_CODES = Object.freeze(getSupportedSizeCodesForTool('quotation'));

export const orientationSchema = z.enum(ORIENTATIONS, {
  errorMap: () => ({
    message: `Orientation must be one of: ${ORIENTATIONS.join(', ')}`,
  }),
});

export const templateKeySchema = z.enum(TEMPLATE_KEYS, {
  errorMap: () => ({
    message: `Template key must be one of: ${TEMPLATE_KEYS.join(', ')}`,
  }),
});

/**
 * Creates a paper configuration fields shape `{ pageSize, orientation, templateKey }`
 * restricted to the allowed paper sizes for the given toolType ('invoice' | 'quotation').
 *
 * @param {'invoice'|'quotation'} [toolType]
 */
export function getPaperConfigShape(toolType) {
  const allowedSizes = toolType
    ? getSupportedSizeCodesForTool(toolType)
    : [...PAPER_SIZE_CODES];

  if (!allowedSizes.length) {
    throw new Error(`No paper sizes configured for toolType "${toolType}"`);
  }

  return {
    pageSize: z
      .enum(allowedSizes, {
        errorMap: () => ({
          message: `Invalid pageSize for ${toolType || 'document'}. Allowed sizes: ${allowedSizes.join(', ')}`,
        }),
      })
      .default('A4'),
    orientation: orientationSchema.default('portrait'),
    templateKey: templateKeySchema.default('indigo'),
  };
}

/**
 * Factory returning a Zod object schema for a tool's paper configuration.
 *
 * @param {'invoice'|'quotation'} [toolType]
 */
export function createPaperConfigSchema(toolType) {
  return z.object(getPaperConfigShape(toolType));
}

export const paperConfigSchema = createPaperConfigSchema();
export const invoicePaperConfigSchema = createPaperConfigSchema('invoice');
export const quotationPaperConfigSchema = createPaperConfigSchema('quotation');

export default paperConfigSchema;
