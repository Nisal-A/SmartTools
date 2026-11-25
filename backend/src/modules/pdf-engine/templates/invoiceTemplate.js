import { getPaperConfig } from '../../../../../shared/constants/paperSizes.js';
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
 * Multi-Size Adaptive HTML Template for Invoices
 * Supports: A4, A5, LETTER, LEGAL, B5 (portrait & landscape) + THERMAL_80 continuous POS receipt.
 */

function renderThermal80Invoice(payload, paper, totals, cssStyles) {
  const biz = payload.businessSnapshot || {};
  const cust = payload.customerSnapshot || {};
  const bank = payload.bankDetails || biz.bankDetails || {};
  const currency = payload.currency || 'USD';
  const logoUrl = sanitizeImageUrl(biz.logoUrl);

  const bizName = escapeHtml(biz.businessName || biz.name || 'Business');
  const custName = escapeHtml(cust.name || cust.customerName || cust.companyName || 'Walk-in Customer');
  const invoiceNumber = escapeHtml(payload.invoiceNumber || 'INV-DRAFT');
  const status = escapeHtml(String(payload.status || 'draft').toUpperCase());

  const itemsHtml = totals.lineResults
    .map((item) => {
      const name = escapeHtml(item.name || 'Item');
      const qty = escapeHtml(item.quantity);
      const unitPrice = formatCurrencyHtml(item.unitPrice, currency);
      const lineTotal = formatCurrencyHtml(item.lineTotal, currency);

      const extras = [];
      if (item.discountAmount > 0) {
        extras.push(`-${formatCurrencyHtml(item.discountAmount, currency)} disc`);
      }
      if (item.taxAmount > 0) {
        extras.push(`+${formatCurrencyHtml(item.taxAmount, currency)} tax`);
      }

      return `
        <div class="thermal-item">
          <div class="thermal-item-name">${name}</div>
          <div class="thermal-item-calc">
            <span>${qty} x ${unitPrice}${extras.length ? ` (${extras.join(', ')})` : ''}</span>
            <span>${lineTotal}</span>
          </div>
        </div>
      `;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Invoice ${invoiceNumber}</title>
  <style>${cssStyles}</style>
</head>
<body class="body-THERMAL_80">
  <main class="paper-sheet size-THERMAL_80 layout-thermal" data-size="THERMAL_80">
    <header class="thermal-header">
      ${logoUrl ? `<img class="thermal-logo" src="${logoUrl}" alt="Logo" />` : ''}
      <div class="thermal-biz-name">${bizName}</div>
      ${biz.taxRegistrationNo ? `<div>TAX ID: ${escapeHtml(biz.taxRegistrationNo)}</div>` : ''}
      ${biz.address ? `<div>${formatEscapedAddress(biz.address)}</div>` : ''}
      ${biz.phone ? `<div>Tel: ${escapeHtml(biz.phone)}</div>` : ''}
      ${biz.email ? `<div>${escapeHtml(biz.email)}</div>` : ''}
    </header>

    <hr class="thermal-divider" />

    <section>
      <div class="thermal-meta-row"><strong>INVOICE:</strong><span>${invoiceNumber}</span></div>
      <div class="thermal-meta-row"><span>STATUS:</span><span>${status}</span></div>
      <div class="thermal-meta-row"><span>DATE:</span><span>${formatDateHtml(payload.issueDate)}</span></div>
      ${payload.dueDate ? `<div class="thermal-meta-row"><span>DUE:</span><span>${formatDateHtml(payload.dueDate)}</span></div>` : ''}
      <div class="thermal-meta-row"><span>CUSTOMER:</span><span>${custName}</span></div>
      ${cust.taxId ? `<div class="thermal-meta-row"><span>CUST TAX ID:</span><span>${escapeHtml(cust.taxId)}</span></div>` : ''}
    </section>

    <hr class="thermal-divider" />

    <section>
      ${itemsHtml}
    </section>

    <hr class="thermal-divider" />

    <section class="totals-block" style="border:none;">
      <div class="thermal-total-row">
        <span>SUBTOTAL:</span>
        <span>${formatCurrencyHtml(totals.subtotal, currency)}</span>
      </div>
      ${
        totals.itemDiscountTotal > 0
          ? `<div class="thermal-total-row"><span>ITEM DISCOUNT:</span><span>-${formatCurrencyHtml(totals.itemDiscountTotal, currency)}</span></div>`
          : ''
      }
      ${
        totals.globalDiscountAmount > 0
          ? `<div class="thermal-total-row"><span>DISCOUNT:</span><span>-${formatCurrencyHtml(totals.globalDiscountAmount, currency)}</span></div>`
          : ''
      }
      <div class="thermal-total-row">
        <span>TAX:</span>
        <span>${formatCurrencyHtml(totals.taxTotal, currency)}</span>
      </div>
      ${
        totals.shippingOrAdjustment !== 0
          ? `<div class="thermal-total-row"><span>ADJUSTMENT:</span><span>${formatCurrencyHtml(totals.shippingOrAdjustment, currency)}</span></div>`
          : ''
      }
      <div class="thermal-total-row thermal-grand-total">
        <span>TOTAL:</span>
        <span>${formatCurrencyHtml(totals.grandTotal, currency)}</span>
      </div>
      <div class="thermal-total-row">
        <span>PAID:</span>
        <span>${formatCurrencyHtml(totals.amountPaid, currency)}</span>
      </div>
      <div class="thermal-total-row">
        <strong>BALANCE DUE:</strong>
        <strong>${formatCurrencyHtml(totals.balanceDue, currency)}</strong>
      </div>
    </section>

    ${
      bank.bankName || bank.accountNumber
        ? `<hr class="thermal-divider" />
           <div class="thermal-footer">
             <div><strong>PAYMENT DETAILS</strong></div>
             ${bank.bankName ? `<div>${escapeHtml(bank.bankName)}</div>` : ''}
             ${bank.accountName ? `<div>Acct: ${escapeHtml(bank.accountName)}</div>` : ''}
             ${bank.accountNumber ? `<div>No: ${escapeHtml(bank.accountNumber)}</div>` : ''}
           </div>`
        : ''
    }

    ${
      payload.notes || payload.paymentTerms
        ? `<hr class="thermal-divider" />
           <div class="thermal-footer">
             ${payload.paymentTerms ? `<div>${escapeHtmlMultiline(payload.paymentTerms)}</div>` : ''}
             ${payload.notes ? `<div>${escapeHtmlMultiline(payload.notes)}</div>` : ''}
           </div>`
        : ''
    }

    <div class="thermal-footer">
      <div>*** THANK YOU FOR YOUR BUSINESS ***</div>
    </div>
  </main>
</body>
</html>`;
}

/**
 * Renders an Invoice HTML document adapted to the target paper size and orientation.
 *
 * @param {object} payload - Validated invoice payload
 * @param {object} [paperConfig] - Resolved paper config or `{ pageSize, orientation, templateKey }`
 * @param {object} [precomputedTotals] - Optional output from `calculateDocumentTotals`
 * @returns {string} Complete HTML document string
 */
export function renderInvoiceTemplate(payload = {}, paperConfig = {}, precomputedTotals = null) {
  const pageSize = paperConfig?.code || paperConfig?.pageSize || payload?.pageSize || 'A4';
  const orientation = paperConfig?.orientation || payload?.orientation || 'portrait';
  const templateKey = paperConfig?.templateKey || payload?.templateKey || 'indigo';

  const paper = getPaperConfig(pageSize, orientation);
  const totals = precomputedTotals || calculateDocumentTotals(payload);
  const cssStyles = buildBasePaperStyles(paper, templateKey);

  if (paper.code === 'THERMAL_80') {
    return renderThermal80Invoice(payload, paper, totals, cssStyles);
  }

  const biz = payload.businessSnapshot || {};
  const cust = payload.customerSnapshot || {};
  const bank = payload.bankDetails || biz.bankDetails || {};
  const currency = payload.currency || 'USD';
  const logoUrl = sanitizeImageUrl(biz.logoUrl);

  const bizName = escapeHtml(biz.businessName || biz.name || 'Business Name');
  const custName = escapeHtml(cust.name || cust.customerName || cust.companyName || 'Customer');
  const invoiceNumber = escapeHtml(payload.invoiceNumber || 'INV-DRAFT');
  const status = escapeHtml(payload.status || 'draft');
  const isCompactA5 = paper.code === 'A5';
  const isLegal = paper.code === 'LEGAL';

  // Table Head: 4 columns for A5 compact, 6 columns for A4 / LETTER / B5 / LEGAL
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
      const desc = item.description ? `<div class="item-desc">${escapeHtmlMultiline(item.description)}</div>` : '';
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

  const hasBankDetails = Boolean(
    bank.bankName || bank.accountName || bank.accountNumber || bank.iban || bank.routingOrSwift
  );

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Invoice ${invoiceNumber}</title>
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
          <div class="doc-type-heading">INVOICE</div>
          <div>
            <span class="doc-number-badge">${invoiceNumber}</span>
            <span class="status-pill">${status}</span>
          </div>
          <div class="doc-meta-grid">
            <span class="doc-meta-label">Issue Date:</span>
            <span class="doc-meta-value">${formatDateHtml(payload.issueDate)}</span>
            <span class="doc-meta-label">Due Date:</span>
            <span class="doc-meta-value">${formatDateHtml(payload.dueDate)}</span>
            <span class="doc-meta-label">Currency:</span>
            <span class="doc-meta-value">${escapeHtml(currency)}</span>
          </div>
        </div>
      </header>

      <!-- Customer & Payment Terms Strip -->
      <section class="billing-grid">
        <div>
          <div class="section-eyebrow">Billed To</div>
          <div class="customer-name">${custName}</div>
          <div class="customer-details">
            ${cust.companyName && cust.companyName !== cust.name ? `<div>${escapeHtml(cust.companyName)}</div>` : ''}
            ${cust.taxId ? `<div>Tax ID: ${escapeHtml(cust.taxId)}</div>` : ''}
            ${cust.billingAddress || cust.address ? `<div>${formatEscapedAddress(cust.billingAddress || cust.address)}</div>` : ''}
            ${cust.email || cust.phone ? `<div>${[cust.email, cust.phone].filter(Boolean).map(escapeHtml).join(' • ')}</div>` : ''}
          </div>
        </div>
        <div>
          <div class="section-eyebrow">Payment Summary</div>
          <div class="customer-details">
            <div><strong>Balance Due:</strong> ${formatCurrencyHtml(totals.balanceDue, currency)}</div>
            ${payload.paymentTerms ? `<div><strong>Terms:</strong> ${escapeHtmlMultiline(payload.paymentTerms)}</div>` : ''}
            ${payload.sourceQuotationId ? `<div><strong>Ref Quote:</strong> ${escapeHtml(payload.sourceQuotationId)}</div>` : ''}
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
      <!-- Adaptive Footer: Bank Details & Notes + Financial Totals -->
      <section class="doc-footer-grid">
        <div>
          ${
            hasBankDetails
              ? `<div class="info-card bank-block">
                   <div class="info-card-title">Bank &amp; Remittance Details</div>
                   <div class="bank-grid">
                     ${bank.bankName ? `<span class="bank-label">Bank:</span><span class="bank-val">${escapeHtml(bank.bankName)}</span>` : ''}
                     ${bank.accountName ? `<span class="bank-label">Account Name:</span><span class="bank-val">${escapeHtml(bank.accountName)}</span>` : ''}
                     ${bank.accountNumber ? `<span class="bank-label">Account No:</span><span class="bank-val">${escapeHtml(bank.accountNumber)}</span>` : ''}
                     ${bank.routingOrSwift ? `<span class="bank-label">SWIFT / Routing:</span><span class="bank-val">${escapeHtml(bank.routingOrSwift)}</span>` : ''}
                     ${bank.iban ? `<span class="bank-label">IBAN:</span><span class="bank-val">${escapeHtml(bank.iban)}</span>` : ''}
                   </div>
                   ${bank.instructions ? `<div style="margin-top:4px;">${escapeHtmlMultiline(bank.instructions)}</div>` : ''}
                 </div>`
              : ''
          }
          ${
            payload.notes
              ? `<div class="info-card terms-block">
                   <div class="info-card-title">Notes &amp; Instructions</div>
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
            <span>Tax Total</span>
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
            <span>Grand Total</span>
            <span>${formatCurrencyHtml(totals.grandTotal, currency)}</span>
          </div>
          <div class="totals-row">
            <span>Amount Paid</span>
            <span>${formatCurrencyHtml(totals.amountPaid, currency)}</span>
          </div>
          <div class="totals-row sub-balance">
            <span>Balance Due</span>
            <span>${formatCurrencyHtml(totals.balanceDue, currency)}</span>
          </div>
        </div>
      </section>

      ${
        isLegal
          ? `<section class="legal-terms-box terms-block">
               <div class="info-card-title">Terms &amp; Conditions</div>
               <p>${
                 payload.paymentTerms
                   ? escapeHtmlMultiline(payload.paymentTerms)
                   : 'Payment is due by the specified Due Date. Late payments may be subject to applicable statutory interest charges. Goods and deliverables remain the property of the issuer until settled in full.'
               }</p>
             </section>
             <section class="signature-block">
               <div>
                 <div class="sig-box"></div>
                 <div class="sig-caption">Authorized Signatory (${bizName})</div>
               </div>
               <div>
                 <div class="sig-box"></div>
                 <div class="sig-caption">Customer Acknowledgement (${custName})</div>
               </div>
             </section>`
          : ''
      }
    </div>
  </main>
</body>
</html>`;
}
