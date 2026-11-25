import React from 'react';
import { useFieldArray, useWatch } from 'react-hook-form';
import {
  ArrowDown,
  ArrowUp,
  Copy,
  Plus,
  Trash2,
} from 'lucide-react';
import { calculateLineItem } from '@shared/utils/financialMath.js';

const DEFAULT_NEW_ITEM = Object.freeze({
  name: '',
  description: '',
  quantity: 1,
  unit: 'pcs',
  unitPrice: 0,
  discountType: 'percentage',
  discountValue: 0,
  taxRate: 0,
});

function formatMoney(amount, currency = 'USD') {
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

/**
 * Dynamic Line-Items Table powered by React Hook Form `useFieldArray`
 *
 * Supports:
 * - Add Row, Duplicate Row, Move Up / Move Down, Remove Row
 * - Per-item quantity, unit, unitPrice, discount (% or fixed), taxRate %, and live computed lineTotal
 */
export function LineItemsTable({
  control,
  register,
  name = 'items',
  currency = 'USD',
  defaultTaxRate = 0,
  errors,
}) {
  const { fields, append, insert, swap, remove } = useFieldArray({
    control,
    name,
  });

  const watchedItems = useWatch({ control, name }) || [];

  const handleAddRow = () => {
    append({
      ...DEFAULT_NEW_ITEM,
      taxRate: Number(defaultTaxRate) || 0,
    });
  };

  const handleDuplicateRow = (index) => {
    const current = watchedItems[index] || fields[index] || DEFAULT_NEW_ITEM;
    insert(index + 1, {
      name: current.name || '',
      description: current.description || '',
      quantity: Number(current.quantity) || 1,
      unit: current.unit || 'pcs',
      unitPrice: Number(current.unitPrice) || 0,
      discountType: current.discountType || 'percentage',
      discountValue: Number(current.discountValue) || 0,
      taxRate: Number(current.taxRate) || 0,
    });
  };

  const handleMoveUp = (index) => {
    if (index > 0) {
      swap(index, index - 1);
    }
  };

  const handleMoveDown = (index) => {
    if (index < fields.length - 1) {
      swap(index, index + 1);
    }
  };

  const handleRemoveRow = (index) => {
    if (fields.length <= 1) return;
    remove(index);
  };

  const itemErrors = errors?.[name];

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Products &amp; Services</h3>
          <p className="text-xs text-slate-500">
            Configure quantities, rates, discounts (% or fixed), and per-line tax rates
          </p>
        </div>
        <button
          type="button"
          onClick={handleAddRow}
          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Line Item
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[780px] border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <th className="w-[28%] px-3 py-2.5">Item &amp; Description</th>
              <th className="w-[10%] px-2 py-2.5">Qty</th>
              <th className="w-[9%] px-2 py-2.5">Unit</th>
              <th className="w-[13%] px-2 py-2.5">Unit Price</th>
              <th className="w-[15%] px-2 py-2.5">Discount</th>
              <th className="w-[9%] px-2 py-2.5">Tax %</th>
              <th className="w-[11%] px-2 py-2.5 text-right">Line Total</th>
              <th className="w-[5%] px-2 py-2.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {fields.map((field, index) => {
              const liveRow = watchedItems[index] || {};
              const computed = calculateLineItem(liveRow);
              const rowErr = Array.isArray(itemErrors) ? itemErrors[index] : null;

              return (
                <tr key={field.id} className="align-top transition hover:bg-slate-50/70">
                  {/* Item Name & Description */}
                  <td className="px-3 py-2.5">
                    <input
                      type="text"
                      placeholder="Service or product name"
                      {...register(`${name}.${index}.name`)}
                      className={`w-full rounded-md border px-2.5 py-1.5 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 ${
                        rowErr?.name ? 'border-rose-400 bg-rose-50/40' : 'border-slate-300'
                      }`}
                    />
                    <input
                      type="text"
                      placeholder="Optional description"
                      {...register(`${name}.${index}.description`)}
                      className="mt-1.5 w-full rounded-md border border-slate-200 px-2.5 py-1 text-[11px] text-slate-600 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/20"
                    />
                    {rowErr?.name?.message ? (
                      <p className="mt-1 text-[11px] font-medium text-rose-600">
                        {rowErr.name.message}
                      </p>
                    ) : null}
                  </td>

                  {/* Quantity */}
                  <td className="px-2 py-2.5">
                    <input
                      type="number"
                      step="any"
                      min="0"
                      {...register(`${name}.${index}.quantity`, { valueAsNumber: true })}
                      className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-right text-xs font-medium text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </td>

                  {/* Unit */}
                  <td className="px-2 py-2.5">
                    <input
                      type="text"
                      placeholder="pcs"
                      {...register(`${name}.${index}.unit`)}
                      className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-xs text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </td>

                  {/* Unit Price */}
                  <td className="px-2 py-2.5">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      {...register(`${name}.${index}.unitPrice`, { valueAsNumber: true })}
                      className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-right text-xs font-medium text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </td>

                  {/* Discount Type + Value */}
                  <td className="px-2 py-2.5">
                    <div className="flex items-center overflow-hidden rounded-md border border-slate-300 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20">
                      <select
                        aria-label="Discount type"
                        {...register(`${name}.${index}.discountType`)}
                        className="border-r border-slate-200 bg-slate-50 px-1.5 py-1.5 text-[11px] font-semibold text-slate-700 focus:outline-none"
                      >
                        <option value="percentage">%</option>
                        <option value="fixed">{currency}</option>
                      </select>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        {...register(`${name}.${index}.discountValue`, { valueAsNumber: true })}
                        className="w-full px-2 py-1.5 text-right text-xs text-slate-900 focus:outline-none"
                      />
                    </div>
                  </td>

                  {/* Tax Rate % */}
                  <td className="px-2 py-2.5">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      {...register(`${name}.${index}.taxRate`, { valueAsNumber: true })}
                      className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-right text-xs text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </td>

                  {/* Live Computed Line Total */}
                  <td className="px-2 py-3 text-right">
                    <div className="font-bold text-slate-900">
                      {formatMoney(computed.lineTotal, currency)}
                    </div>
                    {computed.taxAmount > 0 ? (
                      <div className="text-[10px] text-slate-400">
                        incl. {formatMoney(computed.taxAmount, currency)} tax
                      </div>
                    ) : null}
                  </td>

                  {/* Row Actions: Move Up / Down, Duplicate, Delete */}
                  <td className="px-2 py-2">
                    <div className="flex items-center justify-end gap-0.5">
                      <button
                        type="button"
                        onClick={() => handleMoveUp(index)}
                        disabled={index === 0}
                        title="Move row up"
                        className="rounded p-1 text-slate-500 transition hover:bg-slate-200 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveDown(index)}
                        disabled={index === fields.length - 1}
                        title="Move row down"
                        className="rounded p-1 text-slate-500 transition hover:bg-slate-200 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDuplicateRow(index)}
                        title="Duplicate row"
                        className="rounded p-1 text-slate-500 transition hover:bg-indigo-100 hover:text-indigo-700"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveRow(index)}
                        disabled={fields.length <= 1}
                        title={
                          fields.length <= 1
                            ? 'At least 1 line item is required'
                            : 'Remove row'
                        }
                        className="rounded p-1 text-slate-500 transition hover:bg-rose-100 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {itemErrors?.message ? (
        <div className="border-t border-rose-100 bg-rose-50 px-4 py-2 text-xs font-medium text-rose-700">
          {itemErrors.message}
        </div>
      ) : null}
    </div>
  );
}

export default LineItemsTable;
