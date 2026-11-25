import React, { useState } from 'react';
import { Cloud, Info, LogIn, X } from 'lucide-react';

/**
 * Non-Blocking Guest Mode Info Banner
 *
 * Displayed exclusively to unauthenticated visitors inside the Invoice & Quotation
 * generators so they know their work auto-saves locally and can be exported freely.
 */
export function GuestModeBanner({
  isAuthenticated = false,
  lastSavedAt = null,
  onSignInClick,
  dismissible = true,
  className = '',
}) {
  const [dismissed, setDismissed] = useState(false);

  if (isAuthenticated || dismissed) {
    return null;
  }

  return (
    <div
      role="status"
      className={`no-print flex flex-wrap items-center justify-between gap-3 rounded-xl border border-indigo-200 bg-gradient-to-r from-indigo-50 via-white to-sky-50 px-4 py-3 text-sm text-slate-800 shadow-sm ${className}`}
      data-testid="guest-mode-banner"
    >
      <div className="flex items-start gap-2.5 sm:items-center">
        <span className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700 sm:mt-0">
          <Info className="h-4 w-4" />
        </span>
        <div>
          <p className="text-xs font-medium text-slate-800 sm:text-sm">
            <strong className="font-bold text-indigo-900">Guest Mode:</strong> Draft saved in
            this browser. Download PDF freely or sign in to save to cloud.
          </p>
          {lastSavedAt ? (
            <p className="mt-0.5 text-[11px] text-slate-500">
              Auto-saved locally at {new Date(lastSavedAt).toLocaleTimeString()}
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {typeof onSignInClick === 'function' ? (
          <button
            type="button"
            onClick={onSignInClick}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700"
          >
            <Cloud className="h-3.5 w-3.5" />
            <span>Sign in to Save</span>
            <LogIn className="h-3 w-3 opacity-80" />
          </button>
        ) : null}

        {dismissible ? (
          <button
            type="button"
            onClick={() => setDismissed(true)}
            aria-label="Dismiss Guest Mode banner"
            className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    </div>
  );
}

export default GuestModeBanner;
