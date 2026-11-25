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
 * Multi-Size Adaptive Quotation Template rendered inside `DocumentPaperCanvas`.
 * Mirrors `backend/src/modules/pdf-engine/templates/quotationTemplate.js` 1:1.
 * Supports A4, A5, LETTER, LEGAL, B5.
 */
export function QuotationDocumentTemplate({
  data = {},
  pageSize = 'A4',
  orientation = 'portrait',
  showAcceptanceSignature = true,
}) {
  const safeSize =
    String(pageSize || data.pageSize || 'A4').toUpperCase() === 'THERMAL_80'
      ? 'A4'
      : pageSize || data.pageSize || 'A4';

  const paper = useMemo(() => {
    try {
      return getPaperConfig(safeSize, orientation || data.orientation || 'portrait');
    } catch {
      return getPaperConfig('A4', 'portrait');
    }
  }, [safeSize, orientation, data.orientation]);

  const totals = useMemo(() => calculateDocumentTotals(data), [data]);

  const biz = data.businessSnapshot || {};
  const cust = data.customerSnapshot || {};
  const currency = data.currency || 'USD';
  const bizName = biz.businessName || biz.name || 'Your Business Name';
  const custName = cust.name || cust.customerName || cust.companyName || 'Client Name';
  const quotationNumber = data.quotationNumber || 'QUO-DRAFT';
  const status = data.status || 'draft';
  const isCompactA5 = paper.code === 'A5';
  const isLegal = paper.code === 'LEGAL';

  const bizAddressLines = formatAddressLines(biz.address);
  const custAddressLines = formatAddressLines(cust.billingAddress || cust.address);

  const defaultAcceptanceTerms =
    'This quotation is valid until the expiration date stated above. Signing below confirms formal acceptance of scope, pricing, delivery schedule, and commercial payment terms.';

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
            <div className="doc-type-heading">QUOTATION</div>
            <div>
              <span className="doc-number-badge">{quotationNumber}</span>
              <span className="status-pill">{status}</span>
            </div>
            <div className="doc-meta-grid">
              <span className="doc-meta-label">Issue Date:</span>
              <span className="doc-meta-value">{formatDate(data.issueDate)}</span>
              <span className="doc-meta-label">Valid Until:</span>
              <span className="doc-meta-value">{formatDate(data.validUntil)}</span>
              <span className="doc-meta-label">Currency:</span>
              <span className="doc-meta-value">{currency}</span>
            </div>
          </div>
        </header>

        <section className="billing-grid">
          <div>
            <div className="section-eyebrow">Prepared For</div>
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
            <div className="section-eyebrow">Commercial Terms</div>
            <div className="customer-details">
              <div>
                <strong>Quoted Total:</strong> {formatCurrency(totals.grandTotal, currency)}
              </div>
              {data.deliveryTerms ? (
                <div>
                  <strong>Delivery:</strong> {data.deliveryTerms}
                </div>
              ) : null}
              {data.paymentTerms ? (
                <div>
                  <strong>Payment:</strong> {data.paymentTerms}
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
            {data.deliveryTerms || data.paymentTerms ? (
              <div className="info-card terms-block">
                <div className="info-card-title">Delivery &amp; Payment Terms</div>
                {data.deliveryTerms ? (
                  <div>
                    <strong>Delivery:</strong> {data.deliveryTerms}
                  </div>
                ) : null}
                {data.paymentTerms ? (
                  <div>
                    <strong>Payment:</strong> {data.paymentTerms}
                  </div>
                ) : null}
              </div>
            ) : null}

            {data.notes ? (
              <div className="info-card terms-block">
                <div className="info-card-title">Additional Notes</div>
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
              <span>Estimated Tax</span>
              <span>{formatCurrency(totals.taxTotal, currency)}</span>
            </div>
            {totals.shippingOrAdjustment !== 0 ? (
              <div className="totals-row">
                <span>Shipping / Adjustment</span>
                <span>{formatCurrency(totals.shippingOrAdjustment, currency)}</span>
              </div>
            ) : null}
            <div className="totals-row grand-total">
              <span>Quoted Total</span>
              <span>{formatCurrency(totals.grandTotal, currency)}</span>
            </div>
          </div>
        </section>

        {isLegal ? (
          <section className="legal-terms-box terms-block">
            <div className="info-card-title">Terms, Conditions &amp; Scope of Proposal</div>
            <p>{data.acceptanceTerms || defaultAcceptanceTerms}</p>
          </section>
        ) : data.acceptanceTerms ? (
          <section className="info-card terms-block" style={{ marginTop: '8px' }}>
            <div className="info-card-title">Acceptance Terms</div>
            <div>{data.acceptanceTerms}</div>
          </section>
        ) : null}

        {showAcceptanceSignature ? (
          <section className="signature-block">
            <div>
              <div className="sig-box" />
              <div className="sig-caption">Prepared By ({bizName}) • Date</div>
            </div>
            <div>
              <div className="sig-box" />
              <div className="sig-caption">Client Acceptance Signature ({custName}) • Date</div>
            </div>
          </section>
        ) : null}
      </div>
    </>
  );
}

export default QuotationDocumentTemplate;
