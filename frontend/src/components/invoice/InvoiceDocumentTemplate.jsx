import React, { useMemo } from 'react';
import { getPaperConfig } from '@shared/constants/paperSizes.js';
import { calculateDocumentTotals } from '@shared/utils/financialMath.js';

function formatCurrency(amount, currency = 'USD') {
  const num = Number(amount);
  const safe = Number.isFinite(num) ? num : 0;
  const code = String(currency || 'USD').trim().toUpperCase();
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: code,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(safe);
  } catch {
    return `${code} ${safe.toFixed(2)}`;
  }
}

function formatDate(val) {
  if (!val) return '—';
  if (val instanceof Date && !Number.isNaN(val.getTime())) {
    return val.toISOString().slice(0, 10);
  }
  const str = String(val).trim();
  if (!str) return '—';
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
  const parsed = new Date(str);
  return Number.isNaN(parsed.getTime()) ? str : parsed.toISOString().slice(0, 10);
}

function formatAddressLines(address) {
  if (!address) return [];
  if (typeof address === 'string') {
    return address
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (typeof address === 'object') {
    const line1 = address.street ? String(address.street).trim() : '';
    const line2 = [address.city, address.state, address.postalCode]
      .map((p) => (p ? String(p).trim() : ''))
      .filter(Boolean)
      .join(', ');
    const line3 = address.country ? String(address.country).trim() : '';
    return [line1, line2, line3].filter(Boolean);
  }
  return [];
}

/**
 * Multi-Size Adaptive Invoice Template rendered inside `DocumentPaperCanvas`.
 * Mirrors `backend/src/modules/pdf-engine/templates/invoiceTemplate.js` 1:1.
 */
export function InvoiceDocumentTemplate({
  data = {},
  pageSize = 'A4',
  orientation = 'portrait',
}) {
  const paper = useMemo(() => {
    try {
      return getPaperConfig(pageSize || data.pageSize || 'A4', orientation || data.orientation || 'portrait');
    } catch {
      return getPaperConfig('A4', 'portrait');
    }
  }, [pageSize, orientation, data.pageSize, data.orientation]);

  const totals = useMemo(() => calculateDocumentTotals(data), [data]);

  const biz = data.businessSnapshot || {};
  const cust = data.customerSnapshot || {};
  const bank = data.bankDetails || data.bankDetailsSnapshot || biz.bankDetails || {};
  const currency = data.currency || 'USD';
  const bizName = biz.businessName || biz.name || 'Your Business Name';
  const custName = cust.name || cust.customerName || cust.companyName || 'Customer Name';
  const invoiceNumber = data.invoiceNumber || 'INV-DRAFT';
  const status = data.status || 'draft';

  const bizAddressLines = formatAddressLines(biz.address);
  const custAddressLines = formatAddressLines(cust.billingAddress || cust.address);
  const hasBankDetails = Boolean(
    bank.bankName || bank.accountName || bank.accountNumber || bank.iban || bank.routingOrSwift
  );

  if (paper.code === 'THERMAL_80') {
    return (
      <div data-template="invoice-thermal-80">
        <header className="thermal-header">
          {biz.logoUrl ? (
            <img src={biz.logoUrl} alt="Business Logo" className="thermal-logo" />
          ) : null}
          <div className="thermal-biz-name">{bizName}</div>
          {biz.taxRegistrationNo ? <div>TAX ID: {biz.taxRegistrationNo}</div> : null}
          {bizAddressLines.map((line, idx) => (
            <div key={idx}>{line}</div>
          ))}
          {biz.phone ? <div>Tel: {biz.phone}</div> : null}
          {biz.email ? <div>{biz.email}</div> : null}
        </header>

        <hr className="thermal-divider" />

        <section>
          <div className="thermal-meta-row">
            <strong>INVOICE:</strong>
            <span>{invoiceNumber}</span>
          </div>
          <div className="thermal-meta-row">
            <span>STATUS:</span>
            <span>{String(status).toUpperCase()}</span>
          </div>
          <div className="thermal-meta-row">
            <span>DATE:</span>
            <span>{formatDate(data.issueDate)}</span>
          </div>
          {data.dueDate ? (
            <div className="thermal-meta-row">
              <span>DUE:</span>
              <span>{formatDate(data.dueDate)}</span>
            </div>
          ) : null}
          <div className="thermal-meta-row">
            <span>CUSTOMER:</span>
            <span>{custName}</span>
          </div>
        </section>

        <hr className="thermal-divider" />

        <section>
          {totals.lineResults.map((item, idx) => (
            <div key={idx} className="thermal-item">
              <div className="thermal-item-name">{item.name || `Item ${idx + 1}`}</div>
              <div className="thermal-item-calc">
                <span>
                  {item.quantity} x {formatCurrency(item.unitPrice, currency)}
                </span>
                <span>{formatCurrency(item.lineTotal, currency)}</span>
              </div>
            </div>
          ))}
        </section>

        <hr className="thermal-divider" />

        <section className="totals-block" style={{ border: 'none' }}>
          <div className="thermal-total-row">
            <span>SUBTOTAL:</span>
            <span>{formatCurrency(totals.subtotal, currency)}</span>
          </div>
          {totals.itemDiscountTotal > 0 ? (
            <div className="thermal-total-row">
              <span>ITEM DISC:</span>
              <span>-{formatCurrency(totals.itemDiscountTotal, currency)}</span>
            </div>
          ) : null}
          {totals.globalDiscountAmount > 0 ? (
            <div className="thermal-total-row">
              <span>DISCOUNT:</span>
              <span>-{formatCurrency(totals.globalDiscountAmount, currency)}</span>
            </div>
          ) : null}
          <div className="thermal-total-row">
            <span>TAX:</span>
            <span>{formatCurrency(totals.taxTotal, currency)}</span>
          </div>
          <div className="thermal-total-row thermal-grand-total">
            <span>TOTAL:</span>
            <span>{formatCurrency(totals.grandTotal, currency)}</span>
          </div>
          <div className="thermal-total-row">
            <span>PAID:</span>
            <span>{formatCurrency(totals.amountPaid, currency)}</span>
          </div>
          <div className="thermal-total-row">
            <strong>BALANCE DUE:</strong>
            <strong>{formatCurrency(totals.balanceDue, currency)}</strong>
          </div>
        </section>

        {hasBankDetails ? (
          <>
            <hr className="thermal-divider" />
            <div className="thermal-footer">
              <div>
                <strong>PAYMENT DETAILS</strong>
              </div>
              {bank.bankName ? <div>{bank.bankName}</div> : null}
              {bank.accountNumber ? <div>Acct: {bank.accountNumber}</div> : null}
            </div>
          </>
        ) : null}

        {data.notes ? (
          <>
            <hr className="thermal-divider" />
            <div className="thermal-footer">{data.notes}</div>
          </>
        ) : null}

        <div className="thermal-footer">*** THANK YOU FOR YOUR BUSINESS ***</div>
      </div>
    );
  }

  const isCompactA5 = paper.code === 'A5';
  const isLegal = paper.code === 'LEGAL';

  return (
    <>
      <div>
        <header className="doc-header">
          <div className="brand-block">
            {biz.logoUrl ? (
              <img src={biz.logoUrl} alt="Business Logo" className="brand-logo" />
            ) : null}
            <div>
              <div className="business-name">{bizName}</div>
              <div className="business-meta">
                {biz.taxRegistrationNo ? (
                  <div>
                    Tax Reg No: <strong>{biz.taxRegistrationNo}</strong>
                  </div>
                ) : null}
                {bizAddressLines.map((line, i) => (
                  <div key={i}>{line}</div>
                ))}
                {biz.email || biz.phone ? (
                  <div>{[biz.email, biz.phone].filter(Boolean).join(' • ')}</div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="doc-title-block">
            <div className="doc-type-heading">INVOICE</div>
            <div>
              <span className="doc-number-badge">{invoiceNumber}</span>
              <span className="status-pill">{status}</span>
            </div>
            <div className="doc-meta-grid">
              <span className="doc-meta-label">Issue Date:</span>
              <span className="doc-meta-value">{formatDate(data.issueDate)}</span>
              <span className="doc-meta-label">Due Date:</span>
              <span className="doc-meta-value">{formatDate(data.dueDate)}</span>
              <span className="doc-meta-label">Currency:</span>
              <span className="doc-meta-value">{currency}</span>
            </div>
          </div>
        </header>

        <section className="billing-grid">
          <div>
            <div className="section-eyebrow">Billed To</div>
            <div className="customer-name">{custName}</div>
            <div className="customer-details">
              {cust.companyName && cust.companyName !== cust.name ? (
                <div>{cust.companyName}</div>
              ) : null}
              {cust.taxId ? <div>Tax ID: {cust.taxId}</div> : null}
              {custAddressLines.map((line, i) => (
                <div key={i}>{line}</div>
              ))}
              {cust.email || cust.phone ? (
                <div>{[cust.email, cust.phone].filter(Boolean).join(' • ')}</div>
              ) : null}
            </div>
          </div>
          <div>
            <div className="section-eyebrow">Payment Summary</div>
            <div className="customer-details">
              <div>
                <strong>Balance Due:</strong> {formatCurrency(totals.balanceDue, currency)}
              </div>
              {data.paymentTerms ? (
                <div>
                  <strong>Terms:</strong> {data.paymentTerms}
                </div>
              ) : null}
              {data.sourceQuotationRef ? (
                <div>
                  <strong>Source Quote:</strong> {data.sourceQuotationRef}
                </div>
              ) : null}
            </div>
          </div>
        </section>

        <section className="items-section">
          <table className="items-table" data-columns={isCompactA5 ? 4 : 6}>
            <thead>
              {isCompactA5 ? (
                <tr>
                  <th style={{ width: '44%' }}>Item</th>
                  <th className="num" style={{ width: '22%' }}>
                    Qty × Rate
                  </th>
                  <th className="num" style={{ width: '14%' }}>
                    Tax
                  </th>
                  <th className="num" style={{ width: '20%' }}>
                    Amount
                  </th>
                </tr>
              ) : (
                <tr>
                  <th style={{ width: '34%' }}>Item &amp; Description</th>
                  <th className="num" style={{ width: '10%' }}>
                    Qty
                  </th>
                  <th className="num" style={{ width: '14%' }}>
                    Rate
                  </th>
                  <th className="num" style={{ width: '14%' }}>
                    Discount
                  </th>
                  <th className="num" style={{ width: '12%' }}>
                    Tax
                  </th>
                  <th className="num" style={{ width: '16%' }}>
                    Amount
                  </th>
                </tr>
              )}
            </thead>
            <tbody>
              {totals.lineResults.map((item, idx) => {
                const qtyStr = `${item.quantity}${item.unit ? ` ${item.unit}` : ''}`;
                const rateStr = formatCurrency(item.unitPrice, currency);
                const discStr =
                  item.discountAmount > 0
                    ? `-${formatCurrency(item.discountAmount, currency)}`
                    : '—';

                if (isCompactA5) {
                  return (
                    <tr key={idx}>
                      <td>
                        <div className="item-title">{item.name || `Item ${idx + 1}`}</div>
                        {item.description ? (
                          <div className="item-desc">{item.description}</div>
                        ) : null}
                      </td>
                      <td className="num">
                        <div>
                          {qtyStr} × {rateStr}
                        </div>
                        {item.discountAmount > 0 ? (
                          <div className="item-desc">Disc: {discStr}</div>
                        ) : null}
                      </td>
                      <td className="num">{formatCurrency(item.taxAmount, currency)}</td>
                      <td className="num">
                        <strong>{formatCurrency(item.lineTotal, currency)}</strong>
                      </td>
                    </tr>
                  );
                }

                return (
                  <tr key={idx}>
                    <td>
                      <div className="item-title">{item.name || `Item ${idx + 1}`}</div>
                      {item.description ? (
                        <div className="item-desc">{item.description}</div>
                      ) : null}
                    </td>
                    <td className="num">{qtyStr}</td>
                    <td className="num">{rateStr}</td>
                    <td className="num">{discStr}</td>
                    <td className="num">
                      {item.taxAmount > 0
                        ? `${formatCurrency(item.taxAmount, currency)} (${item.taxRate}%)`
                        : `${item.taxRate}%`}
                    </td>
                    <td className="num">
                      <strong>{formatCurrency(item.lineTotal, currency)}</strong>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      </div>

      <div>
        <section className="doc-footer-grid">
          <div>
            {hasBankDetails ? (
              <div className="info-card bank-block">
                <div className="info-card-title">Bank &amp; Remittance Details</div>
                <div className="bank-grid">
                  {bank.bankName ? (
                    <>
                      <span className="bank-label">Bank:</span>
                      <span className="bank-val">{bank.bankName}</span>
                    </>
                  ) : null}
                  {bank.accountName ? (
                    <>
                      <span className="bank-label">Account Name:</span>
                      <span className="bank-val">{bank.accountName}</span>
                    </>
                  ) : null}
                  {bank.accountNumber ? (
                    <>
                      <span className="bank-label">Account No:</span>
                      <span className="bank-val">{bank.accountNumber}</span>
                    </>
                  ) : null}
                  {bank.routingOrSwift ? (
                    <>
                      <span className="bank-label">SWIFT / Routing:</span>
                      <span className="bank-val">{bank.routingOrSwift}</span>
                    </>
                  ) : null}
                  {bank.iban ? (
                    <>
                      <span className="bank-label">IBAN:</span>
                      <span className="bank-val">{bank.iban}</span>
                    </>
                  ) : null}
                </div>
              </div>
            ) : null}

            {data.notes ? (
              <div className="info-card terms-block">
                <div className="info-card-title">Notes &amp; Instructions</div>
                <div style={{ whiteSpace: 'pre-line' }}>{data.notes}</div>
              </div>
            ) : null}
          </div>

          <div className="totals-block">
            <div className="totals-row">
              <span>Subtotal</span>
              <span>{formatCurrency(totals.subtotal, currency)}</span>
            </div>
            {totals.itemDiscountTotal > 0 ? (
              <div className="totals-row">
                <span>Item Discounts</span>
                <span>-{formatCurrency(totals.itemDiscountTotal, currency)}</span>
              </div>
            ) : null}
            {totals.globalDiscountAmount > 0 ? (
              <div className="totals-row">
                <span>Global Discount</span>
                <span>-{formatCurrency(totals.globalDiscountAmount, currency)}</span>
              </div>
            ) : null}
            <div className="totals-row">
              <span>Tax Total</span>
              <span>{formatCurrency(totals.taxTotal, currency)}</span>
            </div>
            {totals.shippingOrAdjustment !== 0 ? (
              <div className="totals-row">
                <span>Shipping / Adjustment</span>
                <span>{formatCurrency(totals.shippingOrAdjustment, currency)}</span>
              </div>
            ) : null}
            <div className="totals-row grand-total">
              <span>Grand Total</span>
              <span>{formatCurrency(totals.grandTotal, currency)}</span>
            </div>
            <div className="totals-row">
              <span>Amount Paid</span>
              <span>{formatCurrency(totals.amountPaid, currency)}</span>
            </div>
            <div className="totals-row sub-balance">
              <span>Balance Due</span>
              <span>{formatCurrency(totals.balanceDue, currency)}</span>
            </div>
          </div>
        </section>

        {isLegal ? (
          <>
            <section className="legal-terms-box terms-block">
              <div className="info-card-title">Terms &amp; Conditions</div>
              <p>
                {data.paymentTerms ||
                  'Payment is due on or before the stated due date. Deliverables remain property of the issuer until full settlement.'}
              </p>
            </section>
            <section className="signature-block">
              <div>
                <div className="sig-box" />
                <div className="sig-caption">Authorized Signatory ({bizName})</div>
              </div>
              <div>
                <div className="sig-box" />
                <div className="sig-caption">Customer Acknowledgement ({custName})</div>
              </div>
            </section>
          </>
        ) : null}
      </div>
    </>
  );
}

export default InvoiceDocumentTemplate;
