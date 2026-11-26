import { API_BASE_URL, apiClient } from './apiClient.js';

/**
 * Receipt Generator API Service (`/api/receipts`)
 *
 * Uses `apiClient` so Bearer tokens, cross-origin credentials, and automatic
 * 401 token refresh work seamlessly while targeting `/api/receipts`.
 */

const RECEIPTS_BASE_URL = `${API_BASE_URL.replace(/\/api\/v1\/?$/i, '')}/api/receipts`;

export async function createReceiptApi(payload) {
  const res = await apiClient.post(RECEIPTS_BASE_URL, payload, { baseURL: '' });
  return res.data?.data || res.data?.receipt || res.data;
}

export async function getMyReceiptsApi(params = {}) {
  const res = await apiClient.get(`${RECEIPTS_BASE_URL}/my`, {
    baseURL: '',
    params,
  });
  return res.data?.data || res.data?.receipts || [];
}

export async function prefillReceiptFromInvoiceApi(invoiceId) {
  const res = await apiClient.get(
    `${RECEIPTS_BASE_URL}/prefill-invoice/${encodeURIComponent(invoiceId)}`,
    { baseURL: '' }
  );
  return res.data?.data || res.data;
}

export async function deleteReceiptApi(id) {
  const res = await apiClient.delete(
    `${RECEIPTS_BASE_URL}/${encodeURIComponent(id)}`,
    { baseURL: '' }
  );
  return res.data?.data || res.data;
}

export default {
  createReceiptApi,
  getMyReceiptsApi,
  prefillReceiptFromInvoiceApi,
  deleteReceiptApi,
};
