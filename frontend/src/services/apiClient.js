import axios from 'axios';

/**
 * Sanitizes `VITE_API_BASE_URL` against accidental quotes, trailing slashes,
 * Markdown hyperlink formatting (e.g. `[https://...](https://...)`), missing `/api/v1`
 * on bare host origins, or duplicate `/api/v1/api/v1` suffixes.
 */
export function normalizeApiBaseUrl(rawUrl) {
  let cleaned = String(rawUrl || '')
    .trim()
    .replace(/^['"]+|['"]+$/g, '')
    .trim();

  const mdMatch = cleaned.match(/\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/i);
  if (mdMatch) {
    cleaned = mdMatch[1].trim();
  } else if (cleaned.startsWith('<') && cleaned.endsWith('>')) {
    cleaned = cleaned.slice(1, -1).trim();
  }

  cleaned = cleaned.replace(/\/+$/, '');
  if (!cleaned) return '/api/v1';

  // Collapse accidental duplicate `/api/v1/api/v1`
  cleaned = cleaned.replace(/(\/api\/v1)+$/i, '/api/v1');

  // If a full http(s) origin was supplied without any path (e.g. `https://smarttools-api.onrender.com`),
  // append `/api/v1` automatically so auth & resource calls never 404.
  if (/^https?:\/\/[^/]+$/i.test(cleaned)) {
    cleaned = `${cleaned}/api/v1`;
  }

  return cleaned;
}

export const API_BASE_URL = normalizeApiBaseUrl(import.meta.env.VITE_API_BASE_URL);

const ACCESS_TOKEN_STORAGE_KEY = 'smarttools_access_token';
const REFRESH_TOKEN_STORAGE_KEY = 'smarttools_refresh_token';
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

export function getStoredRefreshToken() {
  try {
    return window.localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function setStoredRefreshToken(token) {
  try {
    if (token) {
      window.localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, token);
      window.localStorage.setItem(SESSION_HINT_STORAGE_KEY, '1');
    } else {
      window.localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
    }
  } catch {
    // Ignore storage quota / private mode errors
  }
}

export function hasSessionHint() {
  try {
    return (
      window.localStorage.getItem(SESSION_HINT_STORAGE_KEY) === '1' ||
      Boolean(window.localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY))
    );
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
  setStoredRefreshToken('');
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

/**
 * Single-flight refresh promise shared by BOTH `AuthContext.refreshUser()` and
 * Axios's 401 response interceptor so React 18 `<StrictMode>` double-mounts or
 * concurrent 401 responses never send two simultaneous `/auth/refresh` requests
 * with the same single-use rotated refresh token.
 */
let activeRefreshPromise = null;

export async function performSessionRefresh() {
  if (activeRefreshPromise) {
    return activeRefreshPromise;
  }

  activeRefreshPromise = (async () => {
    const fallbackRefreshToken = getStoredRefreshToken();
    const refreshResponse = await axios.post(
      `${API_BASE_URL}/auth/refresh`,
      fallbackRefreshToken ? { refreshToken: fallbackRefreshToken } : {},
      { withCredentials: true }
    );

    const payload = refreshResponse.data || {};
    const newAccessToken = payload.accessToken || payload.data?.accessToken || '';
    const newRefreshToken = payload.refreshToken || payload.data?.refreshToken || '';
    const refreshedUser = payload.user || payload.data?.user || null;

    if (!newAccessToken) {
      throw new Error('Refresh response did not return an access token');
    }

    setStoredAccessToken(newAccessToken);
    if (newRefreshToken) {
      setStoredRefreshToken(newRefreshToken);
    }
    setSessionHint(true);

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      user: refreshedUser,
    };
  })();

  try {
    return await activeRefreshPromise;
  } finally {
    activeRefreshPromise = null;
  }
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

    originalRequest._retry = true;

    try {
      const { accessToken: newToken } = await performSessionRefresh();
      originalRequest.headers = originalRequest.headers || {};
      originalRequest.headers.Authorization = `Bearer ${newToken}`;
      return apiClient(originalRequest);
    } catch (refreshError) {
      const refreshStatus = refreshError?.response?.status;
      if (refreshStatus === 401 || refreshStatus === 403) {
        clearAuthStorage();
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
        }
      }
      return Promise.reject(refreshError);
    }
  }
);

export default apiClient;
