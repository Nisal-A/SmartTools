import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Maximize2, ZoomIn, ZoomOut } from 'lucide-react';
import './PurchaseOrderPrintStyles.css';

const MM_TO_PX = 96 / 25.4;
const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;

const ZOOM_MODES = [
  { id: 'fit', label: 'Fit' },
  { id: '0.75', label: '75%' },
  { id: '1', label: '100%' },
  { id: '1.15', label: '115%' },
];

const round2 = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

/**
 * Deterministic preview totals matching `backend/src/models/PurchaseOrder.js` 1:1.
 */
export function computePoPreviewTotals(items = [], taxRate = 0, discount = 0) {
  const safeItems = Array.isArray(items) ? items : [];
  const computedItems = safeItems.map((item) => {
    const qty = Math.max(0, Number(item?.quantity) || 0);
    const price = Math.max(0, Number(item?.unitPrice) || 0);
    return {
      ...item,
      quantity: qty,
      unitPrice: price,
      lineTotal: round2(qty * price),
    };
  });

  const subtotal = round2(
    computedItems.reduce((sum, item) => sum + item.lineTotal, 0)
  );
  const safeDiscount = round2(Math.max(0, Number(discount) || 0));
  const safeTaxRate = Math.min(100, Math.max(0, Number(taxRate) || 0));
  const taxableBase = Math.max(0, subtotal - safeDiscount);
  const taxAmount = round2((taxableBase * safeTaxRate) / 100);
  const grandTotal = round2(taxableBase + taxAmount);

  return {
    items: computedItems,
    subtotal,
    discount: safeDiscount,
    taxRate: safeTaxRate,
    taxAmount,
    grandTotal,
  };
}

export function formatPoMoney(amount, currency = 'LKR') {
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

function formatDateValue(val, fallback = '—') {
  if (!val) return fallback;
  const str = String(val).trim();
  if (!str) return fallback;
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const parsed = new Date(str);
  if (Number.isNaN(parsed.getTime())) return str;
  return parsed.toISOString().slice(0, 10);
}

/**
 * Scaled Live A4 Purchase Order Document Preview (`210mm x 297mm`)
 */
export function PurchaseOrderPreviewCanvas({ poData, displayPoNumber = '' }) {
  const stageRef = useRef(null);
  const sheetRef = useRef(null);

  const [zoomMode, setZoomMode] = useState('fit');
  const [stageWidth, setStageWidth] = useState(640);
  const [sheetHeightPx, setSheetHeightPx] = useState(Math.ceil(A4_HEIGHT_MM * MM_TO_PX));

  // Inject `@page { size: A4 portrait; margin: 0; }` cleanly while active
  useEffect(() => {
    const styleId = 'smarttools-po-print-page';
    let styleEl = document.getElementById(styleId);
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = styleId;
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = '@media print { @page { size: A4 portrait; margin: 0; } }';
    return () => {
      if (styleEl && styleEl.parentNode) {
        styleEl.parentNode.removeChild(styleEl);
      }
    };
  }, []);

  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') return undefined;
    const stageEl = stageRef.current;
    const sheetEl = sheetRef.current;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === stageEl) {
          setStageWidth(entry.contentRect.width);
        } else if (entry.target === sheetEl) {
          setSheetHeightPx(
            Math.max(entry.contentRect.height, sheetEl.scrollHeight || 0)
          );
        }
      }
    });

    if (stageEl) observer.observe(stageEl);
    if (sheetEl) observer.observe(sheetEl);
    return () => observer.disconnect();
  }, []);

  const physicalWidthPx = A4_WIDTH_MM * MM_TO_PX;
  const physicalHeightPx = Math.max(A4_HEIGHT_MM * MM_TO_PX, sheetHeightPx);

  const scale = useMemo(() => {
    if (zoomMode !== 'fit') return Number(zoomMode) || 1;
    const available = Math.max(240, stageWidth - 40);
    return Number(Math.min(1, Math.max(0.3, available / physicalWidthPx)).toFixed(4));
  }, [zoomMode, stageWidth, physicalWidthPx]);

  const totals = useMemo(
    () => computePoPreviewTotals(poData?.items, poData?.taxRate, poData?.discount),
    [poData?.items, poData?.taxRate, poData?.discount]
  );

  const buyer = poData?.buyer || {};
  const supplier = poData?.supplier || {};
  const approvals = poData?.approvals || {};
  const preparedBy = approvals.preparedBy || {};
  const approvedBy = approvals.approvedBy || {};
  const approvalStatus = approvedBy.status === 'Approved' ? 'Approved' : 'Pending';
  const currency = poData?.currency || 'LKR';
  const poLabel = displayPoNumber?.trim() || 'PO-AUTO';

  return (
    <div
      className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-sm"
      data-testid="po-preview-canvas"
    >
      {/* Zoom & Paper Pill Toolbar */}
      <div className="no-print flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-800">
            <Maximize2 className="h-3 w-3" />
            A4 Portrait · 210 × 297 mm
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
        className="po-preview-stage po-printable-root flex min-h-[580px] flex-1 justify-center p-5 sm:p-6"
      >
        <div
          className="po-scale-outer relative flex-shrink-0"
          style={{
            width: `${Math.ceil(physicalWidthPx * scale)}px`,
            height: `${Math.ceil(physicalHeightPx * scale)}px`,
          }}
        >
          <div
            className="po-scale-inner"
            style={{
              width: `${physicalWidthPx}px`,
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
            }}
          >
            <article
              ref={sheetRef}
              className="po-sheet--a4"
              data-testid="po-template-a4"
            >
              <div>
                {/* Header */}
                <header className="flex items-start justify-between gap-6 border-b-2 border-sky-600 pb-4">
                  <div className="flex items-start gap-3.5">
                    {buyer.logoUrl ? (
                      <img
                        src={buyer.logoUrl}
                        alt={buyer.name || 'Buyer Logo'}
                        className="h-14 w-14 rounded-lg border border-slate-200 bg-white object-contain p-1"
                      />
                    ) : null}
                    <div>
                      <div className="text-[14pt] font-extrabold tracking-tight text-slate-900">
                        {buyer.name?.trim() || 'Your Company / Buyer Name'}
                      </div>
                      {buyer.address ? (
                        <div className="mt-0.5 whitespace-pre-line text-[8.5pt] text-slate-600">
                          {buyer.address}
                        </div>
                      ) : null}
                      {(buyer.phone || buyer.email) && (
                        <div className="mt-0.5 text-[8.5pt] text-slate-500">
                          {[buyer.phone, buyer.email].filter(Boolean).join(' · ')}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-[16pt] font-black tracking-wider text-sky-700">
                      PURCHASE ORDER
                    </div>
                    <div className="mt-1.5 flex items-center justify-end gap-2">
                      <span className="rounded border border-sky-200 bg-sky-50 px-2.5 py-0.5 text-[9pt] font-bold text-sky-900">
                        {poLabel}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[7.8pt] font-extrabold uppercase tracking-wider ${
                          approvalStatus === 'Approved'
                            ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                            : 'border border-amber-300 bg-amber-50 text-amber-800'
                        }`}
                      >
                        {approvalStatus}
                      </span>
                    </div>
                    <div className="mt-2 space-y-0.5 text-[8.5pt] text-slate-600">
                      <div>
                        Issue Date:{' '}
                        <strong className="text-slate-900">
                          {formatDateValue(
                            poData?.issueDate,
                            new Date().toISOString().slice(0, 10)
                          )}
                        </strong>
                      </div>
                      {poData?.expectedDeliveryDate ? (
                        <div>
                          Expected Delivery:{' '}
                          <strong className="text-slate-900">
                            {formatDateValue(poData.expectedDeliveryDate)}
                          </strong>
                        </div>
                      ) : null}
                      <div>
                        Currency: <strong className="text-slate-900">{currency}</strong>
                      </div>
                    </div>
                  </div>
                </header>

                {/* Two-Column Buyer & Supplier Card */}
                <section className="po-keep-together mt-4 grid grid-cols-2 gap-4 rounded-lg border border-slate-200 bg-slate-50/80 p-3.5">
                  <div>
                    <div className="text-[7.5pt] font-bold uppercase tracking-wider text-sky-700">
                      Vendor / Supplier
                    </div>
                    <div className="mt-1 text-[10pt] font-bold text-slate-900">
                      {supplier.name?.trim() || 'Supplier / Vendor Name'}
                    </div>
                    {supplier.contactPerson ? (
                      <div className="mt-0.5 text-[8.5pt] text-slate-700">
                        Attn: {supplier.contactPerson}
                      </div>
                    ) : null}
                    {supplier.address ? (
                      <div className="mt-0.5 whitespace-pre-line text-[8.5pt] text-slate-600">
                        {supplier.address}
                      </div>
                    ) : null}
                    {(supplier.email || supplier.phone) && (
                      <div className="mt-0.5 text-[8.5pt] text-slate-500">
                        {[supplier.email, supplier.phone].filter(Boolean).join(' · ')}
                      </div>
                    )}
                  </div>

                  <div className="border-l border-slate-200 pl-4">
                    <div className="text-[7.5pt] font-bold uppercase tracking-wider text-slate-500">
                      Buyer / Bill To
                    </div>
                    <div className="mt-1 text-[10pt] font-bold text-slate-900">
                      {buyer.name?.trim() || 'Your Company / Buyer Name'}
                    </div>
                    {buyer.address ? (
                      <div className="mt-0.5 whitespace-pre-line text-[8.5pt] text-slate-600">
                        {buyer.address}
                      </div>
                    ) : null}
                    {(buyer.email || buyer.phone) && (
                      <div className="mt-0.5 text-[8.5pt] text-slate-500">
                        {[buyer.email, buyer.phone].filter(Boolean).join(' · ')}
                      </div>
                    )}
                  </div>
                </section>

                {/* Delivery Schedule Callout Box */}
                <section className="po-keep-together mt-3.5 rounded-lg border border-sky-200/80 bg-sky-50/50 px-3.5 py-2.5 text-[8.5pt]">
                  <div className="mb-1 text-[7.5pt] font-bold uppercase tracking-wider text-sky-800">
                    Delivery &amp; Shipping Schedule
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <span className="text-slate-500">Ship To / Delivery Address:</span>
                      <div className="font-semibold text-slate-900">
                        {poData?.deliveryAddress?.trim() || buyer.address || '—'}
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-500">Shipping Method:</span>
                      <div className="font-semibold text-slate-900">
                        {poData?.shippingMethod?.trim() || 'Standard Freight'}
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-500">Expected Delivery:</span>
                      <div className="font-semibold text-slate-900">
                        {formatDateValue(poData?.expectedDeliveryDate)}
                      </div>
                    </div>
                  </div>
                  {poData?.deliveryNotes ? (
                    <div className="mt-1.5 border-t border-sky-200/60 pt-1.5 text-slate-700">
                      <span className="font-semibold text-slate-600">Instructions: </span>
                      {poData.deliveryNotes}
                    </div>
                  ) : null}
                </section>

                {/* Structured Items Table */}
                <section className="mt-4 overflow-hidden rounded-lg border border-slate-200">
                  <table className="w-full border-collapse text-[8.8pt] tabular-nums">
                    <thead>
                      <tr className="bg-slate-900 text-white">
                        <th className="w-8 px-2.5 py-2 text-center text-[7.5pt] font-bold uppercase">
                          #
                        </th>
                        <th className="px-2.5 py-2 text-left text-[7.5pt] font-bold uppercase">
                          Item Description
                        </th>
                        <th className="w-24 px-2.5 py-2 text-left text-[7.5pt] font-bold uppercase">
                          SKU
                        </th>
                        <th className="w-16 px-2.5 py-2 text-right text-[7.5pt] font-bold uppercase">
                          Qty
                        </th>
                        <th className="w-28 px-2.5 py-2 text-right text-[7.5pt] font-bold uppercase">
                          Unit Price
                        </th>
                        <th className="w-28 px-2.5 py-2 text-right text-[7.5pt] font-bold uppercase">
                          Line Total
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {totals.items.length === 0 ? (
                        <tr>
                          <td
                            colSpan={6}
                            className="px-4 py-6 text-center text-slate-400"
                          >
                            Add items to populate the purchase order schedule
                          </td>
                        </tr>
                      ) : (
                        totals.items.map((item, index) => (
                          <tr
                            key={index}
                            className={index % 2 === 1 ? 'bg-slate-50/60' : 'bg-white'}
                          >
                            <td className="px-2.5 py-2 text-center text-slate-400">
                              {index + 1}
                            </td>
                            <td className="px-2.5 py-2 font-medium text-slate-900">
                              {item.description?.trim() || `Item ${index + 1}`}
                            </td>
                            <td className="px-2.5 py-2 text-[8.2pt] text-slate-500">
                              {item.sku?.trim() || '—'}
                            </td>
                            <td className="px-2.5 py-2 text-right text-slate-800">
                              {item.quantity}
                            </td>
                            <td className="px-2.5 py-2 text-right text-slate-800">
                              {formatPoMoney(item.unitPrice, currency)}
                            </td>
                            <td className="px-2.5 py-2 text-right font-bold text-slate-900">
                              {formatPoMoney(item.lineTotal, currency)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </section>

                {/* Terms & Totals Summary */}
                <section className="po-keep-together mt-4 grid grid-cols-12 items-start gap-5">
                  <div className="col-span-7">
                    {poData?.terms ? (
                      <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 text-[8.2pt]">
                        <div className="mb-1 text-[7.5pt] font-bold uppercase tracking-wider text-slate-500">
                          Terms &amp; Conditions
                        </div>
                        <div className="whitespace-pre-line text-slate-700">
                          {poData.terms}
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-lg border border-dashed border-slate-200 p-3 text-[8pt] text-slate-400">
                        Please include the PO number ({poLabel}) on all invoices, packing slips,
                        and shipping correspondence.
                      </div>
                    )}
                  </div>

                  <div className="col-span-5 overflow-hidden rounded-lg border border-slate-200 bg-white tabular-nums">
                    <div className="flex justify-between border-b border-slate-100 px-3 py-2 text-[8.8pt]">
                      <span className="text-slate-500">Subtotal</span>
                      <span className="font-semibold text-slate-900">
                        {formatPoMoney(totals.subtotal, currency)}
                      </span>
                    </div>
                    {totals.discount > 0 ? (
                      <div className="flex justify-between border-b border-slate-100 px-3 py-2 text-[8.8pt]">
                        <span className="text-slate-500">Discount</span>
                        <span className="font-semibold text-rose-600">
                          -{formatPoMoney(totals.discount, currency)}
                        </span>
                      </div>
                    ) : null}
                    <div className="flex justify-between border-b border-slate-100 px-3 py-2 text-[8.8pt]">
                      <span className="text-slate-500">Tax ({totals.taxRate}%)</span>
                      <span className="font-semibold text-slate-900">
                        {formatPoMoney(totals.taxAmount, currency)}
                      </span>
                    </div>
                    <div className="flex justify-between bg-sky-700 px-3 py-2.5 text-[10pt] font-extrabold text-white">
                      <span>Grand Total</span>
                      <span>{formatPoMoney(totals.grandTotal, currency)}</span>
                    </div>
                  </div>
                </section>
              </div>

              {/* Dual-Signature Approval Footer */}
              <footer className="po-keep-together mt-6 border-t border-dashed border-slate-300 pt-4">
                <div className="grid grid-cols-2 gap-8 text-[8.2pt]">
                  <div>
                    <div className="mb-1 text-[7.2pt] font-bold uppercase tracking-wider text-slate-500">
                      Prepared By
                    </div>
                    <div className="h-9 border-b border-slate-400" />
                    <div className="mt-1.5 flex items-baseline justify-between gap-2">
                      <div>
                        <div className="font-bold text-slate-900">
                          {preparedBy.name?.trim() || 'Authorized Preparer'}
                        </div>
                        {preparedBy.title ? (
                          <div className="text-[7.8pt] text-slate-500">
                            {preparedBy.title}
                          </div>
                        ) : null}
                      </div>
                      <div className="text-[7.8pt] text-slate-500">
                        Date: {formatDateValue(preparedBy.date)}
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-[7.2pt] font-bold uppercase tracking-wider text-slate-500">
                        Approved By
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[6.8pt] font-bold uppercase ${
                          approvalStatus === 'Approved'
                            ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                            : 'bg-amber-50 text-amber-700 ring-1 ring-amber-200'
                        }`}
                      >
                        {approvalStatus}
                      </span>
                    </div>
                    <div className="h-9 border-b border-slate-400" />
                    <div className="mt-1.5 flex items-baseline justify-between gap-2">
                      <div>
                        <div className="font-bold text-slate-900">
                          {approvedBy.name?.trim() || 'Approving Authority'}
                        </div>
                        {approvedBy.title ? (
                          <div className="text-[7.8pt] text-slate-500">
                            {approvedBy.title}
                          </div>
                        ) : null}
                      </div>
                      <div className="text-[7.8pt] text-slate-500">
                        Date: {formatDateValue(approvedBy.date)}
                      </div>
                    </div>
                  </div>
                </div>
              </footer>
            </article>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PurchaseOrderPreviewCanvas;
