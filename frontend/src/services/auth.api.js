import {
  apiClient,
  getStoredRefreshToken,
  performSessionRefresh,
} from './apiClient.js';

/**
 * Authentication API Service (`/api/v1/auth`)
 */

export async function registerApi({ fullName, email, password, businessName }) {
  const res = await apiClient.post('/auth/register', {
    fullName,
    email,
    password,
    businessName,
  });
  return {
    accessToken: res.data?.accessToken || res.data?.data?.accessToken || '',
    refreshToken: res.data?.refreshToken || res.data?.data?.refreshToken || '',
    user: res.data?.user || res.data?.data?.user || null,
  };
}

export async function loginApi({ email, password }) {
  const res = await apiClient.post('/auth/login', { email, password });
  return {
    accessToken: res.data?.accessToken || res.data?.data?.accessToken || '',
    refreshToken: res.data?.refreshToken || res.data?.data?.refreshToken || '',
    user: res.data?.user || res.data?.data?.user || null,
  };
}

export async function refreshApi() {
  return performSessionRefresh();
}

export async function logoutApi() {
  const fallbackRefreshToken = getStoredRefreshToken();
  const res = await apiClient.post(
    '/auth/logout',
    fallbackRefreshToken ? { refreshToken: fallbackRefreshToken } : {}
  );
  return res.data;
}

export async function getMeApi() {
  const res = await apiClient.get('/auth/me');
  return res.data?.data || res.data?.user || null;
}

export async function updatePinnedToolsApi(pinnedToolIds) {
  const res = await apiClient.patch('/auth/me/pinned-tools', { pinnedToolIds });
  return res.data?.data || res.data;
}

export async function updatePasswordApi({ currentPassword, newPassword }) {
  const res = await apiClient.patch('/auth/me/password', {
    currentPassword,
    newPassword,
  });
  return res.data;
}

export default {
  registerApi,
  loginApi,
  refreshApi,
  logoutApi,
  getMeApi,
  updatePinnedToolsApi,
  updatePasswordApi,
};
