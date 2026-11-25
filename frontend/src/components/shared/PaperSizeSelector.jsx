import React from 'react';
import {
  FileText,
  Palette,
  Receipt,
  RectangleHorizontal,
  RectangleVertical,
} from 'lucide-react';
import {
  PAPER_SIZES,
  TEMPLATE_THEMES,
  getSupportedSizesForTool,
} from '@shared/constants/paperSizes.js';

/**
 * Multi-Size Paper, Orientation & Theme Selector
 *
 * - Renders only paper sizes permitted for `toolType` ('invoice' | 'quotation')
 * - Displays human-readable labels with exact physical dimensions
 * - Automatically disables Landscape orientation for `LEGAL` and `THERMAL_80`
 * - Includes Indigo, Emerald, and Slate theme palette swatches
 */

export function PaperSizeSelector({
  toolType = 'invoice',
  pageSize = 'A4',
  orientation = 'portrait',
  templateKey = 'indigo',
  onChange,
  onPageSizeChange,
  onOrientationChange,
  onTemplateKeyChange,
  className = '',
}) {
  const supportedSizes = getSupportedSizesForTool(toolType);
  const currentMeta = PAPER_SIZES[pageSize] || supportedSizes[0] || PAPER_SIZES.A4;
  const isLandscapeDisabled = !currentMeta.landscape || currentMeta.continuousRoll;
  const effectiveOrientation = isLandscapeDisabled ? 'portrait' : orientation;

  const emitChange = (nextValues) => {
    if (typeof onChange === 'function') {
      onChange({
        pageSize: nextValues.pageSize ?? pageSize,
        orientation: nextValues.orientation ?? effectiveOrientation,
        templateKey: nextValues.templateKey ?? templateKey,
      });
    }
  };

  const handleSizeSelect = (nextSizeCode) => {
    const nextMeta = PAPER_SIZES[nextSizeCode];
    const nextOrientation =
      !nextMeta?.landscape || nextMeta?.continuousRoll ? 'portrait' : orientation;

    if (typeof onPageSizeChange === 'function') {
      onPageSizeChange(nextSizeCode);
    }
    if (nextOrientation !== orientation && typeof onOrientationChange === 'function') {
      onOrientationChange(nextOrientation);
    }
    emitChange({ pageSize: nextSizeCode, orientation: nextOrientation });
  };

  const handleOrientationSelect = (nextOrientation) => {
    if (isLandscapeDisabled && nextOrientation === 'landscape') return;
    if (typeof onOrientationChange === 'function') {
      onOrientationChange(nextOrientation);
    }
    emitChange({ orientation: nextOrientation });
  };

  const handleThemeSelect = (nextThemeKey) => {
    if (typeof onTemplateKeyChange === 'function') {
      onTemplateKeyChange(nextThemeKey);
    }
    emitChange({ templateKey: nextThemeKey });
  };

  return (
    <div
      className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm ${className}`}
      data-testid="paper-size-selector"
    >
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:items-end">
        {/* Paper Size Select */}
        <div className="lg:col-span-5">
          <label
            htmlFor={`paper-size-${toolType}`}
            className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-600"
          >
            {currentMeta.continuousRoll ? (
              <Receipt className="h-3.5 w-3.5 text-indigo-600" />
            ) : (
              <FileText className="h-3.5 w-3.5 text-indigo-600" />
            )}
            Paper Size Standard
          </label>
          <select
            id={`paper-size-${toolType}`}
            value={currentMeta.code}
            onChange={(e) => handleSizeSelect(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          >
            {supportedSizes.map((size) => (
              <option key={size.code} value={size.code}>
                {size.code === 'THERMAL_80'
                  ? 'Thermal 80mm (80 mm × Auto Roll)'
                  : size.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-500">
            {currentMeta.marginMm}mm margins · {currentMeta.baseFontPt}pt base font ·{' '}
            {currentMeta.continuousRoll
              ? 'Continuous POS receipt'
              : `${currentMeta.tableColumns}-col adaptive table`}
          </p>
        </div>

        {/* Portrait / Landscape Orientation Toggle */}
        <div className="lg:col-span-4">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-600">
            Orientation
          </span>
          <div className="inline-flex w-full rounded-lg border border-slate-200 bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => handleOrientationSelect('portrait')}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                effectiveOrientation === 'portrait'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              aria-pressed={effectiveOrientation === 'portrait'}
            >
              <RectangleVertical className="h-3.5 w-3.5" />
              Portrait
            </button>
            <button
              type="button"
              disabled={isLandscapeDisabled}
              onClick={() => handleOrientationSelect('landscape')}
              title={
                isLandscapeDisabled
                  ? `Landscape is not supported for ${currentMeta.name}`
                  : 'Switch to Landscape orientation'
              }
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                isLandscapeDisabled
                  ? 'cursor-not-allowed text-slate-400 opacity-60'
                  : effectiveOrientation === 'landscape'
                    ? 'bg-white text-indigo-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
              }`}
              aria-pressed={effectiveOrientation === 'landscape'}
            >
              <RectangleHorizontal className="h-3.5 w-3.5" />
              Landscape
            </button>
          </div>
          {isLandscapeDisabled ? (
            <p className="mt-1 text-xs text-amber-600">
              Portrait locked for {currentMeta.name}
            </p>
          ) : (
            <p className="mt-1 text-xs text-slate-500">
              Swaps physical width &amp; height
            </p>
          )}
        </div>

        {/* Accent Theme Selector */}
        <div className="lg:col-span-3">
          <span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-600">
            <Palette className="h-3.5 w-3.5 text-indigo-600" />
            Accent Theme
          </span>
          <div className="flex items-center gap-2">
            {Object.values(TEMPLATE_THEMES).map((theme) => {
              const active = templateKey === theme.key;
              return (
                <button
                  key={theme.key}
                  type="button"
                  onClick={() => handleThemeSelect(theme.key)}
                  title={theme.name}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs font-semibold capitalize transition ${
                    active
                      ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                  aria-pressed={active}
                >
                  <span
                    className="h-3 w-3 rounded-full border border-white/60 shadow-inner"
                    style={{ backgroundColor: theme.primaryHex }}
                  />
                  <span>{theme.key}</span>
                </button>
              );
            })}
          </div>
          <p className="mt-1 text-xs text-slate-500">Synced with PDF output</p>
        </div>
      </div>
    </div>
  );
}

export default PaperSizeSelector;
