import { API_BASE_URL, apiClient } from './apiClient.js';

/**
 * Expense Tracker & Category Budgets API Service (`/api/expenses`)
 *
 * Uses `apiClient` so Bearer access tokens, credentials, and automatic
 * 401 refresh work identically to the rest of the workspace.
 */

const EXPENSES_BASE_URL = `${API_BASE_URL.replace(/\/api\/v1\/?$/i, '')}/api/expenses`;

export const EXPENSE_CATEGORIES = [
  'Travel',
  'Office Supplies',
  'Software & Subscriptions',
  'Utilities',
  'Marketing',
  'Meals & Entertainment',
  'Equipment',
  'Contractors',
  'Other',
];

export const EXPENSE_PAYMENT_METHODS = [
  'Cash',
  'Card',
  'Bank Transfer',
  'Other',
];

export const EXPENSE_CURRENCIES = [
  'LKR',
  'USD',
  'EUR',
  'GBP',
  'INR',
  'AUD',
  'SGD',
  'AED',
];

export const MAX_RECEIPT_FILE_BYTES = 5 * 1024 * 1024;
export const ALLOWED_RECEIPT_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
];

export async function listExpensesApi(params = {}) {
  const res = await apiClient.get(EXPENSES_BASE_URL, {
    baseURL: '',
    params,
  });
  return res.data?.data || res.data?.expenses || [];
}

export async function getExpenseSummaryApi(month) {
  const res = await apiClient.get(`${EXPENSES_BASE_URL}/summary`, {
    baseURL: '',
    params: month ? { month } : {},
  });
  return res.data?.data || res.data;
}

export async function createExpenseApi(formData) {
  const res = await apiClient.post(EXPENSES_BASE_URL, formData, {
    baseURL: '',
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return res.data?.data || res.data?.expense || res.data;
}

export async function updateExpenseApi(id, formData) {
  const res = await apiClient.put(
    `${EXPENSES_BASE_URL}/${encodeURIComponent(id)}`,
    formData,
    {
      baseURL: '',
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }
  );
  return res.data?.data || res.data?.expense || res.data;
}

export async function deleteExpenseApi(id) {
  const res = await apiClient.delete(
    `${EXPENSES_BASE_URL}/${encodeURIComponent(id)}`,
    { baseURL: '' }
  );
  return res.data?.data || res.data;
}

export async function upsertCategoryBudgetsApi(payload) {
  const res = await apiClient.put(`${EXPENSES_BASE_URL}/budgets`, payload, {
    baseURL: '',
  });
  return res.data?.data || res.data;
}

export default {
  EXPENSE_CATEGORIES,
  EXPENSE_PAYMENT_METHODS,
  EXPENSE_CURRENCIES,
  MAX_RECEIPT_FILE_BYTES,
  ALLOWED_RECEIPT_MIME_TYPES,
  listExpensesApi,
  getExpenseSummaryApi,
  createExpenseApi,
  updateExpenseApi,
  deleteExpenseApi,
  upsertCategoryBudgetsApi,
};
