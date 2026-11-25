import { apiClient } from './apiClient.js';

const SEO_CLIENT_ID_STORAGE_KEY = 'smarttools_seo_client_id';

/**
 * Generates or retrieves a stable browser-scoped anonymous client ID for guest
 * SEO audits so a guest can immediately view their just-generated report.
 */
export function getSeoClientId() {
  try {
    let existing = window.localStorage.getItem(SEO_CLIENT_ID_STORAGE_KEY);
    if (existing && /^[a-zA-Z0-9_-]{8,64}$/.test(existing)) {
      return existing;
    }
    const randomPart =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID().replace(/-/g, '')
        : `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
    existing = `seo_${randomPart}`.slice(0, 64);
    window.localStorage.setItem(SEO_CLIENT_ID_STORAGE_KEY, existing);
    return existing;
  } catch {
    return 'anonymous-public';
  }
}

function withClientHeader(extraConfig = {}) {
  return {
    ...extraConfig,
    headers: {
      ...(extraConfig.headers || {}),
      'X-Client-Id': getSeoClientId(),
    },
  };
}

function normalizeSeoError(err) {
  const data = err?.response?.data;
  const code = data?.error?.code || err?.code || 'INTERNAL_ERROR';
  const message =
    data?.error?.message ||
    data?.message ||
    err?.message ||
    'Unable to complete SEO Analyzer request.';
  const normalized = new Error(message);
  normalized.code = code;
  normalized.status = err?.response?.status;
  return normalized;
}

export const analyzeUrl = async (url, { signal } = {}) => {
  try {
    const response = await apiClient.post(
      '/seo/analyze',
      { url },
      withClientHeader({ signal })
    );
    return response.data?.data;
  } catch (err) {
    if (err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED') throw err;
    throw normalizeSeoError(err);
  }
};

export const getAudits = async ({ page = 1, limit = 10, search = '', signal } = {}) => {
  try {
    const params = { page, limit };
    if (typeof search === 'string' && search.trim() !== '') {
      params.search = search.trim();
    }
    const response = await apiClient.get('/seo/audits', { params, signal });
    return {
      items: response.data?.data ?? [],
      meta: response.data?.meta ?? { page: 1, limit, total: 0, totalPages: 0 },
    };
  } catch (err) {
    if (err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED') throw err;
    throw normalizeSeoError(err);
  }
};

export const getAuditById = async (id, { signal } = {}) => {
  try {
    const response = await apiClient.get(
      `/seo/audits/${encodeURIComponent(id)}`,
      withClientHeader({ signal })
    );
    return response.data?.data;
  } catch (err) {
    if (err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED') throw err;
    throw normalizeSeoError(err);
  }
};

export const getGlobalStats = async ({ signal } = {}) => {
  try {
    const response = await apiClient.get('/seo/stats', { signal });
    return response.data?.data;
  } catch (err) {
    if (err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED') throw err;
    throw normalizeSeoError(err);
  }
};

export const deleteAudit = async (id) => {
  try {
    await apiClient.delete(`/seo/audits/${encodeURIComponent(id)}`);
    return true;
  } catch (err) {
    throw normalizeSeoError(err);
  }
};

export default {
  analyzeUrl,
  getAudits,
  getAuditById,
  getGlobalStats,
  deleteAudit,
  getSeoClientId,
};
