import {
  getPaperConfig,
  isSizeSupportedForTool,
} from '../../../../../shared/constants/paperSizes.js';
import { calculateDocumentTotals } from '../../../../../shared/utils/financialMath.js';
import {
  escapeHtml,
  escapeHtmlMultiline,
  formatCurrencyHtml,
  formatDateHtml,
  formatEscapedAddress,
  sanitizeImageUrl,
} from '../../../utils/htmlSanitizer.js';
import { buildBasePaperStyles } from './basePaperStyles.js';

/**
 * Multi-Size Adaptive HTML Template for Quotations
 * Supports: A4, A5, LETTER, LEGAL, B5 (portrait & landscape).
 * Strictly rejects THERMAL_80.
 */

export function renderQuotationTemplate(payload = {}, paperConfig = {}, precomputedTotals = null) {
  const pageSize = String(
    paperConfig?.code || paperConfig?.pageSize || payload?.pageSize || 'A4'
  )
    .trim()
    .toUpperCase();
  const orientation = paperConfig?.orientation || payload?.orientation || 'portrait';
  const templateKey = paperConfig?.templateKey || payload?.templateKey || 'indigo';

  if (!isSizeSupportedForTool(pageSize, 'quotation')) {
    throw new Error(
      `Paper size "${pageSize}" is not supported for Quotation documents.`
    );
  }

  const paper = getPaperConfig(pageSize, orientation);
  const totals = precomputedTotals || calculateDocumentTotals(payload);
  const cssStyles = buildBasePaperStyles(paper, templateKey);

  const biz = payload.businessSnapshot || {};
  const cust = payload.customerSnapshot || {};
  const currency = payload.currency || 'USD';
  const logoUrl = sanitizeImageUrl(biz.logoUrl);

  const bizName = escapeHtml(biz.businessName || biz.name || 'Business Name');
  const custName = escapeHtml(cust.name || cust.customerName || cust.companyName || 'Client');
  const quotationNumber = escapeHtml(payload.quotationNumber || 'QUO-DRAFT');
  const status = escapeHtml(payload.status || 'draft');
  const isCompactA5 = paper.code === 'A5';
  const isLegal = paper.code === 'LEGAL';

  // 4-column table for A5; 6-column table for A4, LETTER, B5, LEGAL
  const tableHeaderHtml = isCompactA5
    ? `<tr>
         <th style="width: 44%;">Item</th>
         <th class="num" style="width: 22%;">Qty × Rate</th>
         <th class="num" style="width: 14%;">Tax</th>
         <th class="num" style="width: 20%;">Amount</th>
       </tr>`
    : `<tr>
         <th style="width: 34%;">Item &amp; Description</th>
         <th class="num" style="width: 10%;">Qty</th>
         <th class="num" style="width: 14%;">Rate</th>
         <th class="num" style="width: 14%;">Discount</th>
         <th class="num" style="width: 12%;">Tax</th>
         <th class="num" style="width: 16%;">Amount</th>
       </tr>`;

  const tableRowsHtml = totals.lineResults
    .map((item) => {
      const title = escapeHtml(item.name || 'Item');
      const desc = item.description
        ? `<div class="item-desc">${escapeHtmlMultiline(item.description)}</div>`
        : '';
      const unit = item.unit ? ` ${escapeHtml(item.unit)}` : '';
      const qtyStr = `${escapeHtml(item.quantity)}${unit}`;
      const rateStr = formatCurrencyHtml(item.unitPrice, currency);
      const discStr =
        item.discountAmount > 0
          ? `-${formatCurrencyHtml(item.discountAmount, currency)}`
          : '—';
      const taxStr =
        item.taxAmount > 0
          ? `${formatCurrencyHtml(item.taxAmount, currency)} (${escapeHtml(item.taxRate)}%)`
          : `${escapeHtml(item.taxRate)}%`;
      const amountStr = formatCurrencyHtml(item.lineTotal, currency);

      if (isCompactA5) {
        const mergedQtyRate = `${qtyStr} × ${rateStr}${
          item.discountAmount > 0 ? `<div class="item-desc">Disc: ${discStr}</div>` : ''
        }`;
        return `<tr>
          <td><div class="item-title">${title}</div>${desc}</td>
          <td class="num">${mergedQtyRate}</td>
          <td class="num">${formatCurrencyHtml(item.taxAmount, currency)}</td>
          <td class="num"><strong>${amountStr}</strong></td>
        </tr>`;
      }

      return `<tr>
        <td><div class="item-title">${title}</div>${desc}</td>
        <td class="num">${qtyStr}</td>
        <td class="num">${rateStr}</td>
        <td class="num">${discStr}</td>
        <td class="num">${taxStr}</td>
        <td class="num"><strong>${amountStr}</strong></td>
      </tr>`;
    })
    .join('');

  const defaultAcceptanceTerms =
    'This quotation is valid until the date stated above. To accept this quotation, please sign below and return a copy to authorize commencement of work under the stated delivery and payment terms.';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Quotation ${quotationNumber}</title>
  <style>${cssStyles}</style>
</head>
<body class="body-${paper.code}">
  <main class="paper-sheet size-${paper.code} layout-${paper.layoutVariant} orient-${paper.orientation}" data-size="${paper.code}" data-orientation="${paper.orientation}">
    <div>
      <!-- 2-Column Header -->
      <header class="doc-header">
        <div class="brand-block">
          ${logoUrl ? `<img class="brand-logo" src="${logoUrl}" alt="Business Logo" />` : ''}
          <div>
            <div class="business-name">${bizName}</div>
            <div class="business-meta">
              ${biz.taxRegistrationNo ? `<div>Tax Reg No: <strong>${escapeHtml(biz.taxRegistrationNo)}</strong></div>` : ''}
              ${biz.address ? `<div>${formatEscapedAddress(biz.address)}</div>` : ''}
              ${biz.email || biz.phone ? `<div>${[biz.email, biz.phone].filter(Boolean).map(escapeHtml).join(' • ')}</div>` : ''}
            </div>
          </div>
        </div>

        <div class="doc-title-block">
          <div class="doc-type-heading">QUOTATION</div>
          <div>
            <span class="doc-number-badge">${quotationNumber}</span>
            <span class="status-pill">${status}</span>
          </div>
          <div class="doc-meta-grid">
            <span class="doc-meta-label">Issue Date:</span>
            <span class="doc-meta-value">${formatDateHtml(payload.issueDate)}</span>
            <span class="doc-meta-label">Valid Until:</span>
            <span class="doc-meta-value">${formatDateHtml(payload.validUntil)}</span>
            <span class="doc-meta-label">Currency:</span>
            <span class="doc-meta-value">${escapeHtml(currency)}</span>
          </div>
        </div>
      </header>

      <!-- Prepared For & Commercial Terms Strip -->
      <section class="billing-grid">
        <div>
          <div class="section-eyebrow">Prepared For</div>
          <div class="customer-name">${custName}</div>
          <div class="customer-details">
            ${cust.companyName && cust.companyName !== cust.name ? `<div>${escapeHtml(cust.companyName)}</div>` : ''}
            ${cust.taxId ? `<div>Tax ID: ${escapeHtml(cust.taxId)}</div>` : ''}
            ${cust.billingAddress || cust.address ? `<div>${formatEscapedAddress(cust.billingAddress || cust.address)}</div>` : ''}
            ${cust.email || cust.phone ? `<div>${[cust.email, cust.phone].filter(Boolean).map(escapeHtml).join(' • ')}</div>` : ''}
          </div>
        </div>
        <div>
          <div class="section-eyebrow">Commercial Terms</div>
          <div class="customer-details">
            <div><strong>Quoted Total:</strong> ${formatCurrencyHtml(totals.grandTotal, currency)}</div>
            ${payload.deliveryTerms ? `<div><strong>Delivery:</strong> ${escapeHtmlMultiline(payload.deliveryTerms)}</div>` : ''}
            ${payload.paymentTerms ? `<div><strong>Payment:</strong> ${escapeHtmlMultiline(payload.paymentTerms)}</div>` : ''}
          </div>
        </div>
      </section>

      <!-- Adaptive Line Items Table -->
      <section class="items-section">
        <table class="items-table">
          <thead>${tableHeaderHtml}</thead>
          <tbody>${tableRowsHtml}</tbody>
        </table>
      </section>
    </div>

    <div>
      <!-- Adaptive Footer: Terms & Notes + Totals -->
      <section class="doc-footer-grid">
        <div>
          ${
            payload.deliveryTerms || payload.paymentTerms
              ? `<div class="info-card terms-block">
                   <div class="info-card-title">Delivery &amp; Payment Terms</div>
                   ${payload.deliveryTerms ? `<div><strong>Delivery Terms:</strong> ${escapeHtmlMultiline(payload.deliveryTerms)}</div>` : ''}
                   ${payload.paymentTerms ? `<div><strong>Payment Terms:</strong> ${escapeHtmlMultiline(payload.paymentTerms)}</div>` : ''}
                 </div>`
              : ''
          }
          ${
            payload.notes
              ? `<div class="info-card terms-block">
                   <div class="info-card-title">Additional Notes</div>
                   <div>${escapeHtmlMultiline(payload.notes)}</div>
                 </div>`
              : ''
          }
        </div>

        <div class="totals-block">
          <div class="totals-row">
            <span>Subtotal</span>
            <span>${formatCurrencyHtml(totals.subtotal, currency)}</span>
          </div>
          ${
            totals.itemDiscountTotal > 0
              ? `<div class="totals-row">
                   <span>Item Discounts</span>
                   <span>-${formatCurrencyHtml(totals.itemDiscountTotal, currency)}</span>
                 </div>`
              : ''
          }
          ${
            totals.globalDiscountAmount > 0
              ? `<div class="totals-row">
                   <span>Global Discount</span>
                   <span>-${formatCurrencyHtml(totals.globalDiscountAmount, currency)}</span>
                 </div>`
              : ''
          }
          <div class="totals-row">
            <span>Estimated Tax</span>
            <span>${formatCurrencyHtml(totals.taxTotal, currency)}</span>
          </div>
          ${
            totals.shippingOrAdjustment !== 0
              ? `<div class="totals-row">
                   <span>Shipping / Adjustment</span>
                   <span>${formatCurrencyHtml(totals.shippingOrAdjustment, currency)}</span>
                 </div>`
              : ''
          }
          <div class="totals-row grand-total">
            <span>Quoted Total</span>
            <span>${formatCurrencyHtml(totals.grandTotal, currency)}</span>
          </div>
        </div>
      </section>

      <!-- Dedicated Terms & Client Acceptance Signature Block (Extended on LEGAL) -->
      ${
        isLegal
          ? `<section class="legal-terms-box terms-block">
               <div class="info-card-title">Terms, Conditions &amp; Scope of Proposal</div>
               <p>${escapeHtmlMultiline(payload.acceptanceTerms || defaultAcceptanceTerms)}</p>
             </section>`
          : payload.acceptanceTerms
            ? `<section class="info-card terms-block" style="margin-top:8px;">
                 <div class="info-card-title">Acceptance Terms</div>
                 <div>${escapeHtmlMultiline(payload.acceptanceTerms)}</div>
               </section>`
            : ''
      }

      <section class="signature-block">
        <div>
          <div class="sig-box"></div>
          <div class="sig-caption">Prepared By (${bizName}) • Date</div>
        </div>
        <div>
          <div class="sig-box"></div>
          <div class="sig-caption">Client Acceptance Signature (${custName}) • Date</div>
        </div>
      </section>
    </div>
  </main>
</body>
</html>`;
}
