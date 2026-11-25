import { apiClient } from './apiClient.js';

/**
 * Admin Governance API Service (`/api/v1/admin`)
 * Strictly accessible only to `role === 'admin'` users.
 */

export async function getAdminGlobalHistoryApi(params = {}) {
  const res = await apiClient.get('/admin/history', { params });
  return {
    items: Array.isArray(res.data?.data) ? res.data.data : [],
    pagination: res.data?.pagination || {
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 1,
    },
  };
}

export async function inspectAdminDocumentApi(type, id) {
  const res = await apiClient.get(`/admin/history/${type}/${id}`);
  return res.data?.data || res.data;
}

export async function listAdminUsersApi(params = {}) {
  const res = await apiClient.get('/admin/users', { params });
  return {
    users: Array.isArray(res.data?.data) ? res.data.data : [],
    pagination: res.data?.pagination || {
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 1,
    },
  };
}

export async function updateAdminUserRoleApi(userId, role) {
  const res = await apiClient.patch(`/admin/users/${userId}/role`, { role });
  return res.data?.data || res.data;
}

export async function toggleAdminUserStatusApi(userId, isActive) {
  const res = await apiClient.patch(`/admin/users/${userId}/status`, { isActive });
  return res.data?.data || res.data;
}

export async function listAdminAuditLogsApi(params = {}) {
  const res = await apiClient.get('/admin/audit-logs', { params });
  return {
    logs: Array.isArray(res.data?.data) ? res.data.data : [],
    pagination: res.data?.pagination || {
      page: 1,
      limit: 30,
      total: 0,
      totalPages: 1,
    },
  };
}

export default {
  getAdminGlobalHistoryApi,
  inspectAdminDocumentApi,
  listAdminUsersApi,
  updateAdminUserRoleApi,
  toggleAdminUserStatusApi,
  listAdminAuditLogsApi,
};
