import assert from 'node:assert/strict';
import {
  PAPER_SIZES,
  getPaperConfig,
  getSupportedSizesForTool,
} from '../constants/paperSizes.js';
import {
  calculateLineItem,
  calculateDocumentTotals,
} from '../utils/financialMath.js';
import {
  invoicePaperConfigSchema,
  quotationPaperConfigSchema,
} from '../schemas/paperConfig.schema.js';
import { invoiceSchema } from '../schemas/invoice.schema.js';
import { quotationSchema } from '../schemas/quotation.schema.js';

console.log('--- Running Shared Generator Core Verification ---');

// 1. Verify paperSizes.js metadata and landscape swapping via getPaperConfig
{
  assert.equal(PAPER_SIZES.A4.widthMm, 210);
  assert.equal(PAPER_SIZES.A4.heightMm, 297);
  assert.equal(PAPER_SIZES.A4.marginMm, 15);
  assert.equal(PAPER_SIZES.A4.baseFontPt, 10);
  assert.equal(PAPER_SIZES.A4.landscape, true);

  assert.equal(PAPER_SIZES.A5.widthMm, 148);
  assert.equal(PAPER_SIZES.A5.heightMm, 210);
  assert.equal(PAPER_SIZES.A5.marginMm, 10);
  assert.equal(PAPER_SIZES.A5.baseFontPt, 9);

  assert.equal(PAPER_SIZES.LETTER.widthMm, 215.9);
  assert.equal(PAPER_SIZES.LETTER.heightMm, 279.4);

  assert.equal(PAPER_SIZES.LEGAL.widthMm, 215.9);
  assert.equal(PAPER_SIZES.LEGAL.heightMm, 355.6);
  assert.equal(PAPER_SIZES.LEGAL.landscape, false);

  assert.equal(PAPER_SIZES.B5.widthMm, 176);
  assert.equal(PAPER_SIZES.B5.heightMm, 250);
  assert.equal(PAPER_SIZES.B5.marginMm, 12);
  assert.equal(PAPER_SIZES.B5.baseFontPt, 9.5);

  assert.equal(PAPER_SIZES.THERMAL_80.widthMm, 80);
  assert.equal(PAPER_SIZES.THERMAL_80.heightMm, null);
  assert.equal(PAPER_SIZES.THERMAL_80.marginMm, 4);
  assert.equal(PAPER_SIZES.THERMAL_80.baseFontPt, 8.5);
  assert.equal(PAPER_SIZES.THERMAL_80.continuousRoll, true);

  // Portrait vs Landscape dimension swapping
  const a4Portrait = getPaperConfig('A4', 'portrait');
  assert.equal(a4Portrait.widthMm, 210);
  assert.equal(a4Portrait.heightMm, 297);
  assert.equal(a4Portrait.orientation, 'portrait');

  const a4Landscape = getPaperConfig('A4', 'landscape');
  assert.equal(a4Landscape.widthMm, 297);
  assert.equal(a4Landscape.heightMm, 210);
  assert.equal(a4Landscape.orientation, 'landscape');

  const letterLandscape = getPaperConfig('LETTER', 'landscape');
  assert.equal(letterLandscape.widthMm, 279.4);
  assert.equal(letterLandscape.heightMm, 215.9);

  // Non-landscape sizes remain portrait even if landscape requested
  const legalLandscapeAttempt = getPaperConfig('LEGAL', 'landscape');
  assert.equal(legalLandscapeAttempt.widthMm, 215.9);
  assert.equal(legalLandscapeAttempt.heightMm, 355.6);
  assert.equal(legalLandscapeAttempt.orientation, 'portrait');

  // Tool support checks
  const invoiceSizes = getSupportedSizesForTool('invoice');
  const quotationSizes = getSupportedSizesForTool('quotation');
  assert.equal(invoiceSizes.length, 6);
  assert.equal(quotationSizes.length, 5);
  assert.equal(invoiceSizes.includes('THERMAL_80'), true);
  assert.equal(quotationSizes.includes('THERMAL_80'), false);

  console.log('[PASS] 1. paperSizes.js & getPaperConfig landscape swapping verified.');
}

// 2. Verify financialMath.js fractional quantities, percentage vs fixed discounts, and tax rounding
{
  // Fractional quantity + percentage discount + tax rounding
  // 1.5 * 33.33 = 49.995 -> 50.00 gross
  // 10% discount = 5.00 -> taxable 45.00
  // 8.25% tax on 45.00 = 3.7125 -> 3.71
  // lineTotal = 48.71
  const item1 = calculateLineItem({
    quantity: 1.5,
    unitPrice: 33.33,
    discountType: 'percentage',
    discountValue: 10,
    taxRate: 8.25,
  });
  assert.equal(item1.grossAmount, 50.0);
  assert.equal(item1.discountAmount, 5.0);
  assert.equal(item1.taxableAmount, 45.0);
  assert.equal(item1.taxAmount, 3.71);
  assert.equal(item1.lineTotal, 48.71);

  // Fractional quantity + fixed discount + half-cent tax boundary
  // 2.25 * 19.99 = 44.9775 -> 44.98 gross
  // Fixed discount 4.98 -> taxable 40.00
  // 7.5% tax on 40.00 = 3.00 -> lineTotal = 43.00
  const item2 = calculateLineItem({
    quantity: 2.25,
    unitPrice: 19.99,
    discountType: 'fixed',
    discountValue: 4.98,
    taxRate: 7.5,
  });
  assert.equal(item2.grossAmount, 44.98);
  assert.equal(item2.discountAmount, 4.98);
  assert.equal(item2.taxableAmount, 40.0);
  assert.equal(item2.taxAmount, 3.0);
  assert.equal(item2.lineTotal, 43.0);

  // Classic IEEE-754 half-up boundary: 1 * 10.05 with 10% tax = 1.005 -> rounds to 1.01
  const item3 = calculateLineItem({
    quantity: 1,
    unitPrice: 10.05,
    discountType: 'percentage',
    discountValue: 0,
    taxRate: 10,
  });
  assert.equal(item3.taxAmount, 1.01);
  assert.equal(item3.lineTotal, 11.06);

  // Document totals aggregation with global discount, shipping, and amountPaid
  const docTotals = calculateDocumentTotals({
    items: [
      {
        name: 'Consulting Hours',
        quantity: 1.5,
        unitPrice: 33.33,
        discountType: 'percentage',
        discountValue: 10,
        taxRate: 8.25,
      },
      {
        name: 'Hardware Component',
        quantity: 2.25,
        unitPrice: 19.99,
        discountType: 'fixed',
        discountValue: 4.98,
        taxRate: 7.5,
      },
    ],
    globalDiscountType: 'percentage',
    globalDiscountValue: 10, // 10% of (94.98 - 9.98 = 85.00) = 8.50
    shippingOrAdjustment: 15.0,
    amountPaid: 50.0,
  });

  assert.equal(docTotals.lineResults.length, 2);
  assert.equal(docTotals.subtotal, 94.98);
  assert.equal(docTotals.itemDiscountTotal, 9.98);
  assert.equal(docTotals.globalDiscountAmount, 8.5);
  assert.equal(docTotals.taxTotal, 6.71);
  // grandTotal = (94.98 - 9.98) - 8.50 + 6.71 + 15.00 = 98.21
  assert.equal(docTotals.grandTotal, 98.21);
  assert.equal(docTotals.amountPaid, 50.0);
  assert.equal(docTotals.balanceDue, 48.21);

  console.log('[PASS] 2. financialMath.js deterministic cent-rounding verified.');
}

// 3. Verify Zod schemas: quotationSchema rejects THERMAL_80 while invoiceSchema accepts it
{
  const basePayload = {
    issueDate: '2026-11-25',
    currency: 'USD',
    businessSnapshot: {
      businessName: 'SmartTools Solutions Ltd',
      email: 'billing@smarttools.dev',
    },
    customerSnapshot: {
      name: 'Acme Corporation',
      email: 'ap@acme.example.com',
    },
    items: [
      {
        name: 'Cloud SaaS Subscription',
        quantity: 1,
        unitPrice: 199.99,
        discountType: 'percentage',
        discountValue: 0,
        taxRate: 10,
      },
    ],
    pageSize: 'THERMAL_80',
    orientation: 'portrait',
    templateKey: 'indigo',
  };

  const invoiceParse = invoiceSchema.safeParse({
    ...basePayload,
    invoiceNumber: 'INV-2026-0001',
    dueDate: '2026-12-25',
    status: 'draft',
  });
  assert.equal(
    invoiceParse.success,
    true,
    `Expected invoiceSchema to accept THERMAL_80, got error: ${JSON.stringify(invoiceParse.error?.issues)}`
  );

  const quotationThermalParse = quotationSchema.safeParse({
    ...basePayload,
    quotationNumber: 'QUO-2026-0001',
    validUntil: '2026-12-25',
    status: 'draft',
  });
  assert.equal(
    quotationThermalParse.success,
    false,
    'Expected quotationSchema to reject THERMAL_80'
  );

  const quotationA4Parse = quotationSchema.safeParse({
    ...basePayload,
    quotationNumber: 'QUO-2026-0001',
    validUntil: '2026-12-25',
    pageSize: 'A4',
    status: 'draft',
  });
  assert.equal(
    quotationA4Parse.success,
    true,
    `Expected quotationSchema to accept A4, got error: ${JSON.stringify(quotationA4Parse.error?.issues)}`
  );

  // Paper config standalone schemas
  assert.equal(invoicePaperConfigSchema.safeParse({ pageSize: 'THERMAL_80' }).success, true);
  assert.equal(quotationPaperConfigSchema.safeParse({ pageSize: 'THERMAL_80' }).success, false);

  console.log('[PASS] 3. Zod schemas verified (invoice accepts THERMAL_80, quotation rejects THERMAL_80).');
}

console.log('--- ALL SHARED GENERATOR CORE VERIFICATION CHECKS PASSED ---');
