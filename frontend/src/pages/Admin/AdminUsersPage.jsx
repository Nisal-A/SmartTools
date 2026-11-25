import React, { useCallback, useEffect, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Search,
  Shield,
  ShieldCheck,
  UserCheck,
  UserX,
} from 'lucide-react';
import {
  listAdminUsersApi,
  toggleAdminUserStatusApi,
  updateAdminUserRoleApi,
} from '../../services/admin.api.js';
import { useAuth } from '../../app/AuthContext.jsx';

export function AdminUsersPage() {
  const { user: currentAdmin, showToast } = useAuth();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [page, setPage] = useState(1);

  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [pendingAction, setPendingAction] = useState(null);
  const [isApplying, setIsApplying] = useState(false);

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await listAdminUsersApi({
        page,
        limit: 20,
        ...(search.trim() ? { search: search.trim() } : {}),
        ...(roleFilter ? { role: roleFilter } : {}),
      });
      setUsers(res.users);
      setPagination(res.pagination);
    } catch (err) {
      showToast(err.response?.data?.message || 'Unable to load users.', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [page, search, roleFilter, showToast]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      fetchUsers();
    }, 200);
    return () => window.clearTimeout(timer);
  }, [fetchUsers]);

  const executeConfirmedAction = async () => {
    if (!pendingAction) return;
    setIsApplying(true);
    try {
      if (pendingAction.type === 'role') {
        await updateAdminUserRoleApi(pendingAction.user.id, pendingAction.nextRole);
        showToast(
          `Updated ${pendingAction.user.email} role to ${pendingAction.nextRole}.`,
          'success'
        );
      } else if (pendingAction.type === 'status') {
        await toggleAdminUserStatusApi(pendingAction.user.id, pendingAction.nextIsActive);
        showToast(
          `${pendingAction.nextIsActive ? 'Reactivated' : 'Suspended'} ${pendingAction.user.email}.`,
          'info'
        );
      }
      setPendingAction(null);
      fetchUsers();
    } catch (err) {
      showToast(err.response?.data?.message || 'Action failed.', 'error');
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="space-y-5" data-testid="admin-users-page">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-violet-600">
          <ShieldCheck className="h-4 w-4" /> User Governance
        </div>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900">
          Platform Users & Roles
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          View registered accounts, document volumes, and safely promote/demote administrators or toggle account status.
        </p>

        <div className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row">
          <div className="relative flex-1 max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search user name or email…"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs focus:border-violet-500 focus:bg-white focus:outline-none"
            />
          </div>

          <select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700"
          >
            <option value="">All Roles</option>
            <option value="user">Standard Users</option>
            <option value="admin">Administrators</option>
          </select>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-14 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin text-violet-600" /> Loading users…
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm" data-testid="admin-users-table">
              <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">User</th>
                  <th className="px-3 py-3">Role</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3 text-right">Invoices</th>
                  <th className="px-3 py-3 text-right">Quotations</th>
                  <th className="px-3 py-3">Last Login</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => {
                  const isSelf = String(u.id) === String(currentAdmin?.id);
                  return (
                    <tr key={u.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-900">
                          {u.fullName}{' '}
                          {isSelf && (
                            <span className="ml-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">
                              You
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-slate-500">{u.email}</p>
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                            u.role === 'admin'
                              ? 'bg-violet-50 text-violet-700 ring-1 ring-violet-200'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {u.role === 'admin' && <Shield className="h-3 w-3" />}
                          {u.role}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                            u.isActive
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-rose-50 text-rose-700'
                          }`}
                        >
                          {u.isActive ? 'Active' : 'Suspended'}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right font-semibold text-slate-700">
                        {u.invoiceCount}
                      </td>
                      <td className="px-3 py-3 text-right font-semibold text-slate-700">
                        {u.quotationCount}
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-500">
                        {u.lastLoginAt
                          ? new Date(u.lastLoginAt).toLocaleString()
                          : 'Never'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={isSelf && u.role === 'admin'}
                            onClick={() =>
                              setPendingAction({
                                type: 'role',
                                user: u,
                                nextRole: u.role === 'admin' ? 'user' : 'admin',
                              })
                            }
                            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {u.role === 'admin' ? 'Demote' : 'Make Admin'}
                          </button>
                          <button
                            type="button"
                            disabled={isSelf && u.isActive}
                            onClick={() =>
                              setPendingAction({
                                type: 'status',
                                user: u,
                                nextIsActive: !u.isActive,
                              })
                            }
                            className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-40 ${
                              u.isActive
                                ? 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                            }`}
                          >
                            {u.isActive ? (
                              <>
                                <UserX className="h-3.5 w-3.5" /> Suspend
                              </>
                            ) : (
                              <>
                                <UserCheck className="h-3.5 w-3.5" /> Reactivate
                              </>
                            )}
                          </button>
                        </div>
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
              Page {pagination.page} of {pagination.totalPages} ({pagination.total} users)
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

      {/* Confirmation Dialog */}
      {pendingAction && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
            <h3 className="text-base font-bold text-slate-900">Confirm Governance Action</h3>
            <p className="mt-1.5 text-sm text-slate-600">
              {pendingAction.type === 'role'
                ? `Change ${pendingAction.user.email}'s role to "${pendingAction.nextRole}"?`
                : `${pendingAction.nextIsActive ? 'Reactivate' : 'Suspend'} account ${pendingAction.user.email}?`}
            </p>
            <p className="mt-2 text-xs text-slate-400">
              This change will be recorded in the Admin Audit Logs.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingAction(null)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isApplying}
                onClick={executeConfirmedAction}
                className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
              >
                {isApplying && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminUsersPage;
