import { API_BASE_URL, apiClient } from './apiClient.js';

/**
 * Admin Governance API Service (`/api/v1/admin` & module `/admin` endpoints)
 * Strictly accessible only to `role === 'admin'` users.
 */

const ROOT_API_URL = API_BASE_URL.replace(/\/api\/v1\/?$/i, '');

function normalizePaginatedAdminResponse(res) {
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

export async function getAdminGlobalHistoryApi(params = {}) {
  const res = await apiClient.get('/admin/history', { params });
  return normalizePaginatedAdminResponse(res);
}

export async function getAdminReceiptsApi(params = {}) {
  const res = await apiClient.get(`${ROOT_API_URL}/api/receipts/admin`, {
    baseURL: '',
    params,
  });
  return normalizePaginatedAdminResponse(res);
}

export async function getAdminPurchaseOrdersApi(params = {}) {
  const res = await apiClient.get(`${ROOT_API_URL}/api/purchase-orders/admin`, {
    baseURL: '',
    params,
  });
  return normalizePaginatedAdminResponse(res);
}

export async function getAdminExpensesApi(params = {}) {
  const res = await apiClient.get(`${ROOT_API_URL}/api/expenses/admin`, {
    baseURL: '',
    params,
  });
  return normalizePaginatedAdminResponse(res);
}

export async function getAdminProposalsApi(params = {}) {
  const res = await apiClient.get(`${ROOT_API_URL}/api/proposals/admin`, {
    baseURL: '',
    params,
  });
  return normalizePaginatedAdminResponse(res);
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
  getAdminReceiptsApi,
  getAdminPurchaseOrdersApi,
  getAdminExpensesApi,
  getAdminProposalsApi,
  inspectAdminDocumentApi,
  listAdminUsersApi,
  updateAdminUserRoleApi,
  toggleAdminUserStatusApi,
  listAdminAuditLogsApi,
};
