import { apiClient } from './apiClient.js';

/**
 * Shared Customers Directory API Service (`/api/v1/customers`)
 */

export async function listCustomersApi(params = {}) {
  const res = await apiClient.get('/customers', { params });
  return {
    customers: Array.isArray(res.data?.data) ? res.data.data : [],
    pagination: res.data?.pagination || {
      page: 1,
      limit: 50,
      total: 0,
      totalPages: 1,
    },
  };
}

export async function createCustomerApi(payload) {
  const res = await apiClient.post('/customers', payload);
  return res.data?.data || res.data;
}

export async function getCustomerByIdApi(id) {
  const res = await apiClient.get(`/customers/${id}`);
  return res.data?.data || res.data;
}

export async function updateCustomerApi(id, payload) {
  const res = await apiClient.put(`/customers/${id}`, payload);
  return res.data?.data || res.data;
}

export async function deleteCustomerApi(id) {
  const res = await apiClient.delete(`/customers/${id}`);
  return res.data;
}

export default {
  listCustomersApi,
  createCustomerApi,
  getCustomerByIdApi,
  updateCustomerApi,
  deleteCustomerApi,
};
