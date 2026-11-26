import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Maximize2, ZoomIn, ZoomOut } from 'lucide-react';
import './ReceiptPrintStyles.css';

const MM_TO_PX = 96 / 25.4;

const ZOOM_MODES = [
  { id: 'fit', label: 'Fit' },
  { id: '0.85', label: '85%' },
  { id: '1', label: '100%' },
  { id: '1.15', label: '115%' },
];

export function formatReceiptMoney(amount, currency = 'LKR') {
  const num = Number(amount);
  const safe = Number.isFinite(num) ? num : 0;
  const code = String(currency || 'LKR').trim().toUpperCase() || 'LKR';
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

function formatDisplayDate(dateVal) {
  if (!dateVal) return new Date().toISOString().slice(0, 10);
  const str = String(dateVal).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const parsed = new Date(str);
  if (Number.isNaN(parsed.getTime())) return str;
  return parsed.toISOString().slice(0, 10);
}

/**
 * Live Scaled Receipt Document Preview (`A5` 148x210mm & `Thermal` 80mm)
 */
export function ReceiptPreviewCanvas({ receiptData }) {
  const stageRef = useRef(null);
  const sheetRef = useRef(null);

  const [zoomMode, setZoomMode] = useState('fit');
  const [stageWidth, setStageWidth] = useState(560);
  const [sheetHeightPx, setSheetHeightPx] = useState(520);

  const isThermal = receiptData?.format === 'thermal';
  const widthMm = isThermal ? 80 : 148;
  const minHeightMm = isThermal ? null : 210;

  // Dynamically inject exact `@page` print dimensions when switching between A5 and 80mm Thermal
  useEffect(() => {
    const styleId = 'smarttools-receipt-print-page';
    let styleEl = document.getElementById(styleId);
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = styleId;
      document.head.appendChild(styleEl);
    }
    const pageRule = isThermal ? '80mm auto' : 'A5 portrait';
    styleEl.textContent = `@media print { @page { size: ${pageRule}; margin: 0; } }`;

    return () => {
      if (styleEl && styleEl.parentNode) {
        styleEl.parentNode.removeChild(styleEl);
      }
    };
  }, [isThermal]);

  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') return undefined;
    const stageEl = stageRef.current;
    const sheetEl = sheetRef.current;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === stageEl) {
          setStageWidth(entry.contentRect.width);
        } else if (entry.target === sheetEl) {
          setSheetHeightPx(Math.max(entry.contentRect.height, sheetEl.scrollHeight || 0));
        }
      }
    });

    if (stageEl) observer.observe(stageEl);
    if (sheetEl) observer.observe(sheetEl);
    return () => observer.disconnect();
  }, [isThermal]);

  const physicalWidthPx = widthMm * MM_TO_PX;
  const physicalHeightPx =
    minHeightMm !== null
      ? Math.max(minHeightMm * MM_TO_PX, sheetHeightPx)
      : Math.max(260, sheetHeightPx);

  const scale = useMemo(() => {
    if (zoomMode !== 'fit') return Number(zoomMode) || 1;
    const available = Math.max(240, stageWidth - 40);
    if (isThermal) {
      return Number(Math.min(1.15, Math.max(0.65, available / physicalWidthPx)).toFixed(4));
    }
    return Number(Math.min(1.02, Math.max(0.4, available / physicalWidthPx)).toFixed(4));
  }, [zoomMode, stageWidth, physicalWidthPx, isThermal]);

  const currency = receiptData?.currency || 'LKR';
  const rawInvoiceTotal = Number(receiptData?.invoiceTotal) || 0;
  const amountPaid = Math.max(0, Number(receiptData?.amountPaid) || 0);
  const effectiveInvoiceTotal = rawInvoiceTotal > 0 ? rawInvoiceTotal : amountPaid;
  const balanceDue = Math.round(
    Math.max(0, (rawInvoiceTotal || amountPaid) - amountPaid + Number.EPSILON) * 100
  ) / 100;

  const isPaidInFull = balanceDue <= 0 && amountPaid > 0;
  const statusLabel = isPaidInFull ? 'PAID' : balanceDue > 0 ? 'PARTIAL' : 'DRAFT';

  const business = receiptData?.business || {};
  const customer = receiptData?.customer || {};
  const businessName = business.name?.trim() || 'Your Business Name';
  const customerName = customer.name?.trim() || 'Walk-in / Cash Customer';
  const receiptNumber = receiptData?.receiptNumber?.trim() || 'RCP-PREVIEW';
  const linkedInvoiceNumber = receiptData?.linkedInvoiceNumber?.trim() || '';
  const paymentMethod = receiptData?.paymentMethod || 'Cash';
  const paymentReference = receiptData?.paymentReference?.trim() || '';
  const issuedDate = formatDisplayDate(receiptData?.issuedDate);
  const notes = receiptData?.notes?.trim() || '';

  return (
    <div
      className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-sm"
      data-testid="receipt-preview-canvas"
    >
      {/* Preview Toolbar */}
      <div className="no-print flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
            <Maximize2 className="h-3 w-3" />
            {isThermal ? 'Thermal · 80mm × Auto Roll' : 'A5 Portrait · 148 × 210 mm'}
          </span>
          <span className="hidden text-xs font-medium text-slate-500 sm:inline">
            {Math.round(scale * 100)}% zoom
          </span>
        </div>

        <div className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
          <ZoomOut className="ml-1 h-3.5 w-3.5 text-slate-400" />
          {ZOOM_MODES.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setZoomMode(opt.id)}
              className={`rounded-md px-2 py-1 text-xs font-semibold transition ${
                zoomMode === opt.id
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-white hover:text-slate-900'
              }`}
            >
              {opt.label}
            </button>
          ))}
          <ZoomIn className="mr-1 h-3.5 w-3.5 text-slate-400" />
        </div>
      </div>

      {/* Printable Preview Stage */}
      <div
        ref={stageRef}
        className="receipt-preview-stage receipt-printable-root flex min-h-[540px] flex-1 justify-center p-5 sm:p-6"
      >
        <div
          className="receipt-scale-outer relative flex-shrink-0"
          style={{
            width: `${Math.ceil(physicalWidthPx * scale)}px`,
            height: `${Math.ceil(physicalHeightPx * scale)}px`,
          }}
        >
          <div
            className="receipt-scale-inner"
            style={{
              width: `${physicalWidthPx}px`,
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
            }}
          >
            {isThermal ? (
              /* ============================================================
               * THERMAL 80MM POS RECEIPT TEMPLATE
               * ============================================================ */
              <article
                ref={sheetRef}
                className="receipt-sheet receipt-sheet--thermal"
                data-testid="receipt-template-thermal"
              >
                <header className="text-center">
                  {business.logoUrl ? (
                    <img
                      src={business.logoUrl}
                      alt={businessName}
                      className="mx-auto mb-1.5 max-h-12 max-w-[34mm] object-contain"
                    />
                  ) : null}
                  <div className="text-[11pt] font-bold uppercase tracking-tight">
                    {businessName}
                  </div>
                  {business.address ? (
                    <div className="mt-0.5 whitespace-pre-line text-[7.8pt]">
                      {business.address}
                    </div>
                  ) : null}
                  {business.phone ? <div className="text-[7.8pt]">Tel: {business.phone}</div> : null}
                  {business.email ? <div className="text-[7.8pt]">{business.email}</div> : null}
                  <div className="mt-2 inline-block border border-black px-2 py-0.5 text-[8.5pt] font-bold uppercase tracking-widest">
                    PAYMENT RECEIPT
                  </div>
                </header>

                <hr className="my-2 border-0 border-t border-dashed border-black" />

                <section className="space-y-0.5 text-[8.2pt]">
                  <div className="flex justify-between gap-2">
                    <span>RECEIPT #:</span>
                    <span className="font-bold">{receiptNumber}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span>DATE:</span>
                    <span>{issuedDate}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span>STATUS:</span>
                    <span className="font-bold">{statusLabel}</span>
                  </div>
                  {linkedInvoiceNumber ? (
                    <div className="flex justify-between gap-2">
                      <span>INVOICE REF:</span>
                      <span className="font-semibold">{linkedInvoiceNumber}</span>
                    </div>
                  ) : null}
                  <div className="flex justify-between gap-2">
                    <span>METHOD:</span>
                    <span>{paymentMethod}</span>
                  </div>
                  {paymentReference ? (
                    <div className="flex justify-between gap-2">
                      <span>TXN / REF:</span>
                      <span className="truncate">{paymentReference}</span>
                    </div>
                  ) : null}
                </section>

                <hr className="my-2 border-0 border-t border-dashed border-black" />

                <section className="space-y-0.5 text-[8.2pt]">
                  <div className="font-bold uppercase">Received From:</div>
                  <div>{customerName}</div>
                  {customer.phone ? <div>Tel: {customer.phone}</div> : null}
                  {customer.email ? <div>{customer.email}</div> : null}
                  {customer.address ? (
                    <div className="whitespace-pre-line">{customer.address}</div>
                  ) : null}
                </section>

                <hr className="my-2 border-0 border-t border-dashed border-black" />

                <section className="space-y-1 tabular-nums">
                  <div className="flex justify-between text-[8.5pt]">
                    <span>INVOICE TOTAL:</span>
                    <span>{formatReceiptMoney(effectiveInvoiceTotal, currency)}</span>
                  </div>
                  <div className="flex justify-between border-y border-dashed border-black py-1 text-[10pt] font-bold">
                    <span>PAID ({currency}):</span>
                    <span>{formatReceiptMoney(amountPaid, currency)}</span>
                  </div>
                  <div className="flex justify-between text-[9pt] font-bold">
                    <span>BALANCE:</span>
                    <span>{formatReceiptMoney(balanceDue, currency)}</span>
                  </div>
                </section>

                {notes ? (
                  <>
                    <hr className="my-2 border-0 border-t border-dashed border-black" />
                    <div className="whitespace-pre-line text-center text-[7.8pt]">{notes}</div>
                  </>
                ) : null}

                <hr className="my-2 border-0 border-t border-dashed border-black" />
                <footer className="pt-0.5 text-center text-[7.8pt]">
                  <div className="font-bold">*** THANK YOU FOR YOUR PAYMENT ***</div>
                  <div className="mt-0.5 text-[7pt]">Keep this receipt for your records</div>
                </footer>
              </article>
            ) : (
              /* ============================================================
               * A5 PORTRAIT (148mm x 210mm) BRANDED RECEIPT TEMPLATE
               * ============================================================ */
              <article
                ref={sheetRef}
                className="receipt-sheet receipt-sheet--a5"
                data-testid="receipt-template-a5"
              >
                <div>
                  {/* Branded Header */}
                  <header className="flex items-start justify-between gap-4 border-b-2 border-amber-500 pb-3.5">
                    <div className="flex items-start gap-3">
                      {business.logoUrl ? (
                        <img
                          src={business.logoUrl}
                          alt={businessName}
                          className="h-12 w-12 rounded-lg border border-slate-200 bg-white object-contain p-1"
                        />
                      ) : null}
                      <div>
                        <div className="text-[13pt] font-extrabold tracking-tight text-slate-900">
                          {businessName}
                        </div>
                        {business.address ? (
                          <div className="mt-0.5 whitespace-pre-line text-[8pt] text-slate-600">
                            {business.address}
                          </div>
                        ) : null}
                        {(business.phone || business.email) && (
                          <div className="mt-0.5 text-[8pt] text-slate-500">
                            {[business.phone, business.email].filter(Boolean).join(' · ')}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-[14pt] font-black tracking-wider text-amber-600">
                        PAYMENT RECEIPT
                      </div>
                      <div className="mt-1 flex items-center justify-end gap-1.5">
                        <span className="rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-[8pt] font-bold text-amber-900">
                          {receiptNumber}
                        </span>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[7.5pt] font-extrabold uppercase tracking-wider ${
                            isPaidInFull
                              ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                              : balanceDue > 0
                                ? 'border border-amber-300 bg-amber-100 text-amber-800'
                                : 'border border-slate-200 bg-slate-100 text-slate-600'
                          }`}
                          data-testid="receipt-status-badge"
                        >
                          {statusLabel}
                        </span>
                      </div>
                      <div className="mt-1.5 text-[8pt] text-slate-500">
                        Issued Date: <strong className="text-slate-800">{issuedDate}</strong>
                      </div>
                    </div>
                  </header>

                  {/* Two-Column Business & Payer Details */}
                  <section className="mt-4 grid grid-cols-2 gap-3 rounded-lg border border-slate-200 bg-slate-50/80 p-3">
                    <div>
                      <div className="text-[7pt] font-bold uppercase tracking-wider text-amber-700">
                        Received From (Payer)
                      </div>
                      <div className="mt-0.5 text-[9.5pt] font-bold text-slate-900">
                        {customerName}
                      </div>
                      {customer.address ? (
                        <div className="mt-0.5 whitespace-pre-line text-[8pt] text-slate-600">
                          {customer.address}
                        </div>
                      ) : null}
                      {(customer.email || customer.phone) && (
                        <div className="mt-0.5 text-[8pt] text-slate-500">
                          {[customer.email, customer.phone].filter(Boolean).join(' · ')}
                        </div>
                      )}
                    </div>

                    <div className="border-l border-slate-200 pl-3">
                      <div className="text-[7pt] font-bold uppercase tracking-wider text-slate-500">
                        Issued By (Business)
                      </div>
                      <div className="mt-0.5 text-[9.5pt] font-bold text-slate-900">
                        {businessName}
                      </div>
                      {linkedInvoiceNumber ? (
                        <div className="mt-1 text-[8pt] text-slate-600">
                          Invoice Ref:{' '}
                          <strong className="font-semibold text-slate-900">
                            {linkedInvoiceNumber}
                          </strong>
                        </div>
                      ) : null}
                      <div className="mt-0.5 text-[8pt] text-slate-600">
                        Currency: <strong className="text-slate-900">{currency}</strong>
                      </div>
                    </div>
                  </section>

                  {/* Payment Method / Reference Strip */}
                  <section className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200/80 bg-amber-50/60 px-3 py-2 text-[8.2pt]">
                    <div>
                      <span className="font-semibold text-slate-500">Payment Method: </span>
                      <strong className="font-bold text-slate-900">{paymentMethod}</strong>
                    </div>
                    <div>
                      <span className="font-semibold text-slate-500">Transaction / Ref ID: </span>
                      <strong className="font-bold text-slate-900">
                        {paymentReference || '—'}
                      </strong>
                    </div>
                  </section>

                  {/* Clean Summary Table */}
                  <section className="mt-4 overflow-hidden rounded-lg border border-slate-200">
                    <table className="w-full border-collapse text-[8.8pt] tabular-nums">
                      <thead>
                        <tr className="bg-slate-900 text-white">
                          <th className="px-3 py-2 text-left text-[7.5pt] font-bold uppercase tracking-wider">
                            Payment Summary
                          </th>
                          <th className="px-3 py-2 text-right text-[7.5pt] font-bold uppercase tracking-wider">
                            Amount ({currency})
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 bg-white">
                        <tr>
                          <td className="px-3 py-2.5 text-slate-600">
                            Invoice Total
                            {linkedInvoiceNumber ? (
                              <span className="ml-1.5 text-[7.8pt] text-slate-400">
                                ({linkedInvoiceNumber})
                              </span>
                            ) : null}
                          </td>
                          <td className="px-3 py-2.5 text-right font-semibold text-slate-800">
                            {formatReceiptMoney(effectiveInvoiceTotal, currency)}
                          </td>
                        </tr>
                        <tr className="bg-emerald-50/50">
                          <td className="px-3 py-2.5 font-bold text-emerald-900">
                            Amount Paid Received
                          </td>
                          <td className="px-3 py-2.5 text-right text-[10pt] font-extrabold text-emerald-700">
                            {formatReceiptMoney(amountPaid, currency)}
                          </td>
                        </tr>
                        <tr className={balanceDue > 0 ? 'bg-amber-50/60' : 'bg-slate-50'}>
                          <td className="px-3 py-2.5 font-bold text-slate-800">Balance Due</td>
                          <td
                            className={`px-3 py-2.5 text-right font-extrabold ${
                              balanceDue > 0 ? 'text-amber-700' : 'text-slate-900'
                            }`}
                          >
                            {formatReceiptMoney(balanceDue, currency)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </section>

                  {/* Optional Notes */}
                  {notes ? (
                    <section className="mt-3.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[8pt]">
                      <div className="text-[7pt] font-bold uppercase tracking-wider text-slate-400">
                        Notes &amp; Remarks
                      </div>
                      <div className="mt-0.5 whitespace-pre-line text-slate-700">{notes}</div>
                    </section>
                  ) : null}
                </div>

                {/* Footer & Authorized Signature */}
                <footer className="mt-6 border-t border-dashed border-slate-300 pt-3">
                  <div className="grid grid-cols-2 items-end gap-6">
                    <div className="text-[7.8pt] text-slate-500">
                      <div className="font-semibold text-slate-700">
                        Thank you for your payment!
                      </div>
                      <div>
                        This receipt confirms payment received as detailed above.
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="ml-auto w-40 border-b border-slate-400 pt-5" />
                      <div className="mt-1 text-[7.5pt] font-semibold text-slate-600">
                        Authorized Signature
                      </div>
                    </div>
                  </div>
                </footer>
              </article>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ReceiptPreviewCanvas;
