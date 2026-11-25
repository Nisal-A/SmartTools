import { apiClient } from './apiClient.js';

/**
 * Profile Management API Service (`/api/v1/profiles`)
 */

export async function getMyProfilesApi() {
  const res = await apiClient.get('/profiles/me');
  return res.data?.data || { personalProfile: null, businessProfile: null };
}

export async function updatePersonalProfileApi(payload) {
  const res = await apiClient.put('/profiles/personal', payload);
  return res.data?.data || res.data;
}

export async function updateBusinessProfileApi(payload) {
  const res = await apiClient.put('/profiles/business', payload);
  return res.data?.data || res.data;
}

export async function uploadBusinessLogoApi(file) {
  const formData = new FormData();
  formData.append('logo', file);
  const res = await apiClient.post('/profiles/business/logo', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return res.data?.data || res.data;
}

export default {
  getMyProfilesApi,
  updatePersonalProfileApi,
  updateBusinessProfileApi,
  uploadBusinessLogoApi,
};
