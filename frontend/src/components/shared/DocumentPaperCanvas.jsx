import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Maximize2, ZoomIn, ZoomOut } from 'lucide-react';
import {
  TEMPLATE_THEMES,
  getPaperConfig,
} from '@shared/constants/paperSizes.js';
import { calculateDocumentTotals } from '@shared/utils/financialMath.js';
import './DocumentPaperPreviewStyles.css';

const MM_TO_PX = 96 / 25.4;

const ZOOM_OPTIONS = [
  { id: 'fit', label: 'Fit' },
  { id: '0.75', label: '75%' },
  { id: '1', label: '100%' },
  { id: '1.25', label: '125%' },
];

function formatCurrency(amount, currency = 'USD') {
  const num = Number(amount);
  const safeNum = Number.isFinite(num) ? num : 0;
  const code = String(currency || 'USD').trim().toUpperCase();
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: code,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(safeNum);
  } catch {
    return `${code} ${safeNum.toFixed(2)}`;
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
  const d = new Date(str);
  return Number.isNaN(d.getTime()) ? str : d.toISOString().slice(0, 10);
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
 * Multi-Size Adaptive Document Preview Canvas
 *
 * - Uses `ResizeObserver` on the preview pane to scale exact physical millimeter
 *   dimensions smoothly into the viewport without clipping.
 * - Renders true layout adaptations for A4, A5, LETTER, LEGAL, B5, and THERMAL_80
 *   matching backend Puppeteer HTML templates 1:1.
 * - Dynamically injects `@page { size: ...; margin: 0; }` for clean browser printing.
 */
export function DocumentPaperCanvas({
  documentType = 'invoice',
  documentData = {},
  pageSize,
  orientation,
  templateKey,
  children,
  className = '',
}) {
  const containerRef = useRef(null);
  const sheetRef = useRef(null);

  const [zoomMode, setZoomMode] = useState('fit');
  const [containerWidth, setContainerWidth] = useState(640);
  const [measuredSheetHeightPx, setMeasuredSheetHeightPx] = useState(1123);

  const effectiveSizeCode =
    pageSize || documentData?.paperConfig?.pageSize || documentData?.pageSize || 'A4';
  const effectiveOrientation =
    orientation ||
    documentData?.paperConfig?.orientation ||
    documentData?.orientation ||
    'portrait';
  const effectiveTemplateKey =
    templateKey ||
    documentData?.paperConfig?.templateKey ||
    documentData?.templateKey ||
    'indigo';

  const paper = useMemo(() => {
    try {
      return getPaperConfig(effectiveSizeCode, effectiveOrientation);
    } catch {
      return getPaperConfig('A4', 'portrait');
    }
  }, [effectiveSizeCode, effectiveOrientation]);

  const theme = TEMPLATE_THEMES[effectiveTemplateKey] || TEMPLATE_THEMES.indigo;

  const totals = useMemo(
    () => calculateDocumentTotals(documentData || {}),
    [documentData]
  );

  // Inject dynamic `@page` size rule so `window.print()` prints at exact paper dimensions
  useEffect(() => {
    const styleId = 'smarttools-dynamic-print-page';
    let styleEl = document.getElementById(styleId);
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = styleId;
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = `@media print { @page { size: ${paper.pageCssSize}; margin: 0; } }`;
  }, [paper.pageCssSize]);

  // Observe preview container width & rendered sheet height via ResizeObserver
  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') return undefined;

    const containerEl = containerRef.current;
    const sheetEl = sheetRef.current;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === containerEl) {
          setContainerWidth(entry.contentRect.width);
        } else if (entry.target === sheetEl) {
          setMeasuredSheetHeightPx(
            Math.max(entry.contentRect.height, sheetEl.scrollHeight || 0)
          );
        }
      }
    });

    if (containerEl) observer.observe(containerEl);
    if (sheetEl) observer.observe(sheetEl);

    return () => observer.disconnect();
  }, [paper.code, paper.orientation]);

  const physicalWidthPx = paper.widthMm * MM_TO_PX;
  const physicalHeightPx =
    paper.heightMm !== null
      ? Math.max(paper.heightMm * MM_TO_PX, measuredSheetHeightPx)
      : Math.max(300, measuredSheetHeightPx);

  const scale = useMemo(() => {
    if (zoomMode !== 'fit') {
      return Number(zoomMode) || 1;
    }
    const availableWidth = Math.max(240, containerWidth - 48);
    if (paper.continuousRoll) {
      return Number(Math.min(1.15, Math.max(0.5, availableWidth / physicalWidthPx)).toFixed(4));
    }
    return Number(Math.min(1, Math.max(0.25, availableWidth / physicalWidthPx)).toFixed(4));
  }, [zoomMode, containerWidth, physicalWidthPx, paper.continuousRoll]);

  const sheetCssVars = {
    '--paper-width': `${paper.widthMm}mm`,
    '--paper-height': paper.heightMm !== null ? `${paper.heightMm}mm` : 'auto',
    '--paper-margin': `${paper.marginMm}mm`,
    '--base-font-pt': `${paper.baseFontPt}pt`,
    '--accent-primary': theme.primaryHex,
    '--accent-secondary': theme.secondaryHex,
    '--accent-bg': theme.accentBgHex,
    '--accent-border': theme.borderHex,
    '--accent-text': theme.textHex,
  };

  const isQuotation = String(documentType).toLowerCase() === 'quotation';
  const isThermal = paper.code === 'THERMAL_80' && !isQuotation;
  const isCompactA5 = paper.code === 'A5';
  const isLegal = paper.code === 'LEGAL';

  const biz = documentData?.businessSnapshot || {};
  const cust = documentData?.customerSnapshot || {};
  const bank = documentData?.bankDetails || biz?.bankDetails || {};
  const currency = documentData?.currency || 'USD';
  const bizName = biz.businessName || biz.name || 'Your Business Name';
  const custName = cust.name || cust.customerName || cust.companyName || 'Client / Customer Name';
  const docNumber = isQuotation
    ? documentData?.quotationNumber || 'QUO-DRAFT'
    : documentData?.invoiceNumber || 'INV-DRAFT';
  const status = documentData?.status || 'draft';

  const bizAddressLines = formatAddressLines(biz.address);
  const custAddressLines = formatAddressLines(cust.billingAddress || cust.address);
  const hasBankDetails = Boolean(
    bank.bankName || bank.accountName || bank.accountNumber || bank.iban || bank.routingOrSwift
  );

  const dimensionPillText = paper.continuousRoll
    ? `${paper.code} · ${paper.widthMm} mm × Auto Roll · ${paper.marginMm}mm margin`
    : `${paper.code} · ${paper.widthMm} × ${paper.heightMm} mm · ${
        paper.orientation.charAt(0).toUpperCase() + paper.orientation.slice(1)
      } · ${paper.marginMm}mm margin`;

  return (
    <div
      className={`flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-slate-100 shadow-sm ${className}`}
      data-testid="document-paper-canvas"
    >
      {/* Zoom & Dimension Pill Toolbar */}
      <div className="no-print flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span
            className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700"
            data-testid="paper-dimension-pill"
          >
            <Maximize2 className="h-3 w-3" />
            {dimensionPillText}
          </span>
          <span className="hidden text-xs font-medium text-slate-500 sm:inline">
            {Math.round(scale * 100)}% zoom
          </span>
        </div>

        <div className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
          <ZoomOut className="ml-1 h-3.5 w-3.5 text-slate-400" />
          {ZOOM_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setZoomMode(opt.id)}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                zoomMode === opt.id
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-white hover:text-slate-900'
              }`}
            >
              {opt.label}
            </button>
          ))}
          <ZoomIn className="mr-1 h-3.5 w-3.5 text-slate-400" />
        </div>
      </div>

      {/* Responsive Preview Stage */}
      <div
        ref={containerRef}
        className="smarttools-preview-stage smarttools-printable-root flex min-h-[520px] flex-1 justify-center p-6"
      >
        <div
          className="smarttools-scale-wrapper relative flex-shrink-0"
          style={{
            width: `${Math.ceil(physicalWidthPx * scale)}px`,
            height: `${Math.ceil(physicalHeightPx * scale)}px`,
          }}
        >
          <div
            style={{
              width: `${physicalWidthPx}px`,
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
            }}
          >
            <article
              ref={sheetRef}
              className={`smarttools-paper-sheet size-${paper.code} layout-${paper.layoutVariant}`}
              data-paper={paper.code}
              data-orientation={paper.orientation}
              data-layout={paper.layoutVariant}
              data-columns={paper.tableColumns}
              style={sheetCssVars}
            >
              {children ? (
                children
              ) : isThermal ? (
                /* THERMAL_80 Single-Column POS Receipt Layout */
                <div>
                  <header className="thermal-header">
                    {biz.logoUrl ? (
                      <img src={biz.logoUrl} alt="Business Logo" className="thermal-logo" />
                    ) : null}
                    <div className="thermal-biz-name">{bizName}</div>
                    {biz.taxRegistrationNo ? <div>TAX ID: {biz.taxRegistrationNo}</div> : null}
                    {bizAddressLines.map((line, i) => (
                      <div key={i}>{line}</div>
                    ))}
                    {biz.phone ? <div>Tel: {biz.phone}</div> : null}
                    {biz.email ? <div>{biz.email}</div> : null}
                  </header>

                  <hr className="thermal-divider" />

                  <section>
                    <div className="thermal-meta-row">
                      <strong>INVOICE:</strong>
                      <span>{docNumber}</span>
                    </div>
                    <div className="thermal-meta-row">
                      <span>STATUS:</span>
                      <span>{String(status).toUpperCase()}</span>
                    </div>
                    <div className="thermal-meta-row">
                      <span>DATE:</span>
                      <span>{formatDate(documentData?.issueDate)}</span>
                    </div>
                    {documentData?.dueDate ? (
                      <div className="thermal-meta-row">
                        <span>DUE:</span>
                        <span>{formatDate(documentData.dueDate)}</span>
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

                  {documentData?.notes ? (
                    <>
                      <hr className="thermal-divider" />
                      <div className="thermal-footer">{documentData.notes}</div>
                    </>
                  ) : null}

                  <div className="thermal-footer">
                    <div>*** THANK YOU FOR YOUR BUSINESS ***</div>
                  </div>
                </div>
              ) : (
                /* Standard Paged Layouts: A4, LETTER, A5, B5, LEGAL */
                <>
                  <div>
                    {/* 2-Column Header */}
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
                        <div className="doc-type-heading">
                          {isQuotation ? 'QUOTATION' : 'INVOICE'}
                        </div>
                        <div>
                          <span className="doc-number-badge">{docNumber}</span>
                          <span className="status-pill">{status}</span>
                        </div>
                        <div className="doc-meta-grid">
                          <span className="doc-meta-label">Issue Date:</span>
                          <span className="doc-meta-value">
                            {formatDate(documentData?.issueDate)}
                          </span>
                          <span className="doc-meta-label">
                            {isQuotation ? 'Valid Until:' : 'Due Date:'}
                          </span>
                          <span className="doc-meta-value">
                            {formatDate(
                              isQuotation ? documentData?.validUntil : documentData?.dueDate
                            )}
                          </span>
                          <span className="doc-meta-label">Currency:</span>
                          <span className="doc-meta-value">{currency}</span>
                        </div>
                      </div>
                    </header>

                    {/* Customer & Commercial Summary Strip */}
                    <section className="billing-grid">
                      <div>
                        <div className="section-eyebrow">
                          {isQuotation ? 'Prepared For' : 'Billed To'}
                        </div>
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
                        <div className="section-eyebrow">
                          {isQuotation ? 'Commercial Terms' : 'Payment Summary'}
                        </div>
                        <div className="customer-details">
                          <div>
                            <strong>{isQuotation ? 'Quoted Total:' : 'Balance Due:'}</strong>{' '}
                            {formatCurrency(
                              isQuotation ? totals.grandTotal : totals.balanceDue,
                              currency
                            )}
                          </div>
                          {isQuotation && documentData?.deliveryTerms ? (
                            <div>
                              <strong>Delivery:</strong> {documentData.deliveryTerms}
                            </div>
                          ) : null}
                          {documentData?.paymentTerms ? (
                            <div>
                              <strong>Terms:</strong> {documentData.paymentTerms}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </section>

                    {/* Adaptive Items Table: 4-Col on A5, 6-Col on A4 / LETTER / B5 / LEGAL */}
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
                          {totals.lineResults.length === 0 ? (
                            <tr>
                              <td
                                colSpan={isCompactA5 ? 4 : 6}
                                style={{ textAlign: 'center', color: '#94a3b8', padding: '16px' }}
                              >
                                Add line items to preview itemized pricing
                              </td>
                            </tr>
                          ) : (
                            totals.lineResults.map((item, idx) => {
                              const qtyLabel = `${item.quantity}${item.unit ? ` ${item.unit}` : ''}`;
                              const rateLabel = formatCurrency(item.unitPrice, currency);
                              const discLabel =
                                item.discountAmount > 0
                                  ? `-${formatCurrency(item.discountAmount, currency)}`
                                  : '—';

                              if (isCompactA5) {
                                return (
                                  <tr key={idx}>
                                    <td>
                                      <div className="item-title">
                                        {item.name || `Line Item ${idx + 1}`}
                                      </div>
                                      {item.description ? (
                                        <div className="item-desc">{item.description}</div>
                                      ) : null}
                                    </td>
                                    <td className="num">
                                      <div>
                                        {qtyLabel} × {rateLabel}
                                      </div>
                                      {item.discountAmount > 0 ? (
                                        <div className="item-desc">Disc: {discLabel}</div>
                                      ) : null}
                                    </td>
                                    <td className="num">
                                      {formatCurrency(item.taxAmount, currency)}
                                    </td>
                                    <td className="num">
                                      <strong>{formatCurrency(item.lineTotal, currency)}</strong>
                                    </td>
                                  </tr>
                                );
                              }

                              return (
                                <tr key={idx}>
                                  <td>
                                    <div className="item-title">
                                      {item.name || `Line Item ${idx + 1}`}
                                    </div>
                                    {item.description ? (
                                      <div className="item-desc">{item.description}</div>
                                    ) : null}
                                  </td>
                                  <td className="num">{qtyLabel}</td>
                                  <td className="num">{rateLabel}</td>
                                  <td className="num">{discLabel}</td>
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
                            })
                          )}
                        </tbody>
                      </table>
                    </section>
                  </div>

                  {/* Footer: Side-by-side on A4/LETTER/B5/LEGAL; Stacked on A5 */}
                  <div>
                    <section className="doc-footer-grid">
                      <div>
                        {!isQuotation && hasBankDetails ? (
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

                        {isQuotation &&
                        (documentData?.deliveryTerms || documentData?.paymentTerms) ? (
                          <div className="info-card terms-block">
                            <div className="info-card-title">Delivery &amp; Payment Terms</div>
                            {documentData?.deliveryTerms ? (
                              <div>
                                <strong>Delivery:</strong> {documentData.deliveryTerms}
                              </div>
                            ) : null}
                            {documentData?.paymentTerms ? (
                              <div>
                                <strong>Payment:</strong> {documentData.paymentTerms}
                              </div>
                            ) : null}
                          </div>
                        ) : null}

                        {documentData?.notes ? (
                          <div className="info-card terms-block">
                            <div className="info-card-title">Notes &amp; Instructions</div>
                            <div style={{ whiteSpace: 'pre-line' }}>{documentData.notes}</div>
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
                          <span>{isQuotation ? 'Estimated Tax' : 'Tax Total'}</span>
                          <span>{formatCurrency(totals.taxTotal, currency)}</span>
                        </div>
                        {totals.shippingOrAdjustment !== 0 ? (
                          <div className="totals-row">
                            <span>Shipping / Adjustment</span>
                            <span>{formatCurrency(totals.shippingOrAdjustment, currency)}</span>
                          </div>
                        ) : null}
                        <div className="totals-row grand-total">
                          <span>{isQuotation ? 'Quoted Total' : 'Grand Total'}</span>
                          <span>{formatCurrency(totals.grandTotal, currency)}</span>
                        </div>
                        {!isQuotation ? (
                          <>
                            <div className="totals-row">
                              <span>Amount Paid</span>
                              <span>{formatCurrency(totals.amountPaid, currency)}</span>
                            </div>
                            <div className="totals-row sub-balance">
                              <span>Balance Due</span>
                              <span>{formatCurrency(totals.balanceDue, currency)}</span>
                            </div>
                          </>
                        ) : null}
                      </div>
                    </section>

                    {isLegal ? (
                      <section className="legal-terms-box terms-block">
                        <div className="info-card-title">
                          {isQuotation
                            ? 'Terms, Conditions & Scope of Proposal'
                            : 'Terms & Conditions'}
                        </div>
                        <p>
                          {(isQuotation
                            ? documentData?.acceptanceTerms
                            : documentData?.paymentTerms) ||
                            'This document is governed by standard commercial payment and delivery terms. Authorized signature below indicates formal acceptance.'}
                        </p>
                      </section>
                    ) : null}

                    {isQuotation || isLegal ? (
                      <section className="signature-block">
                        <div>
                          <div className="sig-box" />
                          <div className="sig-caption">
                            {isQuotation ? 'Prepared By' : 'Authorized Signatory'} ({bizName})
                          </div>
                        </div>
                        <div>
                          <div className="sig-box" />
                          <div className="sig-caption">
                            {isQuotation ? 'Client Acceptance Signature' : 'Customer Acknowledgement'}{' '}
                            ({custName})
                          </div>
                        </div>
                      </section>
                    ) : null}
                  </div>
                </>
              )}
            </article>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DocumentPaperCanvas;
