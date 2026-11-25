import { apiClient } from './apiClient.js';

export async function listQuotations(params = {}) {
  const res = await apiClient.get('/quotations', { params });
  return res.data;
}

export async function getQuotationById(id) {
  const res = await apiClient.get(`/quotations/${id}`);
  return res.data?.data || res.data;
}

export async function createQuotation(payload) {
  const res = await apiClient.post('/quotations', payload);
  return res.data?.data || res.data;
}

export async function updateQuotation(id, payload) {
  const res = await apiClient.put(`/quotations/${id}`, payload);
  return res.data?.data || res.data;
}

export async function deleteQuotation(id) {
  const res = await apiClient.delete(`/quotations/${id}`);
  return res.data?.data || res.data;
}

export async function duplicateQuotation(id) {
  const res = await apiClient.post(`/quotations/${id}/duplicate`);
  return res.data?.data || res.data;
}

export async function convertQuotationToInvoice(id, overrides = {}) {
  const res = await apiClient.post(`/quotations/${id}/convert-to-invoice`, overrides);
  return res.data?.data || res.data;
}

export async function downloadQuotationPdf(id, params = {}) {
  return apiClient.get(`/quotations/${id}/pdf`, {
    params,
    responseType: 'blob',
  });
}

export default {
  listQuotations,
  getQuotationById,
  createQuotation,
  updateQuotation,
  deleteQuotation,
  duplicateQuotation,
  convertQuotationToInvoice,
  downloadQuotationPdf,
};
