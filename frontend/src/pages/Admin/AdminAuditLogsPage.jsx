import React, { useCallback, useEffect, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  RefreshCw,
  ScrollText,
} from 'lucide-react';
import { listAdminAuditLogsApi } from '../../services/admin.api.js';
import { useAuth } from '../../app/AuthContext.jsx';

const AUDIT_ACTIONS = [
  '',
  'VIEW_GLOBAL_HISTORY',
  'VIEW_USER_DOCUMENT',
  'EXPORT_USER_DOCUMENT_PDF',
  'UPDATE_USER_ROLE',
  'TOGGLE_USER_STATUS',
];

const ACTION_TONE_MAP = {
  VIEW_GLOBAL_HISTORY: 'bg-sky-50 text-sky-700 ring-sky-200',
  VIEW_USER_DOCUMENT: 'bg-violet-50 text-violet-700 ring-violet-200',
  EXPORT_USER_DOCUMENT_PDF: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
  UPDATE_USER_ROLE: 'bg-amber-50 text-amber-700 ring-amber-200',
  TOGGLE_USER_STATUS: 'bg-rose-50 text-rose-700 ring-rose-200',
};

export function AdminAuditLogsPage() {
  const { showToast } = useAuth();
  const [actionFilter, setActionFilter] = useState('');
  const [page, setPage] = useState(1);
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 30,
    total: 0,
    totalPages: 1,
  });
  const [isLoading, setIsLoading] = useState(true);

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await listAdminAuditLogsApi({
        page,
        limit: 30,
        ...(actionFilter ? { action: actionFilter } : {}),
      });
      setLogs(res.logs);
      setPagination(res.pagination);
    } catch (err) {
      showToast(err.response?.data?.message || 'Unable to load audit logs.', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [page, actionFilter, showToast]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  return (
    <div className="space-y-5" data-testid="admin-audit-logs-page">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-violet-600">
              <ScrollText className="h-4 w-4" /> Immutable Governance Trail
            </div>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900">
              Admin Audit Logs
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Read-only record of every cross-user history view, document inspection, PDF export, and role/status change.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={actionFilter}
              onChange={(e) => {
                setActionFilter(e.target.value);
                setPage(1);
              }}
              data-testid="audit-action-filter"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700"
            >
              {AUDIT_ACTIONS.map((act) => (
                <option key={act || 'all'} value={act}>
                  {act ? act : 'All Actions'}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={fetchLogs}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-14 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin text-violet-600" /> Loading audit trail…
          </div>
        ) : logs.length === 0 ? (
          <div className="px-6 py-14 text-center text-sm text-slate-500">
            No audit log entries recorded yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs" data-testid="admin-audit-logs-table">
              <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">Admin</th>
                  <th className="px-3 py-3">Action</th>
                  <th className="px-3 py-3">Target User</th>
                  <th className="px-3 py-3">Resource</th>
                  <th className="px-3 py-3">IP Address</th>
                  <th className="px-4 py-3">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((log) => {
                  const tone =
                    ACTION_TONE_MAP[log.action] ||
                    'bg-slate-100 text-slate-700 ring-slate-200';
                  return (
                    <tr key={log.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-900">
                          {log.admin?.fullName || 'Administrator'}
                        </p>
                        <p className="text-[11px] text-slate-500">{log.admin?.email}</p>
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ring-1 ${tone}`}
                        >
                          {log.action}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        {log.targetUser ? (
                          <>
                            <p className="font-medium text-slate-800">
                              {log.targetUser.fullName || '—'}
                            </p>
                            <p className="text-[11px] text-slate-500">
                              {log.targetUser.email}
                            </p>
                          </>
                        ) : (
                          <span className="text-slate-400">Global / Multiple</span>
                        )}
                      </td>
                      <td className="px-3 py-3 font-mono text-[11px] text-slate-600">
                        {log.resourceType}
                        {log.resourceId ? ` · ${log.resourceId}` : ''}
                      </td>
                      <td className="px-3 py-3 font-mono text-[11px] text-slate-500">
                        {log.ipAddress || '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {log.timestamp
                          ? new Date(log.timestamp).toLocaleString()
                          : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs text-slate-600">
            <span>
              Page {pagination.page} of {pagination.totalPages} ({pagination.total} entries)
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 font-semibold hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Prev
              </button>
              <button
                type="button"
                disabled={page >= pagination.totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 font-semibold hover:bg-slate-50 disabled:opacity-40"
              >
                Next <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

export default AdminAuditLogsPage;
