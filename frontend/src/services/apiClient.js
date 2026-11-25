import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

const ACCESS_TOKEN_STORAGE_KEY = 'smarttools_access_token';
const SESSION_HINT_STORAGE_KEY = 'smarttools_has_session';
export const SESSION_EXPIRED_EVENT = 'smarttools:session-expired';

export function getStoredAccessToken() {
  try {
    return window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function setStoredAccessToken(token) {
  try {
    if (token) {
      window.localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, token);
      window.localStorage.setItem(SESSION_HINT_STORAGE_KEY, '1');
    } else {
      window.localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
    }
  } catch {
    // Ignore storage quota / private mode errors
  }
}

export function hasSessionHint() {
  try {
    return window.localStorage.getItem(SESSION_HINT_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function setSessionHint(active) {
  try {
    if (active) {
      window.localStorage.setItem(SESSION_HINT_STORAGE_KEY, '1');
    } else {
      window.localStorage.removeItem(SESSION_HINT_STORAGE_KEY);
    }
  } catch {
    // Ignore storage errors
  }
}

export function clearAuthStorage() {
  setStoredAccessToken('');
  setSessionHint(false);
}

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: attach Bearer access token
apiClient.interceptors.request.use((config) => {
  const token = getStoredAccessToken();
  if (token && !config.headers?.Authorization) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor: automatic 401 refresh-token queue
let isRefreshing = false;
let failedQueue = [];

function processQueue(error, token = null) {
  for (const pending of failedQueue) {
    if (error) {
      pending.reject(error);
    } else {
      pending.resolve(token);
    }
  }
  failedQueue = [];
}

function isAuthEndpoint(url = '') {
  return (
    url.includes('/auth/login') ||
    url.includes('/auth/register') ||
    url.includes('/auth/refresh') ||
    url.includes('/auth/logout')
  );
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const status = error.response?.status;

    if (
      status !== 401 ||
      !originalRequest ||
      originalRequest._retry ||
      isAuthEndpoint(originalRequest.url || '')
    ) {
      return Promise.reject(error);
    }

    // Only attempt refresh if the user actually had a session
    if (!getStoredAccessToken() && !hasSessionHint()) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      })
        .then((newToken) => {
          originalRequest._retry = true;
          originalRequest.headers = originalRequest.headers || {};
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return apiClient(originalRequest);
        })
        .catch((queueErr) => Promise.reject(queueErr));
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      const refreshResponse = await axios.post(
        `${API_BASE_URL}/auth/refresh`,
        {},
        { withCredentials: true }
      );
      const newToken =
        refreshResponse.data?.accessToken ||
        refreshResponse.data?.data?.accessToken ||
        '';

      if (!newToken) {
        throw new Error('Refresh response did not return an access token');
      }

      setStoredAccessToken(newToken);
      processQueue(null, newToken);

      originalRequest.headers = originalRequest.headers || {};
      originalRequest.headers.Authorization = `Bearer ${newToken}`;
      return apiClient(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError, null);
      clearAuthStorage();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
      }
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

export default apiClient;
