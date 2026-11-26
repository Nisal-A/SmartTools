import { API_BASE_URL, apiClient } from './apiClient.js';

/**
 * Supplier Directory API Service (`/api/suppliers`)
 *
 * Uses `apiClient` so Bearer tokens, cross-origin credentials, and automatic
 * 401 refresh work seamlessly while targeting `/api/suppliers`.
 */

const SUPPLIERS_BASE_URL = `${API_BASE_URL.replace(/\/api\/v1\/?$/i, '')}/api/suppliers`;

export async function listSuppliersApi(params = {}) {
  const res = await apiClient.get(SUPPLIERS_BASE_URL, {
    baseURL: '',
    params,
  });
  return res.data?.data || res.data?.suppliers || [];
}

export async function createSupplierApi(payload) {
  const res = await apiClient.post(SUPPLIERS_BASE_URL, payload, {
    baseURL: '',
  });
  return res.data?.data || res.data?.supplier || res.data;
}

export async function updateSupplierApi(id, payload) {
  const res = await apiClient.put(
    `${SUPPLIERS_BASE_URL}/${encodeURIComponent(id)}`,
    payload,
    { baseURL: '' }
  );
  return res.data?.data || res.data?.supplier || res.data;
}

export async function deleteSupplierApi(id) {
  const res = await apiClient.delete(
    `${SUPPLIERS_BASE_URL}/${encodeURIComponent(id)}`,
    { baseURL: '' }
  );
  return res.data?.data || res.data;
}

export default {
  listSuppliersApi,
  createSupplierApi,
  updateSupplierApi,
  deleteSupplierApi,
};
