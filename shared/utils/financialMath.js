/**
 * Deterministic Financial Calculation Engine (Integer-Cent Rounding)
 *
 * Eliminates IEEE-754 floating-point drift across line items, discounts, taxes,
 * grand totals, and balance due calculations. Shared between React live previews
 * and Express server-side persistence.
 */

/**
 * Converts a decimal currency value to integer cents using symmetric half-up rounding.
 * e.g., 19.99 -> 1999, 1.005 -> 101
 *
 * @param {number|string} value
 * @returns {number} Integer cents
 */
export function toCents(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num === 0) return 0;
  const sign = num < 0 ? -1 : 1;
  return sign * Math.round((Math.abs(num) + Number.EPSILON) * 100);
}

/**
 * Converts integer cents back to a 2-decimal currency number.
 * e.g., 1999 -> 19.99
 *
 * @param {number} cents
 * @returns {number} Decimal currency amount rounded to 2 decimal places
 */
export function fromCents(cents) {
  if (!Number.isFinite(cents) || cents === 0) return 0;
  const rounded = Math.round(cents);
  if (Object.is(rounded, -0) || rounded === 0) return 0;
  return Number((rounded / 100).toFixed(2));
}

/**
 * Normalizes discount type input into 'percentage' or 'fixed'.
 *
 * @param {string} [discountType]
 * @returns {'percentage'|'fixed'}
 */
export function normalizeDiscountType(discountType) {
  const raw = String(discountType || 'percentage').trim().toLowerCase();
  if (raw === 'fixed' || raw === 'flat' || raw === 'amount') {
    return 'fixed';
  }
  return 'percentage';
}

/**
 * Computes deterministic line-item amounts using integer-cent rounding.
 *
 * @param {object} item
 * @param {number} item.quantity - Item quantity (supports fractional quantities, e.g., 1.5, 2.25)
 * @param {number} item.unitPrice - Unit price in currency units
 * @param {'percentage'|'fixed'} [item.discountType='percentage'] - Discount mode
 * @param {number} [item.discountValue=0] - Discount value (0-100 for percentage, currency amount for fixed)
 * @param {number} [item.taxRate=0] - Tax percentage (0-100)
 * @param {number|object} [item.discount] - Optional alias for discountValue or { type, value }
 * @returns {object} Calculated line item financials
 */
export function calculateLineItem(item = {}) {
  const rawQuantity = Number(item.quantity);
  const quantity = Number.isFinite(rawQuantity) && rawQuantity > 0 ? rawQuantity : 0;

  const rawUnitPrice = Number(item.unitPrice);
  const unitPrice = Number.isFinite(rawUnitPrice) && rawUnitPrice > 0 ? rawUnitPrice : 0;

  let rawDiscountType = item.discountType;
  let rawDiscountValue = item.discountValue;

  if (rawDiscountValue === undefined && item.discount !== undefined) {
    if (typeof item.discount === 'object' && item.discount !== null) {
      rawDiscountType = rawDiscountType ?? item.discount.type;
      rawDiscountValue = item.discount.value;
    } else {
      rawDiscountValue = item.discount;
    }
  }

  const discountType = normalizeDiscountType(rawDiscountType);
  const parsedDiscountVal = Number(rawDiscountValue);
  const discountValue =
    Number.isFinite(parsedDiscountVal) && parsedDiscountVal > 0 ? parsedDiscountVal : 0;

  const parsedTaxRate = Number(item.taxRate);
  const taxRate =
    Number.isFinite(parsedTaxRate) && parsedTaxRate > 0
      ? Math.min(100, parsedTaxRate)
      : 0;

  // Gross amount in cents (handles fractional quantities like 1.5 * 33.33 accurately)
  const grossCents = toCents(quantity * unitPrice);

  // Item discount in cents (clamped to [0, grossCents])
  let discountCents = 0;
  if (discountValue > 0 && grossCents > 0) {
    if (discountType === 'percentage') {
      const clampedPct = Math.min(100, discountValue);
      discountCents = Math.round((grossCents * clampedPct) / 100 + Number.EPSILON);
    } else {
      discountCents = toCents(discountValue);
    }
    discountCents = Math.min(grossCents, Math.max(0, discountCents));
  }

  const taxableCents = grossCents - discountCents;
  const taxCents =
    taxRate > 0 && taxableCents > 0
      ? Math.round((taxableCents * taxRate) / 100 + Number.EPSILON)
      : 0;
  const lineTotalCents = taxableCents + taxCents;

  return {
    quantity,
    unitPrice: fromCents(toCents(unitPrice)),
    discountType,
    discountValue,
    taxRate,
    grossAmount: fromCents(grossCents),
    lineSubtotal: fromCents(grossCents),
    discountAmount: fromCents(discountCents),
    itemDiscount: fromCents(discountCents),
    taxableAmount: fromCents(taxableCents),
    netAmount: fromCents(taxableCents),
    taxAmount: fromCents(taxCents),
    lineTotal: fromCents(lineTotalCents),
    total: fromCents(lineTotalCents),
    _cents: {
      grossCents,
      discountCents,
      taxableCents,
      taxCents,
      lineTotalCents,
    },
  };
}

/**
 * Computes deterministic document-level financial totals across all items,
 * global discount, shipping/adjustment, and payments.
 *
 * @param {object} params
 * @param {Array<object>} [params.items=[]] - Line items array
 * @param {'percentage'|'fixed'} [params.globalDiscountType='percentage'] - Global discount type
 * @param {number} [params.globalDiscountValue=0] - Global discount value
 * @param {object} [params.discount] - Optional { type, value } alias for global discount
 * @param {number} [params.shippingOrAdjustment=0] - Optional positive/negative shipping or adjustment
 * @param {number} [params.amountPaid=0] - Amount already paid toward the document
 * @returns {{
 *   lineResults: Array<object>,
 *   subtotal: number,
 *   itemDiscountTotal: number,
 *   globalDiscountAmount: number,
 *   taxTotal: number,
 *   shippingOrAdjustment: number,
 *   grandTotal: number,
 *   amountPaid: number,
 *   balanceDue: number
 * }}
 */
export function calculateDocumentTotals(params = {}) {
  const items = Array.isArray(params.items) ? params.items : [];

  let rawGlobalType = params.globalDiscountType;
  let rawGlobalValue = params.globalDiscountValue;

  if (rawGlobalValue === undefined && params.discount && typeof params.discount === 'object') {
    rawGlobalType = rawGlobalType ?? params.discount.type;
    rawGlobalValue = params.discount.value;
  }

  const globalDiscountType = normalizeDiscountType(rawGlobalType);
  const parsedGlobalVal = Number(rawGlobalValue);
  const globalDiscountValue =
    Number.isFinite(parsedGlobalVal) && parsedGlobalVal > 0 ? parsedGlobalVal : 0;

  let subtotalCents = 0;
  let itemDiscountTotalCents = 0;
  let lineTaxTotalCents = 0;

  const lineResults = items.map((item, index) => {
    const calculated = calculateLineItem(item);
    subtotalCents += calculated._cents.grossCents;
    itemDiscountTotalCents += calculated._cents.discountCents;
    lineTaxTotalCents += calculated._cents.taxCents;

    const { _cents, ...publicLineResult } = calculated;
    return {
      ...publicLineResult,
      sortOrder: typeof item?.sortOrder === 'number' ? item.sortOrder : index,
      name: item?.name ?? '',
      description: item?.description ?? '',
      unit: item?.unit ?? 'pcs',
    };
  });

  const netAfterItemDiscountCents = Math.max(0, subtotalCents - itemDiscountTotalCents);

  // Global discount applied against net subtotal after line-item discounts
  let globalDiscountCents = 0;
  if (globalDiscountValue > 0 && netAfterItemDiscountCents > 0) {
    if (globalDiscountType === 'percentage') {
      const clampedPct = Math.min(100, globalDiscountValue);
      globalDiscountCents = Math.round(
        (netAfterItemDiscountCents * clampedPct) / 100 + Number.EPSILON
      );
    } else {
      globalDiscountCents = toCents(globalDiscountValue);
    }
    globalDiscountCents = Math.min(
      netAfterItemDiscountCents,
      Math.max(0, globalDiscountCents)
    );
  }

  const taxTotalCents = lineTaxTotalCents;
  const shippingCents = toCents(params.shippingOrAdjustment || 0);

  const rawGrandTotalCents =
    netAfterItemDiscountCents - globalDiscountCents + taxTotalCents + shippingCents;
  const grandTotalCents = Math.max(0, rawGrandTotalCents);

  const amountPaidCents = Math.max(0, toCents(params.amountPaid || 0));
  const balanceDueCents = Math.max(0, grandTotalCents - amountPaidCents);

  return {
    lineResults,
    subtotal: fromCents(subtotalCents),
    itemDiscountTotal: fromCents(itemDiscountTotalCents),
    globalDiscountAmount: fromCents(globalDiscountCents),
    taxTotal: fromCents(taxTotalCents),
    shippingOrAdjustment: fromCents(shippingCents),
    grandTotal: fromCents(grandTotalCents),
    amountPaid: fromCents(amountPaidCents),
    balanceDue: fromCents(balanceDueCents),
  };
}

/**
 * Formats a numeric currency amount safely with Intl.NumberFormat fallback.
 *
 * @param {number|string} amount
 * @param {string} [currency='USD']
 * @param {string} [locale='en-US']
 * @returns {string}
 */
export function formatCurrency(amount, currency = 'USD', locale = 'en-US') {
  const num = Number(amount);
  const safeVal = Number.isFinite(num) ? num : 0;
  const code = String(currency || 'USD').trim().toUpperCase();
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: code,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(safeVal);
  } catch {
    return `${code} ${safeVal.toFixed(2)}`;
  }
}
