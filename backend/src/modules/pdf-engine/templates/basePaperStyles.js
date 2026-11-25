import {
  TEMPLATE_THEMES,
  getPaperConfig,
} from '../../../../../shared/constants/paperSizes.js';

/**
 * Adaptive Multi-Size Print & PDF Stylesheet Builder
 *
 * Generates size-specific @page rules, physical margins, font sizing,
 * pagination guards, and accent palettes (`indigo`, `emerald`, `slate`).
 */

export function resolveThemePalette(templateKey = 'indigo') {
  const key = String(templateKey || 'indigo').trim().toLowerCase();
  return TEMPLATE_THEMES[key] || TEMPLATE_THEMES.indigo;
}

/**
 * Builds the complete CSS stylesheet for a given paper size, orientation, and theme key.
 *
 * @param {object} paperConfig - Resolved paper config from `getPaperConfig(sizeCode, orientation)`
 * @param {string} [templateKey='indigo'] - One of 'indigo', 'emerald', 'slate'
 * @returns {string} CSS rules to inject into `<style>`
 */
export function buildBasePaperStyles(paperConfig, templateKey = 'indigo') {
  const paper =
    paperConfig && paperConfig.code
      ? paperConfig
      : getPaperConfig(
          paperConfig?.pageSize || 'A4',
          paperConfig?.orientation || 'portrait'
        );

  const theme = resolveThemePalette(templateKey || paperConfig?.templateKey);

  const pageSizeDeclaration =
    paper.continuousRoll || paper.heightMm === null
      ? `${paper.widthMm}mm auto`
      : `${paper.widthMm}mm ${paper.heightMm}mm`;

  return `
    @page {
      size: ${pageSizeDeclaration};
      margin: 0;
    }

    :root {
      --paper-width: ${paper.widthMm}mm;
      --paper-height: ${paper.heightMm !== null ? `${paper.heightMm}mm` : 'auto'};
      --paper-margin: ${paper.marginMm}mm;
      --base-font-pt: ${paper.baseFontPt}pt;
      --accent-primary: ${theme.primaryHex};
      --accent-secondary: ${theme.secondaryHex};
      --accent-bg: ${theme.accentBgHex};
      --accent-border: ${theme.borderHex};
      --accent-text: ${theme.textHex};
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    html, body {
      width: ${paper.widthMm}mm;
      background: #FFFFFF;
      color: #0F172A;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      font-size: ${paper.baseFontPt}pt;
      line-height: 1.45;
    }

    .paper-sheet {
      width: ${paper.widthMm}mm;
      min-height: ${paper.heightMm !== null ? `${paper.heightMm}mm` : 'auto'};
      padding: ${paper.marginMm}mm;
      background: #FFFFFF;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }

    /* Pagination & Page-Break Enforcement */
    thead {
      display: table-header-group;
    }

    tfoot {
      display: table-footer-group;
    }

    tr,
    .totals-block,
    .signature-block,
    .bank-block,
    .terms-block,
    .billing-grid {
      break-inside: avoid;
      page-break-inside: avoid;
    }

    /* Header Layout (2-Column for A4, LETTER, LEGAL, B5, A5) */
    .doc-header {
      display: grid;
      grid-template-columns: 1.2fr 0.8fr;
      gap: 14px;
      padding-bottom: 12px;
      border-bottom: 2px solid var(--accent-primary);
      margin-bottom: 14px;
      align-items: start;
    }

    .brand-block {
      display: flex;
      gap: 12px;
      align-items: flex-start;
    }

    .brand-logo {
      max-width: 56px;
      max-height: 56px;
      object-fit: contain;
      border-radius: 6px;
      border: 1px solid #E2E8F0;
      padding: 2px;
      background: #FFFFFF;
    }

    .business-name {
      font-size: 1.35em;
      font-weight: 800;
      color: var(--accent-text);
      letter-spacing: -0.01em;
      margin-bottom: 3px;
    }

    .business-meta {
      color: #475569;
      font-size: 0.88em;
      line-height: 1.38;
    }

    .doc-title-block {
      text-align: right;
    }

    .doc-type-heading {
      font-size: 1.75em;
      font-weight: 800;
      color: var(--accent-primary);
      letter-spacing: 0.04em;
      text-transform: uppercase;
      line-height: 1.1;
    }

    .doc-number-badge {
      display: inline-block;
      margin-top: 4px;
      padding: 3px 8px;
      background: var(--accent-bg);
      border: 1px solid var(--accent-border);
      color: var(--accent-secondary);
      border-radius: 4px;
      font-weight: 700;
      font-size: 0.9em;
    }

    .status-pill {
      display: inline-block;
      margin-left: 6px;
      padding: 2px 7px;
      border-radius: 999px;
      font-size: 0.75em;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      background: #F1F5F9;
      color: #334155;
      border: 1px solid #CBD5E1;
    }

    .doc-meta-grid {
      margin-top: 8px;
      display: inline-grid;
      grid-template-columns: auto auto;
      gap: 3px 10px;
      text-align: right;
      font-size: 0.88em;
    }

    .doc-meta-label {
      color: #64748B;
      font-weight: 500;
    }

    .doc-meta-value {
      color: #0F172A;
      font-weight: 600;
    }

    /* Customer & Summary Strip */
    .billing-grid {
      display: grid;
      grid-template-columns: 1.15fr 0.85fr;
      gap: 14px;
      margin-bottom: 14px;
      padding: 10px 12px;
      background: #F8FAFC;
      border: 1px solid #E2E8F0;
      border-left: 4px solid var(--accent-primary);
      border-radius: 6px;
    }

    .section-eyebrow {
      font-size: 0.76em;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--accent-primary);
      margin-bottom: 4px;
    }

    .customer-name {
      font-size: 1.05em;
      font-weight: 700;
      color: #0F172A;
      margin-bottom: 2px;
    }

    .customer-details {
      font-size: 0.88em;
      color: #475569;
      line-height: 1.38;
    }

    /* Line Items Table */
    .items-section {
      margin-bottom: 14px;
      flex-grow: 1;
    }

    table.items-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.92em;
    }

    table.items-table thead th {
      background: var(--accent-primary);
      color: #FFFFFF;
      font-weight: 700;
      text-transform: uppercase;
      font-size: 0.78em;
      letter-spacing: 0.04em;
      padding: 7px 8px;
      text-align: left;
      border: 1px solid var(--accent-primary);
    }

    table.items-table thead th.num,
    table.items-table tbody td.num {
      text-align: right;
      white-space: nowrap;
    }

    table.items-table tbody tr {
      border-bottom: 1px solid #E2E8F0;
    }

    table.items-table tbody tr:nth-child(even) {
      background: #FAFBFD;
    }

    table.items-table tbody td {
      padding: 7px 8px;
      vertical-align: top;
      color: #1E293B;
    }

    .item-title {
      font-weight: 600;
      color: #0F172A;
    }

    .item-desc {
      font-size: 0.86em;
      color: #64748B;
      margin-top: 2px;
    }

    /* Footer: Side-by-side on A4, LETTER, B5, LEGAL; Stacked on A5 */
    .doc-footer-grid {
      display: grid;
      grid-template-columns: 1.15fr 0.85fr;
      gap: 16px;
      align-items: start;
      margin-top: 8px;
    }

    .info-card {
      padding: 9px 11px;
      border: 1px solid #E2E8F0;
      border-radius: 6px;
      background: #FFFFFF;
      margin-bottom: 8px;
      font-size: 0.88em;
    }

    .info-card-title {
      font-size: 0.8em;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--accent-secondary);
      margin-bottom: 4px;
    }

    .bank-grid {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 2px 10px;
      font-size: 0.92em;
    }

    .bank-label {
      color: #64748B;
    }

    .bank-val {
      color: #0F172A;
      font-weight: 600;
    }

    /* Totals Summary Block */
    .totals-block {
      border: 1px solid var(--accent-border);
      background: #FFFFFF;
      border-radius: 6px;
      overflow: hidden;
    }

    .totals-row {
      display: flex;
      justify-content: space-between;
      padding: 5px 11px;
      font-size: 0.92em;
      border-bottom: 1px solid #F1F5F9;
    }

    .totals-row.grand-total {
      background: var(--accent-primary);
      color: #FFFFFF;
      font-weight: 800;
      font-size: 1.08em;
      padding: 8px 11px;
      border-bottom: none;
    }

    .totals-row.sub-balance {
      background: var(--accent-bg);
      color: var(--accent-text);
      font-weight: 700;
    }

    /* Signature & Acceptance Block */
    .signature-block {
      margin-top: 14px;
      padding-top: 10px;
      border-top: 1px dashed #CBD5E1;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
      font-size: 0.86em;
    }

    .sig-box {
      padding-top: 22px;
      border-bottom: 1px solid #475569;
      margin-bottom: 4px;
    }

    .sig-caption {
      color: #475569;
      font-weight: 600;
    }

    /* Size-Specific Adaptation: A5 (148x210mm, 10mm margins, 9pt base, 4-col compact table, stacked footer) */
    .size-A5 .doc-header {
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      margin-bottom: 10px;
      padding-bottom: 8px;
    }

    .size-A5 .billing-grid {
      grid-template-columns: 1fr;
      gap: 6px;
      padding: 7px 9px;
      margin-bottom: 10px;
    }

    .size-A5 table.items-table thead th,
    .size-A5 table.items-table tbody td {
      padding: 5px 6px;
    }

    .size-A5 .doc-footer-grid {
      grid-template-columns: 1fr;
      gap: 10px;
    }

    /* Size-Specific Adaptation: B5 (176x250mm, 12mm margins, 9.5pt typography, condensed widths) */
    .size-B5 table.items-table thead th,
    .size-B5 table.items-table tbody td {
      padding: 5px 6px;
      font-size: 0.9em;
    }

    .size-B5 .doc-footer-grid {
      grid-template-columns: 1.05fr 0.95fr;
      gap: 12px;
    }

    /* Size-Specific Adaptation: LEGAL (215.9x355.6mm, extended table area + multi-paragraph Terms & Signature) */
    .size-LEGAL .items-section {
      min-height: 125mm;
    }

    .size-LEGAL .legal-terms-box {
      margin-top: 12px;
      padding: 11px 13px;
      background: #F8FAFC;
      border: 1px solid #CBD5E1;
      border-radius: 6px;
      font-size: 0.86em;
      line-height: 1.45;
    }

    /* Size-Specific Adaptation: THERMAL_80 (80mm x auto roll, 4mm padding, 8.5pt monospace POS receipt) */
    body.body-THERMAL_80,
    .size-THERMAL_80 {
      font-family: 'Courier New', Courier, 'Liberation Mono', monospace;
      font-size: 8.5pt;
      line-height: 1.32;
      color: #000000;
    }

    .size-THERMAL_80.paper-sheet {
      width: 80mm;
      min-height: auto;
      padding: 4mm;
      display: block;
    }

    .thermal-header {
      text-align: center;
      margin-bottom: 6px;
    }

    .thermal-logo {
      max-width: 36mm;
      max-height: 16mm;
      object-fit: contain;
      margin: 0 auto 4px auto;
      display: block;
    }

    .thermal-biz-name {
      font-size: 1.2em;
      font-weight: 700;
      text-transform: uppercase;
    }

    .thermal-divider {
      border: none;
      border-top: 1px dashed #000000;
      margin: 5px 0;
    }

    .thermal-meta-row,
    .thermal-total-row {
      display: flex;
      justify-content: space-between;
      gap: 6px;
      margin: 2px 0;
    }

    .thermal-item {
      margin: 4px 0;
    }

    .thermal-item-name {
      font-weight: 700;
      word-break: break-word;
    }

    .thermal-item-calc {
      display: flex;
      justify-content: space-between;
      font-size: 0.94em;
    }

    .thermal-grand-total {
      font-size: 1.15em;
      font-weight: 700;
      padding: 3px 0;
      border-top: 1px dashed #000000;
      border-bottom: 1px dashed #000000;
      margin: 4px 0;
    }

    .thermal-footer {
      text-align: center;
      margin-top: 8px;
      font-size: 0.9em;
    }
  `;
}
