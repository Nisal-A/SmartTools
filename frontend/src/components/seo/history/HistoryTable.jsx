import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, BarChart3, Clock, ExternalLink, Trash2 } from 'lucide-react';
import { formatDateTime, getScoreBand, truncateUrl } from '../../../pages/SeoAnalyzer/utils/formatters.js';
import Alert from '../ui/Alert.jsx';
import Badge from '../ui/Badge.jsx';
import Button from '../ui/Button.jsx';

export default function HistoryTable({ audits = [], onDelete }) {
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const cancelButtonRef = useRef(null);

  useEffect(() => {
    if (!pendingDelete) return undefined;

    cancelButtonRef.current?.focus();

    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !deleting) {
        setPendingDelete(null);
        setDeleteError(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pendingDelete, deleting]);

  const handleConfirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await onDelete(pendingDelete._id);
      setPendingDelete(null);
    } catch (err) {
      setDeleteError(err?.message || 'Unable to delete this audit report.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      {/* Desktop table view (md and up) */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <th scope="col" className="py-3 pr-4">
                Website / Page Title
              </th>
              <th scope="col" className="px-4 py-3">
                Educational Score
              </th>
              <th scope="col" className="px-4 py-3">
                Checks Summary
              </th>
              <th scope="col" className="px-4 py-3">
                Analyzed
              </th>
              <th scope="col" className="py-3 pl-4 text-right">
                Actions
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-200">
            {audits.map((audit) => {
              const displayUrl = audit.finalUrl || audit.url;
              const band = getScoreBand(audit.overallScore);

              return (
                <tr key={audit._id} className="hover:bg-slate-50/70">
                  <td className="max-w-xs py-4 pr-4">
                    <div className="flex items-center gap-1.5">
                      <Link
                        to={`/tools/seo-analyzer/audits/${audit._id}`}
                        className="truncate font-semibold text-slate-900 hover:text-blue-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                        title={displayUrl}
                      >
                        {truncateUrl(displayUrl, 48)}
                      </Link>
                      <a
                        href={displayUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Open ${displayUrl} in a new tab`}
                        className="shrink-0 text-slate-400 hover:text-slate-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                      >
                        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                      </a>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-slate-600" title={audit.pageTitle || ''}>
                      {audit.pageTitle || 'No <title> tag detected'}
                    </p>
                  </td>

                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span className="text-base font-bold text-slate-900">
                        {audit.overallScore}
                        <span className="text-xs font-normal text-slate-500">/100</span>
                      </span>
                      <Badge variant={band.variant}>{band.label}</Badge>
                    </div>
                  </td>

                  <td className="px-4 py-4 text-xs whitespace-nowrap text-slate-600">
                    <span className="font-medium text-green-700">{audit.summary?.passed ?? 0} pass</span>
                    {' · '}
                    <span className="font-medium text-amber-700">{audit.summary?.warning ?? 0} warn</span>
                    {' · '}
                    <span className="font-medium text-red-700">{audit.summary?.failed ?? 0} fail</span>
                  </td>

                  <td className="px-4 py-4 text-xs whitespace-nowrap text-slate-600">
                    {formatDateTime(audit.analyzedAt)}
                  </td>

                  <td className="py-4 pl-4 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-2">
                      <Link
                        to={`/tools/seo-analyzer/audits/${audit._id}`}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                      >
                        <BarChart3 className="h-3.5 w-3.5 text-blue-600" aria-hidden="true" />
                        <span>View Report</span>
                      </Link>

                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Delete audit for ${displayUrl}`}
                        onClick={() => {
                          setDeleteError(null);
                          setPendingDelete(audit);
                        }}
                        className="text-red-700 hover:bg-red-50 hover:text-red-800"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Delete</span>
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile stacked card view (< md) */}
      <ul className="divide-y divide-slate-200 md:hidden">
        {audits.map((audit) => {
          const displayUrl = audit.finalUrl || audit.url;
          const band = getScoreBand(audit.overallScore);

          return (
            <li key={audit._id} className="space-y-3 py-4 first:pt-0 last:pb-0">
              <div className="space-y-1">
                <Link
                  to={`/tools/seo-analyzer/audits/${audit._id}`}
                  className="block break-all text-sm font-semibold text-slate-900 hover:text-blue-600 focus-visible:outline-2 focus-visible:outline-blue-600"
                >
                  {displayUrl}
                </Link>
                <p className="text-xs text-slate-600">
                  {audit.pageTitle || 'No <title> tag detected'}
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-slate-900">
                    {audit.overallScore}
                    <span className="text-xs font-normal text-slate-500">/100</span>
                  </span>
                  <Badge variant={band.variant}>{band.label}</Badge>
                </div>

                <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                  <Clock className="h-3 w-3" aria-hidden="true" />
                  {formatDateTime(audit.analyzedAt)}
                </span>
              </div>

              <div className="text-xs text-slate-600">
                <span className="font-medium text-green-700">{audit.summary?.passed ?? 0} passed</span>
                {' · '}
                <span className="font-medium text-amber-700">{audit.summary?.warning ?? 0} warnings</span>
                {' · '}
                <span className="font-medium text-red-700">{audit.summary?.failed ?? 0} failed</span>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <Link
                  to={`/tools/seo-analyzer/audits/${audit._id}`}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-600"
                >
                  <BarChart3 className="h-3.5 w-3.5 text-blue-600" aria-hidden="true" />
                  <span>View Report</span>
                </Link>

                <Button
                  variant="outline"
                  size="sm"
                  aria-label={`Delete audit for ${displayUrl}`}
                  onClick={() => {
                    setDeleteError(null);
                    setPendingDelete(audit);
                  }}
                  className="border-red-200 text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Delete</span>
                </Button>
              </div>
            </li>
          );
        })}
      </ul>

      {/* Accessible Delete Confirmation Dialog */}
      {pendingDelete ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-xs"
          onClick={() => {
            if (!deleting) {
              setPendingDelete(null);
              setDeleteError(null);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-dialog-title"
            aria-describedby="delete-dialog-description"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl"
          >
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600">
                <AlertTriangle className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <h2 id="delete-dialog-title" className="text-base font-semibold text-slate-900">
                  Delete Audit Report?
                </h2>
                <p id="delete-dialog-description" className="mt-1.5 text-sm text-slate-600">
                  This permanently deletes the saved SEO report for:
                </p>
                <p className="mt-2 rounded-lg bg-slate-100 px-3 py-2 font-mono text-xs break-all text-slate-900">
                  {pendingDelete.finalUrl || pendingDelete.url}
                </p>
              </div>
            </div>

            {deleteError ? (
              <div className="mt-4">
                <Alert variant="error">{deleteError}</Alert>
              </div>
            ) : null}

            <div className="mt-6 flex items-center justify-end gap-3">
              <Button
                ref={cancelButtonRef}
                variant="outline"
                size="md"
                disabled={deleting}
                onClick={() => {
                  setPendingDelete(null);
                  setDeleteError(null);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="md"
                loading={deleting}
                onClick={handleConfirmDelete}
              >
                {deleting ? 'Deleting…' : 'Confirm Delete'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
