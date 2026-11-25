import { apiClient } from './apiClient.js';

export async function listInvoices(params = {}) {
  const res = await apiClient.get('/invoices', { params });
  return res.data;
}

export async function getInvoiceById(id) {
  const res = await apiClient.get(`/invoices/${id}`);
  return res.data?.data || res.data;
}

export async function createInvoice(payload) {
  const res = await apiClient.post('/invoices', payload);
  return res.data?.data || res.data;
}

export async function updateInvoice(id, payload) {
  const res = await apiClient.put(`/invoices/${id}`, payload);
  return res.data?.data || res.data;
}

export async function deleteInvoice(id) {
  const res = await apiClient.delete(`/invoices/${id}`);
  return res.data?.data || res.data;
}

export async function duplicateInvoice(id) {
  const res = await apiClient.post(`/invoices/${id}/duplicate`);
  return res.data?.data || res.data;
}

export async function recordInvoicePayment(id, paymentPayload) {
  const res = await apiClient.post(`/invoices/${id}/payments`, paymentPayload);
  return res.data;
}

export async function downloadInvoicePdf(id, params = {}) {
  return apiClient.get(`/invoices/${id}/pdf`, {
    params,
    responseType: 'blob',
  });
}

export default {
  listInvoices,
  getInvoiceById,
  createInvoice,
  updateInvoice,
  deleteInvoice,
  duplicateInvoice,
  recordInvoicePayment,
  downloadInvoicePdf,
};
