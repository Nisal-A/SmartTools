import { API_BASE_URL, apiClient } from './apiClient.js';

/**
 * AI Proposal Writer API Service (`/api/proposals`)
 *
 * Uses `apiClient` so Bearer access tokens, credentials, and automatic
 * 401 refresh work identically to other protected workspace modules.
 */

const PROPOSALS_BASE_URL = `${API_BASE_URL.replace(/\/api\/v1\/?$/i, '')}/api/proposals`;

export const PROPOSAL_TONES = [
  'Professional',
  'Consultative',
  'Executive',
  'Friendly',
];

export const PROPOSAL_CURRENCIES = [
  'LKR',
  'USD',
  'EUR',
  'GBP',
  'INR',
  'AUD',
  'CAD',
];

export const PROPOSAL_STATUSES = ['Draft', 'Sent', 'Handed Off'];

export const QUOTATION_HANDOFF_STORAGE_KEY = 'smarttools_quotation_handoff';

export async function generateProposalApi(payload) {
  const res = await apiClient.post(`${PROPOSALS_BASE_URL}/generate`, payload, {
    baseURL: '',
  });
  return res.data?.data || res.data;
}

export async function createProposalApi(payload) {
  const res = await apiClient.post(PROPOSALS_BASE_URL, payload, {
    baseURL: '',
  });
  return res.data?.data || res.data?.proposal || res.data;
}

export async function getMyProposalsApi(params = {}) {
  const res = await apiClient.get(`${PROPOSALS_BASE_URL}/my`, {
    baseURL: '',
    params,
  });
  return res.data?.data || res.data?.proposals || [];
}

export async function getProposalByIdApi(id) {
  const res = await apiClient.get(
    `${PROPOSALS_BASE_URL}/${encodeURIComponent(id)}`,
    { baseURL: '' }
  );
  return res.data?.data || res.data?.proposal || res.data;
}

export async function updateProposalApi(id, payload) {
  const res = await apiClient.put(
    `${PROPOSALS_BASE_URL}/${encodeURIComponent(id)}`,
    payload,
    { baseURL: '' }
  );
  return res.data?.data || res.data?.proposal || res.data;
}

export async function deleteProposalApi(id) {
  const res = await apiClient.delete(
    `${PROPOSALS_BASE_URL}/${encodeURIComponent(id)}`,
    { baseURL: '' }
  );
  return res.data?.data || res.data;
}

export default {
  PROPOSAL_TONES,
  PROPOSAL_CURRENCIES,
  PROPOSAL_STATUSES,
  QUOTATION_HANDOFF_STORAGE_KEY,
  generateProposalApi,
  createProposalApi,
  getMyProposalsApi,
  getProposalByIdApi,
  updateProposalApi,
  deleteProposalApi,
};
