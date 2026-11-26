import React, { useEffect, useState } from 'react';
import { ExternalLink, FileText, Paperclip, X } from 'lucide-react';
import {
  formatExpenseDate,
  formatExpenseMoney,
  isPdfAttachment,
} from './expenseHelpers.js';

export function ReceiptPreviewModal({ expense, onClose }) {
  const [objectUrl, setObjectUrl] = useState('');

  const attachment = expense?.receiptAttachment;
  const rawUrl = attachment?.url || '';
  const isPdf = isPdfAttachment(attachment);

  useEffect(() => {
    if (!rawUrl || !rawUrl.startsWith('data:')) {
      setObjectUrl('');
      return undefined;
    }

    let createdUrl = '';
    try {
      const [header, base64] = rawUrl.split(',');
      const mimeMatch = header.match(/data:([^;]+)/);
      const mimeType = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
      const binary = window.atob(base64 || '');
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: mimeType });
      createdUrl = URL.createObjectURL(blob);
      setObjectUrl(createdUrl);
    } catch {
      setObjectUrl('');
    }

    return () => {
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
      }
    };
  }, [rawUrl]);

  if (!expense || !rawUrl) return null;

  const displayUrl = objectUrl || rawUrl;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="receipt-preview-title"
      data-testid="receipt-preview-modal"
    >
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-rose-600">
              <Paperclip className="h-3.5 w-3.5" /> Receipt Attachment
            </div>
            <h2
              id="receipt-preview-title"
              className="mt-1 truncate text-base font-extrabold text-slate-900"
            >
              {expense.title}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {formatExpenseDate(expense.expenseDate)}
              {expense.vendor ? ` · ${expense.vendor}` : ''} ·{' '}
              <span className="font-semibold text-slate-700">
                {formatExpenseMoney(expense.amount, expense.currency)}
              </span>
              {attachment.originalName ? ` · ${attachment.originalName}` : ''}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={displayUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Open in New Tab
            </a>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close receipt preview"
              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex min-h-[320px] flex-1 items-center justify-center overflow-auto bg-slate-100 p-4">
          {isPdf ? (
            <div className="flex h-full w-full flex-col items-center gap-3">
              <iframe
                src={displayUrl}
                title={attachment.originalName || 'PDF Receipt'}
                className="h-[65vh] w-full rounded-xl border border-slate-200 bg-white"
              />
              <p className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                <FileText className="h-3.5 w-3.5" /> If the embedded PDF preview is blocked by your
                browser, use Open in New Tab above.
              </p>
            </div>
          ) : (
            <img
              src={displayUrl}
              alt={attachment.originalName || `${expense.title} receipt`}
              className="max-h-[68vh] w-auto rounded-xl border border-slate-200 bg-white object-contain shadow-sm"
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default ReceiptPreviewModal;
