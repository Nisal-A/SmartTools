import React, { useState } from 'react';
import {
  AlertCircle,
  CloudUpload,
  Download,
  Loader2,
  Printer,
  Save,
} from 'lucide-react';
import { apiClient } from '../../services/apiClient.js';

function triggerBrowserBlobDownload(blob, filename) {
  const objectUrl = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => window.URL.revokeObjectURL(objectUrl), 1000);
}

function extractFilenameFromHeader(dispositionHeader, fallbackFilename) {
  if (!dispositionHeader) return fallbackFilename;
  const match = /filename="?([^";\n]+)"?/i.exec(dispositionHeader);
  return match?.[1] || fallbackFilename;
}

/**
 * Shared Print, Multi-Size PDF Download & Save / Save-to-Cloud Action Bar
 *
 * - Print: invokes clean browser `@media print` output (`window.print()`)
 * - Download PDF:
 *     - Guests or unsaved drafts -> `POST /api/v1/public/pdf/render`
 *     - Authenticated saved records -> `GET /api/v1/invoices/:id/pdf` or `/quotations/:id/pdf`
 * - Save / Save to Cloud:
 *     - Authenticated -> `onSave()`
 *     - Guest -> `onSaveToCloud()` (triggers inline Auth Modal & draft migration)
 */
export function DocumentExportBar({
  documentType = 'invoice',
  documentId = null,
  documentData = {},
  paperConfig = {},
  isAuthenticated = false,
  isSaving = false,
  onSave,
  onSaveToCloud,
  onPrint,
  className = '',
}) {
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [downloadError, setDownloadError] = useState('');

  const pageSize =
    paperConfig?.pageSize || documentData?.pageSize || 'A4';
  const orientation =
    paperConfig?.orientation || documentData?.orientation || 'portrait';
  const templateKey =
    paperConfig?.templateKey || documentData?.templateKey || 'indigo';

  const handlePrint = () => {
    if (typeof onPrint === 'function') {
      onPrint();
      return;
    }
    window.print();
  };

  const handleDownloadPdf = async () => {
    setDownloadError('');
    setIsDownloadingPdf(true);

    const normalizedType =
      String(documentType).toLowerCase() === 'quotation' ? 'quotation' : 'invoice';
    const docNum =
      normalizedType === 'quotation'
        ? documentData?.quotationNumber || 'QUO-DRAFT'
        : documentData?.invoiceNumber || 'INV-DRAFT';
    const fallbackFilename = `${String(docNum).replace(/[^A-Za-z0-9_-]/g, '-')}-${pageSize}.pdf`;

    try {
      let response;

      if (isAuthenticated && documentId) {
        const resourceSegment =
          normalizedType === 'quotation' ? 'quotations' : 'invoices';
        response = await apiClient.get(`/${resourceSegment}/${documentId}/pdf`, {
          params: {
            size: pageSize,
            orientation,
            templateKey,
          },
          responseType: 'blob',
        });
      } else {
        response = await apiClient.post(
          '/public/pdf/render',
          {
            documentType: normalizedType,
            paperConfig: {
              pageSize,
              orientation,
              templateKey,
            },
            payload: {
              ...documentData,
              pageSize,
              orientation,
              templateKey,
            },
          },
          {
            responseType: 'blob',
          }
        );
      }

      const contentDisposition = response.headers?.['content-disposition'];
      const filename = extractFilenameFromHeader(contentDisposition, fallbackFilename);
      const pdfBlob = new Blob([response.data], { type: 'application/pdf' });
      triggerBrowserBlobDownload(pdfBlob, filename);
    } catch (err) {
      let message = 'Failed to generate PDF document.';
      if (err.response?.data instanceof Blob) {
        try {
          const text = await err.response.data.text();
          const parsed = JSON.parse(text);
          if (parsed?.message) message = parsed.message;
        } catch {
          // Keep fallback message
        }
      } else if (err.response?.data?.message) {
        message = err.response.data.message;
      } else if (err.message) {
        message = err.message;
      }
      setDownloadError(message);
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const handlePrimarySaveClick = () => {
    if (isAuthenticated) {
      onSave?.();
    } else {
      onSaveToCloud?.();
    }
  };

  return (
    <div className={`no-print space-y-2 ${className}`} data-testid="document-export-bar">
      <div className="flex flex-wrap items-center justify-end gap-2.5">
        {/* Browser Print */}
        <button
          type="button"
          onClick={handlePrint}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          <Printer className="h-4 w-4 text-slate-500" />
          Print
        </button>

        {/* Server Puppeteer PDF Download */}
        <button
          type="button"
          onClick={handleDownloadPdf}
          disabled={isDownloadingPdf}
          className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3.5 py-2 text-xs font-semibold text-indigo-700 shadow-sm transition hover:bg-indigo-100 disabled:cursor-wait disabled:opacity-70"
        >
          {isDownloadingPdf ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          {isDownloadingPdf ? `Rendering ${pageSize} PDF...` : `Download ${pageSize} PDF`}
        </button>

        {/* Save / Save to Cloud */}
        <button
          type="button"
          onClick={handlePrimarySaveClick}
          disabled={isSaving}
          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-60"
        >
          {isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : isAuthenticated ? (
            <Save className="h-4 w-4" />
          ) : (
            <CloudUpload className="h-4 w-4" />
          )}
          {isSaving
            ? 'Saving...'
            : isAuthenticated
              ? documentId
                ? 'Update Document'
                : 'Save Document'
              : 'Save to Cloud'}
        </button>
      </div>

      {downloadError ? (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700"
        >
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{downloadError}</span>
        </div>
      ) : null}
    </div>
  );
}

export default DocumentExportBar;
