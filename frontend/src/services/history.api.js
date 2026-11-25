import { apiClient } from './apiClient.js';

/**
 * Unified User History, Dashboard Summary & Saved Document PDF Service
 */

export async function getDashboardSummaryApi() {
  const res = await apiClient.get('/dashboard/summary');
  return res.data?.data || res.data;
}

export async function getUserHistoryApi(params = {}) {
  const res = await apiClient.get('/history', { params });
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

export async function exportDocumentPdfApi(type, id, params = {}) {
  const res = await apiClient.get(`/documents/${type}/${id}/pdf`, {
    params,
    responseType: 'blob',
  });
  return res;
}

/**
 * Triggers a browser download for a PDF Blob response.
 */
export function triggerPdfBlobDownload(response, fallbackFilename = 'document.pdf') {
  const disposition = response.headers?.['content-disposition'] || '';
  const match = disposition.match(/filename="?([^"]+)"?/i);
  const filename = match?.[1] || fallbackFilename;
  const blob =
    response.data instanceof Blob
      ? response.data
      : new Blob([response.data], { type: 'application/pdf' });

  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => window.URL.revokeObjectURL(url), 1500);
}

export default {
  getDashboardSummaryApi,
  getUserHistoryApi,
  exportDocumentPdfApi,
  triggerPdfBlobDownload,
};
