/**
 * Single Source of Truth for Physical Paper Dimensions, Print Margins,
 * Typography Scaling, and Tool Compatibility.
 *
 * Used identically by:
 * - Frontend React `DocumentPaperCanvas` & `PaperSizeSelector`
 * - Shared Zod validation schemas (`paperConfig.schema.js`)
 * - Backend Puppeteer multi-size PDF rendering engine
 */

export const PAPER_SIZE_CODES = Object.freeze([
  'A4',
  'A5',
  'LETTER',
  'LEGAL',
  'B5',
  'THERMAL_80',
]);

export const ORIENTATIONS = Object.freeze(['portrait', 'landscape']);

export const TEMPLATE_KEYS = Object.freeze(['indigo', 'emerald', 'slate']);

export const TEMPLATE_THEMES = Object.freeze({
  indigo: Object.freeze({
    key: 'indigo',
    name: 'Indigo Executive',
    primaryHex: '#4F46E5',
    secondaryHex: '#3730A3',
    accentBgHex: '#EEF2FF',
    borderHex: '#C7D2FE',
    textHex: '#1E1B4B',
  }),
  emerald: Object.freeze({
    key: 'emerald',
    name: 'Emerald Commerce',
    primaryHex: '#059669',
    secondaryHex: '#065F46',
    accentBgHex: '#ECFDF5',
    borderHex: '#A7F3D0',
    textHex: '#064E3B',
  }),
  slate: Object.freeze({
    key: 'slate',
    name: 'Slate Minimal',
    primaryHex: '#334155',
    secondaryHex: '#0F172A',
    accentBgHex: '#F8FAFC',
    borderHex: '#CBD5E1',
    textHex: '#0F172A',
  }),
});

function createMarginConfig(mm) {
  return Object.freeze({
    top: mm,
    right: mm,
    bottom: mm,
    left: mm,
    unit: 'mm',
    css: `${mm}mm`,
    valueOf() {
      return mm;
    },
    toString() {
      return `${mm}mm`;
    },
  });
}

export const PAPER_SIZES = Object.freeze({
  A4: Object.freeze({
    code: 'A4',
    name: 'A4',
    label: 'A4 (210 × 297 mm)',
    widthMm: 210,
    heightMm: 297,
    tools: Object.freeze(['invoice', 'quotation']),
    supportedTools: Object.freeze(['invoice', 'quotation']),
    landscape: true,
    supportsLandscape: true,
    marginMm: 15,
    marginsMm: 15,
    margins: createMarginConfig(15),
    baseFontPt: 10,
    continuousRoll: false,
    layoutVariant: 'standard',
    tableColumns: 6,
    description: '15mm margins, 2-column header, 6-column item table, side-by-side Bank Details + Totals',
  }),

  A5: Object.freeze({
    code: 'A5',
    name: 'A5',
    label: 'A5 (148 × 210 mm)',
    widthMm: 148,
    heightMm: 210,
    tools: Object.freeze(['invoice', 'quotation']),
    supportedTools: Object.freeze(['invoice', 'quotation']),
    landscape: true,
    supportsLandscape: true,
    marginMm: 10,
    marginsMm: 10,
    margins: createMarginConfig(10),
    baseFontPt: 9,
    continuousRoll: false,
    layoutVariant: 'compact',
    tableColumns: 4,
    description: '10mm margins, 9pt base font, compact 4-column table (merged Qty × Rate), stacked footer',
  }),

  LETTER: Object.freeze({
    code: 'LETTER',
    name: 'Letter',
    label: 'US Letter (215.9 × 279.4 mm)',
    widthMm: 215.9,
    heightMm: 279.4,
    tools: Object.freeze(['invoice', 'quotation']),
    supportedTools: Object.freeze(['invoice', 'quotation']),
    landscape: true,
    supportsLandscape: true,
    marginMm: 15,
    marginsMm: 15,
    margins: createMarginConfig(15),
    baseFontPt: 10,
    continuousRoll: false,
    layoutVariant: 'standard',
    tableColumns: 6,
    description: '15mm margins, North American standard grid equivalent to A4 with adjusted page break',
  }),

  LEGAL: Object.freeze({
    code: 'LEGAL',
    name: 'Legal',
    label: 'US Legal (215.9 × 355.6 mm)',
    widthMm: 215.9,
    heightMm: 355.6,
    tools: Object.freeze(['invoice', 'quotation']),
    supportedTools: Object.freeze(['invoice', 'quotation']),
    landscape: false,
    supportsLandscape: false,
    marginMm: 15,
    marginsMm: 15,
    margins: createMarginConfig(15),
    baseFontPt: 10,
    continuousRoll: false,
    layoutVariant: 'extended',
    tableColumns: 6,
    description: 'Extended vertical item capacity + dedicated multi-paragraph Terms & Acceptance Signature block',
  }),

  B5: Object.freeze({
    code: 'B5',
    name: 'B5',
    label: 'JIS/ISO B5 (176 × 250 mm)',
    widthMm: 176,
    heightMm: 250,
    tools: Object.freeze(['invoice', 'quotation']),
    supportedTools: Object.freeze(['invoice', 'quotation']),
    landscape: true,
    supportsLandscape: true,
    marginMm: 12,
    marginsMm: 12,
    margins: createMarginConfig(12),
    baseFontPt: 9.5,
    continuousRoll: false,
    layoutVariant: 'condensed',
    tableColumns: 6,
    description: '12mm margins, 9.5pt typography, condensed column widths',
  }),

  THERMAL_80: Object.freeze({
    code: 'THERMAL_80',
    name: 'Thermal 80mm',
    label: 'Thermal Receipt (80 mm × Auto Roll)',
    widthMm: 80,
    heightMm: null,
    tools: Object.freeze(['invoice']),
    supportedTools: Object.freeze(['invoice']),
    landscape: false,
    supportsLandscape: false,
    marginMm: 4,
    marginsMm: 4,
    margins: createMarginConfig(4),
    baseFontPt: 8.5,
    continuousRoll: true,
    layoutVariant: 'thermal',
    tableColumns: 1,
    description: 'Single-column flow, 4mm side padding, monospace totals, dynamic height via scrollHeight',
  }),
});

/**
 * Returns the resolved paper configuration for a given sizeCode and orientation.
 * When orientation is 'landscape' and the size supports landscape, widthMm and heightMm are swapped.
 *
 * @param {string} [sizeCode='A4'] - One of 'A4', 'A5', 'LETTER', 'LEGAL', 'B5', 'THERMAL_80'
 * @param {'portrait'|'landscape'} [orientation='portrait'] - Page orientation
 * @returns {object} Resolved paper metadata with oriented widthMm and heightMm
 */
export function getPaperConfig(sizeCode = 'A4', orientation = 'portrait') {
  const normalizedCode = String(sizeCode || 'A4').trim().toUpperCase();
  const base = PAPER_SIZES[normalizedCode];

  if (!base) {
    throw new Error(
      `Unsupported paper size "${sizeCode}". Allowed sizes: ${PAPER_SIZE_CODES.join(', ')}`
    );
  }

  const normalizedOrientation =
    String(orientation || 'portrait').trim().toLowerCase() === 'landscape'
      ? 'landscape'
      : 'portrait';

  const isLandscape =
    normalizedOrientation === 'landscape' &&
    base.landscape === true &&
    !base.continuousRoll &&
    base.heightMm !== null;

  const effectiveOrientation = isLandscape ? 'landscape' : 'portrait';
  const widthMm = isLandscape ? base.heightMm : base.widthMm;
  const heightMm = isLandscape ? base.widthMm : base.heightMm;

  return Object.freeze({
    ...base,
    orientation: effectiveOrientation,
    requestedOrientation: normalizedOrientation,
    widthMm,
    heightMm,
    cssWidth: `${widthMm}mm`,
    cssHeight: heightMm !== null ? `${heightMm}mm` : 'auto',
    cssMargin: `${base.marginMm}mm`,
    pageCssSize:
      base.continuousRoll || heightMm === null
        ? `${widthMm}mm auto`
        : `${widthMm}mm ${heightMm}mm`,
    aspectRatio: heightMm !== null ? Number((widthMm / heightMm).toFixed(6)) : null,
  });
}

/**
 * Returns all paper size configurations supported by the specified tool type.
 * The returned array also supports `.includes('A4')` by size code or object reference.
 *
 * @param {'invoice'|'quotation'} toolType
 * @returns {Array<object>} Array of supported paper size definitions
 */
export function getSupportedSizesForTool(toolType) {
  const normalizedTool = String(toolType || '').trim().toLowerCase();
  const matches = Object.values(PAPER_SIZES).filter((size) =>
    size.tools.includes(normalizedTool)
  );

  Object.defineProperty(matches, 'includes', {
    value(searchElement, fromIndex = 0) {
      if (typeof searchElement === 'string') {
        const upper = searchElement.trim().toUpperCase();
        return this.slice(fromIndex).some((item) => item.code === upper);
      }
      return Array.prototype.includes.call(this, searchElement, fromIndex);
    },
    enumerable: false,
  });

  return matches;
}

/**
 * Returns array of allowed paper size codes (strings) for a given tool type.
 *
 * @param {'invoice'|'quotation'} toolType
 * @returns {Array<string>} e.g. ['A4', 'A5', 'LETTER', 'LEGAL', 'B5']
 */
export function getSupportedSizeCodesForTool(toolType) {
  return getSupportedSizesForTool(toolType).map((size) => size.code);
}

/**
 * Checks whether a paper size code is supported for a given tool type.
 *
 * @param {string} sizeCode
 * @param {'invoice'|'quotation'} toolType
 * @returns {boolean}
 */
export function isSizeSupportedForTool(sizeCode, toolType) {
  const normalizedCode = String(sizeCode || '').trim().toUpperCase();
  return getSupportedSizeCodesForTool(toolType).includes(normalizedCode);
}
