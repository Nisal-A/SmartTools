import { API_BASE_URL, apiClient } from './apiClient.js';

/**
 * Purchase Order Generator API Service (`/api/purchase-orders`)
 *
 * Uses `apiClient` so Bearer tokens, cross-origin credentials, and automatic
 * 401 refresh work seamlessly while targeting `/api/purchase-orders`.
 */

const PO_BASE_URL = `${API_BASE_URL.replace(/\/api\/v1\/?$/i, '')}/api/purchase-orders`;

export async function createPurchaseOrderApi(payload) {
  const res = await apiClient.post(PO_BASE_URL, payload, {
    baseURL: '',
  });
  return res.data?.data || res.data?.purchaseOrder || res.data;
}

export async function getMyPurchaseOrdersApi(params = {}) {
  const res = await apiClient.get(`${PO_BASE_URL}/my`, {
    baseURL: '',
    params,
  });
  return res.data?.data || res.data?.purchaseOrders || [];
}

export async function deletePurchaseOrderApi(id) {
  const res = await apiClient.delete(
    `${PO_BASE_URL}/${encodeURIComponent(id)}`,
    { baseURL: '' }
  );
  return res.data?.data || res.data;
}

export default {
  createPurchaseOrderApi,
  getMyPurchaseOrdersApi,
  deletePurchaseOrderApi,
};
